<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import BlueprintSidebar from '../components/blueprint/BlueprintSidebar.vue'
import BlueprintToolbar from '../components/blueprint/BlueprintToolbar.vue'
import BlueprintCanvasStage from '../components/blueprint/BlueprintCanvasStage.vue'
import BlueprintGameNode from '../components/blueprint/BlueprintGameNode.vue'
import BlueprintCompactNode from '../components/blueprint/BlueprintCompactNode.vue'
import BlueprintNodeContextMenu from '../components/blueprint/BlueprintNodeContextMenu.vue'
import BlueprintNodeEditorPanel from '../components/blueprint/BlueprintNodeEditorPanel.vue'
import {
  BLUEPRINT_COMPACT_NODE_META,
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
  getBlueprintLogPanelPosition,
  getBlueprintNodeContextMenuPosition,
  getBlueprintNodeEditorPanelPosition
} from '../utils/blueprintUi.js'
import {
  CHAT_MORE_BUILTIN_MODELS,
  CHAT_MORE_BUILTIN_MODEL_META
} from '../utils/discussionChatMore.js'
import { API_BASE_URL, apiCall } from '../utils/api'

const gameStore = useGameStore()
const authStore = useAuthStore()
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

const BLUEPRINT_SEED_PATTERN = /^[A-Z0-9]{8,32}$/
const BP_LOG_PANEL_WIDTH = 360
const BP_LOG_PANEL_HEIGHT = 420
const BP_LOG_PANEL_MARGIN = 24
const BP_LOG_PANEL_SAFE_TOP = 84
const BP_LOG_PANEL_SAFE_BOTTOM = 128
const BP_LOG_PANEL_SAFE_RIGHT = 24
const BP_LOG_PANEL_SAFE_LEFT = 24

const seed = ref('')
const seedOwnership = ref('draft')
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
const workflowLoadState = ref('idle')
const selectedModel = ref(CHAT_MORE_BUILTIN_MODELS[0] || 'DouBaoSeed')
const hasWorkflowHydrated = ref(false)
const lastSavedWorkflowSnapshot = ref(serializeBlueprintWorkflow([], []))
const latestRunId = ref('')
const latestRunStatus = ref('idle')
const latestRunContinuation = ref(null)
const latestFailedNodeId = ref('')
const recentRuns = ref([])
const latestRunDetail = ref(null)
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
  || workflowLoadState.value === 'executing'
)
const isWorkflowDirty = computed(() => {
  if (!seed.value || !hasBlueprintNodes.value) return false
  return workflowSnapshot.value !== lastSavedWorkflowSnapshot.value
})
const canGenerateSeed = computed(() =>
  hasBlueprintNodes.value && !seed.value && !isWorkflowBusy.value
)
const canSaveWorkflow = computed(() =>
  hasBlueprintNodes.value && Boolean(seed.value) && !isWorkflowBusy.value
)
const canCopySeed = computed(() =>
  Boolean(seed.value) && !isWorkflowBusy.value
)
const canExecuteWorkflow = computed(() =>
  hasBlueprintNodes.value && !isWorkflowBusy.value
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

const getRuntimeBundleFiles = (runtime = null) => {
  const files = runtime?.artifactJson?.files
  return files && typeof files === 'object' ? files : {}
}

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
  appendLog('当前服务端暂未提供运行历史接口，已切换为兼容模式。')
}

const formatRunStatusLabel = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  if (normalizedStatus === 'completed') return '已完成'
  if (normalizedStatus === 'failed') return '失败'
  if (normalizedStatus === 'running') return '运行中'
  if (normalizedStatus === 'cancel_requested') return '取消中'
  if (normalizedStatus === 'cancelled') return '已取消'
  return '待处理'
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
}

const buildWorkflowPayload = () => JSON.parse(workflowSnapshot.value)

