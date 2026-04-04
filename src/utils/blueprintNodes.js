export const BP_GRID_SIZE = 34
export const BP_GAME_DRAG_MIME = 'application/x-dpcc-blueprint-game'
const VIDEO_EXT_PATTERN = /\.(mp4|webm|ogg|m4v|mov)(\?.*)?$/i
export const BP_WORLD_WIDTH = 4800
export const BP_WORLD_HEIGHT = 3200

export const BP_NODE_DIMENSIONS = {
  character: { width: 264, height: 136 },
  design: { width: 264, height: 136 },
  economy: { width: 264, height: 136 },
  game: { width: 238, height: 212 },
  language: { width: 264, height: 136 },
  level: { width: 264, height: 136 },
  mixer: { width: 264, height: 136 },
  music: { width: 264, height: 136 },
  narrative: { width: 264, height: 136 },
  play: { width: 264, height: 136 },
  progression: { width: 264, height: 136 },
  'prompt-negative': { width: 264, height: 136 },
  'prompt-positive': { width: 264, height: 136 },
  output: { width: 264, height: 136 },
  ui: { width: 264, height: 136 },
  visual: { width: 264, height: 136 }
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
  visual: {
    title: '视觉风格',
    subtitle: 'Visual Direction',
    iconClass: 'fa fa-palette',
    iconBackground: '#efe6ff',
    iconColor: '#6a35a0',
    contentLabel: '视觉描述',
    contentPlaceholder: '输入画风、色彩、镜头和氛围方向'
  },
  language: {
    title: '编程语言要求',
    subtitle: 'Code Language',
    iconClass: 'fa fa-code',
    iconBackground: '#ecf3ff',
    iconColor: '#345f9c',
    contentLabel: '目标语言',
    contentPlaceholder: '输入优先的 H5 技术方案，例如：原生 HTML/CSS/JavaScript，可直接运行'
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
  character: {
    title: '角色设定',
    subtitle: 'Character Cast',
    iconClass: 'fa fa-user',
    iconBackground: '#fff0dc',
    iconColor: '#995c11',
    contentLabel: '角色描述',
    contentPlaceholder: '输入主角、敌人、NPC 与能力定位'
  },
  ui: {
    title: 'UI/HUD',
    subtitle: 'Interface Flow',
    iconClass: 'fa fa-table-columns',
    iconBackground: '#dff4ff',
    iconColor: '#165f87',
    contentLabel: '界面描述',
    contentPlaceholder: '输入界面结构、HUD 信息和交互重点'
  },
  level: {
    title: '关卡流程',
    subtitle: 'Level Flow',
    iconClass: 'fa fa-route',
    iconBackground: '#e8f8ec',
    iconColor: '#28784d',
    contentLabel: '流程描述',
    contentPlaceholder: '输入章节推进、地图结构和任务路径'
  },
  progression: {
    title: '数值成长',
    subtitle: 'Progression Curve',
    iconClass: 'fa fa-chart-line',
    iconBackground: '#f3ebff',
    iconColor: '#6c3bb0',
    contentLabel: '成长描述',
    contentPlaceholder: '输入等级、技能、装备和成长节奏'
  },
  economy: {
    title: '经济奖励',
    subtitle: 'Economy Loop',
    iconClass: 'fa fa-coins',
    iconBackground: '#fff2d6',
    iconColor: '#946200',
    contentLabel: '经济描述',
    contentPlaceholder: '输入货币、掉落、商店和奖励循环'
  },
  narrative: {
    title: '剧情叙事',
    subtitle: 'Narrative Arc',
    iconClass: 'fa fa-book-open',
    iconBackground: '#ffe8ef',
    iconColor: '#9d2d58',
    contentLabel: '叙事描述',
    contentPlaceholder: '输入剧情背景、事件推进和对白节奏'
  },
  music: {
    title: '游戏音乐',
    subtitle: 'Game Music',
    iconClass: 'fa fa-music',
    iconBackground: '#dcecff',
    iconColor: '#1f5f9a',
    contentLabel: '音乐描述',
    contentPlaceholder: '输入音乐氛围、节奏和参考方向'
  },
  output: {
    title: '输出节点',
    subtitle: 'Prompt Output',
    iconClass: 'fa fa-paper-plane',
    iconBackground: '#e9ecf7',
    iconColor: '#2d3f76',
    contentLabel: '输出内容',
    contentPlaceholder: '输入最终 Prompt、摘要或执行指令'
  }
}

const BP_EDGE_COLOR_BY_PAIR = {
  'character:play': '#ff9b54',
  'character:ui': '#2f8cff',
  'design:character': '#4bbf73',
  'design:level': '#31a06f',
  'game:prompt-positive': '#2fcf5f',
  'game:prompt-negative': '#ff5a5f',
  'game:mixer': '#2d7ff9',
  'game:design': '#ff9f1c',
  'game:play': '#b83280',
  'game:music': '#12c2e9',
  'language:output': '#3f73d6',
  'language:play': '#5a7bdd',
  'level:progression': '#8b5cf6',
  'play:progression': '#c95d9b',
  'play:economy': '#d69a00',
  'prompt-positive:mixer': '#4a7cff',
  'prompt-negative:mixer': '#ff6b81',
  'ui:output': '#3568d4',
  'visual:music': '#5a7ff0',
  'visual:output': '#7b52d6',
  'mixer:design': '#ff8c42',
  'mixer:play': '#a855f7',
  'mixer:music': '#00b8d9',
  'mixer:visual': '#8a5cff',
  'design:play': '#ff6f61',
  'design:music': '#17bebb',
  'narrative:level': '#d94c73',
  'play:music': '#7c4dff',
  'progression:economy': '#c08700'
}

const BP_EDGE_COLOR_BY_TARGET = {
  character: '#ff9b54',
  design: '#ff9f1c',
  economy: '#d69a00',
  level: '#31a06f',
  mixer: '#4a7cff',
  music: '#12c2e9',
  narrative: '#d94c73',
  output: '#506edc',
  play: '#b83280',
  progression: '#8b5cf6',
  'prompt-positive': '#2fcf5f',
  'prompt-negative': '#ff5a5f',
  ui: '#2f8cff',
  visual: '#8a5cff',
  game: '#ffd166',
  language: '#3f73d6'
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

export const getBlueprintGameDescription = (game = {}) =>
  String(game?.description || game?.summary || game?.intro || '')
    .trim()

export const getBlueprintGameCodeSummary = (game = {}) =>
  String(game?.codeSummary || game?.code_summary || '')
    .trim()

export const getBlueprintGameCodeEntryPath = (game = {}) =>
  String(game?.codeEntryPath || game?.code_entry_path || '')
    .trim()

export const getBlueprintGameCodePackageUrl = (game = {}) =>
  String(game?.codePackageUrl || game?.code_package_url || '')
    .trim()

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
    description: getBlueprintGameDescription(game),
    codeSummary: getBlueprintGameCodeSummary(game),
    codeEntryPath: getBlueprintGameCodeEntryPath(game),
    codePackageUrl: getBlueprintGameCodePackageUrl(game),
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
  const widthScale = fallbackDimensions.width > 0
    ? dimensions.width / fallbackDimensions.width
    : 1
  const portOffset = 6 * widthScale

  if (portType === 'left' || portType === 'input') {
    return {
      x: node.position.x - portOffset,
      y: node.position.y + dimensions.height / 2
    }
  }

  if (portType === 'top') {
    return {
      x: node.position.x + dimensions.width / 2,
      y: node.position.y - portOffset
    }
  }

  if (portType === 'bottom') {
    return {
      x: node.position.x + dimensions.width / 2,
      y: node.position.y + dimensions.height + portOffset
    }
  }

  const x = node.position.x + dimensions.width + portOffset
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

export const serializeBlueprintWorkflow = (nodes = [], edges = [], meta = {}) =>
  JSON.stringify({
    version: 1,
    nodes,
    edges,
    meta: meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}
  }, null, 2)

export const parseBlueprintWorkflow = (rawValue) => {
  if (!rawValue) {
    throw new Error('导入内容为空')
  }

  const parsed = JSON.parse(rawValue)
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : []
  const edges = Array.isArray(parsed?.edges) ? parsed.edges : []
  const meta = parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta)
    ? parsed.meta
    : {}

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
        description: String(node.description || ''),
        codeSummary: String(node.codeSummary || ''),
        codeEntryPath: String(node.codeEntryPath || ''),
        codePackageUrl: String(node.codePackageUrl || ''),
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
    edges: normalizedEdges,
    meta
  }
}
