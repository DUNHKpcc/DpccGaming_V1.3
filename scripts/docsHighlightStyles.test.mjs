import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const docsViewSource = readFileSync(
  new URL('../src/views/DocsPlaceholder.vue', import.meta.url),
  'utf8'
)

test('DocsPlaceholder includes markdown highlight token styles', () => {
  assert.match(docsViewSource, /\.docs-markdown\s*:deep\(\.hljs-keyword\)/)
  assert.match(docsViewSource, /\.docs-markdown\s*:deep\(\.hljs-string\)/)
  assert.match(docsViewSource, /\.docs-markdown\s*:deep\(\.hljs-title\)/)
})