const fetchRunHistory = async ({ limit = 6 } = {}) => {
  if (!runHistoryApiAvailable.value) return

  try {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    if (seed.value) {
      params.set('seed', seed.value)
    }

    const payload = await apiCall(`/blueprints/runs?${params.toString()}`, {
      suppressErrorLogging: true
    })
    recentRuns.value = Array.isArray(payload?.runs) ? payload.runs : []
  } catch (error) {
    if (error?.status === 404) {
      disableRunHistoryApi()
      return
    }

    appendLog(resolveBlueprintErrorMessage(error, '获取蓝图运行历史失败，请稍后重试。'))
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

const generateRandomSeedCandidate = (length = 12) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const randomValues = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
    ? crypto.getRandomValues(new Uint32Array(length))
    : Array.from({ length }, () => Math.floor(Math.random() * 0xffffffff))

  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('')
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
  seedOwnership.value = payload.ownership || 'copy'
  applyWorkflowPayload(payload.workflow, { persistSnapshot: true })
  await syncSeedToRoute(seed.value)
  appendLog(successMessage)
  await fetchRunHistory()
}

const handleGenerateSeed = async () => {
  if (!hasBlueprintNodes.value) {
    appendLog('请先创建至少一个节点，再生成种子。')
    return
  }

  workflowLoadState.value = 'creating'

  try {
    let createdPayload = null

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidateSeed = generateRandomSeedCandidate()

      try {
        createdPayload = await apiCall('/blueprints', {
          method: 'POST',
          body: JSON.stringify({
            seed: candidateSeed,
            workflow: buildWorkflowPayload()
          })
        })
        break
      } catch (error) {
        if (error?.status === 409) {
          continue
        }

        throw error
      }
    }

    if (!createdPayload?.seed) {
      appendLog('种子生成冲突次数过多，请稍后重试。')
      return
    }

    await persistBlueprintSeedState(
      createdPayload,
      `已生成种子 ${createdPayload.seed}，并完成首次保存。`
    )
  } catch (error) {
    appendLog(resolveBlueprintErrorMessage(error, '生成种子失败，请稍后重试。'))
  } finally {
    workflowLoadState.value = 'idle'
  }
}

const handleImportSeed = async (seedValue, options = {}) => {
  const normalizedSeed = normalizeSeedInput(seedValue)

  if (!BLUEPRINT_SEED_PATTERN.test(normalizedSeed)) {
    appendLog('请输入 8-32 位的大写字母或数字种子。')
    return
  }

  if (!options.skipConfirm && !confirmWorkflowReplacement()) {
    return
  }

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
    appendLog(resolveBlueprintErrorMessage(error, '种子导入失败，请检查后重试。'))
  } finally {
    workflowLoadState.value = 'idle'
    hasWorkflowHydrated.value = true
  }
}

const handleSaveWorkflowToSeed = async () => {
  if (!seed.value) {
    appendLog('请先生成种子，再保存当前蓝图。')
    return
  }

  if (!hasBlueprintNodes.value) {
    appendLog('当前没有节点内容，无法保存到种子。')
    return
  }

  workflowLoadState.value = 'saving'

  try {
    const payload = await apiCall(`/blueprints/${encodeURIComponent(seed.value)}`, {
      method: 'PUT',
      body: JSON.stringify({
        workflow: buildWorkflowPayload()
      })
    })

    await persistBlueprintSeedState(payload, '已保存当前蓝图。')
  } catch (error) {
    appendLog(resolveBlueprintErrorMessage(error, '保存蓝图失败，请稍后重试。'))
  } finally {
    workflowLoadState.value = 'idle'
  }
}

const handleCopySeed = async () => {
  if (!seed.value) {
    appendLog('当前还没有可分享的种子。')
    return
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(seed.value)
    } else {
      const input = document.createElement('input')
      input.value = seed.value
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }

    appendLog(`已复制种子 ${seed.value}。`)
  } catch (error) {
    console.error('复制蓝图种子失败:', error)
    appendLog('复制种子失败，请手动复制当前种子。')
  }
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

const appendLog = (line) => {
  const timestamp = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })

  logs.value = [`${timestamp} ${line}`, ...logs.value].slice(0, 20)
}

