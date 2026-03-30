<script setup>
import { computed } from 'vue'
import BlueprintNodePorts from './BlueprintNodePorts.vue'
import { useBlueprintNodeInteractions } from './useBlueprintNodeInteractions.js'
import { getGameCodeTypeIconByValue, getGameEngineIconByValue } from '../../utils/gameMetadata'

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

const positionStyle = computed(() => ({
  left: `${props.node.position.x}px`,
  top: `${props.node.position.y}px`
}))

const engineIcon = computed(() => getGameEngineIconByValue(props.node.engineLabel))
const codeTypeIcon = computed(() => getGameCodeTypeIconByValue(props.node.codeTypeLabel))

</script>

<template>
  <article
    ref="nodeRef"
    class="bp-node-frame bp-game-node"
    :class="{
      'is-selected': props.selected,
      'is-highlighted': props.highlighted
    }"
    :style="positionStyle"
    data-no-pan
    @click="emit('select', props.node.id)"
    @pointerdown.stop="onPointerDown"
    @contextmenu.prevent.stop="onContextMenu"
  >
    <BlueprintNodePorts
      :node-id="props.node.id"
      @start-link="onPortPointerDown"
    />

    <div class="bp-game-node-cover-wrap" data-no-pan>
      <video
        v-if="props.node.hasVideo && props.node.videoUrl"
        class="bp-game-node-cover"
        :src="props.node.videoUrl"
        :poster="props.node.coverUrl"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
      ></video>
      <img
        v-else
        class="bp-game-node-cover"
        :src="props.node.coverUrl"
        :alt="props.node.title"
        draggable="false"
      />
      <span class="bp-game-node-badge">游戏节点</span>
    </div>

    <div class="bp-game-node-body" data-no-pan>
      <strong>{{ props.node.title }}</strong>
      <p>{{ props.node.categoryLabel }}</p>

      <div class="bp-game-node-meta">
        <span class="bp-game-node-chip">
          <img v-if="engineIcon" :src="engineIcon" alt="" />
          <span>{{ props.node.engineLabel }}</span>
        </span>
        <span class="bp-game-node-chip">
          <img v-if="codeTypeIcon" :src="codeTypeIcon" alt="" />
          <span>{{ props.node.codeTypeLabel }}</span>
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.bp-game-node {
  --bp-node-surface: rgba(255, 255, 255, 0.98);
  --bp-node-border: rgba(17, 17, 17, 0.14);
  --bp-node-border-strong: #6f6f6f;
  --bp-node-port-fill: #b7b7b7;
  --bp-node-port-fill-hover: #909090;
  --bp-node-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  --bp-node-shadow-hover: 0 16px 34px rgba(0, 0, 0, 0.11);
  width: calc(238px * var(--bp-ui-scale, 1));
  color: var(--bp-text);
}

.bp-game-node-cover-wrap {
  position: relative;
  height: calc(128px * var(--bp-ui-scale, 1));
  overflow: hidden;
  border-radius: 6px 6px 0 0;
  background: #efefef;
}

.bp-game-node-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bp-game-node-badge {
  position: absolute;
  top: calc(10px * var(--bp-ui-scale, 1));
  left: calc(10px * var(--bp-ui-scale, 1));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: calc(24px * var(--bp-ui-scale, 1));
  padding: 0 calc(10px * var(--bp-ui-scale, 1));
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.92);
  color: #ffffff;
  font-size: calc(0.72rem * var(--bp-ui-scale, 1));
  font-weight: 600;
  line-height: 1;
  text-align: center;
}

.bp-game-node-body {
  display: flex;
  flex-direction: column;
  gap: calc(10px * var(--bp-ui-scale, 1));
  padding: calc(14px * var(--bp-ui-scale, 1));
}

.bp-game-node-body strong {
  font-size: calc(0.95rem * var(--bp-ui-scale, 1));
  line-height: 1.35;
}

.bp-game-node-body p {
  margin: 0;
  color: var(--bp-muted);
  font-size: calc(0.8rem * var(--bp-ui-scale, 1));
}

.bp-game-node-meta {
  display: flex;
  flex-wrap: wrap;
  gap: calc(8px * var(--bp-ui-scale, 1));
}

.bp-game-node-chip {
  display: inline-flex;
  align-items: center;
  gap: calc(6px * var(--bp-ui-scale, 1));
  min-height: calc(30px * var(--bp-ui-scale, 1));
  padding: 0 calc(10px * var(--bp-ui-scale, 1));
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 999px;
  background: #f5f5f5;
  font-size: calc(0.74rem * var(--bp-ui-scale, 1));
  font-weight: 600;
}

.bp-game-node-chip img {
  width: calc(14px * var(--bp-ui-scale, 1));
  height: calc(14px * var(--bp-ui-scale, 1));
  object-fit: contain;
  display: block;
}

</style>
