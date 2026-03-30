<script setup>
const props = defineProps({
  nodeId: { type: String, required: true }
})

const emit = defineEmits(['start-link'])

const onPortPointerDown = (portPosition, event) => {
  if (event.button !== 0) return

  emit('start-link', {
    clientX: event.clientX,
    clientY: event.clientY,
    portPosition
  })
}
</script>

<template>
  <button
    type="button"
    class="bp-node-port bp-node-port-in"
    title="左侧连接点"
    data-port-hit="true"
    data-port-type="port"
    data-port-position="left"
    :data-node-id="props.nodeId"
    @pointerdown.stop="onPortPointerDown('left', $event)"
  ></button>
  <button
    type="button"
    class="bp-node-port bp-node-port-out"
    title="右侧连接点"
    data-port-hit="true"
    data-port-type="port"
    data-port-position="right"
    :data-node-id="props.nodeId"
    @pointerdown.stop="onPortPointerDown('right', $event)"
  ></button>
  <button
    type="button"
    class="bp-node-port bp-node-port-top"
    title="顶部连接点"
    data-port-hit="true"
    data-port-type="port"
    data-port-position="top"
    :data-node-id="props.nodeId"
    @pointerdown.stop="onPortPointerDown('top', $event)"
  ></button>
  <button
    type="button"
    class="bp-node-port bp-node-port-bottom"
    title="底部连接点"
    data-port-hit="true"
    data-port-type="port"
    data-port-position="bottom"
    :data-node-id="props.nodeId"
    @pointerdown.stop="onPortPointerDown('bottom', $event)"
  ></button>
</template>
