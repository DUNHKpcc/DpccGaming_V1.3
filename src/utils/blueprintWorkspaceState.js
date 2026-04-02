export const isBlueprintWorkflowDirty = ({
  workflowSnapshot = '',
  lastSavedWorkflowSnapshot = ''
} = {}) => String(workflowSnapshot || '') !== String(lastSavedWorkflowSnapshot || '')

export const getBlueprintSelectionState = (nodes = []) => ({
  selectedNodeId: Array.isArray(nodes) && nodes.length ? String(nodes[0]?.id || '') : '',
  activeLibraryGameId: Array.isArray(nodes)
    ? String(nodes.find((node) => node?.kind === 'game')?.gameId || '')
    : ''
})
