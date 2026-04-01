import { CHAT_MORE_BUILTIN_MODEL_META } from './discussionChatMore.js'

export const DEFAULT_BLUEPRINT_VISION_MODEL = 'DouBaoSeed'

export const BLUEPRINT_VISION_MODELS = [
  'DouBaoSeed',
  'GLM-4.6V'
]

export const BLUEPRINT_VISION_MODEL_OPTIONS = BLUEPRINT_VISION_MODELS.map((value) => {
  const meta = CHAT_MORE_BUILTIN_MODEL_META[value] || {}
  return {
    label: meta.label || value,
    value,
    logoSrc: meta.logo || '',
    logoAlt: meta.label || value
  }
})
