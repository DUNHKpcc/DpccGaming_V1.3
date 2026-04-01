export const normalizeApiBase = (rawBase = '') => {
  const value = String(rawBase || '').trim()
  if (!value) return '/api'

  const normalized = value.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(normalized)) {
    return normalized
  }

  if (normalized.startsWith('/')) {
    return normalized
  }

  return `/${normalized}`
}
