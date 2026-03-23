export const CHAT_MORE_MENU_ITEMS = [
  { key: 'game-code', label: '游戏代码选取' },
  { key: 'pull-ai', label: '拉取 AI' },
  { key: 'custom-name', label: '自定义对方昵称' },
  { key: 'meeting-status', label: '会议/协作 状态' },
  { key: 'personal-ai', label: '个性化AI' },
  { key: 'role-preset', label: '角色预设' },
  { key: 'dual-ai-loop', label: '双 AI 轮询对话', accent: true }
]

export const CHAT_MORE_COLLAB_STATUS_OPTIONS = [
  { value: 'private-chat', label: '私聊沟通', headerLabel: '讨论中', tone: 'discussion' },
  { value: 'pair-programming', label: '结对编程', headerLabel: '编程中', tone: 'coding' },
  { value: 'planning', label: '方案讨论', headerLabel: '方案中', tone: 'planning' },
  { value: 'review', label: '代码评审', headerLabel: '评审中', tone: 'review' },
  { value: 'client-sync', label: '客户沟通', headerLabel: '沟通中', tone: 'sync' }
]

export const CHAT_MORE_ROLE_PRESET_OPTIONS = [
  '初学者',
  '产品经理',
  '客户',
  '策划',
  '程序',
  '美术',
  '测试'
]

export const CHAT_MORE_BUILTIN_MODELS = [
  'DouBaoSeed1.6',
  'GPT-5.4',
  'Claude 4.6 opus',
  'Gemini 3.0 Pro',
  'DeepSeek-R1',
  'Qwen3-CodeMax'
]

export const CHAT_MORE_BUILTIN_MODEL_META = {
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
  'DeepSeek-R1': {
    label: 'DeepSeek-R1',
    logo: '/Ai/DeepSeekR1.png'
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
  customNickname: '',
  collaborationStatus: CHAT_MORE_COLLAB_STATUS_OPTIONS[0].value,
  collaborationNote: '',
  peerRolePreset: CHAT_MORE_ROLE_PRESET_OPTIONS[0],
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
    customNickname: String(rawSettings?.customNickname || '').trim(),
    collaborationStatus: String(rawSettings?.collaborationStatus || fallback.collaborationStatus).trim() || fallback.collaborationStatus,
    collaborationNote: String(rawSettings?.collaborationNote || '').trim(),
    peerRolePreset: String(rawSettings?.peerRolePreset || fallback.peerRolePreset).trim() || fallback.peerRolePreset,
    dualAiLoopEnabled: Boolean(rawSettings?.dualAiLoopEnabled),
    dualAiLoopPrompt: String(rawSettings?.dualAiLoopPrompt || fallback.dualAiLoopPrompt).trim() || fallback.dualAiLoopPrompt,
    dualAiLoopTurnCount: Number(rawSettings?.dualAiLoopTurnCount || 0) || 0,
    aiSlots: [0, 1].map((index) => normalizeAiSlot(rawSlots[index], index))
  }
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

export const compressImageToWebpDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const maxSize = 320
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('当前浏览器不支持图片压缩'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('图片压缩失败'))
          return
        }
        const blobReader = new FileReader()
        blobReader.onload = () => resolve(String(blobReader.result || ''))
        blobReader.onerror = () => reject(new Error('图片读取失败'))
        blobReader.readAsDataURL(blob)
      }, 'image/webp', 0.82)
    }
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = String(reader.result || '')
  }
  reader.onerror = () => reject(new Error('图片读取失败'))
  reader.readAsDataURL(file)
})
