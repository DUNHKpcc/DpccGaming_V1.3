<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import { useNotificationStore } from '../stores/notification'
import BlueprintSidebar from '../components/blueprint/BlueprintSidebar.vue'
import BlueprintToolbar from '../components/blueprint/BlueprintToolbar.vue'
import BlueprintCanvasStage from '../components/blueprint/BlueprintCanvasStage.vue'
import BlueprintGameNode from '../components/blueprint/BlueprintGameNode.vue'
import BlueprintCompactNode from '../components/blueprint/BlueprintCompactNode.vue'
import BlueprintNodeContextMenu from '../components/blueprint/BlueprintNodeContextMenu.vue'
import BlueprintNodeEditorPanel from '../components/blueprint/BlueprintNodeEditorPanel.vue'
import BlueprintLogPanel from '../components/blueprint/BlueprintLogPanel.vue'
import {
  BLUEPRINT_COMPACT_NODE_META,
  BP_NODE_DIMENSIONS,
  BP_WORLD_HEIGHT,
  BP_WORLD_WIDTH,
  createBlueprintCompactNode,
  createPromptPositiveBlueprintNode,
  getBlueprintEdgePortPositions,
  getBlueprintEdgeColor,
  getBlueprintEdgePreviewColor,
  getBlueprintNodePortPoint,
  isBlueprintCompactNodeKind,
  parseBlueprintWorkflow,
  removeBlueprintNode,
  serializeBlueprintWorkflow,
  snapPointToGrid,
  updateBlueprintNodeContent,
  updateBlueprintNodePosition,
  upsertBlueprintEdge,
  upsertGameBlueprintNode
} from '../utils/blueprintNodes.js'
import {
  buildBlueprintPlannerAvailableNodes,
  normalizeBlueprintPlannerPrompt
} from '../utils/blueprintPlanner.js'
import {
  getBlueprintLogPanelPosition,
  getBlueprintNodeContextMenuPosition,
  getBlueprintNodeEditorPanelPosition
} from '../utils/blueprintUi.js'
import {
  PROGRESS_STAGE_LABELS,
  buildProgressTrail,
  createBlueprintEdgePath,
  formatBlueprintTimestamp,
  formatRunStatusLabel,
  getRuntimeBundleFiles,
  resolvePersistableRuntimeText
} from '../utils/blueprintRuntime.js'
import {
  CHAT_MORE_BUILTIN_MODELS,
  CHAT_MORE_BUILTIN_MODEL_META
} from '../utils/discussionChatMore.js'
import {
  BLUEPRINT_VISION_MODEL_OPTIONS,
  DEFAULT_BLUEPRINT_VISION_MODEL
} from '../utils/blueprintVisionModels.js'
import { API_BASE_URL, apiCall } from '../utils/api'

const gameStore = useGameStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const route = useRoute()
const router = useRouter()

const modelOptions = CHAT_MORE_BUILTIN_MODELS.map((value) => {
  const meta = CHAT_MORE_BUILTIN_MODEL_META[value] || {}
  return {
    label: meta.label || value,
    value,
    logoSrc: meta.logo || '',
    logoAlt: meta.label || value
  }
})
const visionModelOptions = BLUEPRINT_VISION_MODEL_OPTIONS

const BLUEPRINT_SEED_PATTERN = /^[A-Z0-9]{8,32}$/
const BP_LOG_PANEL_WIDTH = 360
const BP_LOG_PANEL_HEIGHT = 420
const BP_LOG_PANEL_SAFE_TOP = 84
const BP_LOG_PANEL_SAFE_BOTTOM = 128
const BP_LOG_PANEL_SAFE_RIGHT = 24
const BP_LOG_PANEL_SAFE_LEFT = 24

const seed = ref('')
const logs = ref([])
const isSidebarCollapsed = ref(false)
const isLibraryLoading = ref(false)
const blueprintNodes = ref([])
const blueprintEdges = ref([])
const nodeRuntimeMap = ref({})
const nodeMeasurements = ref({})
const selectedNodeId = ref('')
const highlightedNodeId = ref('')
const activeContextMenu = ref(null)
const activeEditor = ref(null)
const activeLibraryGameId = ref('')
const activeNodeDrag = ref(null)
const activeEdgeDrag = ref(null)
const screenToWorldProjector = ref(null)
const stageRectGetter = ref(null)
const focusWorldBoundsFn = ref(null)
const workflowLoadState = ref('idle')
const plannerPromptDraft = ref('')
const selectedModel = ref(CHAT_MORE_BUILTIN_MODELS[0] || 'DouBaoSeed')
const selectedVisionModel = ref(DEFAULT_BLUEPRINT_VISION_MODEL)
const planningStatusLabel = ref('AI 正在规划工作流...')
const hasWorkflowHydrated = ref(false)
const lastSavedWorkflowSnapshot = ref(serializeBlueprintWorkflow([], []))
const latestRunId = ref('')
const latestRunStatus = ref('idle')
const latestRunContinuation = ref(null)
const latestFailedNodeId = ref('')
const recentBlueprints = ref([])
const recentBlueprintsLoading = ref(false)
const recentBlueprintsError = ref('')
const recentRuns = ref([])
const latestRunDetail = ref(null)
const isLogPanelHistoryHidden = ref(false)
const hasSessionRunHistory = ref(false)
const sessionRunIds = ref([])
const runHistoryApiAvailable = ref(true)
const logPanelPosition = ref({
  x: BP_LOG_PANEL_SAFE_LEFT,
  y: BP_LOG_PANEL_SAFE_TOP
})
const hasLogPanelBeenPositioned = ref(false)

const libraryGames = computed(() => gameStore.games || [])
const gameLibraryById = computed(() => {
  const map = new Map()

  libraryGames.value.forEach((game) => {
    const gameId = String(game?.game_id || game?.id || '').trim()
    if (gameId) {
      map.set(gameId, game)
    }
  })

  return map
})

let nodeIdCounter = 0
let edgeIdCounter = 0
let logIdCounter = 0
let highlightTimer = null
let libraryLoadTimeout = null
let libraryLoadRaf = null
let libraryLoadIdle = null
let activeExecutionController = null

const normalizeSeedInput = (value = '') => String(value || '').trim().toUpperCase()
const getRouteSeedValue = () => {
  const rawValue = Array.isArray(route.query.seed) ? route.query.seed[0] : route.query.seed
  return normalizeSeedInput(rawValue)
}

const hasBlueprintNodes = computed(() => blueprintNodes.value.length > 0)
const workflowSnapshot = computed(() =>
  serializeBlueprintWorkflow(blueprintNodes.value, blueprintEdges.value)
)
const isWorkflowBusy = computed(() =>
  workflowLoadState.value === 'loading'
  || workflowLoadState.value === 'saving'
  || workflowLoadState.value === 'creating'
  || workflowLoadState.value === 'planning'
  || workflowLoadState.value === 'executing'
)
const isWorkflowDirty = computed(() => {
  if (!seed.value || !hasBlueprintNodes.value) return false
  return workflowSnapshot.value !== lastSavedWorkflowSnapshot.value
})
const canExecuteWorkflow = computed(() =>
  hasBlueprintNodes.value && !isWorkflowBusy.value
)
const availablePlannerNodes = buildBlueprintPlannerAvailableNodes()
const isPlannerRunning = computed(() =>
  workflowLoadState.value === 'planning'
)
const canContinueFailedRun = computed(() =>
  Boolean(runHistoryApiAvailable.value ? latestRunId.value : latestFailedNodeId.value)
  && latestRunStatus.value === 'failed'
  && !isWorkflowBusy.value
)
const canCancelLatestRun = computed(() =>
  runHistoryApiAvailable.value
  && Boolean(latestRunId.value)
  && ['running', 'cancel_requested'].includes(String(latestRunStatus.value || ''))
)

const latestOutputRuntime = computed(() => {
  const outputNodes = [...blueprintNodes.value]
    .filter((node) => node.kind === 'output')
    .reverse()

  return outputNodes
    .map((node) => nodeRuntimeMap.value[node.id] || null)
    .find((runtime) => runtime?.artifactType === 'file-bundle')
    || null
})

const latestOutputFiles = computed(() => getRuntimeBundleFiles(latestOutputRuntime.value))

const latestOutputFileEntries = computed(() =>
  Object.entries(latestOutputFiles.value).map(([fileName, content]) => ({
    fileName,
    content: String(content || '')
  }))
)

