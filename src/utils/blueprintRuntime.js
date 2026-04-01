export const PROGRESS_STAGE_LABELS = {
  queued: '准备',
  metadata: '元信息',
  code: '代码',
  video: '关键帧',
  vision: '视觉',
  prepare: '整理输入',
  generate: '模型生成',
  parse: '解析结果',
  finalize: '收尾'
}

export const normalizeBlueprintRuntimeText = (value = '') => {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim()
  }

  try {
    return JSON.stringify(value, null, 2).trim()
  } catch {
    return String(value).trim()
  }
}

export const getRuntimeBundleFiles = (runtime = null) => {
  const files = runtime?.artifactJson?.files
  return files && typeof files === 'object' ? files : {}
}

export const formatRunStatusLabel = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  if (normalizedStatus === 'completed') return '已完成'
  if (normalizedStatus === 'failed') return '失败'
  if (normalizedStatus === 'running') return '运行中'
  if (normalizedStatus === 'cancel_requested') return '取消中'
  if (normalizedStatus === 'cancelled') return '已取消'
  return '待处理'
}

export const formatBlueprintTimestamp = (value) => {
  if (!value) return '最近保存'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '最近保存'

  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const buildProgressTrail = (currentTrail = [], patch = {}) => {
  const detail = String(patch.detail || '').trim()
  if (!detail) return currentTrail

  const nextEntry = {
    stage: String(patch.stage || ''),
    label: PROGRESS_STAGE_LABELS[String(patch.stage || '')] || '处理中',
    detail
  }

  return [...currentTrail, nextEntry].slice(-3)
}

export const resolvePersistableRuntimeText = (node = {}, runtime = null, isPersistableNode = () => false) => {
  if (!isPersistableNode(node?.kind)) return ''
  if (String(runtime?.status || '') !== 'completed') return ''
  if (String(runtime?.artifactType || '') === 'file-bundle') return ''

  return normalizeBlueprintRuntimeText(runtime?.output)
}

export const createBlueprintEdgePath = (start, end, orientation = 'horizontal') => {
  if (orientation === 'vertical') {
    const delta = Math.max(72, Math.abs(end.y - start.y) * 0.4)
    return `M ${start.x} ${start.y} C ${start.x} ${start.y + delta}, ${end.x} ${end.y - delta}, ${end.x} ${end.y}`
  }

  const delta = Math.max(72, Math.abs(end.x - start.x) * 0.4)
  return `M ${start.x} ${start.y} C ${start.x + delta} ${start.y}, ${end.x - delta} ${end.y}, ${end.x} ${end.y}`
}
