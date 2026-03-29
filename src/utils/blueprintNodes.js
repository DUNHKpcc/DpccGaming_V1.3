export const BP_GRID_SIZE = 34
export const BP_GAME_DRAG_MIME = 'application/x-dpcc-blueprint-game'
const VIDEO_EXT_PATTERN = /\.(mp4|webm|ogg|m4v|mov)(\?.*)?$/i
export const BP_WORLD_WIDTH = 4800
export const BP_WORLD_HEIGHT = 3200

const BP_NODE_DIMENSIONS = {
  game: { width: 238, height: 212 },
  'prompt-positive': { width: 280, height: 252 }
}

const CATEGORY_MAP_EN_TO_ZH = {
  action: '动作',
  adventure: '冒险',
  puzzle: '益智',
  racing: '赛车',
  simulation: '模拟',
  strategy: '策略',
  casual: '休闲',
  sports: '体育',
  rpg: '角色扮演',
  shooter: '射击',
  arcade: '街机',
  platformer: '平台',
  card: '卡牌',
  board: '桌游',
  music: '音乐',
  horror: '恐怖',
  other: '其他'
}

export const snapValueToGrid = (value, gridSize = BP_GRID_SIZE) =>
  Math.round(Number(value || 0) / gridSize) * gridSize

export const snapPointToGrid = (point = {}, gridSize = BP_GRID_SIZE) => ({
  x: snapValueToGrid(point.x, gridSize),
  y: snapValueToGrid(point.y, gridSize)
})

export const getBlueprintGameId = (game = {}) =>
  String(game?.game_id || game?.id || '')

export const categoryToBlueprintLabel = (value) => {
  const key = String(value || 'other').trim().toLowerCase()
  return CATEGORY_MAP_EN_TO_ZH[key] || String(value || '其他')
}

export const getBlueprintGameCoverUrl = (game = {}) =>
  game?.coverUrl
  || game?.thumbnail_url
  || game?.thumbnail
  || game?.cover
  || game?.cover_url
  || '/GameImg.jpg'

export const getBlueprintGameVideoUrl = (game = {}) =>
  game?.videoUrl
  || game?.video_url
  || ''

export const hasBlueprintGameVideo = (game = {}) =>
  VIDEO_EXT_PATTERN.test(String(getBlueprintGameVideoUrl(game)).trim())

export const getBlueprintGameEngineLabel = (game = {}) =>
  String(game?.engineLabel || game?.engine || game?.game_engine || game?.gameEngine || '')
    .trim() || '未标注引擎'

export const getBlueprintGameCodeTypeLabel = (game = {}) =>
  String(game?.codeTypeLabel || game?.code_type || game?.codeType || game?.code_category || '')
    .trim() || '未标注语言'

export const createGameBlueprintNode = (game = {}, point = {}, createId = () => '') => {
  const title = game?.title || game?.name || '未命名游戏'

  return {
    id: createId(),
    kind: 'game',
    gameId: getBlueprintGameId(game),
    title,
    categoryLabel: categoryToBlueprintLabel(game?.categoryLabel || game?.category || 'other'),
    coverUrl: getBlueprintGameCoverUrl(game),
    videoUrl: hasBlueprintGameVideo(game) ? getBlueprintGameVideoUrl(game) : '',
    hasVideo: hasBlueprintGameVideo(game),
    engineLabel: getBlueprintGameEngineLabel(game),
    codeTypeLabel: getBlueprintGameCodeTypeLabel(game),
    position: snapPointToGrid(point)
  }
}

export const createPromptPositiveBlueprintNode = (point = {}, createId = () => '') => ({
  id: createId(),
  kind: 'prompt-positive',
  title: '正向提示词',
  fields: {
    theme: '',
    style: '',
    gameplay: '',
    keywords: ''
  },
  position: snapPointToGrid(point)
})

export const findGameBlueprintNode = (nodes = [], gameId) =>
  nodes.find((node) => node?.kind === 'game' && String(node?.gameId || '') === String(gameId || '')) || null

