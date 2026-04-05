export const applyWorkflowStartSessionState = (previousState = {}, event = {}) => {
  const persistent = event?.persistent === true
  const nextRunId = persistent ? String(event?.runId || '').trim() : ''
  const previousRunIds = Array.isArray(previousState?.sessionRunIds) ? previousState.sessionRunIds : []
  const nextRunIds = persistent && nextRunId && !previousRunIds.includes(nextRunId)
    ? [nextRunId, ...previousRunIds]
    : (persistent ? previousRunIds : [])

  return {
    latestRunId: nextRunId,
    hasSessionRunHistory: persistent && nextRunIds.length > 0,
    sessionRunIds: nextRunIds,
    latestRunStatus: 'running',
    latestRunContinuation: null,
    latestFailedNodeId: '',
    latestRunDetail: null,
    activeRunIsPersistent: persistent
  }
}

export const shouldHydratePersistentRunDetail = ({
  runHistoryApiAvailable = true,
  latestRunId = '',
  activeRunIsPersistent = false
} = {}) =>
  Boolean(
    runHistoryApiAvailable
    && activeRunIsPersistent
    && String(latestRunId || '').trim()
  )

export const shouldUsePersistentRunCancel = ({
  runHistoryApiAvailable = true,
  latestRunId = '',
  activeRunIsPersistent = false
} = {}) =>
  Boolean(
    runHistoryApiAvailable
    && activeRunIsPersistent
    && String(latestRunId || '').trim()
  )
