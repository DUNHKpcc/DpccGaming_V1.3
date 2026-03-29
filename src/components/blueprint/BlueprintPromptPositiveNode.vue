<script setup>
import BlueprintCompactNode from './BlueprintCompactNode.vue'

const props = defineProps({
  node: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'drag-start', 'start-link', 'measure', 'unmount'])
</script>

<template>
  <BlueprintCompactNode
    :node="props.node"
    :selected="props.selected"
    :highlighted="props.highlighted"
    @select="emit('select', $event)"
    @drag-start="emit('drag-start', $event)"
    @start-link="emit('start-link', $event)"
    @measure="emit('measure', $event)"
    @unmount="emit('unmount', $event)"
  />
</template>
