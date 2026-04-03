import { computed, nextTick, ref } from 'vue'
import {
  BLUEPRINT_COMPACT_NODE_META,
  BP_NODE_DIMENSIONS,
  createBlueprintCompactNode,
  createPromptPositiveBlueprintNode,
  getBlueprintEdgeColor,
  getBlueprintEdgePortPositions,
  getBlueprintEdgePreviewColor,
  getBlueprintNodePortPoint,
  isBlueprintCompactNodeKind,
  snapPointToGrid,
  updateBlueprintNodePosition,
  upsertBlueprintEdge,
  upsertGameBlueprintNode
} from '../../utils/blueprintNodes.js'
import { createBlueprintEdgePath } from '../../utils/blueprintRuntime.js'

export const useBlueprintCanvasInteractions = ({
  gameStore,
  blueprintNodes,
  blueprintEdges,
  nodeMeasurements,
  selectedNodeId,
  activeLibraryGameId,
  highlightedNodeId,
  closeNodeOverlays,
  appendLog,
  pulseNode
}) => {
  const isLibraryLoading = ref(false)
  const activeNodeDrag = ref(null)
  const activeEdgeDrag = ref(null)
  const screenToWorldProjector = ref(null)
  const worldToViewportProjector = ref(null)
  const stageRectGetter = ref(null)
  const focusWorldBoundsFn = ref(null)

  let nodeIdCounter = 0
  let edgeIdCounter = 0
  let libraryLoadTimeout = null
  let libraryLoadRaf = null
  let libraryLoadIdle = null

  const createNodeId = () => {
    nodeIdCounter += 1
    return `bp-game-${Date.now().toString(36)}-${nodeIdCounter}`
  }

  const createEdgeId = () => {
    edgeIdCounter += 1
    return `bp-edge-${Date.now().toString(36)}-${edgeIdCounter}`
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

  const getNodePortPoint = (node, portType) =>
    getBlueprintNodePortPoint(node, portType, nodeMeasurements.value[node.id])

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

  const finishNodeDrag = ({ snapToGrid: shouldSnapToGrid = true } = {}) => {
    const currentDrag = activeNodeDrag.value
    if (!currentDrag) return

    if (shouldSnapToGrid) {
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

  const handleCanvasReady = ({ screenToWorldPoint, worldToViewportPoint, getStageRect, focusWorldBounds }) => {
    screenToWorldProjector.value = screenToWorldPoint
    worldToViewportProjector.value = worldToViewportPoint
    stageRectGetter.value = getStageRect
    focusWorldBoundsFn.value = focusWorldBounds
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
    const targetGame = new Map(
      (gameStore.games || []).map((game) => [String(game?.game_id || game?.id || ''), game])
    ).get(String(gameId || ''))

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

  return {
    isLibraryLoading,
    screenToWorldProjector,
    worldToViewportProjector,
    stageRectGetter,
    focusWorldBoundsFn,
    activeEdgeDrag,
    handleSelectNode,
    handleNodeMeasure,
    handleNodeUnmount,
    handleToolbarAction,
    handleCanvasReady,
    handleDropGame,
    focusWorkflowNodes,
    finishNodeDrag,
    finishEdgeDrag,
    clearScheduledLibraryLoad,
    scheduleLibraryLoad,
    gameBlueprintNodes,
    compactBlueprintNodes,
    renderedEdges,
    previewEdgePath,
    previewEdgeStroke,
    getNodePortPoint,
    handleNodeDragStart,
    handleStartLink
  }
}
