<script setup>
import { computed } from 'vue'
import BlueprintNodePorts from './BlueprintNodePorts.vue'
import { useBlueprintNodeInteractions } from './useBlueprintNodeInteractions.js'

const props = defineProps({
  node: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'drag-start', 'start-link', 'measure', 'unmount', 'context-menu'])
const {
  nodeRef,
  onPointerDown,
  onPortPointerDown,
  onContextMenu
} = useBlueprintNodeInteractions(props, emit)

const nodeStyle = computed(() => ({
  left: `${props.node.position.x}px`,
  top: `${props.node.position.y}px`,
  '--bp-compact-icon-background': props.node.iconBackground || '#ededed',
  '--bp-compact-icon-color': props.node.iconColor || '#111111'
}))
</script>

<template>
  <article
    ref="nodeRef"
    class="bp-node-frame bp-compact-node"
    :class="{
      'is-selected': props.selected,
      'is-highlighted': props.highlighted
    }"
    :style="nodeStyle"
    data-no-pan
    @click="emit('select', props.node.id)"
    @pointerdown.stop="onPointerDown"
    @contextmenu.prevent.stop="onContextMenu"
  >
    <BlueprintNodePorts
      :node-id="props.node.id"
      @start-link="onPortPointerDown"
    />

    <span class="bp-compact-node-icon" aria-hidden="true">
      <i :class="props.node.iconClass"></i>
    </span>
    <div class="bp-compact-node-copy" data-no-pan>
      <strong>{{ props.node.title }}</strong>
      <span>{{ String(props.node.content || '').trim() || props.node.subtitle }}</span>
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
  gap: calc(12px * var(--bp-ui-scale, 1));
  width: calc(214px * var(--bp-ui-scale, 1));
  min-height: calc(72px * var(--bp-ui-scale, 1));
  padding: calc(12px * var(--bp-ui-scale, 1)) calc(14px * var(--bp-ui-scale, 1));
  box-sizing: border-box;
  color: var(--bp-text);
}

.bp-compact-node-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(36px * var(--bp-ui-scale, 1));
  height: calc(36px * var(--bp-ui-scale, 1));
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: calc(10px * var(--bp-ui-scale, 1));
  background: var(--bp-compact-icon-background);
  color: var(--bp-compact-icon-color);
  font-size: calc(1rem * var(--bp-ui-scale, 1));
  line-height: 1;
  flex: 0 0 auto;
}

.bp-compact-node-copy {
  min-width: 0;
}

.bp-compact-node-copy strong {
  display: block;
  color: #111111;
  font-size: calc(0.9rem * var(--bp-ui-scale, 1));
  font-weight: 700;
  line-height: 1.25;
}

.bp-compact-node-copy span {
  display: block;
  margin-top: calc(4px * var(--bp-ui-scale, 1));
  color: #727272;
  font-size: calc(0.72rem * var(--bp-ui-scale, 1));
  line-height: 1.2;
}
</style>