const handleClearLogs = () => {
  logs.value = []
}

const PROGRESS_STAGE_LABELS = {
  queued: '准备',
  metadata: '元信息',
  code: '代码',
  video: '关键帧',
  prepare: '整理输入',
  generate: '模型生成',
  parse: '解析结果',
  finalize: '收尾'
}

const buildProgressTrail = (currentTrail = [], patch = {}) => {
  const detail = String(patch.detail || '').trim()
  if (!detail) return currentTrail

  const nextEntry = {
    stage: String(patch.stage || ''),
    label: PROGRESS_STAGE_LABELS[String(patch.stage || '')] || '处理中',
    detail
  }

  return [...currentTrail, nextEntry].slice(-3)
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
    latestRunId.value = String(event.runId || '')
    latestRunStatus.value = 'running'
    latestRunContinuation.value = null
    latestFailedNodeId.value = ''
    latestRunDetail.value = null
    appendLog(`开始自动执行工作流，模型：${event.model || selectedModel.value}。`)
    return
  }

  if (event.event === 'step-start') {
    assignNodeRuntime(event.nodeId, {
      status: 'running',
      kind: event.nodeKind,
      model: event.mode === 'source' ? 'source' : selectedModel.value,
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
    appendLog(`节点「${event.nodeTitle || event.nodeId}」执行失败。`)
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
    appendLog(event.message || '工作流执行失败。')
    return
  }

  if (event.event === 'workflow-log') {
    appendLog(event.message || '工作流产生了一条新的运行日志。')
  }
}

const streamBlueprintExecution = async ({ startNodeId = '', scope = 'all' } = {}) => {
  if (isWorkflowBusy.value) return

  if (!hasBlueprintNodes.value) {
    appendLog('当前没有节点内容，无法执行工作流。')
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

    appendLog(error?.message || '执行工作流失败，请稍后重试。')
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
        appendLog('当前没有可继续的失败节点。')
        return
      }

      appendLog('当前服务端未提供运行历史接口，已使用当前会话状态从失败节点继续。')
      await handleExecuteNode(localContinuation.nodeId, {
        scope: localContinuation.scope
      })
      return
    }

    if (!targetRunId) {
      if (!localContinuation?.nodeId) {
        appendLog('当前没有可继续的运行记录。')
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
      appendLog('最近一次运行没有可继续的失败节点。')
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
        appendLog('运行详情接口不可用，已回退到当前会话状态继续执行。')
        await handleExecuteNode(localContinuation.nodeId, {
          scope: localContinuation.scope
        })
        return
      }
    }

    appendLog(resolveBlueprintErrorMessage(error, '加载运行记录失败，请稍后重试。'))
  }
}

const handleCancelLatestRun = async (runId = latestRunId.value) => {
  const targetRunId = String(runId || latestRunId.value || '').trim()
  if (!targetRunId) {
    appendLog('当前没有可取消的运行记录。')
    return
  }

  try {
    if (!runHistoryApiAvailable.value) {
      appendLog('当前服务端暂未提供运行取消接口。')
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
      appendLog('当前服务端暂未提供运行取消接口。')
      return
    }

    appendLog(resolveBlueprintErrorMessage(error, '取消运行失败，请稍后重试。'))
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
  selectedModel.value = String(modelValue || 'DouBaoSeed').trim() || 'DouBaoSeed'
  appendLog(`已切换执行模型为 ${selectedModel.value}。`)
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

const createEdgePath = (start, end, orientation = 'horizontal') => {
  if (orientation === 'vertical') {
    const delta = Math.max(72, Math.abs(end.y - start.y) * 0.4)
    return `M ${start.x} ${start.y} C ${start.x} ${start.y + delta}, ${end.x} ${end.y - delta}, ${end.x} ${end.y}`
  }

  const delta = Math.max(72, Math.abs(end.x - start.x) * 0.4)
  return `M ${start.x} ${start.y} C ${start.x + delta} ${start.y}, ${end.x - delta} ${end.y}, ${end.x} ${end.y}`
}

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
    appendLog('当前画布为空，没有可导出的工作流。')
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
    resetBlueprintRuntime()
    resetLatestRunTracking()
    selectedNodeId.value = nodes[0]?.id || ''
    activeLibraryGameId.value = nodes[0]?.gameId || ''
    appendLog(`已导入 ${nodes.length} 个节点和 ${edges.length} 条连线。`)
    void fetchRunHistory()
  } catch (error) {
    appendLog(error?.message || '导入失败，请检查 JSON 格式。')
  }
}

