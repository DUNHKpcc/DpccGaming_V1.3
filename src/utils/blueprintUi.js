import {
  BP_NODE_DIMENSIONS,
  BP_WORLD_HEIGHT,
  BP_WORLD_WIDTH
} from './blueprintNodes.js'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const getBlueprintNodeSurfaceSize = (node = {}, measurement = null) => {
  const fallback = BP_NODE_DIMENSIONS[node.kind] || BP_NODE_DIMENSIONS.game

  return {
    width: Number(measurement?.width) || fallback.width,
    height: Number(measurement?.height) || fallback.height
  }
}

export const getBlueprintNodeContextMenuPosition = (
  point = {},
  {
    worldWidth = BP_WORLD_WIDTH,
    worldHeight = BP_WORLD_HEIGHT,
    width = 152,
    height = 92,
    margin = 24,
    cursorGap = 8
  } = {}
) => ({
  x: clamp(Number(point.x || 0) + cursorGap, margin, worldWidth - width - margin),
  y: clamp(Number(point.y || 0) + cursorGap, margin, worldHeight - height - margin)
})

export const getBlueprintNodeEditorPanelPosition = (
  node = {},
  measurement = null,
  {
    worldWidth = BP_WORLD_WIDTH,
    worldHeight = BP_WORLD_HEIGHT,
    width = 280,
    height = 240,
    margin = 24,
    gap = 16
  } = {}
) => {
  const size = getBlueprintNodeSurfaceSize(node, measurement)

  return {
    x: clamp(Number(node?.position?.x || 0) + size.width + gap, margin, worldWidth - width - margin),
    y: clamp(Number(node?.position?.y || 0), margin, worldHeight - height - margin)
  }
}
