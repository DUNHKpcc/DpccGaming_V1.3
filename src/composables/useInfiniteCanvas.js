import { computed, ref } from 'vue'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const PAN_GUARD_SELECTOR = 'input, textarea, button, select, option, a, [contenteditable=""], [contenteditable="true"], [data-no-pan]'

export const useInfiniteCanvas = () => {
  const stageRef = ref(null)
  const scale = ref(1)
  const offset = ref({ x: 0, y: 0 })
  const isPanning = ref(false)
  const lastPointer = ref({ x: 0, y: 0 })
  const activePointerId = ref(null)
  const worldCenter = { x: 2400, y: 1600 }

  const worldStyle = computed(() => ({
    transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`,
    transformOrigin: '0 0'
  }))

  const gridStyle = computed(() => {
    const size = 34 * scale.value
    return {
      backgroundSize: `${size}px ${size}px`,
      backgroundPosition: `${offset.value.x}px ${offset.value.y}px`
    }
  })

  const centerOnWorld = ({ xRatio = 0.5, yRatio = 0.5 } = {}) => {
    const rect = stageRef.value?.getBoundingClientRect()
    if (!rect) return

    offset.value = {
      x: rect.width * xRatio - worldCenter.x * scale.value,
      y: rect.height * yRatio - worldCenter.y * scale.value
    }
  }

  const focusWorldBounds = (
    bounds = {},
    {
      padding = 160,
      minScale = 0.55,
      maxScale = 1.15
    } = {}
  ) => {
    const rect = stageRef.value?.getBoundingClientRect()
    if (!rect) return

    const width = Math.max(1, Number(bounds?.width) || (Number(bounds?.maxX) || 0) - (Number(bounds?.minX) || 0))
    const height = Math.max(1, Number(bounds?.height) || (Number(bounds?.maxY) || 0) - (Number(bounds?.minY) || 0))
    const centerX = (Number(bounds?.minX) || 0) + width / 2
    const centerY = (Number(bounds?.minY) || 0) + height / 2
    const usableWidth = Math.max(1, rect.width - padding * 2)
    const usableHeight = Math.max(1, rect.height - padding * 2)
    const fittedScale = clamp(Math.min(usableWidth / width, usableHeight / height), minScale, maxScale)

    scale.value = fittedScale
    offset.value = {
      x: rect.width / 2 - centerX * fittedScale,
      y: rect.height / 2 - centerY * fittedScale
    }
  }

  const screenToWorldPoint = ({ x = 0, y = 0 } = {}) => {
    const rect = stageRef.value?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }

    return {
      x: (x - rect.left - offset.value.x) / scale.value,
      y: (y - rect.top - offset.value.y) / scale.value
    }
  }

  const worldToViewportPoint = ({ x = 0, y = 0 } = {}) => ({
    x: x * scale.value + offset.value.x,
    y: y * scale.value + offset.value.y
  })

  const shouldIgnoreCanvasGesture = (event) => {
    if (!(event.target instanceof Element)) return false
    return Boolean(event.target.closest(PAN_GUARD_SELECTOR))
  }

  const shouldStartPan = (event) => {
    if (event.button !== 0) return false
    return !shouldIgnoreCanvasGesture(event)
  }

  const beginPan = (event) => {
    if (!shouldStartPan(event)) return

    event.preventDefault()
    isPanning.value = true
    activePointerId.value = event.pointerId
    lastPointer.value = { x: event.clientX, y: event.clientY }
    stageRef.value?.setPointerCapture?.(event.pointerId)
  }

  const movePan = (event) => {
    if (!isPanning.value || activePointerId.value !== event.pointerId) return

    event.preventDefault()
    offset.value = {
      x: offset.value.x + event.clientX - lastPointer.value.x,
      y: offset.value.y + event.clientY - lastPointer.value.y
    }
    lastPointer.value = { x: event.clientX, y: event.clientY }
  }

  const endPan = (event) => {
    if (event && activePointerId.value !== null && event.pointerId !== activePointerId.value) return

    const pointerId = activePointerId.value
    isPanning.value = false
    activePointerId.value = null

    if (pointerId !== null) {
      stageRef.value?.releasePointerCapture?.(pointerId)
    }
  }

  const onWheel = (event) => {
    if (shouldIgnoreCanvasGesture(event)) return

    const rect = stageRef.value?.getBoundingClientRect()
    if (!rect) return

    event.preventDefault()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const previousScale = scale.value
    const nextScale = clamp(previousScale + (event.deltaY > 0 ? -0.08 : 0.08), 0.55, 1.8)
    const worldX = (pointerX - offset.value.x) / previousScale
    const worldY = (pointerY - offset.value.y) / previousScale

    scale.value = nextScale
    offset.value = {
      x: pointerX - worldX * nextScale,
      y: pointerY - worldY * nextScale
    }
  }

  return {
    stageRef,
    isPanning,
    worldCenter,
    worldStyle,
    gridStyle,
    beginPan,
    movePan,
    endPan,
    centerOnWorld,
    focusWorldBounds,
    onWheel,
    screenToWorldPoint,
    worldToViewportPoint
  }
}