const handleClearWorkflow = () => {
  if (!blueprintNodes.value.length) {
    appendLog('当前画布已经是空的。')
    return
  }

  blueprintNodes.value = []
  blueprintEdges.value = []
  resetBlueprintRuntime()
  resetLatestRunTracking()
  selectedNodeId.value = ''
  highlightedNodeId.value = ''
  activeLibraryGameId.value = ''
  closeNodeOverlays()
  appendLog('已清空当前工作流。')
  void fetchRunHistory()
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

const handleCanvasReady = ({ screenToWorldPoint, getStageRect }) => {
  screenToWorldProjector.value = screenToWorldPoint
  stageRectGetter.value = getStageRect

  if (!hasLogPanelBeenPositioned.value) {
    positionLogPanelInViewport()
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
        path: createEdgePath(start, end, orientation)
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
  return createEdgePath(startPoint, currentPoint, orientation)
})

const previewEdgeStroke = computed(() => {
  if (!activeEdgeDrag.value?.fromNodeId) return '#8c8c8c'

  const sourceNode = nodeMap.value.get(activeEdgeDrag.value.fromNodeId)
  return getBlueprintEdgePreviewColor(sourceNode?.kind)
})

const handleDropGame = ({ gameId, position }) => {
  const targetGame = gameLibraryById.value.get(String(gameId || ''))

  if (!targetGame) {
    appendLog('拖入失败，未找到对应游戏。')
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
    appendLog(error?.message || '游戏库加载失败，请稍后重试。')
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

  const routeSeed = getRouteSeedValue()
  if (routeSeed) {
    await handleImportSeed(routeSeed, { skipConfirm: true })
  } else {
    updateWorkflowSavedSnapshot()
    hasWorkflowHydrated.value = true
  }

  await fetchRunHistory()
  if (latestRunId.value && runHistoryApiAvailable.value) {
    try {
      await syncLatestRunDetail(latestRunId.value, { hydrate: true })
    } catch (error) {
      if (error?.status === 404) {
        disableRunHistoryApi()
      }
    }
  }
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
      :seed="seed"
      :ownership="seedOwnership"
      :logs="logs"
      :model-options="modelOptions"
      :selected-model="selectedModel"
      :collapsed="isSidebarCollapsed"
      :loading="isLibraryLoading"
      :active-game-id="activeLibraryGameId"
      :busy="isWorkflowBusy"
      :can-generate-seed="canGenerateSeed"
      :can-save-workflow="canSaveWorkflow"
      :can-copy-seed="canCopySeed"
      @toggle="toggleSidebar"
      @select-game="handleSelectGame"
      @export-workflow="handleExportWorkflow"
      @import-workflow="handleImportWorkflow"
      @clear-workflow="handleClearWorkflow"
      @generate-seed="handleGenerateSeed"
      @save-workflow="handleSaveWorkflowToSeed"
      @copy-seed="handleCopySeed"
      @import-seed="handleImportSeed"
      @select-model="handleSelectModel"
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
        :show-empty-state="!blueprintNodes.length"
        @canvas-ready="handleCanvasReady"
        @drop-game="handleDropGame"
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
          <section
            class="bp-log-panel bp-control-surface"
            :style="{
              left: `${logPanelPosition.x}px`,
              top: `${logPanelPosition.y}px`
            }"
            data-no-pan
          >
            <header
              class="bp-log-panel-header"
              data-no-pan
            >
              <div class="bp-log-panel-title">
                <i class="fa fa-bars-staggered" aria-hidden="true"></i>
                <span>生成日志</span>
              </div>
              <div class="bp-log-panel-actions">
                <span v-if="latestRunId" class="bp-log-panel-run-id">
                  Run #{{ latestRunId }}
                </span>
                <button
                  v-if="logs.length"
                  type="button"
                  class="bp-log-panel-action"
                  @click="handleClearLogs"
                >
                  清空日志
                </button>
                <button
                  v-if="canCancelLatestRun"
                  type="button"
                  class="bp-log-panel-action"
                  @click="handleCancelLatestRun"
                >
                  取消运行
                </button>
                <button
                  v-if="canContinueFailedRun"
                  type="button"
                  class="bp-log-panel-action"
                  @click="handleContinueFromFailedRun"
                >
                  从失败节点继续
                </button>
              </div>
            </header>
            <div class="bp-log-panel-body" data-no-pan>
              <section
                v-if="latestOutputFileEntries.length || latestPreviewUrl"
                class="bp-log-output-card"
              >
                <div class="bp-log-output-head">
                  <div>
                    <strong>最近产物</strong>
                    <span>{{ latestOutputFileEntries.length }} 个文件</span>
                  </div>
                  <a
                    v-if="latestPreviewUrl"
                    class="bp-log-output-link"
                    :href="latestPreviewUrl"
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开预览
                  </a>
                </div>
                <div v-if="latestOutputFileEntries.length" class="bp-log-output-files">
                  <span
                    v-for="file in latestOutputFileEntries"
                    :key="file.fileName"
                    class="bp-log-output-file"
                  >
                    {{ file.fileName }}
                  </span>
                </div>
                <iframe
                  v-if="latestPreviewUrl"
                  class="bp-log-output-iframe"
                  :src="latestPreviewUrl"
                  title="Blueprint H5 预览"
                  loading="lazy"
                ></iframe>
                <pre v-if="latestOutputReadmeSnippet" class="bp-log-output-readme">{{ latestOutputReadmeSnippet }}</pre>
              </section>
              <div v-if="runHistoryApiAvailable && recentRuns.length" class="bp-log-run-list">
                <article
                  v-for="run in recentRuns"
                  :key="run.id"
                  class="bp-log-run-item"
                >
                  <div class="bp-log-run-meta">
                    <strong>#{{ run.id }}</strong>
                    <span>{{ run.model || '未知模型' }}</span>
                  </div>
                  <div class="bp-log-run-row">
                    <span
                      class="bp-log-run-status"
                      :class="`is-${String(run.status || 'pending')}`"
                    >
                      {{ formatRunStatusLabel(run.status) }}
                    </span>
                    <div class="bp-log-run-actions">
                      <button
                        v-if="run.continuation?.nodeId && run.status === 'failed'"
                        type="button"
                        class="bp-log-run-mini-btn"
                        @click="handleContinueFromFailedRun(run.id)"
                      >
                        续跑
                      </button>
                      <button
                        v-if="['running', 'cancel_requested'].includes(String(run.status || ''))"
                        type="button"
                        class="bp-log-run-mini-btn"
                        @click="handleCancelLatestRun(run.id)"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </article>
              </div>
              <p v-if="!logs.length" class="bp-log-panel-empty">暂无日志</p>
              <p v-for="(line, index) in logs" :key="index">{{ line }}</p>
            </div>
          </section>
        </template>
      </BlueprintCanvasStage>
    </main>
  </div>
</template>

<style src="../styles/blueprint-mode.css"></style>
<style src="../styles/blueprint-node-chrome.css"></style>
<style src="../styles/blueprint-controls.css"></style>
<style scoped>
.bp-world-layer {
  position: relative;
  width: 4800px;
  height: 3200px;
}

.bp-edge-layer {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
}

.bp-edge-path {
  fill: none;
  stroke: rgba(96, 96, 96, 0.84);
  stroke-width: 3;
  stroke-linecap: round;
}

.bp-edge-path-preview {
  stroke: rgba(146, 146, 146, 0.94);
  stroke-dasharray: 10 8;
}

.bp-log-panel {
  position: absolute;
  z-index: 7;
  width: 360px;
  height: min(420px, calc(100dvh - 112px));
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 36px rgba(32, 24, 11, 0.14);
  overflow: hidden;
  pointer-events: auto;
}

.bp-log-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
  background: linear-gradient(180deg, rgba(252, 251, 248, 0.98), rgba(245, 241, 234, 0.98));
}

.bp-log-panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #171513;
  font-size: 0.84rem;
  font-weight: 700;
}

