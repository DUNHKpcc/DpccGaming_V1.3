import { useAuthStore } from '../stores/auth'
const API_BASE_URL = 'https://dpccgaming.xyz/api'

export async function apiCall(endpoint, options = {}) {
  const authStore = useAuthStore()
  const url = `${API_BASE_URL}${endpoint}`

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  }

  // 优先使用localStorage中的token，然后使用store中的token
  const token = localStorage.getItem('token') || authStore.authToken
  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, finalOptions)
    const data = await response.json()

    // 处理认证错误
    if (response.status === 401 || response.status === 403) {
      // 清除无效token
      localStorage.removeItem('token')
      authStore.logout()
      throw new Error(data.message || '登录已过期，请重新登录')
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || '请求失败')
    }

    return data
  } catch (error) {
    console.error('API调用错误:', error)
    throw error
  }
}
