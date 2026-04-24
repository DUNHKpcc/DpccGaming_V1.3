import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createHeadingIdGenerator,
  extractMarkdownHeadings,
  slugifyHeadingText
} from '../src/utils/docsNavigation.js'

test('slugifyHeadingText creates readable ids for mixed text', () => {
  assert.equal(slugifyHeadingText('Claude Code 概述'), 'claude-code-概述')
  assert.equal(slugifyHeadingText('  API & CLI  '), 'api-cli')
})

test('createHeadingIdGenerator de-duplicates repeated headings', () => {
  const getId = createHeadingIdGenerator()

  assert.equal(getId('开始使用'), '开始使用')
  assert.equal(getId('开始使用'), '开始使用-2')
  assert.equal(getId('开始使用'), '开始使用-3')
})

test('extractMarkdownHeadings returns unique ids and skips code fences', () => {
  const headings = extractMarkdownHeadings([
    '# 概述',
    '正文',
    '## 开始使用',
    '```md',
    '# 不应进入目录',
    '```',
    '## 开始使用',
    '### 后续步骤'
  ].join('\n'))

  assert.deepEqual(headings, [
    { level: 1, text: '概述', id: '概述' },
    { level: 2, text: '开始使用', id: '开始使用' },
    { level: 2, text: '开始使用', id: '开始使用-2' },
    { level: 3, text: '后续步骤', id: '后续步骤' }
  ])
})
