import { useAuthStore } from '../stores/auth'

const resolveApiBase = () => {
  const envBase = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
  if (envBase && /^https?:\/\//i.test(envBase)) {
    return envBase.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`
  }
  return '/api'
}

const API_BASE_URL = resolveApiBase()

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
    const contentType = response.headers.get('content-type') || ''
    let data
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      const snippet = text.slice(0, 200).replace(/\s+/g, ' ')
      throw new Error(`非JSON响应 (${response.status}): ${snippet}`)
    }

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
