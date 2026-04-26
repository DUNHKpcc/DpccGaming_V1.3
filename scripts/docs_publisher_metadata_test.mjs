import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const docsListSource = fs.readFileSync(path.join(projectRoot, 'src/data/docsList.js'), 'utf8')
const docsList = new Function(
  docsListSource.replace('export const docsList =', 'return')
)()
const docsPageSource = fs.readFileSync(path.join(projectRoot, 'src/views/DocsPlaceholder.vue'), 'utf8')
const publicRoot = path.join(projectRoot, 'public')

for (const doc of docsList) {
  assert.ok(doc.publisher, `Doc "${doc.id}" must include publisher metadata`)
  assert.equal(typeof doc.publisher.username, 'string', `Doc "${doc.id}" publisher username must be a string`)
  assert.ok(doc.publisher.username.trim(), `Doc "${doc.id}" publisher username must not be empty`)
  assert.match(doc.publisher.avatar, /^\//, `Doc "${doc.id}" publisher avatar must start with "/"`)
  assert.ok(
    fs.existsSync(path.join(publicRoot, doc.publisher.avatar.slice(1))),
    `Doc "${doc.id}" publisher avatar is missing: public${doc.publisher.avatar}`
  )
}

assert.match(docsPageSource, /class="docs-publisher"/)
assert.match(docsPageSource, /selectedDoc\?\.publisher\?\.avatar/)
assert.match(docsPageSource, /selectedDoc\?\.publisher\?\.username/)
assert.match(docsPageSource, /<div class="docs-article-content">\s*<header class="docs-hero">/)
assert.match(docsPageSource, /\.docs-article\s*{[^}]*max-width:\s*none;/s)
assert.match(docsPageSource, /\.docs-article-content\s*{[^}]*max-width:\s*860px;/s)

console.log(`Validated publisher metadata for ${docsList.length} docs.`)
