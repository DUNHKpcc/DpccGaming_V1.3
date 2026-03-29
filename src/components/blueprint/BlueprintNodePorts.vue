<script setup>
const props = defineProps({
  nodeId: { type: String, required: true }
})

const emit = defineEmits(['start-link'])

const onOutputPointerDown = (event) => {
  if (event.button !== 0) return
  emit('start-link', event)
}
</script>

<template>
  <button
    type="button"
    class="bp-node-port bp-node-port-in"
    title="输入"
    data-port-hit="true"
    data-port-type="input"
    :data-node-id="props.nodeId"
    @pointerdown.stop
  ></button>
  <button
    type="button"
    class="bp-node-port bp-node-port-out"
    title="输出"
    data-port-hit="true"
    data-port-type="output"
    :data-node-id="props.nodeId"
    @pointerdown.stop="onOutputPointerDown"
  ></button>
  <span
    class="bp-node-port bp-node-port-top bp-node-port-aux"
    data-port-hit="true"
    aria-hidden="true"
    @pointerdown.stop
  ></span>
  <span
    class="bp-node-port bp-node-port-bottom bp-node-port-aux"
    data-port-hit="true"
    aria-hidden="true"
    @pointerdown.stop
  ></span>
</template>