const latestOutputReadme = computed(() =>
  String(latestOutputFiles.value['README.md'] || '').trim()
)

const latestOutputReadmeSnippet = computed(() => {
  const readme = latestOutputReadme.value
  if (!readme) return ''
  return readme.length > 420 ? `${readme.slice(0, 420)}...` : readme
})

const shouldShowLogOutputCard = computed(() =>
  !isLogPanelHistoryHidden.value
  && (latestOutputFileEntries.value.length > 0 || Boolean(latestPreviewUrl.value))
)

const shouldShowRunHistory = computed(() =>
  !isLogPanelHistoryHidden.value
  && hasSessionRunHistory.value
  && runHistoryApiAvailable.value
  && recentRuns.value.length > 0
)

const canClearLogPanelHistory = computed(() =>
  logs.value.length > 0
  || Boolean(latestRunId.value)
  || recentRuns.value.length > 0
  || latestOutputFileEntries.value.length > 0
  || Boolean(latestPreviewUrl.value)
)

const formattedRecentBlueprints = computed(() =>
  recentBlueprints.value.map((blueprint) => ({
    ...blueprint,
    updatedAtLabel: formatBlueprintTimestamp(blueprint.updatedAt || blueprint.createdAt)
  }))
)

const latestPreviewUrl = computed(() => {
  const previewUrl = String(
    latestRunDetail.value?.previewUrl
    || recentRuns.value.find((run) => String(run.id || '') === String(latestRunId.value || ''))?.previewUrl
    || ''
  ).trim()

  if (!previewUrl) return ''
  if (/^https?:\/\//i.test(previewUrl)) return previewUrl

  try {
    return new URL(previewUrl, window.location.origin).toString()
  } catch {
    return previewUrl
  }
})

const clampLogPanelPosition = (position = {}) => {
  const stageRect = typeof stageRectGetter.value === 'function'
    ? stageRectGetter.value()
    : null

  const stageWidth = Math.max(0, Number(stageRect?.width) || window.innerWidth)
  const stageHeight = Math.max(0, Number(stageRect?.height) || window.innerHeight)
  const minX = BP_LOG_PANEL_SAFE_LEFT
  const maxX = Math.max(
    minX,
    stageWidth - BP_LOG_PANEL_WIDTH - BP_LOG_PANEL_SAFE_RIGHT
  )
  const minY = BP_LOG_PANEL_SAFE_TOP
  const maxY = Math.max(
    minY,
    stageHeight - BP_LOG_PANEL_HEIGHT - BP_LOG_PANEL_SAFE_BOTTOM
  )

  return {
    x: Math.min(maxX, Math.max(minX, Number(position.x) || 0)),
    y: Math.min(maxY, Math.max(minY, Number(position.y) || 0))
  }
}

const getViewportAnchoredLogPanelPosition = () => {
  const stageRect = typeof stageRectGetter.value === 'function'
    ? stageRectGetter.value()
    : null

  return getBlueprintLogPanelPosition(
    {
      width: Number(stageRect?.width) || window.innerWidth,
      height: Number(stageRect?.height) || window.innerHeight
    },
    {
      panelWidth: BP_LOG_PANEL_WIDTH,
      panelHeight: BP_LOG_PANEL_HEIGHT,
      safeTop: BP_LOG_PANEL_SAFE_TOP,
      safeBottom: BP_LOG_PANEL_SAFE_BOTTOM,
      safeRight: BP_LOG_PANEL_SAFE_RIGHT,
      safeLeft: BP_LOG_PANEL_SAFE_LEFT
    }
  )
}

const positionLogPanelInViewport = () => {
  logPanelPosition.value = getViewportAnchoredLogPanelPosition()
  hasLogPanelBeenPositioned.value = true
}

const syncSeedToRoute = async (nextSeed = '') => {
  const normalizedSeed = normalizeSeedInput(nextSeed)
  const currentRouteSeed = getRouteSeedValue()
  if (normalizedSeed === currentRouteSeed) return

  const nextQuery = { ...route.query }
  if (normalizedSeed) {
    nextQuery.seed = normalizedSeed
  } else {
    delete nextQuery.seed
  }

  try {
    await router.replace({ query: nextQuery })
  } catch (error) {
    console.error('同步蓝图种子到路由失败:', error)
  }
}

const updateWorkflowSavedSnapshot = (workflow = null) => {
  if (workflow) {
    lastSavedWorkflowSnapshot.value = serializeBlueprintWorkflow(
      Array.isArray(workflow.nodes) ? workflow.nodes : [],
      Array.isArray(workflow.edges) ? workflow.edges : []
    )
    return
  }

  lastSavedWorkflowSnapshot.value = workflowSnapshot.value
}

const resetLatestRunTracking = () => {
  latestRunId.value = ''
  latestRunStatus.value = 'idle'
  latestRunContinuation.value = null
  latestFailedNodeId.value = ''
  latestRunDetail.value = null
}

const cancelActiveExecutionStream = () => {
  if (!activeExecutionController) return

  activeExecutionController.abort()
  activeExecutionController = null
}

const resetExecutionLogSession = () => {
  cancelActiveExecutionStream()
  logs.value = []
  recentRuns.value = []
  latestRunDetail.value = null
  hasSessionRunHistory.value = false
  sessionRunIds.value = []
  isLogPanelHistoryHidden.value = false
  resetLatestRunTracking()
}

const getLocalFailedContinuation = () => {
  if (latestRunContinuation.value?.nodeId) {
    return {
      nodeId: String(latestRunContinuation.value.nodeId),
      scope: latestRunContinuation.value.scope === 'single' ? 'single' : 'branch'
    }
  }

  if (!latestFailedNodeId.value) {
    return null
  }

  return {
    nodeId: String(latestFailedNodeId.value),
    scope: 'branch'
  }
}

const disableRunHistoryApi = () => {
  if (!runHistoryApiAvailable.value) return

  runHistoryApiAvailable.value = false
  recentRuns.value = []
  appendLog('当前服务端暂未提供运行历史接口，已切换为兼容模式。', 'warning')
}

const fetchRecentBlueprints = async ({ limit = 8 } = {}) => {
  recentBlueprintsLoading.value = true
  recentBlueprintsError.value = ''

  try {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    const payload = await apiCall(`/blueprints/recent?${params.toString()}`, {
      suppressErrorLogging: true
    })
    recentBlueprints.value = Array.isArray(payload?.blueprints) ? payload.blueprints : []
  } catch (error) {
    recentBlueprints.value = []
    if (error?.status === 401 || error?.status === 403) {
      recentBlueprintsError.value = '登录后可查看最近蓝图。'
      return
    }

    recentBlueprintsError.value = error?.message || '最近蓝图暂时不可用。'
  } finally {
    recentBlueprintsLoading.value = false
  }
}

const syncActiveEditorDraftFromNodeContent = (nodeId, previousContent, nextContent) => {
  if (!activeEditor.value || activeEditor.value.nodeId !== nodeId) return
  if (String(activeEditor.value.draft || '') !== String(previousContent || '')) return

  activeEditor.value = {
    ...activeEditor.value,
    draft: nextContent
  }
}

const mergeRuntimeOutputsIntoBlueprintNodes = (targetNodeIds = null) => {
  const allowedNodeIds = Array.isArray(targetNodeIds) && targetNodeIds.length
    ? new Set(targetNodeIds.map((nodeId) => String(nodeId || '')))
    : null

  let didChange = false
  const nextNodes = blueprintNodes.value.map((node) => {
    if (allowedNodeIds && !allowedNodeIds.has(String(node.id || ''))) {
      return node
    }

    const nextContent = resolvePersistableRuntimeText(
      node,
      nodeRuntimeMap.value[node.id],
      isBlueprintCompactNodeKind
    )
    if (!nextContent) return node

    const previousContent = String(node.content || '')
    if (nextContent === previousContent) return node

    didChange = true
    syncActiveEditorDraftFromNodeContent(node.id, previousContent, nextContent)
    return {
      ...node,
      content: nextContent
    }
  })

  if (didChange) {
    blueprintNodes.value = nextNodes
  }

  return didChange ? nextNodes : blueprintNodes.value
}

const applyWorkflowPayload = (workflow = {}, options = {}) => {
  const { nodes, edges } = parseBlueprintWorkflow(JSON.stringify(workflow || {}))

  blueprintNodes.value = nodes
  blueprintEdges.value = edges
  resetBlueprintRuntime()
  resetLatestRunTracking()
  nodeMeasurements.value = {}
  selectedNodeId.value = nodes[0]?.id || ''
  highlightedNodeId.value = ''
  activeLibraryGameId.value = nodes.find((node) => node?.kind === 'game')?.gameId || ''
  closeNodeOverlays()

  if (options.persistSnapshot) {
    updateWorkflowSavedSnapshot({ nodes, edges })
  }

  if (options.focusNodes) {
    focusWorkflowNodes(nodes)
  }
}

const buildWorkflowPayload = () => {
  mergeRuntimeOutputsIntoBlueprintNodes()
  return JSON.parse(serializeBlueprintWorkflow(blueprintNodes.value, blueprintEdges.value))
}

const fetchRunHistory = async ({ limit = 6 } = {}) => {
  if (!runHistoryApiAvailable.value) return
  if (!hasSessionRunHistory.value || !sessionRunIds.value.length) {
    recentRuns.value = []
    latestRunDetail.value = null
    return
  }

  try {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    if (seed.value) {
      params.set('seed', seed.value)
    }

    const payload = await apiCall(`/blueprints/runs?${params.toString()}`, {
      suppressErrorLogging: true
    })
    const allowedRunIds = new Set(sessionRunIds.value.map((runId) => String(runId || '')))
    recentRuns.value = (Array.isArray(payload?.runs) ? payload.runs : [])
      .filter((run) => allowedRunIds.has(String(run?.id || '')))
  } catch (error) {
    if (error?.status === 404) {
      disableRunHistoryApi()
      return
    }

    appendLog(resolveBlueprintErrorMessage(error, '获取蓝图运行历史失败，请稍后重试。'), 'error')
  }
}

const syncLatestRunDetail = async (runId = latestRunId.value, { hydrate = false } = {}) => {
  const targetRunId = String(runId || '').trim()
  if (!targetRunId || !runHistoryApiAvailable.value) return null

  const detail = await apiCall(`/blueprints/runs/${encodeURIComponent(targetRunId)}`, {
    suppressErrorLogging: true
  })

  latestRunDetail.value = detail || null

  if (hydrate && detail?.runtimeSnapshot && typeof detail.runtimeSnapshot === 'object') {
    hydrateRuntimeSnapshot(detail.runtimeSnapshot)
  }

  return detail
}

const resolveBlueprintErrorMessage = (error, fallbackMessage) => {
  if (error?.status === 401 || error?.status === 403) {
    return '蓝图种子功能需要登录后使用。'
  }

  return error?.message || fallbackMessage
}

const confirmWorkflowReplacement = () => {
  if (!hasBlueprintNodes.value) return true

  if (seed.value && isWorkflowDirty.value) {
    return window.confirm('当前蓝图有未保存改动，继续导入其他种子会覆盖当前内容，确定继续吗？')
  }

  if (!seed.value) {
    return window.confirm('当前画布还没有种子，导入其他种子会覆盖当前内容，确定继续吗？')
  }

  return true
}

const persistBlueprintSeedState = async (payload = {}, successMessage = '已保存蓝图。') => {
  seed.value = normalizeSeedInput(payload.seed)
  applyWorkflowPayload(payload.workflow, {
    persistSnapshot: true,
    focusNodes: true
  })
  await syncSeedToRoute(seed.value)
  appendLog(successMessage)
  await fetchRunHistory()
  await fetchRecentBlueprints()
}

const handleImportSeed = async (seedValue, options = {}) => {
  const normalizedSeed = normalizeSeedInput(seedValue)

  if (!BLUEPRINT_SEED_PATTERN.test(normalizedSeed)) {
    appendLog('请输入 8-32 位的大写字母或数字种子。', 'warning')
    return
  }

  if (!options.skipConfirm && !confirmWorkflowReplacement()) {
    return
  }

  resetExecutionLogSession()
  workflowLoadState.value = 'loading'
  appendLog(`正在加载种子 ${normalizedSeed}...`)

  try {
    const payload = await apiCall(`/blueprints/${encodeURIComponent(normalizedSeed)}`)
    await persistBlueprintSeedState(
      payload,
      payload?.is_owner
        ? `已载入你的原始蓝图种子 ${payload.seed}。`
        : `已根据种子 ${payload.seed} 载入你的个人副本。`
    )
  } catch (error) {
    appendLog(resolveBlueprintErrorMessage(error, '种子导入失败，请检查后重试。'), 'error')
  } finally {
    workflowLoadState.value = 'idle'
    hasWorkflowHydrated.value = true
  }
}

const handleOpenRecentBlueprint = async (seedValue) => {
  const normalizedSeed = normalizeSeedInput(seedValue)
  if (!normalizedSeed) return

  await handleImportSeed(normalizedSeed)
}

const handleSaveWorkflowToSeed = async () => {
  if (!hasBlueprintNodes.value) {
    appendLog('当前没有节点内容，无法保存到种子。', 'warning')
    notificationStore.warning('无法保存', '当前没有可保存的蓝图内容')
    return
  }

  workflowLoadState.value = seed.value ? 'saving' : 'creating'

  try {
    const workflow = buildWorkflowPayload()
    const requestPath = seed.value
      ? `/blueprints/${encodeURIComponent(seed.value)}`
      : '/blueprints'
    const payload = await apiCall(requestPath, {
      method: seed.value ? 'PUT' : 'POST',
      body: JSON.stringify({ workflow })
    })

    await persistBlueprintSeedState(
      payload,
      seed.value ? '已保存当前蓝图。' : `已首次保存蓝图，种子 ${payload.seed} 已创建。`
    )
    notificationStore.success(
      '蓝图已保存',
      seed.value ? '当前蓝图已保存到当前种子' : `已创建新种子 ${payload.seed}`
    )
  } catch (error) {
    const message = resolveBlueprintErrorMessage(error, '保存蓝图失败，请稍后重试。')
    appendLog(message, 'error')
    notificationStore.error('保存失败', message)
  } finally {
    workflowLoadState.value = 'idle'
  }
}

const handleCreateBlueprint = async () => {
  if (isWorkflowBusy.value) return

  const hasContent = blueprintNodes.value.length > 0 || Boolean(seed.value)
  if (hasContent && !confirmWorkflowReplacement()) {
    return
  }

  blueprintNodes.value = []
  blueprintEdges.value = []
  resetExecutionLogSession()
  resetBlueprintRuntime()
  nodeMeasurements.value = {}
  selectedNodeId.value = ''
  highlightedNodeId.value = ''
  activeLibraryGameId.value = ''
  plannerPromptDraft.value = ''
  seed.value = ''
  closeNodeOverlays()
  updateWorkflowSavedSnapshot({ nodes: [], edges: [] })
  await syncSeedToRoute('')
}

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const closeNodeOverlays = () => {
  activeContextMenu.value = null
  activeEditor.value = null
}

const clearPointerButtonFocus = (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null
  if (!(button instanceof HTMLButtonElement)) return

  window.setTimeout(() => {
    button.blur()
  }, 0)
}

const handleGlobalPointerDown = (event) => {
  if (!(event.target instanceof Element)) {
    closeNodeOverlays()
    return
  }

  if (event.target.closest('.bp-node-context-menu, .bp-node-editor-panel')) return
  closeNodeOverlays()
}

const createNodeId = () => {
  nodeIdCounter += 1
  return `bp-game-${Date.now().toString(36)}-${nodeIdCounter}`
}

const createEdgeId = () => {
  edgeIdCounter += 1
  return `bp-edge-${Date.now().toString(36)}-${edgeIdCounter}`
}

const resolveBlueprintLogLevel = (line, level = '') => {
  const normalizedLevel = String(level || '').trim().toLowerCase()
  if (normalizedLevel) return normalizedLevel

  const text = String(line || '').trim()
  if (!text) return 'info'
  if (/^(提示：|警告：)/.test(text)) return 'warning'
  if (/(失败|错误|异常|损坏|空工作流|未返回有效)/.test(text)) return 'error'
  return 'info'
}

const appendLog = (line, level = '') => {
  isLogPanelHistoryHidden.value = false
  const timestamp = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })

  logIdCounter += 1
  logs.value = [{
    id: `bp-log-${Date.now().toString(36)}-${logIdCounter}`,
    text: `${timestamp} ${line}`,
    level: resolveBlueprintLogLevel(line, level)
  }, ...logs.value].slice(0, 20)
}

