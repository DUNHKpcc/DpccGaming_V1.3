import { compressImageToWebpDataUrl } from './image'
export { isPullAiConnectionField } from './discussionAiSlotFields.js'

export const CHAT_MORE_DIRECT_MENU_ITEMS = [
  { key: 'game-code', label: '游戏代码选取' },
  { key: 'pull-ai', label: '拉取 AI' },
  { key: 'custom-name', label: '自定义对方昵称' },
  { key: 'meeting-status', label: '会议/协作状态' },
  { key: 'personal-ai', label: '个性化 AI' },
  { key: 'dual-ai-loop', label: '双 AI 轮询对话', accent: true }
]

export const CHAT_MORE_GROUP_MENU_ITEMS = [
  { key: 'group-profile', label: '群聊信息' },
  { key: 'group-members', label: '群成员详情' },
  { key: 'group-invite', label: '邀请成员' },
  { key: 'custom-name', label: '我在本群的昵称' },
  { key: 'game-code', label: '游戏代码选取' },
  { key: 'pull-ai', label: '拉取 AI' },
  { key: 'meeting-status', label: '会议/协作状态' },
  { key: 'personal-ai', label: '个性化 AI' },
  { key: 'dual-ai-loop', label: '双 AI 轮询对话', accent: true }
]

export const CHAT_MORE_COLLAB_STATUS_OPTIONS = [
  { value: 'private-chat', label: '私聊沟通', headerLabel: '讨论中', tone: 'discussion' },
  { value: 'pair-programming', label: '结对编程', headerLabel: '编程中', tone: 'coding' },
  { value: 'planning', label: '方案讨论', headerLabel: '方案中', tone: 'planning' },
  { value: 'review', label: '代码评审', headerLabel: '评审中', tone: 'review' },
  { value: 'client-sync', label: '客户沟通', headerLabel: '沟通中', tone: 'sync' }
]

export const CHAT_MORE_GROUP_INVITE_PERMISSION_OPTIONS = [
  { value: 'host-only', label: '仅群主可邀请' },
  { value: 'all-members', label: '所有成员可邀请' }
]

export const CHAT_MORE_BUILTIN_MODELS = [
  'DouBaoSeed',
  'GPT-5.4',
  'Claude 4.6 opus',
  'Gemini 3.0 Pro',
  'GLM-4.5',
  'Qwen3-CodeMax'
]

export const CHAT_MORE_BUILTIN_MODEL_META = {
  'DouBaoSeed': {
    label: 'DouBaoSeed',
    logo: '/Ai/DouBaoSeed1.6.png'
  },
  'DouBaoSeed1.6': {
    label: 'DouBaoSeed1.6',
    logo: '/Ai/DouBaoSeed1.6.png'
  },
  'GPT-5.4': {
    label: 'GPT-5.4',
    logo: '/Ai/ChatGPT.svg'
  },
  'Claude 4.6 opus': {
    label: 'Claude 4.6 opus',
    logo: '/Ai/Claude.png'
  },
  'Gemini 3.0 Pro': {
    label: 'Gemini 3.0 Pro',
    logo: '/Ai/Gemini.svg'
  },
  'GLM-4.5': {
    label: 'GLM-4.5',
    logo: '/Ai/GLM5.png'
  },
  'Qwen3-CodeMax': {
    label: 'Qwen-CodeMax',
    logo: '/Ai/Qwen.png'
  }
}

export const createDefaultAiSlot = (id, fallbackName = 'AI 助手') => ({
  id,
  enabled: false,
  provider: 'builtin',
  builtinModel: CHAT_MORE_BUILTIN_MODELS[0],
  customModel: '',
  customEndpoint: '',
  apiKey: '',
  hasApiKey: false,
  ownerUserId: null,
  name: fallbackName,
  context: '',
  intensity: 60,
  memoryEnabled: true,
  avatarUrl: '',
  avatarUpdatedAt: 0
})

export const createDefaultChatMoreSettings = () => ({
  sourceGameId: '',
  sourceGameTitle: '',
  roomTitle: '',
  roomAvatarUrl: '',
  roomMaxMembers: 4,
  invitePermission: CHAT_MORE_GROUP_INVITE_PERMISSION_OPTIONS[0].value,
  customNickname: '',
  clearedBeforeMessageId: 0,
  collaborationStatus: CHAT_MORE_COLLAB_STATUS_OPTIONS[0].value,
  collaborationNote: '',
  dualAiLoopEnabled: false,
  dualAiLoopPrompt: '围绕当前房间里的需求继续推进讨论，并给出下一步。',
  dualAiLoopTurnCount: 0,
  aiSlots: [
    createDefaultAiSlot('slot-1', '协作 AI 1'),
    createDefaultAiSlot('slot-2', '协作 AI 2')
  ]
})

