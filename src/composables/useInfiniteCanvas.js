import { computed, ref } from 'vue'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const useInfiniteCanvas = () => {
  const stageRef = ref(null)
  const scale = ref(1)
  const offset = ref({ x: 0, y: 0 })
  const isPanning = ref(false)
  const lastPointer = ref({ x: 0, y: 0 })
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

  const onWheel = (event) => {
    const rect = stageRef.value?.getBoundingClientRect()
    if (!rect) return

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

  return { stageRef, scale, offset, isPanning, lastPointer, worldCenter, worldStyle, gridStyle, onWheel }
}