const handleClearLogs = () => {
  logs.value = []
  recentRuns.value = []
  latestRunDetail.value = null
  hasSessionRunHistory.value = false
  resetLatestRunTracking()
  isLogPanelHistoryHidden.value = true
}

const resetBlueprintRuntime = () => {
  nodeRuntimeMap.value = {}
}

const hydrateRuntimeSnapshot = (runtimeSnapshot = {}) => {
  const nextRuntimeMap = {}

  Object.entries(runtimeSnapshot || {}).forEach(([nodeId, runtime]) => {
    if (!nodeId || !runtime || typeof runtime !== 'object') return
    if (!blueprintNodes.value.some((node) => node.id === nodeId)) return
    nextRuntimeMap[nodeId] = runtime
  })

  nodeRuntimeMap.value = nextRuntimeMap
}

const assignNodeRuntime = (nodeId, patch = {}) => {
  if (!nodeId) return

  const currentRuntime = nodeRuntimeMap.value[nodeId] || null
  nodeRuntimeMap.value = {
    ...nodeRuntimeMap.value,
    [nodeId]: {
      ...(currentRuntime || {}),
      ...patch
    }
  }

  if (activeEditor.value?.nodeId === nodeId) {
    activeEditor.value = {
      ...activeEditor.value,
      runtime: nodeRuntimeMap.value[nodeId]
    }
  }
}

