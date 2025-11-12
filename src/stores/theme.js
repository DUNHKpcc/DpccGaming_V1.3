import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(true) // 默认暗色模式

  // 切换主题
  const toggleTheme = () => {
    isDark.value = !isDark.value
    applyTheme()
  }

  // 设置特定主题
  const setTheme = (dark) => {
    isDark.value = dark
    applyTheme()
  }

  // 应用主题到DOM
  const applyTheme = () => {
    const root = document.documentElement
    if (isDark.value) {
      root.setAttribute('data-theme', 'dark')
      // 移除亮色模式的遮罩
      removeThemeOverlay()
    } else {
      root.setAttribute('data-theme', 'light')
      // 直接切换主题，不使用遮罩动画
      removeThemeOverlay()
    }
  }

  // 添加遮罩动画
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

    // 触发动画
    requestAnimationFrame(() => {
      overlay.style.transform = 'scaleY(1)'
    })

    // 动画结束后移除遮罩
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove()
      }
    }, 600)
  }

  // 移除遮罩动画（暗色模式）
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

  // 初始化主题
  const initTheme = () => {
    applyTheme()
  }

  return {
    isDark,
    toggleTheme,
    setTheme,
    initTheme
  }
})