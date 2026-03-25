export const DEFAULT_IMAGE_COMPRESS_CONFIG = {
  maxSize: 320,        // 最大边长
  quality: 0.82,       // WebP 质量 (0-1)
  mimeType: 'image/webp'
}

/**
 * 压缩图片为 WebP 格式的 DataURL
 * @param {File|Blob} file - 图片文件
 * @param {Object} options - 压缩配置
 * @param {number} options.maxSize - 最大边长，默认 320
 * @param {number} options.quality - WebP 质量，默认 0.82
 * @returns {Promise<string>} - WebP DataURL
 */
export function compressImageToWebpDataUrl(file, options = {}) {
  const {
    maxSize = DEFAULT_IMAGE_COMPRESS_CONFIG.maxSize,
    quality = DEFAULT_IMAGE_COMPRESS_CONFIG.quality
  } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const image = new Image()

      image.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))

        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('当前浏览器不支持图片压缩'))
          return
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('图片压缩失败'))
            return
          }

          const blobReader = new FileReader()
          blobReader.onload = () => resolve(String(blobReader.result || ''))
          blobReader.onerror = () => reject(new Error('图片读取失败'))
          blobReader.readAsDataURL(blob)
        }, 'image/webp', quality)
      }

      image.onerror = () => reject(new Error('图片加载失败'))
      image.src = String(reader.result || '')
    }

    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 压缩图片为 Blob
 * @param {File|Blob} file - 图片文件
 * @param {Object} options - 压缩配置
 * @param {number} options.maxSize - 最大边长
 * @param {number} options.quality - WebP 质量
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export function compressImageToBlob(file, options = {}) {
  const {
    maxSize = DEFAULT_IMAGE_COMPRESS_CONFIG.maxSize,
    quality = DEFAULT_IMAGE_COMPRESS_CONFIG.quality
  } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const image = new Image()

      image.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('当前浏览器不支持图片压缩'))
          return
        }

        context.drawImage(image, 0, 0, width, height)

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('图片压缩失败'))
            return
          }
          resolve({ blob, width, height })
        }, 'image/webp', quality)
      }

      image.onerror = () => reject(new Error('图片加载失败'))
      image.src = String(reader.result || '')
    }

    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}
