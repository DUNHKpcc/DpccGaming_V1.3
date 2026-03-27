const codeTypeIconMap = {
  typescript: '/codeType/typescript.jpg',
  javascript: '/codeType/js.webp',
  'c#': '/codeType/csharp.webp'
}

const engineIconMap = {
  godot: '/engineType/godot.webp',
  unity: '/engineType/unity.webp',
  cocos: '/engineType/cocos.webp'
}

export const getGameEngineLabel = (game) =>
  (game?.engine || game?.game_engine || game?.gameEngine || '')
    .toString()
    .trim()

export const getGameCodeTypeLabel = (game) =>
  (game?.code_type || game?.codeType || game?.code_category || '')
    .toString()
    .trim()

export const normalizeGameEngine = (value) => {
  const normalized = (value || '').toString().trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'godot') return 'godot'
  if (normalized === 'unity') return 'unity'
  if (['cocos', 'cocos2d', 'cocos-creator', 'cocos creator'].includes(normalized)) {
    return 'cocos'
  }
  if (['other', 'others', '其他'].includes(normalized)) return 'other'
  return normalized
}

export const normalizeGameCodeType = (value) => {
  const normalized = (value || '').toString().trim().toLowerCase()
  if (!normalized) return ''
  if (['typescript', 'ts'].includes(normalized)) return 'typescript'
  if (['javascript', 'js'].includes(normalized)) return 'javascript'
  if (['c#', 'csharp', 'cs'].includes(normalized)) return 'c#'
  if (['other', 'others', '其他'].includes(normalized)) return 'other'
  return normalized
}

export const getGameEngineIcon = (game) => {
  const key = normalizeGameEngine(getGameEngineLabel(game))
  return engineIconMap[key] || ''
}

export const getGameCodeTypeIcon = (game) => {
  const key = normalizeGameCodeType(getGameCodeTypeLabel(game))
  return codeTypeIconMap[key] || ''
}

export const getGameEngineIconByValue = (value) => {
  const key = normalizeGameEngine(value)
  return engineIconMap[key] || ''
}

export const getGameCodeTypeIconByValue = (value) => {
  const key = normalizeGameCodeType(value)
  return codeTypeIconMap[key] || ''
}