const collectDownstreamNodeIds = (startNodeId, includeStart = true) => {
  const visited = new Set()
  const pending = [startNodeId]

  while (pending.length) {
    const currentNodeId = pending.shift()
    if (!currentNodeId || visited.has(currentNodeId)) continue
    visited.add(currentNodeId)

    blueprintEdges.value
      .filter((edge) => edge.fromNodeId === currentNodeId)
      .forEach((edge) => {
        if (!visited.has(edge.toNodeId)) {
          pending.push(edge.toNodeId)
        }
      })
  }

  if (!includeStart) {
    visited.delete(startNodeId)
  }

  return [...visited]
}

const clearNodeRuntimeEntries = (nodeIds = []) => {
  if (!nodeIds.length) return

  const nextRuntimeMap = { ...nodeRuntimeMap.value }
  nodeIds.forEach((nodeId) => {
    delete nextRuntimeMap[nodeId]
  })
  nodeRuntimeMap.value = nextRuntimeMap
}

const buildBlueprintExecutionHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  }
  const token = localStorage.getItem('token') || authStore.authToken
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

const handleBlueprintExecutionEvent = (event = {}) => {
  if (event.event === 'workflow-start') {
    hasSessionRunHistory.value = true
    isLogPanelHistoryHidden.value = false
    latestRunId.value = String(event.runId || '')
    if (latestRunId.value && !sessionRunIds.value.includes(latestRunId.value)) {
      sessionRunIds.value = [latestRunId.value, ...sessionRunIds.value]
    }
    latestRunStatus.value = 'running'
    latestRunContinuation.value = null
    latestFailedNodeId.value = ''
    latestRunDetail.value = null
    appendLog(`开始自动执行工作流，模型：${event.model || selectedModel.value}，视觉理解模型：${event.visionModel || selectedVisionModel.value}。`)
    return
  }

  if (event.event === 'step-start') {
    assignNodeRuntime(event.nodeId, {
      status: 'running',
      kind: event.nodeKind,
      model: event.model || (event.mode === 'source' ? selectedVisionModel.value : selectedModel.value),
      startedAt: event.startedAt,
      progressValue: 0.04,
      progressStage: 'queued',
      progressDetail: '正在准备节点执行。',
      progressTrail: [{
        stage: 'queued',
        label: PROGRESS_STAGE_LABELS.queued,
        detail: '正在准备节点执行。'
      }],
      summary: '',
      analysis: '',
      output: ''
    })
    selectedNodeId.value = event.nodeId || selectedNodeId.value
    pulseNode(event.nodeId)
    appendLog(`开始执行节点「${event.nodeTitle || event.nodeId}」。`)
    return
  }

  if (event.event === 'step-progress') {
    const currentRuntime = nodeRuntimeMap.value[event.nodeId] || {}
    assignNodeRuntime(event.nodeId, {
      progressValue: Number.isFinite(Number(event.progress))
        ? Math.max(0, Math.min(1, Number(event.progress)))
        : (currentRuntime.progressValue || 0),
      progressStage: String(event.stage || currentRuntime.progressStage || ''),
      progressDetail: String(event.detail || currentRuntime.progressDetail || ''),
      progressTrail: buildProgressTrail(currentRuntime.progressTrail || [], event)
    })
    return
  }

  if (event.event === 'step-complete') {
    assignNodeRuntime(event.nodeId, {
      ...(event.runtime || {}),
      status: event.runtime?.status || 'completed',
      progressValue: 1,
      progressStage: 'finalize',
      progressDetail: '',
      progressTrail: event.runtime?.progressTrail || []
    })
    mergeRuntimeOutputsIntoBlueprintNodes([event.nodeId])
    selectedNodeId.value = event.nodeId || selectedNodeId.value
    pulseNode(event.nodeId)
    appendLog(`节点「${event.nodeTitle || event.nodeId}」已完成。`)
    return
  }

  if (event.event === 'step-failed') {
    assignNodeRuntime(event.nodeId, {
      ...(event.runtime || {}),
      status: event.runtime?.status || 'failed',
      progressDetail: '',
      progressTrail: event.runtime?.progressTrail || []
    })
    selectedNodeId.value = event.nodeId || selectedNodeId.value
    pulseNode(event.nodeId)
    latestRunStatus.value = 'failed'
    latestFailedNodeId.value = String(event.nodeId || '')
    latestRunContinuation.value = event.nodeId
      ? { nodeId: String(event.nodeId), scope: 'branch' }
      : null
    appendLog(`节点「${event.nodeTitle || event.nodeId}」执行失败。`, 'error')
    return
  }

  if (event.event === 'workflow-complete') {
    latestRunStatus.value = 'completed'
    latestRunContinuation.value = null
    latestFailedNodeId.value = ''
    appendLog('工作流已自动顺序执行完成。')
    return
  }

  if (event.event === 'workflow-cancelled') {
    latestRunStatus.value = 'cancelled'
    latestRunContinuation.value = null
    latestFailedNodeId.value = ''
    appendLog('工作流已取消。')
    return
  }

  if (event.event === 'workflow-error') {
    latestRunStatus.value = 'failed'
    latestFailedNodeId.value = String(event.failedNodeId || latestFailedNodeId.value || '')
    latestRunContinuation.value = latestFailedNodeId.value
      ? { nodeId: latestFailedNodeId.value, scope: 'branch' }
      : latestRunContinuation.value
    appendLog(event.message || '工作流执行失败。', 'error')
    return
  }

  if (event.event === 'workflow-log') {
    appendLog(event.message || '工作流产生了一条新的运行日志。')
  }
}

const streamBlueprintExecution = async ({ startNodeId = '', scope = 'all' } = {}) => {
  if (isWorkflowBusy.value) return

  if (!hasBlueprintNodes.value) {
    appendLog('当前没有节点内容，无法执行工作流。', 'warning')
    return
  }

  workflowLoadState.value = 'executing'
  activeExecutionController = new AbortController()
  const executionController = activeExecutionController
  let wasAborted = false

  try {
    const response = await fetch(`${API_BASE_URL}/blueprints/execute`, {
      method: 'POST',
      credentials: 'include',
      headers: buildBlueprintExecutionHeaders(),
      signal: executionController.signal,
      body: JSON.stringify({
        seed: seed.value,
        model: selectedModel.value,
        visionModel: selectedVisionModel.value,
        startNodeId,
        scope,
        runtimeSnapshot: nodeRuntimeMap.value,
        workflow: buildWorkflowPayload()
      })
    })

    if (!response.ok) {
      const contentType = String(response.headers.get('content-type') || '').toLowerCase()
      const payload = contentType.includes('application/json')
        ? await response.json()
        : { error: await response.text() }
      throw new Error(payload.error || payload.message || '执行工作流失败')
    }

    if (!response.body) {
      throw new Error('执行接口未返回可读取的数据流')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      lines.forEach((line) => {
        const trimmed = String(line || '').trim()
        if (!trimmed) return
        handleBlueprintExecutionEvent(JSON.parse(trimmed))
      })
    }

    if (buffer.trim()) {
      handleBlueprintExecutionEvent(JSON.parse(buffer.trim()))
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      wasAborted = true
    }

    if (wasAborted) {
      return
    }

    appendLog(error?.message || '执行工作流失败，请稍后重试。', 'error')
  } finally {
    if (executionController.signal.aborted) {
      wasAborted = true
    }

    if (activeExecutionController === executionController) {
      activeExecutionController = null
    }

    if (wasAborted) {
      workflowLoadState.value = 'idle'
      return
    }

    await fetchRunHistory()
    if (runHistoryApiAvailable.value && latestRunId.value) {
      try {
        await syncLatestRunDetail(latestRunId.value, { hydrate: true })
      } catch (error) {
        if (error?.status === 404) {
          disableRunHistoryApi()
        }
      }
    }
    workflowLoadState.value = 'idle'
  }
}

