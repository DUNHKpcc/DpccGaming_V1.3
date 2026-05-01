import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useCookieStore } from './cookie'
import {
  getEffectiveTheme,
  getNextThemeMode,
  normalizeThemeMode
} from '../utils/themeMode.mjs'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false)
  const themeMode = ref('system')
  let systemThemeQuery = null

  const toggleTheme = () => {
    themeMode.value = getNextThemeMode(themeMode.value)
    applyTheme()
  }

  const setTheme = (dark) => {
    themeMode.value = dark ? 'dark' : 'light'
    applyTheme()
  }

  const setThemeMode = (mode) => {
    themeMode.value = normalizeThemeMode(mode)
    applyTheme()
  }

  const applyTheme = (options = {}) => {
    const root = document.documentElement
    syncEffectiveTheme()
    if (isDark.value) {
      root.setAttribute('data-theme', 'dark')
      removeThemeOverlay()
    } else {
      root.setAttribute('data-theme', 'light')
      removeThemeOverlay()
    }

    if (options.persist !== false) {
      syncThemePreference()
    }
  }

  const syncEffectiveTheme = () => {
    const systemPrefersDark = getSystemPrefersDark()
    isDark.value = getEffectiveTheme(themeMode.value, systemPrefersDark) === 'dark'
  }

  const getSystemPrefersDark = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  const addThemeOverlay = () => {
    const existingOverlay = document.getElementById('theme-transition-overlay')
    if (existingOverlay) {
      existingOverlay.remove()
    }

    const overlay = document.createElement('div')
    overlay.id = 'theme-transition-overlay'
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: var(--theme-overlay-light);
      z-index: 9999;
      pointer-events: none;
      transform: scaleY(0);
      transform-origin: top;
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    `

    document.body.appendChild(overlay)

    requestAnimationFrame(() => {
      overlay.style.transform = 'scaleY(1)'
    })

    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove()
      }
    }, 600)
  }

  const removeThemeOverlay = () => {
    const overlay = document.getElementById('theme-transition-overlay')
    if (overlay) {
      overlay.style.background = 'var(--theme-overlay-dark)'
      overlay.style.transform = 'scaleY(0)'
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove()
        }
      }, 600)
    }
  }

  const syncThemePreference = () => {
    const cookieStore = useCookieStore()
    if (!cookieStore.initialized) {
      cookieStore.init()
    }
    cookieStore.setThemePreference(themeMode.value)
  }

  const handleSystemThemeChange = () => {
    if (themeMode.value === 'system') {
      applyTheme({ persist: false })
    }
  }

  const watchSystemTheme = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    if (systemThemeQuery) {
      return
    }
    systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    if (typeof systemThemeQuery.addEventListener === 'function') {
      systemThemeQuery.addEventListener('change', handleSystemThemeChange)
    } else if (typeof systemThemeQuery.addListener === 'function') {
      systemThemeQuery.addListener(handleSystemThemeChange)
    }
  }

  const initTheme = () => {
    const cookieStore = useCookieStore()
    cookieStore.init()
    const storedTheme = cookieStore.preferences?.theme
    const canUse =
      cookieStore.consentStatus && cookieStore.preferences?.functional
    if (canUse) {
      themeMode.value = normalizeThemeMode(storedTheme)
    }
    watchSystemTheme()
    applyTheme({ persist: false })
  }

  return {
    isDark,
    themeMode,
    toggleTheme,
    setTheme,
    setThemeMode,
    initTheme
  }
})