.bp-log-panel-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.bp-log-panel-run-id {
  color: #8b8274;
  font-size: 0.7rem;
  white-space: nowrap;
}

.bp-log-panel-action {
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 999px;
  padding: 5px 9px;
  background: rgba(255, 255, 255, 0.82);
  color: #2f2a22;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
}

.bp-log-panel-action:hover {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(17, 17, 17, 0.2);
  transform: translateY(-1px);
}

.bp-log-panel-body {
  flex: 1;
  min-height: 0;
  padding: 12px 14px;
  overflow: auto;
}

.bp-log-output-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  min-height: 0;
  padding: 11px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(251, 249, 244, 0.96), rgba(245, 241, 233, 0.94));
}

.bp-log-output-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.bp-log-output-head strong,
.bp-log-output-head span {
  display: block;
}

.bp-log-output-head strong {
  color: #171513;
  font-size: 0.78rem;
}

.bp-log-output-head span {
  margin-top: 4px;
  color: #7d7569;
  font-size: 0.68rem;
}

.bp-log-output-link {
  color: #946400;
  font-size: 0.7rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.bp-log-output-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bp-log-output-file {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #4f483d;
  font-size: 0.68rem;
  font-weight: 600;
}

.bp-log-output-iframe {
  width: 100%;
  height: 180px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  background: #ffffff;
}

.bp-log-output-readme {
  margin: 0;
  padding: 10px;
  max-height: 140px;
  overflow: auto;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.74);
  color: #5a5347;
  font-size: 0.7rem;
  line-height: 1.55;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.bp-log-run-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.bp-log-run-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  background: rgba(248, 245, 239, 0.85);
}

