<script setup>
import BlueprintGameNode from './BlueprintGameNode.vue'
import BlueprintCompactNode from './BlueprintCompactNode.vue'

const props = defineProps({
  renderedEdges: { type: Array, default: () => [] },
  previewEdgePath: { type: String, default: '' },
  previewEdgeStroke: { type: String, default: '#8c8c8c' },
  gameNodes: { type: Array, default: () => [] },
  compactNodes: { type: Array, default: () => [] },
  nodeRuntimeMap: { type: Object, default: () => ({}) },
  selectedNodeId: { type: String, default: '' },
  highlightedNodeId: { type: String, default: '' },
  screenToWorldPoint: { type: Function, required: true },
  worldWidth: { type: Number, required: true },
  worldHeight: { type: Number, required: true }
})

const emit = defineEmits([
  'select-node',
  'drag-start',
  'start-link',
  'context-menu',
  'measure-node',
  'unmount-node'
])
</script>

<template>
  <div class="bp-world-layer">
    <svg
      class="bp-edge-layer"
      :viewBox="`0 0 ${props.worldWidth} ${props.worldHeight}`"
      :width="props.worldWidth"
      :height="props.worldHeight"
      aria-hidden="true"
    >
      <path
        v-for="edge in props.renderedEdges"
        :key="edge.id"
        class="bp-edge-path"
        :d="edge.path"
        :style="{ stroke: edge.stroke }"
      />
      <path
        v-if="props.previewEdgePath"
        class="bp-edge-path bp-edge-path-preview"
        :d="props.previewEdgePath"
        :style="{ stroke: props.previewEdgeStroke }"
      />
    </svg>

    <BlueprintGameNode
      v-for="node in props.gameNodes"
      :key="node.id"
      :node="node"
      :runtime="props.nodeRuntimeMap[node.id] || null"
      :selected="props.selectedNodeId === node.id"
      :highlighted="props.highlightedNodeId === node.id"
      @select="emit('select-node', $event)"
      @drag-start="emit('drag-start', $event, props.screenToWorldPoint)"
      @start-link="emit('start-link', $event, props.screenToWorldPoint)"
      @context-menu="emit('context-menu', $event, props.screenToWorldPoint)"
      @measure="emit('measure-node', $event)"
      @unmount="emit('unmount-node', $event)"
    />

    <BlueprintCompactNode
      v-for="node in props.compactNodes"
      :key="node.id"
      :node="node"
      :runtime="props.nodeRuntimeMap[node.id] || null"
      :selected="props.selectedNodeId === node.id"
      :highlighted="props.highlightedNodeId === node.id"
      @select="emit('select-node', $event)"
      @drag-start="emit('drag-start', $event, props.screenToWorldPoint)"
      @start-link="emit('start-link', $event, props.screenToWorldPoint)"
      @context-menu="emit('context-menu', $event, props.screenToWorldPoint)"
      @measure="emit('measure-node', $event)"
      @unmount="emit('unmount-node', $event)"
    />
  </div>
</template>
