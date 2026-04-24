import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDocsCatalog } from '../src/utils/docsCatalog.js'

const sampleDocs = [
  { id: 'a', title: 'Claude Code 接入', tag: '快速开始', summary: '本地接入教程' },
  { id: 'b', title: '内容发布规范', tag: '文档与资源管理', summary: '资源命名流程' },
  { id: 'c', title: '上线检查清单', tag: '部署与质量保障', summary: '上线前检查项' }
]

test('buildDocsCatalog groups docs by tag when query is empty', () => {
  assert.deepEqual(buildDocsCatalog(sampleDocs, '').map(group => group.tag), [
    '快速开始',
    '文档与资源管理',
    '部署与质量保障'
  ])
})

test('buildDocsCatalog filters by title, summary and tag', () => {
  assert.deepEqual(
    buildDocsCatalog(sampleDocs, '检查').flatMap(group => group.items.map(doc => doc.id)),
    ['c']
  )

  assert.deepEqual(
    buildDocsCatalog(sampleDocs, '资源管理').flatMap(group => group.items.map(doc => doc.id)),
    ['b']
  )

  assert.deepEqual(
    buildDocsCatalog(sampleDocs, '教程').flatMap(group => group.items.map(doc => doc.id)),
    ['a']
  )
})
