import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCardThemeStyle,
  createSeedCardThemeStyle,
  extractAverageRgbFromImageData
} from '../src/utils/imageTheme.js'

const parseRgbTuple = tuple => tuple.split(',').map(value => Number(value.trim()))

const getRelativeLuminance = ([r, g, b]) => (
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
)

const getSaturation = ([r, g, b]) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

test('extractAverageRgbFromImageData ignores transparent and extreme pixels', () => {
  const data = new Uint8ClampedArray([
    255, 255, 255, 255,
    0, 0, 0, 255,
    100, 150, 200, 255,
    50, 100, 150, 255,
    200, 10, 10, 20
  ])

  assert.deepEqual(extractAverageRgbFromImageData(data), [75, 125, 175])
})

test('createCardThemeStyle returns darker readable gradient tokens', () => {
  const style = createCardThemeStyle([120, 160, 200])
  const main = parseRgbTuple(style['--blog-card-theme-main'])
  const bright = parseRgbTuple(style['--blog-card-theme-bright'])
  const deep = parseRgbTuple(style['--blog-card-theme-deep'])
  const edge = parseRgbTuple(style['--blog-card-theme-edge'])

  assert.ok(getRelativeLuminance(main) < 0.62)
  assert.ok(getRelativeLuminance(bright) > getRelativeLuminance(main))
  assert.ok(getRelativeLuminance(deep) < getRelativeLuminance(main))
  assert.ok(getRelativeLuminance(edge) < getRelativeLuminance(deep))
})

test('createSeedCardThemeStyle is deterministic for the same seed', () => {
  const first = createSeedCardThemeStyle('BluePrint1.webp')
  const second = createSeedCardThemeStyle('BluePrint1.webp')

  assert.deepEqual(first, second)
  assert.ok(first['--blog-card-theme-main'])
})

test('createCardThemeStyle normalizes pale low-saturation colors for white text', () => {
  const style = createCardThemeStyle([245, 245, 245], { fallbackSeed: 'Docs.webp' })
  const main = parseRgbTuple(style['--blog-card-theme-main'])
  const bright = parseRgbTuple(style['--blog-card-theme-bright'])

  assert.ok(getRelativeLuminance(main) < 0.5)
  assert.notDeepEqual(main, [245, 245, 245])
  assert.ok(new Set(main).size > 1)
  assert.ok(getRelativeLuminance(bright) < 0.7)
})

test('createCardThemeStyle keeps saturated colors restrained', () => {
  const style = createCardThemeStyle([255, 64, 64], { fallbackSeed: 'Hot.webp' })
  const main = parseRgbTuple(style['--blog-card-theme-main'])

  assert.ok(getSaturation(main) < 0.55)
})