.bp-log-run-meta,
.bp-log-run-row,
.bp-log-run-actions {
  display: flex;
  align-items: center;
}

.bp-log-run-meta,
.bp-log-run-row {
  justify-content: space-between;
  gap: 8px;
}

.bp-log-run-meta strong {
  color: #171513;
  font-size: 0.74rem;
}

.bp-log-run-meta span {
  color: #7d7569;
  font-size: 0.7rem;
}

.bp-log-run-actions {
  gap: 6px;
}

.bp-log-run-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
  color: #544b3f;
  background: rgba(138, 129, 118, 0.14);
}

.bp-log-run-status.is-completed {
  color: #14633c;
  background: rgba(42, 167, 103, 0.16);
}

.bp-log-run-status.is-failed {
  color: #8a2d2d;
  background: rgba(215, 90, 90, 0.16);
}

.bp-log-run-status.is-running,
.bp-log-run-status.is-cancel_requested {
  color: #85580d;
  background: rgba(224, 171, 74, 0.2);
}

.bp-log-run-status.is-cancelled {
  color: #5b556a;
  background: rgba(131, 126, 151, 0.16);
}

.bp-log-run-mini-btn {
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.82);
  color: #2f2a22;
  font-size: 0.68rem;
  line-height: 1;
  cursor: pointer;
}

.bp-log-panel-body p {
  margin: 0;
  color: #5c554a;
  font-size: 0.78rem;
  line-height: 1.65;
}

.bp-log-panel-body p + p {
  margin-top: 8px;
}

.bp-log-panel-empty {
  color: #9a9388;
}

</style>
