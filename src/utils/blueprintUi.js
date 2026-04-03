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
    width = 360,
    height = 460,
    margin = 24,
    gap = 16,
    viewportPoint = null,
    viewportRect = null
  } = {}
) => {
  const size = getBlueprintNodeSurfaceSize(node, measurement)
  const anchorX = Number(viewportPoint?.x)
  const anchorY = Number(viewportPoint?.y)
  const hasViewportPoint = Number.isFinite(anchorX) && Number.isFinite(anchorY)
  const rectX = Number(viewportRect?.x)
  const rectY = Number(viewportRect?.y)
  const rectWidth = Number(viewportRect?.width)
  const rectHeight = Number(viewportRect?.height)
  const hasViewportRect =
    Number.isFinite(rectX)
    && Number.isFinite(rectY)
    && Number.isFinite(rectWidth)
    && Number.isFinite(rectHeight)

  const baseX = hasViewportRect ? rectX : (hasViewportPoint ? anchorX : Number(node?.position?.x || 0))
  const baseY = hasViewportRect ? rectY : (hasViewportPoint ? anchorY : Number(node?.position?.y || 0))
  const baseWidth = hasViewportRect ? rectWidth : size.width
  const baseHeight = hasViewportRect ? rectHeight : size.height

  const preferredRightX = baseX + baseWidth + gap
  const preferredLeftX = baseX - width - gap
  const hasRightSpace = preferredRightX <= worldWidth - width - margin
  const hasLeftSpace = preferredLeftX >= margin

  const x = hasRightSpace
    ? preferredRightX
    : hasLeftSpace
      ? preferredLeftX
      : clamp(preferredRightX, margin, worldWidth - width - margin)

  const centeredY = baseY + (baseHeight / 2) - (height / 2)

  return {
    x,
    y: clamp(centeredY, margin, worldHeight - height - margin)
  }
}

export const getBlueprintLogPanelPosition = (
  viewport = {},
  {
    panelWidth = 320,
    panelHeight = 220,
    safeTop = 84,
    safeBottom = 128,
    safeRight = 24,
    safeLeft = 24
  } = {}
) => {
  const viewportWidth = Math.max(0, Number(viewport?.width) || 0)
  const viewportHeight = Math.max(0, Number(viewport?.height) || 0)
  const minX = safeLeft
  const maxX = Math.max(minX, viewportWidth - panelWidth - safeRight)
  const minY = safeTop
  const maxY = Math.max(minY, viewportHeight - panelHeight - safeBottom)

  return {
    x: maxX,
    y: Math.min(maxY, minY)
  }
}
