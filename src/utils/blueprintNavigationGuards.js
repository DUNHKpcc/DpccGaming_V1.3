export const shouldWarnBeforeBlueprintBrowserUnload = ({
  isWorkflowDirty = false
} = {}) => Boolean(isWorkflowDirty)

export const shouldBlockBlueprintRouteLeave = () => false
