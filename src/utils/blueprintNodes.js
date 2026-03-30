export const BP_GRID_SIZE = 34
export const BP_GAME_DRAG_MIME = 'application/x-dpcc-blueprint-game'
const VIDEO_EXT_PATTERN = /\.(mp4|webm|ogg|m4v|mov)(\?.*)?$/i
export const BP_WORLD_WIDTH = 4800
export const BP_WORLD_HEIGHT = 3200

export const BP_NODE_DIMENSIONS = {
  game: { width: 238, height: 212 },
  design: { width: 214, height: 72 },
  mixer: { width: 214, height: 72 },
  music: { width: 214, height: 72 },
  play: { width: 214, height: 72 },
  'prompt-negative': { width: 214, height: 72 },
  'prompt-positive': { width: 214, height: 72 }
}

export const BLUEPRINT_COMPACT_NODE_META = {
  'prompt-positive': {
    title: '正向提示词',
    subtitle: 'Structured Prompt',
    iconClass: 'fa fa-wand-magic-sparkles',
    iconBackground: '#ececec',
    iconColor: '#111111',
    contentLabel: '提示词内容',
    contentPlaceholder: '输入正向提示词内容'
  },
  'prompt-negative': {
    title: '反向提示词',
    subtitle: 'Negative Prompt',
    iconClass: 'fa fa-arrows-rotate',
    iconBackground: '#ffe2e2',
    iconColor: '#8a1f1f',
    contentLabel: '负向提示词',
    contentPlaceholder: '输入需要规避的内容'
  },
  mixer: {
    title: 'Mixer',
    subtitle: 'Context Mixer',
    iconClass: 'fa fa-link',
    iconBackground: '#e6ecff',
    iconColor: '#2441a8',
    contentLabel: '混合说明',
    contentPlaceholder: '输入节点混合和串联说明'
  },
  design: {
    title: '游戏设定',
    subtitle: 'Game Design',
    iconClass: 'fa fa-map',
    iconBackground: '#e6f7e8',
    iconColor: '#24643d',
    contentLabel: '设定描述',
    contentPlaceholder: '输入世界观、风格和核心设定'
  },
  play: {
    title: '游戏玩法',
    subtitle: 'Gameplay Loop',
    iconClass: 'fa fa-gamepad',
    iconBackground: '#fff1d8',
    iconColor: '#8f5b00',
    contentLabel: '玩法描述',
    contentPlaceholder: '输入核心玩法和循环设计'
  },
  music: {
    title: '游戏音乐',
    subtitle: 'Game Music',
    iconClass: 'fa fa-music',
    iconBackground: '#dcecff',
    iconColor: '#1f5f9a',
    contentLabel: '音乐描述',
    contentPlaceholder: '输入音乐氛围、节奏和参考方向'
  }
}

const BP_EDGE_COLOR_BY_PAIR = {
  'game:prompt-positive': '#2fcf5f',
  'game:prompt-negative': '#ff5a5f',
  'game:mixer': '#2d7ff9',
  'game:design': '#ff9f1c',
  'game:play': '#b83280',
  'game:music': '#12c2e9',
  'prompt-positive:mixer': '#4a7cff',
  'prompt-negative:mixer': '#ff6b81',
  'mixer:design': '#ff8c42',
  'mixer:play': '#a855f7',
  'mixer:music': '#00b8d9',
  'design:play': '#ff6f61',
  'design:music': '#17bebb',
  'play:music': '#7c4dff'
}

const BP_EDGE_COLOR_BY_TARGET = {
  'prompt-positive': '#2fcf5f',
  'prompt-negative': '#ff5a5f',
  mixer: '#4a7cff',
  design: '#ff9f1c',
  play: '#b83280',
  music: '#12c2e9',
  game: '#ffd166'
}

export const isBlueprintCompactNodeKind = (kind = '') =>
  Object.prototype.hasOwnProperty.call(BLUEPRINT_COMPACT_NODE_META, String(kind || ''))

export const getBlueprintEdgeColor = (fromKind = '', toKind = '') => {
  const pairKey = `${String(fromKind || '')}:${String(toKind || '')}`

  return BP_EDGE_COLOR_BY_PAIR[pairKey]
    || BP_EDGE_COLOR_BY_TARGET[String(toKind || '')]
    || '#5e8bff'
}

export const getBlueprintEdgePreviewColor = (fromKind = '') =>
  BP_EDGE_COLOR_BY_TARGET[String(fromKind || '')] || '#8c8c8c'

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
  title: BLUEPRINT_COMPACT_NODE_META['prompt-positive'].title,
  subtitle: BLUEPRINT_COMPACT_NODE_META['prompt-positive'].subtitle,
  iconClass: BLUEPRINT_COMPACT_NODE_META['prompt-positive'].iconClass,
  iconBackground: BLUEPRINT_COMPACT_NODE_META['prompt-positive'].iconBackground,
  iconColor: BLUEPRINT_COMPACT_NODE_META['prompt-positive'].iconColor,
  content: '',
  fields: {
    theme: '',
    style: '',
    gameplay: '',
    keywords: ''
  },
  position: snapPointToGrid(point)
})

