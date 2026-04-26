const COMMENT_TARGET_ENDPOINTS = {
  game: targetId => `/games/${targetId}/comments`,
  doc: targetId => `/docs/${targetId}/comments`
}

export const normalizeCommentTargetId = (targetId) => {
  const normalized = String(targetId || '').trim()
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(normalized)) {
    throw new Error('无效的评论目标')
  }
  return normalized
}

export const getCommentEndpoint = (targetType, targetId) => {
  const key = String(targetType || '').trim().toLowerCase()
  const endpointBuilder = COMMENT_TARGET_ENDPOINTS[key]
  if (!endpointBuilder) {
    throw new Error('不支持的评论目标')
  }
  return endpointBuilder(normalizeCommentTargetId(targetId))
}