const handleExecuteWorkflow = async () => {
  resetExecutionLogSession()
  resetBlueprintRuntime()
  await streamBlueprintExecution({ scope: 'all' })
}

const updatePlannerPromptDraft = (value) => {
  plannerPromptDraft.value = String(value || '')
}

const handleSubmitPlannerPrompt = async () => {
  const prompt = normalizeBlueprintPlannerPrompt(plannerPromptDraft.value)

  if (!prompt) {
    appendLog('请先输入你希望 AI 生成的工作流需求。', 'warning')
    return
  }

  if (isWorkflowBusy.value) return

  resetExecutionLogSession()
  workflowLoadState.value = 'planning'
  planningStatusLabel.value = '正在分析你的需求并匹配最合适的节点组合。'
  appendLog(`正在根据需求规划工作流：${prompt}`)

  try {
    const payload = await apiCall('/blueprints/plan', {
      method: 'POST',
      body: JSON.stringify({
        seed: seed.value,
        prompt,
        workflow: buildWorkflowPayload(),
        availableNodes: availablePlannerNodes,
        model: selectedModel.value,
        visionModel: selectedVisionModel.value
      })
    })

    if (!payload?.workflow || !Array.isArray(payload.workflow.nodes)) {
      throw new Error('AI 没有返回有效的工作流。')
    }

    planningStatusLabel.value = '已完成规划，正在把新工作流铺到画布上。'
    applyWorkflowPayload(payload.workflow, { focusNodes: true })
    plannerPromptDraft.value = ''

    appendLog(payload.summary || 'AI 已根据需求更新工作流。')
    ;(Array.isArray(payload.changes) ? payload.changes : [])
      .filter(Boolean)
      .slice(0, 6)
      .forEach((change) => appendLog(`变更：${change}`))
    ;(Array.isArray(payload.warnings) ? payload.warnings : [])
      .filter(Boolean)
      .slice(0, 4)
      .forEach((warning) => appendLog(`提示：${warning}`, 'warning'))

    workflowLoadState.value = 'idle'
    appendLog('开始自动执行更新后的工作流。')
    await streamBlueprintExecution({ scope: 'all' })
  } catch (error) {
    appendLog(resolveBlueprintErrorMessage(error, '工作流规划失败，请稍后重试。'), 'error')
    planningStatusLabel.value = 'AI 正在规划工作流...'
    workflowLoadState.value = 'idle'
  }
}

const handleExecuteNode = async (nodeId, options = {}) => {
  const normalizedNodeId = String(nodeId || '').trim()
  if (!normalizedNodeId) return

  resetExecutionLogSession()

  const scope = options.scope === 'single' ? 'single' : 'branch'
  const affectedNodeIds = scope === 'single'
    ? [normalizedNodeId]
    : collectDownstreamNodeIds(normalizedNodeId, true)

  clearNodeRuntimeEntries(affectedNodeIds)
  closeNodeOverlays()
  selectedNodeId.value = normalizedNodeId
  appendLog(
    scope === 'single'
      ? `准备重跑节点「${normalizedNodeId}」。`
      : `准备从节点「${normalizedNodeId}」继续执行到下游。`
  )

  await streamBlueprintExecution({
    startNodeId: normalizedNodeId,
    scope: scope === 'single' ? 'single' : 'branch'
  })
}

const handleContinueFromFailedRun = async (runId = latestRunId.value) => {
  const targetRunId = String(runId || latestRunId.value || '').trim()
  const localContinuation = getLocalFailedContinuation()

  try {
    if (!runHistoryApiAvailable.value) {
      if (!localContinuation?.nodeId) {
        appendLog('当前没有可继续的失败节点。', 'warning')
        return
      }

      appendLog('当前服务端未提供运行历史接口，已使用当前会话状态从失败节点继续。', 'warning')
      await handleExecuteNode(localContinuation.nodeId, {
        scope: localContinuation.scope
      })
      return
    }

    if (!targetRunId) {
      if (!localContinuation?.nodeId) {
        appendLog('当前没有可继续的运行记录。', 'warning')
        return
      }

      await handleExecuteNode(localContinuation.nodeId, {
        scope: localContinuation.scope
      })
      return
    }

    latestRunId.value = targetRunId
    const runDetail = await syncLatestRunDetail(targetRunId, { hydrate: true })
    latestRunStatus.value = String(runDetail?.status || latestRunStatus.value || 'idle')
    latestRunContinuation.value = runDetail?.continuation || null
    latestFailedNodeId.value = String(runDetail?.continuation?.nodeId || latestFailedNodeId.value || '')

    const continuation = runDetail?.continuation || null
    if (!continuation?.nodeId) {
      appendLog('最近一次运行没有可继续的失败节点。', 'warning')
      return
    }

    appendLog(`已载入运行 #${targetRunId}，准备从失败节点继续。`)
    await handleExecuteNode(continuation.nodeId, {
      scope: continuation.scope === 'single' ? 'single' : 'branch'
    })
  } catch (error) {
    if (error?.status === 404) {
      disableRunHistoryApi()

      if (localContinuation?.nodeId) {
        appendLog('运行详情接口不可用，已回退到当前会话状态继续执行。', 'warning')
        await handleExecuteNode(localContinuation.nodeId, {
          scope: localContinuation.scope
        })
        return
      }
    }

    appendLog(resolveBlueprintErrorMessage(error, '加载运行记录失败，请稍后重试。'), 'error')
  }
}

const handleCancelLatestRun = async (runId = latestRunId.value) => {
  const targetRunId = String(runId || latestRunId.value || '').trim()
  if (!targetRunId) {
    appendLog('当前没有可取消的运行记录。', 'warning')
    return
  }

  try {
    if (!runHistoryApiAvailable.value) {
      appendLog('当前服务端暂未提供运行取消接口。', 'warning')
      return
    }

    latestRunId.value = targetRunId
    const payload = await apiCall(`/blueprints/runs/${encodeURIComponent(latestRunId.value)}/cancel`, {
      method: 'POST',
      suppressErrorLogging: true
    })
    latestRunStatus.value = String(payload?.status || 'cancel_requested')
    appendLog(`已请求取消运行 #${targetRunId}。`)
    await fetchRunHistory()
  } catch (error) {
    if (error?.status === 404) {
      disableRunHistoryApi()
      appendLog('当前服务端暂未提供运行取消接口。', 'warning')
      return
    }

    appendLog(resolveBlueprintErrorMessage(error, '取消运行失败，请稍后重试。'), 'error')
  }
}

const pulseNode = (nodeId) => {
  highlightedNodeId.value = nodeId

  if (highlightTimer) {
    clearTimeout(highlightTimer)
  }

  highlightTimer = window.setTimeout(() => {
    if (highlightedNodeId.value === nodeId) {
      highlightedNodeId.value = ''
    }
  }, 1200)
}

const handleSelectGame = (gameId) => {
  activeLibraryGameId.value = String(gameId || '')
}

const handleSelectModel = (modelValue) => {
  const nextModel = String(modelValue || 'DouBaoSeed').trim() || 'DouBaoSeed'
  if (nextModel === selectedModel.value) return

  selectedModel.value = nextModel
  appendLog(`已切换执行模型为 ${selectedModel.value}。`)
  notificationStore.success('模型已切换', `当前执行模型：${selectedModel.value}`)
}

