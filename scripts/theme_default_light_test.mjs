import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const asDataModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

const piniaUrl = await import.meta.resolve('pinia')
const vueUrl = await import.meta.resolve('vue')
const cookieSource = fs
  .readFileSync(path.join(projectRoot, 'src/stores/cookie.js'), 'utf8')
  .replace("from 'pinia'", `from '${piniaUrl}'`)
  .replace('from "pinia"', `from '${piniaUrl}'`)

const cookieModuleUrl = asDataModule(cookieSource)
const themeSource = fs
  .readFileSync(path.join(projectRoot, 'src/stores/theme.js'), 'utf8')
  .replace("from 'pinia'", `from '${piniaUrl}'`)
  .replace('from "pinia"', `from '${piniaUrl}'`)
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace('from "vue"', `from '${vueUrl}'`)
  .replace("from './cookie'", `from '${cookieModuleUrl}'`)
  .replace('from "./cookie"', `from '${cookieModuleUrl}'`)
const styleSource = fs.readFileSync(path.join(projectRoot, 'src/style.css'), 'utf8')
const indexSource = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8')

const attributes = new Map()
const elements = new Map()
const storage = new Map()
const fetchCalls = []

globalThis.document = {
  documentElement: {
    setAttribute(name, value) {
      attributes.set(name, value)
    },
    getAttribute(name) {
      return attributes.get(name) || null
    }
  },
  body: {
    appendChild(element) {
      if (element.id) {
        elements.set(element.id, element)
      }
      element.parentNode = this
    }
  },
  createElement() {
    return {
      id: '',
      style: {},
      remove() {
        if (this.id) {
          elements.delete(this.id)
        }
        this.parentNode = null
      }
    }
  },
  getElementById(id) {
    return elements.get(id) || null
  }
}

globalThis.window = {}
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null
  },
  setItem(key, value) {
    storage.set(key, String(value))
  },
  removeItem(key) {
    storage.delete(key)
  }
}
globalThis.window.localStorage = globalThis.localStorage
globalThis.requestAnimationFrame = (callback) => callback()
globalThis.fetch = async (url, options = {}) => {
  fetchCalls.push({ url, options })
  const body = options.body ? JSON.parse(options.body) : {}
  return {
    ok: true,
    async json() {
      return {
        cookieId: body.cookieId || 'test-cookie',
        consentStatus: body.consentStatus,
        updatedAt: '2026-04-25T00:00:00.000Z'
      }
    }
  }
}

const [{ useThemeStore }, { useCookieStore }] = await Promise.all([
  import(themeSource.startsWith('\ufeff') ? asDataModule(themeSource.slice(1)) : asDataModule(themeSource)),
  import(cookieModuleUrl)
])

const resetRuntime = () => {
  attributes.clear()
  elements.clear()
  storage.clear()
  fetchCalls.length = 0
  setActivePinia(createPinia())
}

resetRuntime()
const cookieStore = useCookieStore()
assert.equal(cookieStore.preferences.theme, 'light')

const themeStore = useThemeStore()
assert.equal(themeStore.isDark, false)

themeStore.initTheme()

assert.equal(themeStore.isDark, false)
assert.equal(document.documentElement.getAttribute('data-theme'), 'light')
assert.match(
  styleSource,
  /:root,\s*\[data-theme="light"\]\s*{[^}]*--bg-primary:\s*#ffffff;/s
)
assert.match(
  styleSource,
  /\[data-theme="dark"\]\s*{[^}]*--bg-primary:\s*#000000;/s
)
assert.match(indexSource, /<body[^>]*background:#fff/)

resetRuntime()
storage.set(
  'cookiePreferences',
  JSON.stringify({
    consentStatus: 'accepted',
    cookieId: 'stored-cookie',
    preferences: {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
      theme: 'dark'
    },
    lastSyncedAt: '2026-04-24T00:00:00.000Z'
  })
)

const storedThemeStore = useThemeStore()
storedThemeStore.initTheme()

assert.equal(storedThemeStore.isDark, true)
assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')

storedThemeStore.toggleTheme()
await new Promise((resolve) => setTimeout(resolve, 0))

assert.equal(storedThemeStore.isDark, false)
assert.equal(document.documentElement.getAttribute('data-theme'), 'light')
assert.equal(fetchCalls.length, 1)
assert.equal(fetchCalls[0].url, '/api/cookies/consent')
assert.equal(JSON.parse(fetchCalls[0].options.body).preferences.theme, 'light')
assert.equal(
  JSON.parse(storage.get('cookiePreferences')).preferences.theme,
  'light'
)

console.log('Default theme initializes as light and saved preferences still work.')
