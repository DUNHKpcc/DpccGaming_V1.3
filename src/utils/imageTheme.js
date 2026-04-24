const clampChannel = value => Math.max(0, Math.min(255, Math.round(value)))

const rgbTuple = (r, g, b) =>
  `${clampChannel(r)}, ${clampChannel(g)}, ${clampChannel(b)}`

const mixRgb = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t)
]

const hashString = value => {
  const text = String(value || '')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const seedHue = value => hashString(value) % 360

const hslToRgb = (h, s, l) => {
  const hue = (h % 360) / 360
  const sat = Math.max(0, Math.min(1, s))
  const light = Math.max(0, Math.min(1, l))

  if (sat === 0) {
    const value = Math.round(light * 255)
    return [value, value, value]
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q
  const hueToChannel = t => {
    let next = t
    if (next < 0) next += 1
    if (next > 1) next -= 1
    if (next < 1 / 6) return p + (q - p) * 6 * next
    if (next < 1 / 2) return q
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6
    return p
  }

  return [
    Math.round(hueToChannel(hue + 1 / 3) * 255),
    Math.round(hueToChannel(hue) * 255),
    Math.round(hueToChannel(hue - 1 / 3) * 255)
  ]
}

const rgbToHsl = (r, g, b) => {
  const red = clampChannel(r) / 255
  const green = clampChannel(g) / 255
  const blue = clampChannel(b) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min

  if (delta === 0) {
    return [0, 0, lightness]
  }

  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min)

  let hue = 0
  if (max === red) {
    hue = ((green - blue) / delta) + (green < blue ? 6 : 0)
  } else if (max === green) {
    hue = ((blue - red) / delta) + 2
  } else {
    hue = ((red - green) / delta) + 4
  }

  return [Math.round(hue * 60), saturation, lightness]
}

const createSeedRgb = seed => {
  const hue = seedHue(seed)
  const saturation = 0.42 + ((hashString(seed) % 19) / 100)
  const lightness = 0.43 + ((hashString(seed) % 11) / 120)
  return hslToRgb(hue, saturation, lightness)
}

const normalizeThemeRgb = (rgb, options = {}) => {
  const base = Array.isArray(rgb) ? rgb.map(clampChannel) : [94, 123, 160]
  const [hue, saturation, lightness] = rgbToHsl(base[0], base[1], base[2])
  const fallbackHue = seedHue(options.fallbackSeed || base.join('-'))
  const isLowSaturation = saturation < 0.18
  const isTooBright = lightness > 0.72
  const targetHue = isLowSaturation ? fallbackHue : hue
  const targetSaturation = isLowSaturation
    ? 0.38
    : Math.min(Math.max(saturation * 0.72, 0.24), 0.5)
  const targetLightness = isTooBright || isLowSaturation
    ? Math.min(Math.max(lightness * 0.52, 0.28), 0.4)
    : Math.min(Math.max(lightness, 0.26), 0.58)

  return hslToRgb(targetHue, targetSaturation, targetLightness)
}

export const extractAverageRgbFromImageData = data => {
  if (!data || !data.length) return null

  let r = 0
  let g = 0
  let b = 0
  let count = 0

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255
    if (alpha < 0.2) continue

    const pr = data[i]
    const pg = data[i + 1]
    const pb = data[i + 2]
    const luminance = (0.2126 * pr + 0.7152 * pg + 0.0722 * pb) / 255

    if (luminance < 0.05 || luminance > 0.95) continue

    r += pr
    g += pg
    b += pb
    count += 1
  }

  if (!count) return null

  return [
    Math.round(r / count),
    Math.round(g / count),
    Math.round(b / count)
  ]
}

export const createCardThemeStyle = (rgb, options = {}) => {
  const main = normalizeThemeRgb(rgb, options)
  const bright = mixRgb(main, [255, 255, 255], 0.22)
  const deep = mixRgb(main, [0, 0, 0], 0.52)
  const edge = mixRgb(main, [0, 0, 0], 0.69)

  return {
    '--blog-card-theme-main': rgbTuple(main[0], main[1], main[2]),
    '--blog-card-theme-bright': rgbTuple(bright[0], bright[1], bright[2]),
    '--blog-card-theme-deep': rgbTuple(deep[0], deep[1], deep[2]),
    '--blog-card-theme-edge': rgbTuple(edge[0], edge[1], edge[2])
  }
}

export const createSeedCardThemeStyle = seed => {
  return createCardThemeStyle(createSeedRgb(seed), { fallbackSeed: seed })
}

export const extractCardThemeFromElement = (element, options = {}) => {
  if (!element || typeof document === 'undefined') return null

  const sampleSize = Math.max(8, Number(options.sampleSize) || 24)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = sampleSize
    canvas.height = sampleSize

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null

    context.drawImage(element, 0, 0, sampleSize, sampleSize)
    const { data } = context.getImageData(0, 0, sampleSize, sampleSize)
    const average = extractAverageRgbFromImageData(data)

    return average ? createCardThemeStyle(average, options) : null
  } catch {
    return null
  }
}
