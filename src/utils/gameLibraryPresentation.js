import { resolveMediaUrl } from './media'

const VIDEO_EXT_PATTERN = /\.(mp4|webm|ogg|m4v|mov)(\?.*)?$/i

export const getGameCoverUrl = (game = {}) => {
  const source = game || {}
  return resolveMediaUrl(
    source.thumbnail_url || source.thumbnail || source.cover || source.cover_url || ''
  )
}

export const getGameVideoUrl = (game = {}) => {
  const source = game || {}
  return resolveMediaUrl(source.video_url || source.videoUrl || '')
}

export const hasPlayableVideo = (game = {}) => {
  const source = game || {}
  const rawUrl = String(source.video_url || source.videoUrl || '').trim()
  return VIDEO_EXT_PATTERN.test(rawUrl)
}
