const rawApiBase = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_API_BASE_URL
  : ''

const assetBase = (() => {
  if (rawApiBase && /^https?:\/\//i.test(rawApiBase)) {
    try {
      const url = new URL(rawApiBase)
      const basePath = url.pathname.replace(/\/api\/?$/, '')
      return `${url.origin}${basePath}`.replace(/\/$/, '')
    } catch {
      /* ignore parsing errors */
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
})()

export function resolveMediaUrl(rawUrl = '') {
  if (!rawUrl) return ''

  const urlString = String(rawUrl).trim()
  if (!urlString) return ''

  if (/^https?:\/\//i.test(urlString)) {
    return urlString
  }

  const normalizedPath = urlString.replace(/\\/g, '/')
  const ensuredLeadingSlash = normalizedPath.startsWith('/')
    ? normalizedPath
    : `/${normalizedPath}`

  if (!assetBase) {
    return ensuredLeadingSlash
  }

  return `${assetBase}${ensuredLeadingSlash}`
}
