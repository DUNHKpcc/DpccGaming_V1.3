import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const blogViewSource = readFileSync(
  new URL('../src/views/Blog.vue', import.meta.url),
  'utf8'
)

test('Blog view includes explicit light theme overrides while keeping theme variables', () => {
  assert.match(blogViewSource, /\.blog-page\s*{[\s\S]*--blog-page-bg:/)
  assert.match(blogViewSource, /\[data-theme=['"]light['"]\]\s+\.blog-page\s*{/)
  assert.match(blogViewSource, /\.glass-card\s*{[\s\S]*background:\s*var\(--blog-card-surface\)/)
})
