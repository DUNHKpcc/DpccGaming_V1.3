import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const execFileAsync = promisify(execFile)
const projectRoot = process.cwd()
const tutorialDir = path.join(projectRoot, 'public/teaching/blueprint')
const tutorialAssets = ['blueprint1', 'blueprint2', 'blueprint3', 'blueprint4']
const frameRate = 30

const outputProfiles = [
  {
    extension: 'webm',
    mimeType: 'video/webm;codecs=vp9',
    fallbackMimeType: 'video/webm',
    videoBitsPerSecond: 1_200_000
  },
  {
    extension: 'mp4',
    mimeType: 'video/mp4;codecs=avc1',
    fallbackMimeType: 'video/mp4',
    videoBitsPerSecond: 1_500_000
  }
]

const formatBytes = (size) => {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(2)} KB`
  return `${size} B`
}

const removeDirSafe = async (targetDir) => {
  await fs.rm(targetDir, { recursive: true, force: true })
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png'
}

const startStaticServer = async (rootDir) => {
  const server = http.createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
      const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1)
      const filePath = path.resolve(rootDir, relativePath)

      if (!filePath.startsWith(path.resolve(rootDir) + path.sep) && filePath !== path.resolve(rootDir, 'index.html')) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }

      const body = await fs.readFile(filePath)
      const extension = path.extname(filePath).toLowerCase()
      response.writeHead(200, {
        'Content-Type': mimeTypes[extension] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      })
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve temporary tutorial media server address.')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }
}

const extractGifFrames = async (gifPath) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-tutorial-'))
  const manifestPath = path.join(tempDir, 'manifest.json')
  const extractorPath = path.join(projectRoot, 'scripts', 'extract-blueprint-tutorial-frames.py')

  await execFileAsync('python3', [extractorPath, gifPath, tempDir, manifestPath], {
    cwd: projectRoot,
    maxBuffer: 32 * 1024 * 1024
  })
  await fs.writeFile(
    path.join(tempDir, 'index.html'),
    '<!doctype html><html><body style="margin:0;background:#fff;"></body></html>',
    'utf8'
  )

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  return {
    tempDir,
    manifest,
    cleanup: () => removeDirSafe(tempDir)
  }
}

const ensureMimeType = async (page, profile) => {
  const supportedMimeType = await page.evaluate((profileInput) => {
    if (typeof MediaRecorder !== 'function') return ''
    if (MediaRecorder.isTypeSupported(profileInput.mimeType)) return profileInput.mimeType
    if (MediaRecorder.isTypeSupported(profileInput.fallbackMimeType)) return profileInput.fallbackMimeType
    return ''
  }, profile)

  if (!supportedMimeType) {
    throw new Error(`MediaRecorder does not support ${profile.mimeType}`)
  }

  return supportedMimeType
}

const writeDataUrlToFile = async (dataUrl, outputPath) => {
  const [, base64 = ''] = dataUrl.split(',', 2)
  await fs.writeFile(outputPath, Buffer.from(base64, 'base64'))
}

const recordTutorialMedia = async (
  page,
  { frameSources, width, height, mimeType, videoBitsPerSecond, posterSource }
) => {
  await page.setViewportSize({ width, height })

  return page.evaluate(async (payload) => {
    const loadImage = (src) => new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(`Failed to load frame: ${src}`))
      image.src = src
    })

    const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Failed to read MediaRecorder output.'))
      reader.readAsDataURL(blob)
    })

    const canvas = document.createElement('canvas')
    canvas.width = payload.width
    canvas.height = payload.height
    const context = canvas.getContext('2d', { alpha: false })

    if (!context) {
      throw new Error('Unable to create 2D canvas context.')
    }

    const drawFrame = (image) => {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, payload.width, payload.height)
      context.drawImage(image, 0, 0, payload.width, payload.height)
    }

    const posterImage = await loadImage(payload.posterSource)
    drawFrame(posterImage)
    const posterDataUrl = canvas.toDataURL('image/jpeg', 0.84)

    const stream = canvas.captureStream(payload.frameRate)
    const recorder = new MediaRecorder(stream, {
      mimeType: payload.mimeType,
      videoBitsPerSecond: payload.videoBitsPerSecond
    })
    const chunks = []

    const resultPromise = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onerror = () => reject(new Error('MediaRecorder failed to encode the tutorial video.'))

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: payload.mimeType })
          resolve({
            posterDataUrl,
            videoDataUrl: await readAsDataUrl(blob)
          })
        } catch (error) {
          reject(error)
        }
      }
    })

    recorder.start(250)
    let nextImagePromise = loadImage(payload.frameSources[0].src)

    for (let index = 0; index < payload.frameSources.length; index += 1) {
      const frame = payload.frameSources[index]
      const image = await nextImagePromise
      nextImagePromise = payload.frameSources[index + 1]
        ? loadImage(payload.frameSources[index + 1].src)
        : null

      const frameDeadline = performance.now() + frame.durationMs
      do {
        drawFrame(image)
        await new Promise((resolve) => window.requestAnimationFrame(resolve))
      } while (performance.now() < frameDeadline)
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120))
    recorder.stop()
    return resultPromise
  }, {
    frameSources,
    width,
    height,
    mimeType,
    videoBitsPerSecond,
    posterSource,
    frameRate
  })
}

const main = async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    for (const assetName of tutorialAssets) {
      const gifPath = path.join(tutorialDir, `${assetName}.gif`)
      const extracted = await extractGifFrames(gifPath)
      const staticServer = await startStaticServer(extracted.tempDir)

      try {
        const { manifest } = extracted
        await page.goto(`${staticServer.baseUrl}/index.html`)
        const frameSources = manifest.frames.map((frame) => ({
          src: frame.file,
          durationMs: frame.durationMs
        }))
        const posterSource = manifest.posterFile

        console.log(
          `Converting ${assetName}.gif (${manifest.width}x${manifest.height}, ${manifest.frames.length} frames)`
        )

        let posterWritten = false

        for (const profile of outputProfiles) {
          const mimeType = await ensureMimeType(page, profile)
          const { posterDataUrl, videoDataUrl } = await recordTutorialMedia(page, {
            frameSources,
            width: manifest.width,
            height: manifest.height,
            mimeType,
            videoBitsPerSecond: profile.videoBitsPerSecond,
            posterSource
          })

          if (!posterWritten) {
            await writeDataUrlToFile(posterDataUrl, path.join(tutorialDir, `${assetName}.jpg`))
            posterWritten = true
          }

          const outputPath = path.join(tutorialDir, `${assetName}.${profile.extension}`)
          await writeDataUrlToFile(videoDataUrl, outputPath)
          const stat = await fs.stat(outputPath)
          console.log(`  -> ${path.basename(outputPath)} ${formatBytes(stat.size)}`)
        }
      } finally {
        await staticServer.close()
        await extracted.cleanup()
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
