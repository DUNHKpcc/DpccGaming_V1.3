import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useCookieStore } from './cookie'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false)

  const toggleTheme = () => {
    isDark.value = !isDark.value
    applyTheme()
  }

  const setTheme = (dark) => {
    isDark.value = dark
    applyTheme()
  }

  const applyTheme = (options = {}) => {
    const root = document.documentElement
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
    const themeValue = isDark.value ? 'dark' : 'light'
    cookieStore.setThemePreference(themeValue)
  }

  const initTheme = () => {
    const cookieStore = useCookieStore()
    cookieStore.init()
    const storedTheme = cookieStore.preferences?.theme
    const canUse =
      cookieStore.consentStatus && cookieStore.preferences?.functional
    if (canUse && (storedTheme === 'dark' || storedTheme === 'light')) {
      isDark.value = storedTheme === 'dark'
    }
    applyTheme({ persist: false })
  }

  return {
    isDark,
    toggleTheme,
    setTheme,
    initTheme
  }
})