const handleSelectVisionModel = (modelValue) => {
  const nextModel = String(modelValue || DEFAULT_BLUEPRINT_VISION_MODEL).trim() || DEFAULT_BLUEPRINT_VISION_MODEL
  if (nextModel === selectedVisionModel.value) return

  selectedVisionModel.value = nextModel
  appendLog(`已切换视觉理解模型为 ${selectedVisionModel.value}。`)
  notificationStore.success('视觉模型已切换', `当前视觉模型：${selectedVisionModel.value}`)
}

const handleSelectNode = (nodeId) => {
  selectedNodeId.value = nodeId
  const targetNode = blueprintNodes.value.find((node) => node.id === nodeId)
  if (targetNode?.kind === 'game' && targetNode?.gameId) {
    activeLibraryGameId.value = targetNode.gameId
  }
}

const handleNodeMeasure = ({ nodeId, width, height }) => {
  if (!nodeId || !width || !height) return

  const currentMeasurement = nodeMeasurements.value[nodeId]
  if (currentMeasurement?.width === width && currentMeasurement?.height === height) {
    return
  }

  nodeMeasurements.value = {
    ...nodeMeasurements.value,
    [nodeId]: { width, height }
  }
}

const handleNodeUnmount = (nodeId) => {
  if (!nodeId || !nodeMeasurements.value[nodeId]) return

  const nextMeasurements = { ...nodeMeasurements.value }
  delete nextMeasurements[nodeId]
  nodeMeasurements.value = nextMeasurements
}

const handleDeleteNode = (nodeId) => {
  const result = removeBlueprintNode(blueprintNodes.value, blueprintEdges.value, nodeId)
  blueprintNodes.value = result.nodes
  blueprintEdges.value = result.edges
  if (nodeRuntimeMap.value[nodeId]) {
    const nextRuntimeMap = { ...nodeRuntimeMap.value }
    delete nextRuntimeMap[nodeId]
    nodeRuntimeMap.value = nextRuntimeMap
  }

  if (selectedNodeId.value === nodeId) {
    selectedNodeId.value = ''
  }

  if (highlightedNodeId.value === nodeId) {
    highlightedNodeId.value = ''
  }

  handleNodeUnmount(nodeId)
  closeNodeOverlays()
  appendLog('已删除节点。')
}

const handleNodeContextMenu = (payload, screenToWorldPoint) => {
  if (!payload?.nodeId || typeof screenToWorldPoint !== 'function') return

  const node = blueprintNodes.value.find((item) => item.id === payload.nodeId)
  if (!node) return

  handleSelectNode(node.id)
  activeEditor.value = null
  activeContextMenu.value = {
    nodeId: node.id,
    kind: node.kind,
    position: getBlueprintNodeContextMenuPosition(
      screenToWorldPoint({
        x: payload.clientX,
        y: payload.clientY
      })
    )
  }
}

const openNodeEditor = (nodeId) => {
  const node = blueprintNodes.value.find((item) => item.id === nodeId)
  if (!node || !isBlueprintCompactNodeKind(node.kind)) return

  activeContextMenu.value = null
  activeEditor.value = {
    nodeId: node.id,
    kind: node.kind,
    position: getBlueprintNodeEditorPanelPosition(node, nodeMeasurements.value[node.id]),
    draft: String(node.content || ''),
    runtime: nodeRuntimeMap.value[node.id] || null,
    previewUrl: node.kind === 'output' ? latestPreviewUrl.value : ''
  }
}

const updateNodeEditorDraft = (value) => {
  if (!activeEditor.value) return

  activeEditor.value = {
    ...activeEditor.value,
    draft: String(value || '')
  }
}

const saveNodeEditor = () => {
  const editor = activeEditor.value
  if (!editor?.nodeId) return

  blueprintNodes.value = updateBlueprintNodeContent(
    blueprintNodes.value,
    editor.nodeId,
    editor.draft
  )
  appendLog('已更新节点内容。')
  closeNodeOverlays()
}

const getNodePortPoint = (node, portType) =>
  getBlueprintNodePortPoint(node, portType, nodeMeasurements.value[node.id])

