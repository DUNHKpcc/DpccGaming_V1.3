import { resolveMediaUrl } from './media'

const BACKEND_DEFAULT_AVATAR_PATH = '/avatars/default-avatar.svg'
const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6FA8FF"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs><circle cx="128" cy="128" r="128" fill="url(#g)"/><circle cx="128" cy="104" r="44" fill="white" fill-opacity=".94"/><path d="M48 220C48 180.235 80.235 148 120 148h16c39.765 0 72 32.235 72 72v36H48v-36z" fill="white" fill-opacity=".94"/></svg>`
export const DEFAULT_AVATAR_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DEFAULT_AVATAR_SVG)}`

export function getAvatarUrl(rawUrl = '') {
  if (!rawUrl || rawUrl === BACKEND_DEFAULT_AVATAR_PATH) {
    return DEFAULT_AVATAR_URL
  }
  return resolveMediaUrl(rawUrl)
}

export function handleAvatarError(event) {
  if (!event?.target) return
  if (event.target.dataset.fallbackApplied === '1') return
  event.target.dataset.fallbackApplied = '1'
  event.target.src = DEFAULT_AVATAR_URL
}
