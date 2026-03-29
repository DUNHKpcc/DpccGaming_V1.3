<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import BlueprintNodePorts from './BlueprintNodePorts.vue'

const props = defineProps({
  node: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'drag-start', 'start-link', 'measure', 'unmount'])

const nodeRef = ref(null)
let resizeObserver = null

const onPointerDown = (event) => {
  if (event.button !== 0) return
  if (event.target instanceof Element && event.target.closest('[data-port-hit]')) return

  emit('drag-start', {
    nodeId: props.node.id,
    clientX: event.clientX,
    clientY: event.clientY
  })
}

const onOutputPointerDown = (event) => {
  if (event.button !== 0) return

  emit('start-link', {
    nodeId: props.node.id,
    clientX: event.clientX,
    clientY: event.clientY
  })
}

const publishMeasurement = () => {
  const element = nodeRef.value
  if (!element) return

  emit('measure', {
    nodeId: props.node.id,
    width: element.offsetWidth,
    height: element.offsetHeight
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
</script>

<template>
  <article
    ref="nodeRef"
    class="bp-node-frame bp-compact-node"
    :class="{
      'is-selected': props.selected,
      'is-highlighted': props.highlighted
    }"
    :style="{
      left: `${props.node.position.x}px`,
      top: `${props.node.position.y}px`,
      '--bp-compact-icon-background': props.node.iconBackground || '#ededed',
      '--bp-compact-icon-color': props.node.iconColor || '#111111'
    }"
    data-no-pan
    @click="emit('select', props.node.id)"
    @pointerdown.stop="onPointerDown"
  >
    <BlueprintNodePorts
      :node-id="props.node.id"
      @start-link="onOutputPointerDown"
    />

    <span class="bp-compact-node-icon" aria-hidden="true">
      <i :class="props.node.iconClass"></i>
    </span>
    <div class="bp-compact-node-copy" data-no-pan>
      <strong>{{ props.node.title }}</strong>
      <span>{{ props.node.subtitle }}</span>
    </div>
  </article>
</template>

<style scoped>
.bp-compact-node {
  --bp-node-surface: #ffffff;
  --bp-node-border: rgba(17, 17, 17, 0.16);
  --bp-node-border-strong: #6f6f6f;
  --bp-node-port-fill: #b7b7b7;
  --bp-node-port-fill-hover: #909090;
  --bp-node-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  --bp-node-shadow-hover: 0 14px 28px rgba(0, 0, 0, 0.11);
  display: flex;
  align-items: center;
  gap: 12px;
  width: 214px;
  min-height: 72px;
  padding: 12px 14px;
  box-sizing: border-box;
  color: var(--bp-text);
}

.bp-compact-node-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 10px;
  background: var(--bp-compact-icon-background);
  color: var(--bp-compact-icon-color);
  font-size: 1rem;
  line-height: 1;
  flex: 0 0 auto;
}

.bp-compact-node-copy {
  min-width: 0;
}

.bp-compact-node-copy strong {
  display: block;
  color: #111111;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25;
}

.bp-compact-node-copy span {
  display: block;
  margin-top: 4px;
  color: #727272;
  font-size: 0.72rem;
  line-height: 1.2;
}
</style>
