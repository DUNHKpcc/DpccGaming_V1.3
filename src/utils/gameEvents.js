/**
 * 游戏事件处理工具
 * 用于解决iframe中游戏无法接收键盘和鼠标事件的问题
 */

/**
 * 为iframe游戏添加事件传递支持
 * @param {HTMLIFrameElement} iframe - 游戏iframe元素
 * @param {Object} options - 配置选项
 */
export function setupGameEventHandling(iframe, options = {}) {
  if (!iframe) return

  const {
    enableKeyboardEvents = true,
    enableMouseEvents = true,
    enableGamepadEvents = true,
    debugMode = false
  } = options

  // 确保iframe可以获得焦点
  iframe.setAttribute('tabindex', '0')
  iframe.style.outline = 'none'

  // 键盘事件处理
  if (enableKeyboardEvents) {
    setupKeyboardEvents(iframe, debugMode)
  }

  // 鼠标事件处理
  if (enableMouseEvents) {
    setupMouseEvents(iframe, debugMode)
  }

  // 游戏手柄事件处理
  if (enableGamepadEvents) {
    setupGamepadEvents(iframe, debugMode)
  }

  // iframe加载完成后自动获得焦点
  iframe.addEventListener('load', () => {
    setTimeout(() => {
      focusGameIframe(iframe)
    }, 100)
  })

  // 点击iframe时获得焦点
  iframe.addEventListener('click', () => {
    focusGameIframe(iframe)
  })
}

/**
 * 设置键盘事件传递
 */
function setupKeyboardEvents(iframe, debugMode) {
  const handleKeydown = (event) => {
    // 如果iframe有焦点，不拦截事件
    if (document.activeElement === iframe) {
      if (debugMode) {
        console.log('游戏iframe有焦点，允许键盘事件:', event.key)
      }
      return
    }

    // 只有特定键被拦截（如ESC用于退出全屏）
    const interceptedKeys = ['Escape']
    if (interceptedKeys.includes(event.key)) {
      if (debugMode) {
        console.log('拦截键盘事件:', event.key)
      }
      return
    }

    // 其他键盘事件传递给游戏
    if (debugMode) {
      console.log('传递键盘事件给游戏:', event.key)
    }
    
    // 尝试将焦点转移到iframe
    focusGameIframe(iframe)
    
    // 重新触发事件
    setTimeout(() => {
      const newEvent = new KeyboardEvent('keydown', {
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        which: event.which,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true
      })
      
      try {
        iframe.contentWindow.dispatchEvent(newEvent)
      } catch (e) {
        if (debugMode) {
          console.log('无法向iframe传递键盘事件:', e.message)
        }
      }
    }, 10)
  }

  const handleKeyup = (event) => {
    if (document.activeElement === iframe) {
      return
    }

    const interceptedKeys = ['Escape']
    if (interceptedKeys.includes(event.key)) {
      return
    }

    try {
      const newEvent = new KeyboardEvent('keyup', {
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        which: event.which,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true
      })
      
      iframe.contentWindow.dispatchEvent(newEvent)
    } catch (e) {
      if (debugMode) {
        console.log('无法向iframe传递keyup事件:', e.message)
      }
    }
  }

  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('keyup', handleKeyup)

  // 返回清理函数
  return () => {
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('keyup', handleKeyup)
  }
}

/**
 * 设置鼠标事件传递
 */
function setupMouseEvents(iframe, debugMode) {
  const handleMouseMove = (event) => {
    if (document.activeElement === iframe) {
      return
    }

    try {
      const rect = iframe.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      // 检查鼠标是否在iframe范围内
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        const newEvent = new MouseEvent('mousemove', {
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true
        })
        
        iframe.contentWindow.dispatchEvent(newEvent)
      }
    } catch (e) {
      if (debugMode) {
        console.log('无法向iframe传递鼠标事件:', e.message)
      }
    }
  }

  document.addEventListener('mousemove', handleMouseMove)

  return () => {
    document.removeEventListener('mousemove', handleMouseMove)
  }
}

/**
 * 设置游戏手柄事件
 */
function setupGamepadEvents(iframe, debugMode) {
  let gamepadIndex = -1

  const handleGamepadConnected = (event) => {
    gamepadIndex = event.gamepad.index
    if (debugMode) {
      console.log('游戏手柄已连接:', event.gamepad.id)
    }
  }

  const handleGamepadDisconnected = (event) => {
    if (event.gamepad.index === gamepadIndex) {
      gamepadIndex = -1
    }
    if (debugMode) {
      console.log('游戏手柄已断开:', event.gamepad.id)
    }
  }

  window.addEventListener('gamepadconnected', handleGamepadConnected)
  window.addEventListener('gamepaddisconnected', handleGamepadDisconnected)

  return () => {
    window.removeEventListener('gamepadconnected', handleGamepadConnected)
    window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected)
  }
}

/**
 * 让游戏iframe获得焦点
 */
export function focusGameIframe(iframe) {
  if (!iframe) return

  try {
    // 让iframe获得焦点
    iframe.focus()
    
    // 尝试让iframe内部也获得焦点
    if (iframe.contentWindow) {
      iframe.contentWindow.focus()
      
      // 尝试让iframe内部的body获得焦点
      if (iframe.contentDocument && iframe.contentDocument.body) {
        iframe.contentDocument.body.focus()
      }
    }
  } catch (e) {
    console.log('无法设置iframe焦点:', e.message)
  }
}

/**
 * 检查游戏是否支持全屏
 */
export function checkGameFullscreenSupport(iframe) {
  if (!iframe || !iframe.contentWindow) return false

  try {
    return !!(
      iframe.contentDocument.fullscreenEnabled ||
      iframe.contentDocument.webkitFullscreenEnabled ||
      iframe.contentDocument.mozFullScreenEnabled ||
      iframe.contentDocument.msFullscreenEnabled
    )
  } catch (e) {
    return false
  }
}

/**
 * 进入游戏全屏模式
 */
export function enterGameFullscreen(iframe) {
  if (!iframe || !iframe.contentDocument) return false

  try {
    const doc = iframe.contentDocument
    const element = doc.documentElement

    if (element.requestFullscreen) {
      return element.requestFullscreen()
    } else if (element.webkitRequestFullscreen) {
      return element.webkitRequestFullscreen()
    } else if (element.mozRequestFullScreen) {
      return element.mozRequestFullScreen()
    } else if (element.msRequestFullscreen) {
      return element.msRequestFullscreen()
    }
  } catch (e) {
    console.log('无法进入游戏全屏模式:', e.message)
  }

  return false
}

/**
 * 退出游戏全屏模式
 */
export function exitGameFullscreen(iframe) {
  if (!iframe || !iframe.contentDocument) return false

  try {
    const doc = iframe.contentDocument

    if (doc.exitFullscreen) {
      return doc.exitFullscreen()
    } else if (doc.webkitExitFullscreen) {
      return doc.webkitExitFullscreen()
    } else if (doc.mozCancelFullScreen) {
      return doc.mozCancelFullScreen()
    } else if (doc.msExitFullscreen) {
      return doc.msExitFullscreen()
    }
  } catch (e) {
    console.log('无法退出游戏全屏模式:', e.message)
  }

  return false
}