export const upsertGameBlueprintNode = (nodes = [], game = {}, point = {}, createId = () => '') => {
  const gameId = getBlueprintGameId(game)
  const duplicateNode = findGameBlueprintNode(nodes, gameId)

  if (duplicateNode) {
    return {
      created: false,
      createdNode: null,
      duplicateNode,
      nodes
    }
  }

  const createdNode = createGameBlueprintNode(game, point, createId)

  return {
    created: true,
    createdNode,
    duplicateNode: null,
    nodes: [...nodes, createdNode]
  }
}

export const updateBlueprintNodePosition = (nodes = [], nodeId, point = {}, snapToGrid = false) =>
  nodes.map((node) => {
    if (node.id !== nodeId) return node
    return {
      ...node,
      position: snapToGrid ? snapPointToGrid(point) : { x: point.x, y: point.y }
    }
  })

export const updateBlueprintNodeField = (nodes = [], nodeId, fieldKey, value) =>
  nodes.map((node) => {
    if (node.id !== nodeId || !node.fields || !(fieldKey in node.fields)) {
      return node
    }

    return {
      ...node,
      fields: {
        ...node.fields,
        [fieldKey]: value
      }
    }
  })

export const createBlueprintEdge = (fromNodeId, toNodeId, createId = () => '') => ({
  id: createId(),
  fromNodeId,
  toNodeId
})

export const upsertBlueprintEdge = (edges = [], fromNodeId, toNodeId, createId = () => '') => {
  const existing = edges.find((edge) =>
    edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId
  )

  if (existing || !fromNodeId || !toNodeId || fromNodeId === toNodeId) {
    return {
      created: false,
      createdEdge: null,
      duplicateEdge: existing || null,
      edges
    }
  }

  const createdEdge = createBlueprintEdge(fromNodeId, toNodeId, createId)
  return {
    created: true,
    createdEdge,
    duplicateEdge: null,
    edges: [...edges, createdEdge]
  }
}

export const getBlueprintNodePortPoint = (node = {}, portType = 'output') => {
  const dimensions = BP_NODE_DIMENSIONS[node.kind] || BP_NODE_DIMENSIONS.game
  const x = portType === 'input'
    ? node.position.x
    : node.position.x + dimensions.width
  const y = node.position.y + dimensions.height / 2

  return { x, y }
}

export const serializeBlueprintGameDragData = (game = {}) =>
  JSON.stringify({
    gameId: getBlueprintGameId(game)
  })

export const parseBlueprintGameDragData = (rawValue) => {
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue)
    const gameId = String(parsed?.gameId || '').trim()
    return gameId ? { gameId } : null
  } catch {
    return null
  }
}

export const serializeBlueprintWorkflow = (nodes = [], edges = []) =>
  JSON.stringify({
    version: 1,
    nodes,
    edges
  }, null, 2)

export const parseBlueprintWorkflow = (rawValue) => {
  if (!rawValue) {
    throw new Error('导入内容为空')
  }

  const parsed = JSON.parse(rawValue)
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : []
  const edges = Array.isArray(parsed?.edges) ? parsed.edges : []

  const normalizedNodes = nodes
    .filter((node) => node?.id && node?.position && ['game', 'prompt-positive'].includes(node?.kind))
    .map((node) => {
      if (node.kind === 'prompt-positive') {
        return {
          ...node,
          title: node.title || '正向提示词',
          fields: {
            theme: String(node?.fields?.theme || ''),
            style: String(node?.fields?.style || ''),
            gameplay: String(node?.fields?.gameplay || ''),
            keywords: String(node?.fields?.keywords || '')
          },
          position: snapPointToGrid(node.position)
        }
      }

      return {
        ...node,
        gameId: String(node.gameId || ''),
        videoUrl: String(node.videoUrl || ''),
        hasVideo: Boolean(node.hasVideo || hasBlueprintGameVideo({ videoUrl: node.videoUrl })),
        position: snapPointToGrid(node.position)
      }
    })

  const nodeIds = new Set(normalizedNodes.map((node) => node.id))
  const normalizedEdges = edges
    .filter((edge) => edge?.id && nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId))
    .map((edge) => ({
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId
    }))

  return {
    nodes: normalizedNodes,
    edges: normalizedEdges
  }
}
