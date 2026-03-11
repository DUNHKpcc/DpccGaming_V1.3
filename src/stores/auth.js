import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiCall } from '../utils/api'

export const useAuthStore = defineStore('auth', () => {
  // 从localStorage恢复用户状态
  const currentUser = ref(JSON.parse(localStorage.getItem('currentUser') || 'null'))
  const authToken = ref(localStorage.getItem('authToken') || localStorage.getItem('token'))

  const isLoggedIn = computed(() => !!authToken.value && !!currentUser.value)

  const persistAuth = (token, user) => {
    authToken.value = token || null
    currentUser.value = user || null

    if (authToken.value) {
      localStorage.setItem('authToken', authToken.value)
      localStorage.setItem('token', authToken.value)
    } else {
      localStorage.removeItem('authToken')
      localStorage.removeItem('token')
    }

    if (currentUser.value) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser.value))
    } else {
      localStorage.removeItem('currentUser')
    }
  }

  const login = async (username, password) => {
    try {
      const response = await apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      })

      persistAuth(response.token, response.user)

      return { success: true, message: '登录成功！' }
    } catch (error) {
      return { success: false, message: error.message || '登录失败' }
    }
  }

  const register = async (username, password, email = '') => {
    try {
      const response = await apiCall('/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, email })
      })

      persistAuth(response.token, response.user)

      return { success: true, message: '注册成功！您现在已登录。' }
    } catch (error) {
      return { success: false, message: error.message || '注册失败' }
    }
  }

  const logout = async () => {
    // 先清理本地状态，保证界面立即退出登录
    persistAuth(null, null)

    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      // 忽略网络错误，本地状态仍需清理
      console.warn('退出登录请求失败，已清理本地登录状态:', error)
    }
  }

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('token') || authToken.value

    try {
      const headers = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch('/api/verify-token', {
        method: 'GET',
        credentials: 'include',
        headers
      })

      if (!response.ok) {
        throw new Error('登录状态无效')
      }

      const data = await response.json()
      persistAuth(data.token || token || null, data.user || null)
      return !!authToken.value && !!currentUser.value
    } catch (error) {
      console.error('验证令牌失败:', error)
      persistAuth(null, null)
      return false
    }
  }

  return {
    currentUser,
    authToken,
    isLoggedIn,
    login,
    register,
    logout,
    checkAuthStatus
  }
})
