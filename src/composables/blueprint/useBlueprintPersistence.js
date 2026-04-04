import { ref } from 'vue'
import { apiCall } from '../../utils/api'
import { parseBlueprintWorkflow } from '../../utils/blueprintNodes.js'

export const useBlueprintPersistence = ({
  route,
  router,
  notificationStore,
  workflowLoadState,
  seed,
  blueprintNodes,
  blueprintEdges,
  isWorkflowBusy,
  isWorkflowDirty,
  plannerPromptDraft,
  selectedNodeId,
  highlightedNodeId,
  activeLibraryGameId,
  hasWorkflowHydrated,
  nodeMeasurements,
  closeNodeOverlays,
  resetExecutionLogSession,
  resetBlueprintRuntime,
  appendLog,
  fetchRunHistory,
  buildWorkflowPayload,
  applyWorkflowPayload,
  focusWorkflowNodes,
  updateWorkflowSavedSnapshot
}) => {
  const recentBlueprints = ref([])
  const recentBlueprintsLoading = ref(false)
  const recentBlueprintsError = ref('')

  const BLUEPRINT_SEED_PATTERN = /^[A-Z0-9]{8,32}$/

  const normalizeSeedInput = (value = '') => String(value || '').trim().toUpperCase()
  const getRouteSeedValue = () => {
    const rawValue = Array.isArray(route.query.seed) ? route.query.seed[0] : route.query.seed
    return normalizeSeedInput(rawValue)
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

  const confirmWorkflowReplacement = () => {
    if (!blueprintNodes.value.length) return true

    if (seed.value && isWorkflowDirty.value) {
      return window.confirm('当前蓝图有未保存改动，继续导入其他种子会覆盖当前内容，确定继续吗？')
    }

    if (!seed.value) {
      return window.confirm('当前画布还没有种子，导入其他种子会覆盖当前内容，确定继续吗？')
    }

    return true
  }

  const resolveBlueprintErrorMessage = (error, fallbackMessage) => {
    if (error?.status === 401 || error?.status === 403) {
      return '蓝图种子功能需要登录后使用。'
    }

    return error?.message || fallbackMessage
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

  const handleSaveWorkflowToSeed = async () => {
    if (!blueprintNodes.value.length) {
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

    applyWorkflowPayload({ nodes: [], edges: [], meta: {} }, {
      persistSnapshot: true
    })
    resetExecutionLogSession()
    resetBlueprintRuntime()
    nodeMeasurements.value = {}
    selectedNodeId.value = ''
    highlightedNodeId.value = ''
    activeLibraryGameId.value = ''
    plannerPromptDraft.value = ''
    seed.value = ''
    closeNodeOverlays()
    await syncSeedToRoute('')
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
      appendLog('当前画布为空，没有可导出的工作流。', 'warning')
      return
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadWorkflow(
      JSON.stringify(buildWorkflowPayload(), null, 2),
      `blueprint-workflow-${stamp}.json`
    )
    appendLog('已导出当前工作流 JSON。')
  }

  const handleImportWorkflow = (rawValue) => {
    if (isWorkflowBusy.value) {
      appendLog('当前工作流正在运行中，暂时无法导入新的工作流。', 'warning')
      return
    }

    if (!confirmWorkflowReplacement()) {
      return
    }

    try {
      const { nodes, edges, meta } = parseBlueprintWorkflow(rawValue)

      applyWorkflowPayload({ nodes, edges, meta }, {
        persistSnapshot: true,
        focusNodes: true
      })
      resetExecutionLogSession()
      resetBlueprintRuntime()
      seed.value = ''
      void syncSeedToRoute('')
      appendLog(`已导入 ${nodes.length} 个节点和 ${edges.length} 条连线。`)
    } catch (error) {
      appendLog(error?.message || '导入失败，请检查 JSON 格式。', 'error')
    }
  }

  const handleClearWorkflow = () => {
    if (isWorkflowBusy.value) {
      appendLog('当前工作流正在运行中，暂时无法清空画布。', 'warning')
      return
    }

    if (!blueprintNodes.value.length) {
      appendLog('当前画布已经是空的。', 'warning')
      return
    }

    applyWorkflowPayload({ nodes: [], edges: [], meta: {} }, {
      persistSnapshot: true
    })
    resetExecutionLogSession()
    resetBlueprintRuntime()
    nodeMeasurements.value = {}
    selectedNodeId.value = ''
    highlightedNodeId.value = ''
    activeLibraryGameId.value = ''
    closeNodeOverlays()
  }

  return {
    recentBlueprints,
    recentBlueprintsLoading,
    recentBlueprintsError,
    normalizeSeedInput,
    getRouteSeedValue,
    syncSeedToRoute,
    fetchRecentBlueprints,
    handleImportSeed,
    handleSaveWorkflowToSeed,
    handleCreateBlueprint,
    handleExportWorkflow,
    handleImportWorkflow,
    handleClearWorkflow
  }
}
