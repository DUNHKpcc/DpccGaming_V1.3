<script setup>
import { computed } from 'vue'
import { getGameCodeTypeIconByValue, getGameEngineIconByValue } from '../../utils/gameMetadata'

const props = defineProps({
  node: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'drag-start', 'start-link'])

const positionStyle = computed(() => ({
  left: `${props.node.position.x}px`,
  top: `${props.node.position.y}px`
}))

const engineIcon = computed(() => getGameEngineIconByValue(props.node.engineLabel))
const codeTypeIcon = computed(() => getGameCodeTypeIconByValue(props.node.codeTypeLabel))

const onPointerDown = (event) => {
  if (event.button !== 0) return
  if (event.target instanceof Element && event.target.closest('[data-port-type]')) return

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
</script>

<template>
  <article
    class="bp-game-node"
    :class="{
      'is-selected': props.selected,
      'is-highlighted': props.highlighted
    }"
    :style="positionStyle"
    data-no-pan
    @click="emit('select', props.node.id)"
    @pointerdown.stop="onPointerDown"
  >
    <button
      type="button"
      class="bp-game-node-port bp-game-node-port-in"
      title="输入"
      data-port-type="input"
      :data-node-id="props.node.id"
      @pointerdown.stop
    ></button>
    <button
      type="button"
      class="bp-game-node-port bp-game-node-port-out"
      title="输出"
      data-port-type="output"
      :data-node-id="props.node.id"
      @pointerdown.stop="onOutputPointerDown"
    ></button>

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
  position: absolute;
  width: 238px;
  overflow: visible;
  border: 1px solid rgba(94, 80, 48, 0.18);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 40px rgba(36, 28, 16, 0.15);
  color: var(--bp-text);
  cursor: pointer;
  user-select: none;
  backdrop-filter: blur(8px);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.bp-game-node-port {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 999px;
  background: linear-gradient(135deg, #c7a24e, #8a6320);
  box-shadow: 0 6px 16px rgba(36, 28, 16, 0.24);
  transform: translateY(-50%);
  cursor: crosshair;
}

.bp-game-node-port-in {
  left: -8px;
}

.bp-game-node-port-out {
  right: -8px;
}

.bp-game-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 44px rgba(36, 28, 16, 0.2);
}

.bp-game-node.is-selected {
  border-color: rgba(210, 160, 43, 0.72);
  box-shadow: 0 0 0 2px rgba(210, 160, 43, 0.14), 0 20px 44px rgba(36, 28, 16, 0.2);
}

.bp-game-node.is-highlighted {
  animation: bp-node-pulse 1.2s ease;
}

.bp-game-node-cover-wrap {
  position: relative;
  height: 128px;
  overflow: hidden;
  border-radius: 18px 18px 0 0;
  background: linear-gradient(135deg, rgba(245, 237, 224, 0.95), rgba(255, 255, 255, 0.96));
}

.bp-game-node-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bp-game-node-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(24, 24, 24, 0.82);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 600;
}

.bp-game-node-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}

.bp-game-node-body strong {
  font-size: 0.95rem;
  line-height: 1.35;
}

.bp-game-node-body p {
  margin: 0;
  color: var(--bp-muted);
  font-size: 0.8rem;
}

.bp-game-node-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.bp-game-node-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(94, 80, 48, 0.12);
  border-radius: 999px;
  background: rgba(252, 251, 248, 0.96);
  font-size: 0.74rem;
  font-weight: 600;
}

.bp-game-node-chip img {
  width: 14px;
  height: 14px;
  object-fit: contain;
  display: block;
}

@keyframes bp-node-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(210, 160, 43, 0.34), 0 18px 40px rgba(36, 28, 16, 0.15);
  }

  50% {
    box-shadow: 0 0 0 10px rgba(210, 160, 43, 0.08), 0 20px 44px rgba(36, 28, 16, 0.2);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(210, 160, 43, 0), 0 18px 40px rgba(36, 28, 16, 0.15);
  }
}
</style>
