import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const blogSource = fs.readFileSync(path.join(projectRoot, 'src/views/Blog.vue'), 'utf8')

assert.doesNotMatch(blogSource, /:style="getPostThemeStyle\(post\)"/)
assert.doesNotMatch(blogSource, /imageTheme/)
assert.doesNotMatch(blogSource, /linear-gradient\(/)
assert.match(blogSource, /--blog-content-bg:\s*#ffffff;/)
assert.match(blogSource, /--blog-content-text:\s*#000000;/)
assert.match(blogSource, /\[data-theme='light'\]\s+\.blog-page\s*{[^}]*--blog-content-bg:\s*#000000;[^}]*--blog-content-text:\s*#ffffff;/s)
assert.match(blogSource, /\.blog-content\s*{[^}]*background:\s*var\(--blog-content-bg\);/s)
assert.match(blogSource, /\.blog-content\s*{[^}]*color:\s*var\(--blog-content-text\);/s)

console.log('Validated blog card theme contrast.')
