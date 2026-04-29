import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const accountSource = fs.readFileSync(path.join(projectRoot, 'src/views/Account.vue'), 'utf8')
const accountStylesSource = fs.readFileSync(path.join(projectRoot, 'src/styles/account.css'), 'utf8')
const docsSource = fs.readFileSync(path.join(projectRoot, 'src/views/DocsPlaceholder.vue'), 'utf8')

assert.match(accountSource, /class="glass-card widget widget-doc-stars p-6"/)
assert.match(accountSource, /Star 文档/)
assert.match(accountSource, /apiCall\('\/user\/doc-stars'/)
assert.match(accountSource, /docsList/)
assert.match(accountSource, /router\.push\(\{\s*name: 'AiDocs',\s*query: \{ doc: doc\.id \}/s)
assert.match(accountStylesSource, /\.doc-star-row\s*{/)
assert.match(docsSource, /route\.query\.doc/)

console.log('Validated account doc stars entry.')