const downloadWorkflow = (content, fileName) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const handleExportWorkflow = () => {
  if (!blueprintNodes.value.length) {
    appendLog('当前画布为空，没有可导出的工作流。', 'warning')
    return
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  downloadWorkflow(
    serializeBlueprintWorkflow(blueprintNodes.value, blueprintEdges.value),
    `blueprint-workflow-${stamp}.json`
  )
  appendLog('已导出当前工作流 JSON。')
}

const handleImportWorkflow = (rawValue) => {
  try {
    const { nodes, edges } = parseBlueprintWorkflow(rawValue)
    blueprintNodes.value = nodes
    blueprintEdges.value = edges
    resetExecutionLogSession()
    resetBlueprintRuntime()
    selectedNodeId.value = nodes[0]?.id || ''
    activeLibraryGameId.value = nodes[0]?.gameId || ''
    focusWorkflowNodes(nodes)
    appendLog(`已导入 ${nodes.length} 个节点和 ${edges.length} 条连线。`)
  } catch (error) {
    appendLog(error?.message || '导入失败，请检查 JSON 格式。', 'error')
  }
}

const handleClearWorkflow = () => {
  if (!blueprintNodes.value.length) {
    appendLog('当前画布已经是空的。', 'warning')
    return
  }

  blueprintNodes.value = []
  blueprintEdges.value = []
  resetExecutionLogSession()
  resetBlueprintRuntime()
  selectedNodeId.value = ''
  highlightedNodeId.value = ''
  activeLibraryGameId.value = ''
  closeNodeOverlays()
}

const finishNodeDrag = ({ snapToGrid = true } = {}) => {
  const currentDrag = activeNodeDrag.value
  if (!currentDrag) return

  if (snapToGrid) {
    blueprintNodes.value = updateBlueprintNodePosition(
      blueprintNodes.value,
      currentDrag.nodeId,
      snapPointToGrid(currentDrag.latestPosition),
      false
    )
  }

  window.removeEventListener('pointermove', handleNodePointerMove)
  window.removeEventListener('pointerup', handleNodePointerUp)
  activeNodeDrag.value = null
}

const finishEdgeDrag = () => {
  window.removeEventListener('pointermove', handleEdgePointerMove)
  window.removeEventListener('pointerup', handleEdgePointerUp)
  activeEdgeDrag.value = null
}

const handleNodePointerMove = (event) => {
  const currentDrag = activeNodeDrag.value
  if (!currentDrag) return

  const point = currentDrag.screenToWorldPoint({
    x: event.clientX,
    y: event.clientY
  })
  const nextPosition = {
    x: point.x - currentDrag.pointerOffset.x,
    y: point.y - currentDrag.pointerOffset.y
  }

  currentDrag.latestPosition = nextPosition
  blueprintNodes.value = updateBlueprintNodePosition(
    blueprintNodes.value,
    currentDrag.nodeId,
    nextPosition,
    false
  )
}

const handleNodePointerUp = () => {
  finishNodeDrag({ snapToGrid: true })
}

const handleEdgePointerMove = (event) => {
  const currentDrag = activeEdgeDrag.value
  if (!currentDrag) return

  currentDrag.currentPoint = currentDrag.screenToWorldPoint({
    x: event.clientX,
    y: event.clientY
  })
}

const handleEdgePointerUp = (event) => {
  const currentDrag = activeEdgeDrag.value
  if (!currentDrag) return

  const targetPort = event.target instanceof Element
    ? event.target.closest('[data-port-hit="true"][data-node-id]')
    : null
  const toNodeId = targetPort?.getAttribute('data-node-id') || ''

  if (toNodeId) {
    const result = upsertBlueprintEdge(
      blueprintEdges.value,
      currentDrag.fromNodeId,
      toNodeId,
      createEdgeId
    )

    blueprintEdges.value = result.edges

    if (result.created) {
      appendLog('已创建节点连线。')
    } else if (currentDrag.fromNodeId !== toNodeId) {
      appendLog('这条连线已经存在。')
    }
  }

  finishEdgeDrag()
}

const handleNodeDragStart = (payload, screenToWorldPoint) => {
  if (!payload?.nodeId || typeof screenToWorldPoint !== 'function') return
  closeNodeOverlays()

  const targetNode = blueprintNodes.value.find((node) => node.id === payload.nodeId)
  if (!targetNode) return

  handleSelectNode(payload.nodeId)

  const pointerPoint = screenToWorldPoint({
    x: payload.clientX,
    y: payload.clientY
  })

  activeNodeDrag.value = {
    nodeId: payload.nodeId,
    pointerOffset: {
      x: pointerPoint.x - targetNode.position.x,
      y: pointerPoint.y - targetNode.position.y
    },
    latestPosition: targetNode.position,
    screenToWorldPoint
  }

  window.addEventListener('pointermove', handleNodePointerMove)
  window.addEventListener('pointerup', handleNodePointerUp, { once: true })
}

const handleStartLink = (payload, screenToWorldPoint) => {
  if (!payload?.nodeId || typeof screenToWorldPoint !== 'function') return
  closeNodeOverlays()

  const sourceNode = blueprintNodes.value.find((node) => node.id === payload.nodeId)
  if (!sourceNode) return

  const startPoint = getNodePortPoint(sourceNode, payload.portPosition || 'right')

  activeEdgeDrag.value = {
    fromNodeId: payload.nodeId,
    fromPort: payload.portPosition || 'right',
    startPoint,
    currentPoint: startPoint,
    screenToWorldPoint
  }

  window.addEventListener('pointermove', handleEdgePointerMove)
  window.addEventListener('pointerup', handleEdgePointerUp, { once: true })
}

const handleToolbarAction = (actionKey) => {
  if (typeof screenToWorldProjector.value !== 'function') {
    return
  }

  closeNodeOverlays()

  const centerPoint = screenToWorldProjector.value({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  })

  let node = null
  if (actionKey === 'prompt-positive') {
    node = createPromptPositiveBlueprintNode(centerPoint, createNodeId)
  } else if (Object.prototype.hasOwnProperty.call(BLUEPRINT_COMPACT_NODE_META, actionKey)) {
    node = createBlueprintCompactNode(actionKey, centerPoint, createNodeId)
  }

  if (!node) return

  blueprintNodes.value = [...blueprintNodes.value, node]
  selectedNodeId.value = node.id
  pulseNode(node.id)
  appendLog(`已添加${node.title}节点。`)
}

const getNodeSurfaceSize = (node) => {
  const measured = nodeMeasurements.value[node.id]
  const fallback = BP_NODE_DIMENSIONS[node.kind] || BP_NODE_DIMENSIONS.game

  return {
    width: Number(measured?.width) || fallback.width,
    height: Number(measured?.height) || fallback.height
  }
}

const getWorkflowBounds = (nodes = blueprintNodes.value) => {
  if (!Array.isArray(nodes) || !nodes.length) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  nodes.forEach((node) => {
    const size = getNodeSurfaceSize(node)
    minX = Math.min(minX, Number(node?.position?.x) || 0)
    minY = Math.min(minY, Number(node?.position?.y) || 0)
    maxX = Math.max(maxX, (Number(node?.position?.x) || 0) + size.width)
    maxY = Math.max(maxY, (Number(node?.position?.y) || 0) + size.height)
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

const focusWorkflowNodes = (nodes = blueprintNodes.value, attempt = 0) => {
  if (typeof focusWorldBoundsFn.value !== 'function') return
  if (!Array.isArray(nodes) || !nodes.length) return

  nextTick(() => {
    window.requestAnimationFrame(() => {
      const bounds = getWorkflowBounds(nodes)
      if (bounds) {
        focusWorldBoundsFn.value(bounds, {
          padding: 156,
          minScale: 0.55,
          maxScale: 1.08
        })
      }

      if (attempt < 2) {
        window.setTimeout(() => {
          focusWorkflowNodes(nodes, attempt + 1)
        }, 90)
      }
    })
  })
}

const handleCanvasReady = ({ screenToWorldPoint, getStageRect, focusWorldBounds }) => {
  screenToWorldProjector.value = screenToWorldPoint
  stageRectGetter.value = getStageRect
  focusWorldBoundsFn.value = focusWorldBounds

  if (!hasLogPanelBeenPositioned.value) {
    positionLogPanelInViewport()
  }

  if (blueprintNodes.value.length) {
    focusWorkflowNodes(blueprintNodes.value)
  }
}

const handleKeydown = (event) => {
  if (event.key !== 'Escape') return
  closeNodeOverlays()
}

const handleWindowResize = () => {
  logPanelPosition.value = hasLogPanelBeenPositioned.value
    ? getViewportAnchoredLogPanelPosition()
    : clampLogPanelPosition(logPanelPosition.value)
}

const handleBeforeUnload = (event) => {
  if (!isWorkflowDirty.value) return

  event.preventDefault()
  event.returnValue = ''
}

const nodeMap = computed(() => {
  const map = new Map()
  blueprintNodes.value.forEach((node) => map.set(node.id, node))
  return map
})

const gameBlueprintNodes = computed(() =>
  blueprintNodes.value.filter((node) => node.kind === 'game')
)

const compactBlueprintNodes = computed(() =>
  blueprintNodes.value.filter((node) => isBlueprintCompactNodeKind(node.kind))
)

const renderedEdges = computed(() =>
  blueprintEdges.value
    .map((edge) => {
      const fromNode = nodeMap.value.get(edge.fromNodeId)
      const toNode = nodeMap.value.get(edge.toNodeId)
      if (!fromNode || !toNode) return null

      const { fromPort, toPort } = getBlueprintEdgePortPositions(fromNode, toNode)
      const start = getNodePortPoint(fromNode, fromPort)
      const end = getNodePortPoint(toNode, toPort)
      const orientation = fromPort === 'top' || fromPort === 'bottom'
        ? 'vertical'
        : 'horizontal'

      return {
        ...edge,
        stroke: getBlueprintEdgeColor(fromNode.kind, toNode.kind),
        path: createBlueprintEdgePath(start, end, orientation)
      }
    })
    .filter(Boolean)
)

const previewEdgePath = computed(() => {
  if (!activeEdgeDrag.value) return ''

  const { startPoint, currentPoint, fromPort } = activeEdgeDrag.value
  const orientation = fromPort === 'top' || fromPort === 'bottom'
    ? 'vertical'
    : 'horizontal'
  return createBlueprintEdgePath(startPoint, currentPoint, orientation)
})

const previewEdgeStroke = computed(() => {
  if (!activeEdgeDrag.value?.fromNodeId) return '#8c8c8c'

  const sourceNode = nodeMap.value.get(activeEdgeDrag.value.fromNodeId)
  return getBlueprintEdgePreviewColor(sourceNode?.kind)
})

const handleDropGame = ({ gameId, position }) => {
  const targetGame = gameLibraryById.value.get(String(gameId || ''))

  if (!targetGame) {
    appendLog('拖入失败，未找到对应游戏。', 'error')
    return
  }

  const result = upsertGameBlueprintNode(
    blueprintNodes.value,
    targetGame,
    position,
    createNodeId
  )

  blueprintNodes.value = result.nodes
  activeLibraryGameId.value = String(gameId)

  if (result.created) {
    selectedNodeId.value = result.createdNode.id
    pulseNode(result.createdNode.id)
    appendLog(`已将《${result.createdNode.title}》加入画布。`)
    return
  }

  selectedNodeId.value = result.duplicateNode.id
  pulseNode(result.duplicateNode.id)
  appendLog(`《${result.duplicateNode.title}》已存在于画布中。`)
}

const clearScheduledLibraryLoad = () => {
  if (libraryLoadTimeout) {
    clearTimeout(libraryLoadTimeout)
    libraryLoadTimeout = null
  }

  if (libraryLoadRaf) {
    window.cancelAnimationFrame(libraryLoadRaf)
    libraryLoadRaf = null
  }

  if (libraryLoadIdle && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(libraryLoadIdle)
    libraryLoadIdle = null
  }
}

const loadLibraryGames = async () => {
  clearScheduledLibraryLoad()

  if (gameStore.gamesLoaded) {
    isLibraryLoading.value = false
    appendLog('已连接游戏库，可将游戏拖入画布。')
    return
  }

  isLibraryLoading.value = true

  try {
    await gameStore.loadGames()
    appendLog('已连接游戏库，可将游戏拖入画布。')
  } catch (error) {
    appendLog(error?.message || '游戏库加载失败，请稍后重试。', 'error')
  } finally {
    isLibraryLoading.value = false
  }
}

const scheduleLibraryLoad = () => {
  if (gameStore.gamesLoaded) {
    appendLog('已连接游戏库，可将游戏拖入画布。')
    return
  }

  isLibraryLoading.value = true

  const queueLoad = () => {
    libraryLoadTimeout = window.setTimeout(() => {
      loadLibraryGames()
    }, 120)
  }

  if (typeof window.requestIdleCallback === 'function') {
    libraryLoadIdle = window.requestIdleCallback(() => {
      queueLoad()
    }, { timeout: 800 })
    return
  }

  libraryLoadRaf = window.requestAnimationFrame(() => {
    queueLoad()
  })
}

onMounted(async () => {
  appendLog('蓝图模块已加载，正在准备游戏库。')
  scheduleLibraryLoad()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('beforeunload', handleBeforeUnload)

  const routeSeed = getRouteSeedValue()
  if (routeSeed) {
    await handleImportSeed(routeSeed, { skipConfirm: true })
  } else {
    updateWorkflowSavedSnapshot()
    hasWorkflowHydrated.value = true
  }

  await fetchRecentBlueprints()
})

watch(
  () => getRouteSeedValue(),
  (nextSeed) => {
    if (!hasWorkflowHydrated.value) return

    const normalizedCurrentSeed = normalizeSeedInput(seed.value)
    if (!nextSeed || nextSeed === normalizedCurrentSeed) return

    void handleImportSeed(nextSeed, { skipConfirm: true })
  }
)

watch(latestPreviewUrl, (nextPreviewUrl) => {
  if (!activeEditor.value || activeEditor.value.kind !== 'output') return

  activeEditor.value = {
    ...activeEditor.value,
    previewUrl: String(nextPreviewUrl || '')
  }
})

watch(isSidebarCollapsed, () => {
  window.setTimeout(() => {
    logPanelPosition.value = hasLogPanelBeenPositioned.value
      ? getViewportAnchoredLogPanelPosition()
      : clampLogPanelPosition(logPanelPosition.value)
  }, 0)
})

onBeforeUnmount(() => {
  if (highlightTimer) {
    clearTimeout(highlightTimer)
  }

  cancelActiveExecutionStream()
  clearScheduledLibraryLoad()
  finishNodeDrag({ snapToGrid: false })
  finishEdgeDrag()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave(() => {
  if (!isWorkflowDirty.value) return true
  return window.confirm('当前蓝图有未保存改动，确定退出吗？')
})
</script>

<template>
  <div
    class="bp-page"
    :class="{ 'is-sidebar-collapsed': isSidebarCollapsed }"
    @pointerdown.capture="handleGlobalPointerDown"
    @pointerup.capture="clearPointerButtonFocus"
  >
    <BlueprintSidebar
      v-if="!isSidebarCollapsed"
      :games="libraryGames"
      :logs="logs"
      :model-options="modelOptions"
      :selected-model="selectedModel"
      :vision-model-options="visionModelOptions"
      :selected-vision-model="selectedVisionModel"
      :seed="seed"
      :recent-blueprints="formattedRecentBlueprints"
      :recent-blueprints-loading="recentBlueprintsLoading"
      :recent-blueprints-error="recentBlueprintsError"
      :collapsed="isSidebarCollapsed"
      :loading="isLibraryLoading"
      :active-game-id="activeLibraryGameId"
      :busy="isWorkflowBusy"
      @toggle="toggleSidebar"
      @create-blueprint="handleCreateBlueprint"
      @select-game="handleSelectGame"
      @export-workflow="handleExportWorkflow"
      @import-workflow="handleImportWorkflow"
      @clear-workflow="handleClearWorkflow"
      @select-model="handleSelectModel"
      @select-vision-model="handleSelectVisionModel"
      @import-seed="handleImportSeed"
      @save-seed="handleSaveWorkflowToSeed"
    />

    <main class="bp-main">
      <button
        v-if="isSidebarCollapsed"
        type="button"
        class="bp-sidebar-fab bp-control-surface bp-control-button bp-control-button-hover-lift"
        aria-label="展开侧栏"
        @click="toggleSidebar"
      >
        <i class="fa fa-angles-right"></i>
      </button>
      <BlueprintToolbar
        @action="handleToolbarAction"
        @save="handleSaveWorkflowToSeed"
        @run="handleExecuteWorkflow"
      />
      <BlueprintCanvasStage
        :busy="isWorkflowBusy"
        :planning="isPlannerRunning"
        :planning-label="planningStatusLabel"
        :prompt-value="plannerPromptDraft"
        :prompt-disabled="isWorkflowBusy"
        :show-empty-state="!blueprintNodes.length"
        placeholder="直接描述需求，AI 会自动调用合适节点并生成工作流"
        @canvas-ready="handleCanvasReady"
        @drop-game="handleDropGame"
        @update:prompt="updatePlannerPromptDraft"
        @submit-prompt="handleSubmitPlannerPrompt"
      >
        <template #world="{ screenToWorldPoint }">
          <div class="bp-world-layer">
            <svg
              class="bp-edge-layer"
              :viewBox="`0 0 ${BP_WORLD_WIDTH} ${BP_WORLD_HEIGHT}`"
              :width="BP_WORLD_WIDTH"
              :height="BP_WORLD_HEIGHT"
              aria-hidden="true"
            >
              <path
                v-for="edge in renderedEdges"
                :key="edge.id"
                class="bp-edge-path"
                :d="edge.path"
                :style="{ stroke: edge.stroke }"
              />
              <path
                v-if="previewEdgePath"
                class="bp-edge-path bp-edge-path-preview"
                :d="previewEdgePath"
                :style="{ stroke: previewEdgeStroke }"
              />
            </svg>

          <BlueprintGameNode
            v-for="node in gameBlueprintNodes"
            :key="node.id"
            :node="node"
            :runtime="nodeRuntimeMap[node.id] || null"
            :selected="selectedNodeId === node.id"
            :highlighted="highlightedNodeId === node.id"
            @select="handleSelectNode"
            @drag-start="handleNodeDragStart($event, screenToWorldPoint)"
            @start-link="handleStartLink($event, screenToWorldPoint)"
            @context-menu="handleNodeContextMenu($event, screenToWorldPoint)"
            @measure="handleNodeMeasure"
            @unmount="handleNodeUnmount"
          />
          <BlueprintCompactNode
            v-for="node in compactBlueprintNodes"
            :key="node.id"
            :node="node"
            :runtime="nodeRuntimeMap[node.id] || null"
            :selected="selectedNodeId === node.id"
            :highlighted="highlightedNodeId === node.id"
            @select="handleSelectNode"
            @drag-start="handleNodeDragStart($event, screenToWorldPoint)"
            @start-link="handleStartLink($event, screenToWorldPoint)"
            @context-menu="handleNodeContextMenu($event, screenToWorldPoint)"
            @measure="handleNodeMeasure"
            @unmount="handleNodeUnmount"
          />

          <BlueprintNodeContextMenu
            v-if="activeContextMenu"
            :menu="activeContextMenu"
            @rerun-node="handleExecuteNode($event, { scope: 'single' })"
            @continue-from-node="handleExecuteNode($event, { scope: 'branch' })"
            @edit="openNodeEditor"
            @delete="handleDeleteNode"
          />

          <BlueprintNodeEditorPanel
            v-if="activeEditor"
            :editor="activeEditor"
            @close="closeNodeOverlays"
            @save="saveNodeEditor"
            @update:draft="updateNodeEditorDraft"
          />

          </div>
        </template>
        <template #overlay>
          <BlueprintLogPanel
            :position="logPanelPosition"
            :latest-run-id="latestRunId"
            :can-clear-history="canClearLogPanelHistory"
            :can-cancel-latest-run="canCancelLatestRun"
            :can-continue-failed-run="canContinueFailedRun"
            :should-show-output-card="shouldShowLogOutputCard"
            :latest-output-file-entries="latestOutputFileEntries"
            :latest-preview-url="latestPreviewUrl"
            :latest-output-readme-snippet="latestOutputReadmeSnippet"
            :should-show-run-history="shouldShowRunHistory"
            :recent-runs="recentRuns"
            :logs="logs"
            :format-run-status-label="formatRunStatusLabel"
            @clear-history="handleClearLogs"
            @cancel-latest-run="handleCancelLatestRun"
            @continue-latest-run="handleContinueFromFailedRun"
          />
        </template>
      </BlueprintCanvasStage>
    </main>
  </div>
</template>

<style src="../styles/blueprint-mode.css"></style>
<style src="../styles/blueprint-node-chrome.css"></style>
<style src="../styles/blueprint-controls.css"></style>
<style src="../styles/blueprint-workspace.css"></style>
