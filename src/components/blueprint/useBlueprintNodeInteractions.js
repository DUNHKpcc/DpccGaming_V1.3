import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const isPortHitTarget = (event) =>
  event.target instanceof Element && Boolean(event.target.closest('[data-port-hit]'))

export const useBlueprintNodeInteractions = (props, emit) => {
  const nodeRef = ref(null)
  let resizeObserver = null

  const publishMeasurement = () => {
    const element = nodeRef.value
    if (!element) return

    emit('measure', {
      nodeId: props.node.id,
      width: element.offsetWidth,
      height: element.offsetHeight
    })
  }

  const onPointerDown = (event) => {
    if (event.button !== 0 || isPortHitTarget(event)) return

    emit('drag-start', {
      nodeId: props.node.id,
      clientX: event.clientX,
      clientY: event.clientY
    })
  }

  const onPortPointerDown = (payload = {}) => {
    emit('start-link', {
      nodeId: props.node.id,
      clientX: payload.clientX,
      clientY: payload.clientY,
      portPosition: payload.portPosition || 'right'
    })
  }

  const onContextMenu = (event) => {
    if (isPortHitTarget(event)) return

    emit('context-menu', {
      nodeId: props.node.id,
      clientX: event.clientX,
      clientY: event.clientY
    })
  }

  onMounted(() => {
    nextTick(() => {
      publishMeasurement()

      if (typeof ResizeObserver !== 'function' || !nodeRef.value) return

      resizeObserver = new ResizeObserver(() => {
        publishMeasurement()
      })
      resizeObserver.observe(nodeRef.value)
    })
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    emit('unmount', props.node.id)
  })

  return {
    nodeRef,
    onPointerDown,
    onPortPointerDown,
    onContextMenu
  }
}