export const normalizeAiSlot = (rawSlot = {}, index = 0) => {
  const fallback = createDefaultAiSlot(`slot-${index + 1}`, `协作 AI ${index + 1}`)
  return {
    ...fallback,
    ...rawSlot,
    id: String(rawSlot?.id || fallback.id),
    enabled: Boolean(rawSlot?.enabled),
    provider: rawSlot?.provider === 'custom' ? 'custom' : 'builtin',
    builtinModel: String(rawSlot?.builtinModel || fallback.builtinModel).trim() || fallback.builtinModel,
    customModel: String(rawSlot?.customModel || '').trim(),
    customEndpoint: String(rawSlot?.customEndpoint || '').trim(),
    apiKey: String(rawSlot?.apiKey || '').trim(),
    hasApiKey: Boolean(rawSlot?.hasApiKey || rawSlot?.apiKey),
    ownerUserId: Number(rawSlot?.ownerUserId || 0) || null,
    name: String(rawSlot?.name || fallback.name).trim() || fallback.name,
    context: String(rawSlot?.context || '').trim(),
    intensity: Math.max(0, Math.min(100, Number(rawSlot?.intensity || fallback.intensity) || fallback.intensity)),
    memoryEnabled: rawSlot?.memoryEnabled !== false,
    avatarUrl: String(rawSlot?.avatarUrl || '').trim(),
    avatarUpdatedAt: Number(rawSlot?.avatarUpdatedAt || 0) || 0
  }
}

export const normalizeChatMoreSettings = (rawSettings = {}) => {
  const fallback = createDefaultChatMoreSettings()
  const rawSlots = Array.isArray(rawSettings?.aiSlots) ? rawSettings.aiSlots : []
  return {
    ...fallback,
    ...rawSettings,
    sourceGameId: String(rawSettings?.sourceGameId || '').trim(),
    sourceGameTitle: String(rawSettings?.sourceGameTitle || '').trim(),
    roomTitle: String(rawSettings?.roomTitle || '').trim(),
    roomAvatarUrl: String(rawSettings?.roomAvatarUrl || '').trim(),
    roomMaxMembers: Math.max(2, Math.min(4, Number(rawSettings?.roomMaxMembers || fallback.roomMaxMembers) || fallback.roomMaxMembers)),
    invitePermission: String(rawSettings?.invitePermission || fallback.invitePermission).trim() || fallback.invitePermission,
    customNickname: String(rawSettings?.customNickname || '').trim(),
    clearedBeforeMessageId: Math.max(0, Number(rawSettings?.clearedBeforeMessageId || 0) || 0),
    collaborationStatus: String(rawSettings?.collaborationStatus || fallback.collaborationStatus).trim() || fallback.collaborationStatus,
    collaborationNote: String(rawSettings?.collaborationNote || '').trim(),
    dualAiLoopEnabled: Boolean(rawSettings?.dualAiLoopEnabled),
    dualAiLoopPrompt: String(rawSettings?.dualAiLoopPrompt || fallback.dualAiLoopPrompt).trim() || fallback.dualAiLoopPrompt,
    dualAiLoopTurnCount: Number(rawSettings?.dualAiLoopTurnCount || 0) || 0,
    aiSlots: [0, 1].map((index) => normalizeAiSlot(rawSlots[index], index))
  }
}

export const getChatMoreMenuItems = (chat = null) => {
  if (chat?.mode === 'room') return CHAT_MORE_GROUP_MENU_ITEMS
  return CHAT_MORE_DIRECT_MENU_ITEMS
}

export const getCollaborationStatusLabel = (statusValue = '') => {
  const matched = CHAT_MORE_COLLAB_STATUS_OPTIONS.find((item) => item.value === statusValue)
  return matched?.label || CHAT_MORE_COLLAB_STATUS_OPTIONS[0].label
}

export const getCollaborationStatusMeta = (statusValue = '') => {
  return CHAT_MORE_COLLAB_STATUS_OPTIONS.find((item) => item.value === statusValue)
    || CHAT_MORE_COLLAB_STATUS_OPTIONS[0]
}

export const getBuiltinModelMeta = (modelName = '') => {
  const normalized = String(modelName || '').trim()
  return CHAT_MORE_BUILTIN_MODEL_META[normalized]
    || {
    label: normalized || CHAT_MORE_BUILTIN_MODELS[0],
    logo: '/Ai/DouBaoSeed1.6.png'
  }
}

export const getBuiltinModelAvatarUrl = (modelName = '') => {
  return getBuiltinModelMeta(modelName).logo
}

export { compressImageToWebpDataUrl }
