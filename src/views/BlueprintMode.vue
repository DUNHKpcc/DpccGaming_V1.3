<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGameStore } from '../stores/game'
import BlueprintSidebar from '../components/blueprint/BlueprintSidebar.vue'
import BlueprintToolbar from '../components/blueprint/BlueprintToolbar.vue'
import BlueprintCanvasStage from '../components/blueprint/BlueprintCanvasStage.vue'
import BlueprintGameNode from '../components/blueprint/BlueprintGameNode.vue'
import BlueprintPromptPositiveNode from '../components/blueprint/BlueprintPromptPositiveNode.vue'
import {
  BP_WORLD_HEIGHT,
  BP_WORLD_WIDTH,
  createPromptPositiveBlueprintNode,
  getBlueprintNodePortPoint,
  parseBlueprintWorkflow,
  serializeBlueprintWorkflow,
  snapPointToGrid,
  updateBlueprintNodeField,
  updateBlueprintNodePosition,
  upsertBlueprintEdge,
  upsertGameBlueprintNode
} from '../utils/blueprintNodes.js'

const gameStore = useGameStore()

const modelOptions = [
  { name: 'ClaudeOpus4.6', logoSrc: '/Ai/Claude.png', logoAlt: 'Claude' },
  { name: 'DouBaoSeed1.6', logoSrc: '/Ai/DouBaoSeed1.6.png', logoAlt: 'DouBao Seed' },
  { name: 'ChatGPT5.4', logoSrc: '/Ai/ChatGPT.svg', logoAlt: 'ChatGPT' },
  { name: 'Qwen3-code', logoSrc: '/Ai/Qwen.png', logoAlt: 'Qwen' }
]

const seed = ref('ABHYUIJHJKK67890900')
const logs = ref([])
const isSidebarCollapsed = ref(false)
const isLibraryLoading = ref(false)
const blueprintNodes = ref([])
const blueprintEdges = ref([])
const selectedNodeId = ref('')
const highlightedNodeId = ref('')
const activeLibraryGameId = ref('')
const activeNodeDrag = ref(null)
const activeEdgeDrag = ref(null)
const screenToWorldProjector = ref(null)

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

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
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

const handleUpdateNodeField = ({ nodeId, fieldKey, value }) => {
  blueprintNodes.value = updateBlueprintNodeField(
    blueprintNodes.value,
    nodeId,
    fieldKey,
    value
  )
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

  const inputPort = event.target instanceof Element
    ? event.target.closest('[data-port-type="input"]')
    : null
  const toNodeId = inputPort?.getAttribute('data-node-id') || ''

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

  const sourceNode = blueprintNodes.value.find((node) => node.id === payload.nodeId)
  if (!sourceNode) return

  const startPoint = getBlueprintNodePortPoint(sourceNode, 'output')

  activeEdgeDrag.value = {
    fromNodeId: payload.nodeId,
    startPoint,
    currentPoint: startPoint,
    screenToWorldPoint
  }

  window.addEventListener('pointermove', handleEdgePointerMove)
  window.addEventListener('pointerup', handleEdgePointerUp, { once: true })
}

const handleToolbarAction = (actionKey) => {
  if (actionKey !== 'prompt-positive' || typeof screenToWorldProjector.value !== 'function') {
    return
  }

  const centerPoint = screenToWorldProjector.value({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  })
  const node = createPromptPositiveBlueprintNode(centerPoint, createNodeId)
  blueprintNodes.value = [...blueprintNodes.value, node]
  selectedNodeId.value = node.id
  pulseNode(node.id)
  appendLog('已添加正向提示词节点。')
}

const handleCanvasReady = ({ screenToWorldPoint }) => {
  screenToWorldProjector.value = screenToWorldPoint
}

const nodeMap = computed(() => {
  const map = new Map()
  blueprintNodes.value.forEach((node) => map.set(node.id, node))
  return map
})

const gameBlueprintNodes = computed(() =>
  blueprintNodes.value.filter((node) => node.kind === 'game')
)

const promptPositiveBlueprintNodes = computed(() =>
  blueprintNodes.value.filter((node) => node.kind === 'prompt-positive')
)

const renderedEdges = computed(() =>
  blueprintEdges.value
    .map((edge) => {
      const fromNode = nodeMap.value.get(edge.fromNodeId)
      const toNode = nodeMap.value.get(edge.toNodeId)
      if (!fromNode || !toNode) return null

      const start = getBlueprintNodePortPoint(fromNode, 'output')
      const end = getBlueprintNodePortPoint(toNode, 'input')
      const delta = Math.max(72, Math.abs(end.x - start.x) * 0.4)

      return {
        ...edge,
        path: `M ${start.x} ${start.y} C ${start.x + delta} ${start.y}, ${end.x - delta} ${end.y}, ${end.x} ${end.y}`
      }
    })
    .filter(Boolean)
)

const previewEdgePath = computed(() => {
  if (!activeEdgeDrag.value) return ''

  const { startPoint, currentPoint } = activeEdgeDrag.value
  const delta = Math.max(72, Math.abs(currentPoint.x - startPoint.x) * 0.4)
  return `M ${startPoint.x} ${startPoint.y} C ${startPoint.x + delta} ${startPoint.y}, ${currentPoint.x - delta} ${currentPoint.y}, ${currentPoint.x} ${currentPoint.y}`
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
})

onBeforeUnmount(() => {
  if (highlightTimer) {
    clearTimeout(highlightTimer)
  }

  clearScheduledLibraryLoad()
  finishNodeDrag({ snapToGrid: false })
  finishEdgeDrag()
})
</script>

<template>
  <div class="bp-page" :class="{ 'is-sidebar-collapsed': isSidebarCollapsed }">
    <BlueprintSidebar
      v-if="!isSidebarCollapsed"
      :games="libraryGames"
      :seed="seed"
      :logs="logs"
      :model-options="modelOptions"
      :collapsed="isSidebarCollapsed"
      :loading="isLibraryLoading"
      :active-game-id="activeLibraryGameId"
      @toggle="toggleSidebar"
      @select-game="handleSelectGame"
      @export-workflow="handleExportWorkflow"
      @import-workflow="handleImportWorkflow"
      @clear-workflow="handleClearWorkflow"
    />

    <main class="bp-main">
      <button
        v-if="isSidebarCollapsed"
        type="button"
        class="bp-sidebar-fab"
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
              />
              <path
                v-if="previewEdgePath"
                class="bp-edge-path bp-edge-path-preview"
                :d="previewEdgePath"
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
          />
          <BlueprintPromptPositiveNode
            v-for="node in promptPositiveBlueprintNodes"
            :key="node.id"
            :node="node"
            :selected="selectedNodeId === node.id"
            :highlighted="highlightedNodeId === node.id"
            @select="handleSelectNode"
            @drag-start="handleNodeDragStart($event, screenToWorldPoint)"
            @start-link="handleStartLink($event, screenToWorldPoint)"
            @update-field="handleUpdateNodeField"
          />
          </div>
        </template>
      </BlueprintCanvasStage>
    </main>
  </div>
</template>

<style src="../styles/blueprint-mode.css"></style>
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
  stroke: rgba(129, 114, 79, 0.72);
  stroke-width: 3;
  stroke-linecap: round;
}

.bp-edge-path-preview {
  stroke: rgba(84, 116, 186, 0.72);
  stroke-dasharray: 10 8;
}
</style>