export const createBlueprintCompactNode = (kind = 'prompt-positive', point = {}, createId = () => '') => {
  const meta = BLUEPRINT_COMPACT_NODE_META[kind] || BLUEPRINT_COMPACT_NODE_META['prompt-positive']

  return {
    id: createId(),
    kind,
    title: meta.title,
    subtitle: meta.subtitle,
    iconClass: meta.iconClass,
    iconBackground: meta.iconBackground,
    iconColor: meta.iconColor,
    content: '',
    position: snapPointToGrid(point)
  }
}

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

export const updateBlueprintNodeContent = (nodes = [], nodeId, content = '') =>
  nodes.map((node) => {
    if (node.id !== nodeId) return node

    return {
      ...node,
      content: String(content || '')
    }
  })

export const removeBlueprintNode = (nodes = [], edges = [], nodeId = '') => ({
  nodes: nodes.filter((node) => node.id !== nodeId),
  edges: edges.filter((edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId)
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

export const getBlueprintNodePortPoint = (node = {}, portType = 'output', measuredDimensions = null) => {
  const fallbackDimensions = BP_NODE_DIMENSIONS[node.kind] || BP_NODE_DIMENSIONS.game
  const dimensions = {
    width: Number(measuredDimensions?.width) || fallbackDimensions.width,
    height: Number(measuredDimensions?.height) || fallbackDimensions.height
  }

  if (portType === 'left' || portType === 'input') {
    return {
      x: node.position.x,
      y: node.position.y + dimensions.height / 2
    }
  }

  if (portType === 'top') {
    return {
      x: node.position.x + dimensions.width / 2,
      y: node.position.y
    }
  }

  if (portType === 'bottom') {
    return {
      x: node.position.x + dimensions.width / 2,
      y: node.position.y + dimensions.height
    }
  }

  const x = node.position.x + dimensions.width
  const y = node.position.y + dimensions.height / 2

  return { x, y }
}

export const getBlueprintEdgePortPositions = (fromNode = {}, toNode = {}) => {
  const fromX = Number(fromNode?.position?.x) || 0
  const fromY = Number(fromNode?.position?.y) || 0
  const toX = Number(toNode?.position?.x) || 0
  const toY = Number(toNode?.position?.y) || 0
  const deltaX = toX - fromX
  const deltaY = toY - fromY

  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    if (deltaY >= 0) {
      return {
        fromPort: 'bottom',
        toPort: 'top'
      }
    }

    return {
      fromPort: 'top',
      toPort: 'bottom'
    }
  }

  if (deltaX >= 0) {
    return {
      fromPort: 'right',
      toPort: 'left'
    }
  }

  return {
    fromPort: 'left',
    toPort: 'right'
  }
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
    .filter((node) => node?.id && node?.position && (
      ['game', 'prompt-positive'].includes(node?.kind)
      || isBlueprintCompactNodeKind(node?.kind)
    ))
    .map((node) => {
      if (node.kind === 'prompt-positive') {
        return {
          ...node,
          title: node.title || BLUEPRINT_COMPACT_NODE_META['prompt-positive'].title,
          subtitle: String(node.subtitle || BLUEPRINT_COMPACT_NODE_META['prompt-positive'].subtitle),
          iconClass: String(node.iconClass || BLUEPRINT_COMPACT_NODE_META['prompt-positive'].iconClass),
          iconBackground: String(node.iconBackground || BLUEPRINT_COMPACT_NODE_META['prompt-positive'].iconBackground),
          iconColor: String(node.iconColor || BLUEPRINT_COMPACT_NODE_META['prompt-positive'].iconColor),
          content: String(
            node.content
            || node?.fields?.theme
            || node?.fields?.keywords
            || ''
          ),
          fields: {
            theme: String(node?.fields?.theme || ''),
            style: String(node?.fields?.style || ''),
            gameplay: String(node?.fields?.gameplay || ''),
            keywords: String(node?.fields?.keywords || '')
          },
          position: snapPointToGrid(node.position)
        }
      }

      if (isBlueprintCompactNodeKind(node.kind)) {
        const meta = BLUEPRINT_COMPACT_NODE_META[node.kind]

        return {
          ...node,
          title: String(node.title || meta.title),
          subtitle: String(node.subtitle || meta.subtitle),
          iconClass: String(node.iconClass || meta.iconClass),
          iconBackground: String(node.iconBackground || meta.iconBackground),
          iconColor: String(node.iconColor || meta.iconColor),
          content: String(node.content || ''),
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
