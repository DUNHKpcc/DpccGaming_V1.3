<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  getBlueprintNodeContextMenuPosition,
  getBlueprintNodeEditorPanelPosition
} from '../utils/blueprintUi.js'
import { apiCall } from '../utils/api'

const gameStore = useGameStore()
const route = useRoute()
const router = useRouter()

const modelOptions = [
  { name: 'ClaudeOpus4.6', logoSrc: '/Ai/Claude.png', logoAlt: 'Claude' },
  { name: 'DouBaoSeed1.6', logoSrc: '/Ai/DouBaoSeed1.6.png', logoAlt: 'DouBao Seed' },
  { name: 'ChatGPT5.4', logoSrc: '/Ai/ChatGPT.svg', logoAlt: 'ChatGPT' },
  { name: 'Qwen3-code', logoSrc: '/Ai/Qwen.png', logoAlt: 'Qwen' }
]

const BLUEPRINT_SEED_PATTERN = /^[A-Z0-9]{8,32}$/
const BP_LOG_PANEL_WIDTH = 320
const BP_LOG_PANEL_HEIGHT = 220
const BP_LOG_PANEL_MARGIN = 32

const seed = ref('')
const seedOwnership = ref('draft')
const logs = ref([])
const isSidebarCollapsed = ref(false)
const isLibraryLoading = ref(false)
const blueprintNodes = ref([])
const blueprintEdges = ref([])
const nodeMeasurements = ref({})
const selectedNodeId = ref('')
const highlightedNodeId = ref('')
const activeContextMenu = ref(null)
const activeEditor = ref(null)
const activeLibraryGameId = ref('')
const activeNodeDrag = ref(null)
const activeEdgeDrag = ref(null)
const activeLogPanelDrag = ref(null)
const screenToWorldProjector = ref(null)
const workflowLoadState = ref('idle')
const hasWorkflowHydrated = ref(false)
const lastSavedWorkflowSnapshot = ref(serializeBlueprintWorkflow([], []))
const logPanelPosition = ref({
  x: BP_WORLD_WIDTH - BP_LOG_PANEL_WIDTH - 48,
  y: 96
})

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

const clampLogPanelPosition = (position = {}) => ({
  x: Math.min(
    BP_WORLD_WIDTH - BP_LOG_PANEL_WIDTH - BP_LOG_PANEL_MARGIN,
    Math.max(BP_LOG_PANEL_MARGIN, Number(position.x) || 0)
  ),
  y: Math.min(
    BP_WORLD_HEIGHT - BP_LOG_PANEL_HEIGHT - BP_LOG_PANEL_MARGIN,
    Math.max(BP_LOG_PANEL_MARGIN, Number(position.y) || 0)
  )
})

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

const applyWorkflowPayload = (workflow = {}, options = {}) => {
  const { nodes, edges } = parseBlueprintWorkflow(JSON.stringify(workflow || {}))

  blueprintNodes.value = nodes
  blueprintEdges.value = edges
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

const finishLogPanelDrag = () => {
  window.removeEventListener('pointermove', handleLogPanelPointerMove)
  window.removeEventListener('pointerup', handleLogPanelPointerUp)
  activeLogPanelDrag.value = null
}

const handleGlobalPointerDown = (event) => {
  if (!(event.target instanceof Element)) {
    closeNodeOverlays()
    return
  }

  if (event.target.closest('.bp-node-context-menu, .bp-node-editor-panel')) return
  closeNodeOverlays()
}

const handleLogPanelPointerMove = (event) => {
  const currentDrag = activeLogPanelDrag.value
  if (!currentDrag) return

  const pointerPoint = currentDrag.screenToWorldPoint({
    x: event.clientX,
    y: event.clientY
  })

  logPanelPosition.value = clampLogPanelPosition({
    x: pointerPoint.x - currentDrag.pointerOffset.x,
    y: pointerPoint.y - currentDrag.pointerOffset.y
  })
}

const handleLogPanelPointerUp = () => {
  finishLogPanelDrag()
}

const handleLogPanelDragStart = (event, screenToWorldPoint) => {
  if (event.button !== 0 || typeof screenToWorldPoint !== 'function') return

  const pointerPoint = screenToWorldPoint({
    x: event.clientX,
    y: event.clientY
  })

  activeLogPanelDrag.value = {
    pointerOffset: {
      x: pointerPoint.x - logPanelPosition.value.x,
      y: pointerPoint.y - logPanelPosition.value.y
    },
    screenToWorldPoint
  }

  window.addEventListener('pointermove', handleLogPanelPointerMove)
  window.addEventListener('pointerup', handleLogPanelPointerUp, { once: true })
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

  logs.value = [`${timestamp} ${line}`, ...logs.value].slice(0, 8)
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
    draft: String(node.content || '')
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
    selectedNodeId.value = nodes[0]?.id || ''
    activeLibraryGameId.value = nodes[0]?.gameId || ''
    appendLog(`已导入 ${nodes.length} 个节点和 ${edges.length} 条连线。`)
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
  selectedNodeId.value = ''
  highlightedNodeId.value = ''
  activeLibraryGameId.value = ''
  closeNodeOverlays()
  appendLog('已清空当前工作流。')
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

const handleCanvasReady = ({ screenToWorldPoint }) => {
  screenToWorldProjector.value = screenToWorldPoint
}

const handleKeydown = (event) => {
  if (event.key !== 'Escape') return
  closeNodeOverlays()
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

  const routeSeed = getRouteSeedValue()
  if (routeSeed) {
    await handleImportSeed(routeSeed, { skipConfirm: true })
  } else {
    updateWorkflowSavedSnapshot()
    hasWorkflowHydrated.value = true
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

onBeforeUnmount(() => {
  if (highlightTimer) {
    clearTimeout(highlightTimer)
  }

  clearScheduledLibraryLoad()
  finishNodeDrag({ snapToGrid: false })
  finishEdgeDrag()
  finishLogPanelDrag()
  window.removeEventListener('keydown', handleKeydown)
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
      <BlueprintToolbar @action="handleToolbarAction" />
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
              @pointerdown.stop.prevent="handleLogPanelDragStart($event, screenToWorldPoint)"
            >
              <div class="bp-log-panel-title">
                <i class="fa fa-bars-staggered" aria-hidden="true"></i>
                <span>生成日志</span>
              </div>
              <span class="bp-log-panel-hint">拖动</span>
            </header>
            <div class="bp-log-panel-body" data-no-pan>
              <p v-if="!logs.length" class="bp-log-panel-empty">暂无日志</p>
              <p v-for="(line, index) in logs" :key="index">{{ line }}</p>
            </div>
          </section>
          </div>
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
  width: 320px;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 36px rgba(32, 24, 11, 0.14);
  overflow: hidden;
}

.bp-log-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
  background: linear-gradient(180deg, rgba(252, 251, 248, 0.98), rgba(245, 241, 234, 0.98));
  cursor: grab;
}

.bp-log-panel-header:active {
  cursor: grabbing;
}

.bp-log-panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #171513;
  font-size: 0.84rem;
  font-weight: 700;
}

.bp-log-panel-hint {
  color: #9a9388;
  font-size: 0.72rem;
  font-weight: 600;
}

.bp-log-panel-body {
  flex: 1;
  min-height: 0;
  padding: 12px 14px;
  overflow: auto;
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
