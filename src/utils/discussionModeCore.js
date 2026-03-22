import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import python from 'highlight.js/lib/languages/python'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import { getAvatarUrl } from './avatar'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('python', python)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c', cpp)
hljs.registerLanguage('csharp', csharp)

const MODE_LABELS = {
  friend: '好友',
  room: '房间',
  match: '匹配'
}

const STATUS_LABELS = {
  waiting: '等待中',
  active: '讨论中',
  closed: '已关闭'
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #8ab4ff, #4d7cff)',
  'linear-gradient(135deg, #ffb199, #ff6a88)',
  'linear-gradient(135deg, #6dd5ed, #2193b0)',
  'linear-gradient(135deg, #a18cd1, #6a82fb)',
  'linear-gradient(135deg, #f6d365, #fda085)'
]

const AI_AVATAR_URL = '/Ai/DouBaoSeed1.6.png'
const MESSAGE_TIME_DIVIDER_MS = 45 * 60 * 1000

export const toDiscussionInt = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export const formatDiscussionClock = (value) => {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const getDiscussionRoomColor = (roomId) => {
  const colorIndex = Math.abs(Number(roomId || 0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[colorIndex]
}

export const resolveDiscussionRoomAvatarUrl = (rawAvatarUrl) => {
  const value = String(rawAvatarUrl || '').trim()
  if (!value || value === '/avatars/default-avatar.svg') return ''
  return getAvatarUrl(value)
}

export const parseDiscussionMetadata = (raw) => {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

export const normalizeDiscussionAttachment = (attachment) => {
  if (!attachment || typeof attachment !== 'object') return null
  const url = String(attachment.url || '').trim()
  if (!url) return null
  const type = String(attachment.type || '').trim().toLowerCase()
  if (!['image', 'video', 'code'].includes(type)) return null
  return {
    type,
    url,
    name: String(attachment.name || '').trim()
  }
}

export const normalizeDiscussionCodePreview = (codePreview) => {
  if (!codePreview || typeof codePreview !== 'object') return null
  const path = String(codePreview.path || '').trim()
  const snippet = String(codePreview.snippet || '').replace(/\r/g, '').trim()
  if (!path || !snippet) return null
  return {
    path,
    snippet,
    language: String(codePreview.language || '').trim(),
    totalLines: Number.parseInt(codePreview.total_lines, 10) || null
  }
}

export const normalizeDiscussionDocumentPreview = (documentPreview) => {
  if (!documentPreview || typeof documentPreview !== 'object') return null
  const documentId = Number.parseInt(documentPreview.document_id, 10)
  const name = String(documentPreview.name || '').trim()
  if (!documentId || !name) return null
  return {
    documentId,
    name,
    previewText: String(documentPreview.preview_text || '').replace(/\r/g, '').trim(),
    pageCount: Number.parseInt(documentPreview.page_count, 10) || null,
    mimeType: String(documentPreview.mime_type || '').trim()
  }
}

export const formatDiscussionMessageTimeDivider = (rawTime) => {
  const date = rawTime ? new Date(rawTime) : null
  if (!date || Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const isSameYear = date.getFullYear() === now.getFullYear()
  const isSameDay = isSameYear
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()

  if (isSameDay) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  if (isSameYear) {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '')
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(',', '')
}

export const shouldShowDiscussionMessageTimeDivider = (messages = [], index = 0) => {
  const current = messages[index]
  if (!current?.rawTime) return false
  if (index === 0) return true

  const previous = messages[index - 1]
  if (!previous?.rawTime) return true

  const currentTime = new Date(current.rawTime).getTime()
  const previousTime = new Date(previous.rawTime).getTime()
  if (Number.isNaN(currentTime) || Number.isNaN(previousTime)) return index === 0

  return currentTime - previousTime >= MESSAGE_TIME_DIVIDER_MS
}

export const inferDiscussionCodeLanguage = (filePath = '') => {
  const normalized = String(filePath || '').toLowerCase()
  if (normalized.endsWith('.ts')) return 'TypeScript'
  if (normalized.endsWith('.tsx')) return 'TSX'
  if (normalized.endsWith('.js')) return 'JavaScript'
  if (normalized.endsWith('.jsx')) return 'JSX'
  if (normalized.endsWith('.vue')) return 'Vue'
  if (normalized.endsWith('.css') || normalized.endsWith('.scss') || normalized.endsWith('.less')) return 'CSS'
  if (normalized.endsWith('.json')) return 'JSON'
  if (normalized.endsWith('.md')) return 'Markdown'
  if (normalized.endsWith('.py')) return 'Python'
  if (normalized.endsWith('.cs')) return 'C#'
  if (normalized.endsWith('.cpp') || normalized.endsWith('.cc') || normalized.endsWith('.c')) return 'C/C++'
  if (normalized.endsWith('.h')) return 'Header'
  if (normalized.endsWith('.html')) return 'HTML'
  return 'Code'
}

export const getDiscussionCodeTypeIconByPath = (filePath = '') => {
  const normalized = String(filePath || '').toLowerCase()
  if (normalized.endsWith('.ts') || normalized.endsWith('.tsx')) return '/codeType/typescript.jpg'
  if (normalized.endsWith('.cs')) return '/codeType/csharp.webp'
  return '/codeType/js.webp'
}

const inferDiscussionHighlightLanguage = (filePath = '') => {
  const normalized = String(filePath || '').toLowerCase()
  if (normalized.endsWith('.ts') || normalized.endsWith('.tsx')) return 'typescript'
  if (normalized.endsWith('.js') || normalized.endsWith('.jsx')) return 'javascript'
  if (normalized.endsWith('.vue') || normalized.endsWith('.html')) return 'xml'
  if (normalized.endsWith('.css') || normalized.endsWith('.scss') || normalized.endsWith('.less')) return 'css'
  if (normalized.endsWith('.json')) return 'json'
  if (normalized.endsWith('.py')) return 'python'
  if (normalized.endsWith('.cs')) return 'csharp'
  if (normalized.endsWith('.cpp') || normalized.endsWith('.cc')) return 'cpp'
  if (normalized.endsWith('.c') || normalized.endsWith('.h')) return 'c'
  return ''
}

export const highlightDiscussionCode = (content = '', filePath = '') => {
  const source = String(content || '')
  if (!source) return ''

  const language = inferDiscussionHighlightLanguage(filePath)
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(source, { language }).value
    } catch {
      // fallback to auto detect
    }
  }

  try {
    return hljs.highlightAuto(source).value
  } catch {
    return source
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}

export const normalizeDiscussionDocumentPickerItem = (document = {}) => {
  const id = Number.parseInt(document.id, 10)
  const name = String(document.file_name || document.name || '').trim()
  if (!id || !name) return null
  const pageCount = Number.parseInt(document.page_count, 10)
  return {
    id,
    name,
    previewText: String(document.preview_text || '').trim(),
    mimeType: String(document.mime_type || '').trim(),
    pageCount: Number.isInteger(pageCount) && pageCount > 0 ? pageCount : null
  }
}

export const normalizeDiscussionCodeFile = (file = {}) => {
  const path = String(file.path || '').trim()
  const content = String(file.content || '').replace(/\r/g, '')
  if (!path) return null
  return {
    path,
    content,
    language: inferDiscussionCodeLanguage(path)
  }
}

export const buildDiscussionCodePreview = (file = {}) => {
  const lines = String(file.content || '').replace(/\r/g, '').split('\n')
  const snippet = lines.slice(0, 14).join('\n').slice(0, 1500)
  return {
    path: file.path,
    snippet,
    language: file.language || inferDiscussionCodeLanguage(file.path),
    total_lines: lines.length
  }
}

export const createDiscussionChatFromRoom = (room = {}) => {
  const roomName = room.title?.trim() || `${room.game_title || '未命名游戏'} 讨论房`
  const isFriendRoom = room.mode === 'friend'
  const friendUserId = toDiscussionInt(room.friend_user_id)
  const hostUserId = toDiscussionInt(room.host_user_id)
  const friendName = String(room.friend_username || '').trim()
  const displayName = isFriendRoom && friendName ? friendName : roomName
  const displayUserId = isFriendRoom ? friendUserId : hostUserId
  const avatarText = displayName.charAt(0).toUpperCase() || 'R'
  const avatarUrl = isFriendRoom ? resolveDiscussionRoomAvatarUrl(room.friend_avatar_url) : ''
  const memberCount = Number(room.joined_count || 0)
  const maxMembers = Number(room.max_members || 4)
  const modeLabel = MODE_LABELS[room.mode] || '房间'
  const statusLabel = STATUS_LABELS[room.status] || room.status || '未知状态'
  const baseStatus = `${modeLabel} · ${memberCount}/${maxMembers}`
  const preview = (room.last_message_content || '暂无消息，发送第一条开始讨论').toString()

  return {
    id: Number(room.id),
    name: displayName,
    baseName: displayName,
    verified: room.mode === 'match',
    time: formatDiscussionClock(room.last_message_at || room.updated_at || room.created_at),
    preview,
    unread: 0,
    avatar: avatarText,
    avatarUrl,
    avatarColor: getDiscussionRoomColor(room.id),
    status: `${baseStatus} · ${statusLabel}`,
    baseStatus,
    statusRaw: room.status,
    roomStatusLabel: statusLabel,
    roomCode: room.room_code,
    mode: room.mode,
    visibility: room.visibility,
    displayUserId,
    gameId: room.game_id,
    gameTitle: room.game_title,
    displayRolePreset: '',
    memberCount,
    maxMembers,
    messages: [],
    messagesLoaded: false
  }
}

export const mapDiscussionMessage = (item, context = {}) => {
  const senderType = item.sender_type || 'user'
  const senderUserId = toDiscussionInt(item.sender_user_id)
  const isMine = senderType === 'user' && senderUserId === context.currentUserId
  const metadata = parseDiscussionMetadata(item.metadata_json)
  const attachment = normalizeDiscussionAttachment(metadata?.attachment || null)
  const codePreview = normalizeDiscussionCodePreview(metadata?.code_preview || null)
  const documentPreview = normalizeDiscussionDocumentPreview(metadata?.document_preview || null)
  const localAiName = String(metadata?.local_ai_name || '').trim()
  const localAiAvatarUrl = String(metadata?.local_ai_avatar_url || '').trim()
  let text = (item.content || '').toString()

  if (codePreview && /^代码预览[:：]/.test(text)) {
    text = ''
  }
  if (documentPreview && /^文档预览[:：]/.test(text)) {
    text = ''
  }
  if (attachment?.type === 'image') {
    text = ''
  }

  const senderName = isMine
    ? context.currentUsername
    : localAiName || item.username || (senderType === 'ai' ? 'AI 助手' : senderType === 'system' ? '系统' : '成员')

  const avatarUrl = senderType === 'ai'
    ? (localAiAvatarUrl || AI_AVATAR_URL)
    : isMine
      ? context.currentUserAvatarUrl
      : getAvatarUrl(item.avatar_url || '')

  if (senderType === 'system') text = `[系统] ${text}`
  if (senderType === 'ai') text = `[AI] ${text}`

  return {
    id: item.id || Date.now(),
    from: isMine ? 'me' : 'theirs',
    senderType,
    senderUserId,
    senderName,
    avatarUrl,
    attachment,
    codePreview,
    documentPreview,
    text,
    time: formatDiscussionClock(item.created_at),
    rawTime: item.created_at
  }
}

export const buildDiscussionChatSummary = (rawMessage, context = {}) => {
  if (!rawMessage) {
    return {
      preview: '',
      time: '--:--'
    }
  }

  const senderType = rawMessage.sender_type || 'user'
  const senderUserId = toDiscussionInt(rawMessage.sender_user_id)
  const prefix = senderType === 'ai'
    ? 'AI: '
    : senderType === 'system'
      ? '系统: '
      : senderType === 'user' && senderUserId === context.currentUserId
        ? 'You: '
        : ''

  const content = (rawMessage.content || '').toString()
  return {
    preview: `${prefix}${content}`.slice(0, 120),
    time: formatDiscussionClock(rawMessage.created_at || new Date())
  }
}

export const shouldCountDiscussionMessageAsUnread = (rawMessage, currentUserId) => {
  const senderType = rawMessage?.sender_type || 'user'
  const senderUserId = toDiscussionInt(rawMessage?.sender_user_id)
  if (senderType === 'user') {
    return senderUserId !== currentUserId
  }
  return senderType === 'ai'
}
