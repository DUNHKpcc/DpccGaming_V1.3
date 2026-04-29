import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const docsPageSource = fs.readFileSync(path.join(projectRoot, 'src/views/DocsPlaceholder.vue'), 'utf8')

assert.match(docsPageSource, /class="docs-star-button"/)
assert.match(docsPageSource, /class="docs-star-button"[\s\S]*class="docs-star-count"[\s\S]*<\/button>/)
assert.match(docsPageSource, /aria-pressed="docStarred"/)
assert.match(docsPageSource, /const loadDocStarStatus = async/)
assert.match(docsPageSource, /const toggleDocStar = async/)
assert.match(docsPageSource, /apiCall\(`\/docs\/\$\{doc\.id\}\/star`/)
assert.match(docsPageSource, /apiCall\(`\/docs\/\$\{selectedDoc\.value\.id\}\/star`/)
assert.match(docsPageSource, /modalStore\.openModal\('login'\)/)

console.log('Validated docs star UI contract.')
