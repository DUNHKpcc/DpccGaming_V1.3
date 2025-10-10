import { useAuthStore } from '../stores/auth'

// ⚠️ 重要：部署前必须修改为你的实际服务器地址
// 选项1: 使用IP地址 - const API_BASE_URL = 'http://你的服务器IP:3000/api'
// 选项2: 使用域名 - const API_BASE_URL = 'https://你的域名/api'
const API_BASE_URL = 'http://dpccgaming.xyz/api'

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
