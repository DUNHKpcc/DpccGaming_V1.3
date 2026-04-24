import assert from 'node:assert/strict'
import test from 'node:test'

import { renderMarkdownToHtml } from '../src/utils/markdownRenderer.mjs'

test('renderMarkdownToHtml keeps inline code escaped', async () => {
  const html = await renderMarkdownToHtml('Use `<script>` safely.')

  assert.equal(html, '<p>Use <code>&lt;script&gt;</code> safely.</p>')
})

test('renderMarkdownToHtml delegates fenced code blocks to code renderer', async () => {
  const calls = []
  const html = await renderMarkdownToHtml(
    [
      '```js',
      'const answer = 42 < 100',
      '```'
    ].join('\n'),
    {
      renderCodeBlock: async ({ code, language, languageLabel }) => {
        calls.push({ code, language, languageLabel })
        return `<span class="token">${code}</span>`
      }
    }
  )

  assert.deepEqual(calls, [{ code: 'const answer = 42 < 100', language: 'js', languageLabel: 'JS' }])
  assert.match(html, /class="markdown-code-block"/)
  assert.match(html, /class="markdown-code-toolbar"/)
  assert.match(html, /class="markdown-code-language">JS</)
  assert.match(html, /data-action="copy-code"/)
  assert.match(html, /data-code="const%20answer%20%3D%2042%20%3C%20100"/)
  assert.match(html, /<code class="hljs language-js"><span class="token">const answer = 42 < 100<\/span><\/code>/)
})

test('renderMarkdownToHtml falls back to escaped code blocks when renderer fails', async () => {
  const html = await renderMarkdownToHtml(
    [
      '```ts',
      'const message = "<safe>"',
      '```'
    ].join('\n'),
    {
      renderCodeBlock: async () => {
        throw new Error('boom')
      }
    }
  )

  assert.match(html, /class="markdown-code-language">TS</)
  assert.match(html, /复制代码/)
  assert.match(html, /<code class="hljs language-ts">const message = &quot;&lt;safe&gt;&quot;<\/code>/)
})

test('renderMarkdownToHtml defaults unlabeled fenced code blocks to TEXT', async () => {
  const html = await renderMarkdownToHtml(
    [
      '```',
      'plain text',
      '```'
    ].join('\n')
  )

  assert.match(html, /class="markdown-code-language">TEXT</)
  assert.match(html, /data-code="plain%20text"/)
})

test('renderMarkdownToHtml adds stable ids to headings', async () => {
  const html = await renderMarkdownToHtml(
    [
      '# 概述',
      '## 开始使用',
      '## 开始使用'
    ].join('\n')
  )

  assert.match(html, /<h1 id="概述">概述<\/h1>/)
  assert.match(html, /<h2 id="开始使用">开始使用<\/h2>/)
  assert.match(html, /<h2 id="开始使用-2">开始使用<\/h2>/)
})
