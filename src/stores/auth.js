import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiCall } from '../utils/api'

export const useAuthStore = defineStore('auth', () => {
  // 从localStorage恢复用户状态
  const currentUser = ref(JSON.parse(localStorage.getItem('currentUser') || 'null'))
  const authToken = ref(localStorage.getItem('authToken') || localStorage.getItem('token'))

  const isLoggedIn = computed(() => !!authToken.value && !!currentUser.value)

  const login = async (username, password) => {
    try {
      const response = await apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      })

      authToken.value = response.token
      currentUser.value = response.user
      localStorage.setItem('authToken', authToken.value)
      localStorage.setItem('token', authToken.value) // 同时保存为token键
      localStorage.setItem('currentUser', JSON.stringify(currentUser.value))

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

      authToken.value = response.token
      currentUser.value = response.user
      localStorage.setItem('authToken', authToken.value)
      localStorage.setItem('token', authToken.value) // 同时保存为token键
      localStorage.setItem('currentUser', JSON.stringify(currentUser.value))

      return { success: true, message: '注册成功！您现在已登录。' }
    } catch (error) {
      return { success: false, message: error.message || '注册失败' }
    }
  }

  const logout = () => {
    authToken.value = null
    currentUser.value = null
    localStorage.removeItem('authToken')
    localStorage.removeItem('token') // 同时清除token键
    localStorage.removeItem('currentUser')
  }

  const checkAuthStatus = async () => {
    if (!authToken.value) {
      return false
    }

    try {
      const response = await apiCall('/verify-token')
      currentUser.value = response.user
      localStorage.setItem('currentUser', JSON.stringify(currentUser.value))
      return true
    } catch (error) {
      console.error('验证令牌失败:', error)
      logout()
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
