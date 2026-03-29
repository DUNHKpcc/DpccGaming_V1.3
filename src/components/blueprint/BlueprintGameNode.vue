<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import BlueprintNodePorts from './BlueprintNodePorts.vue'
import { getGameCodeTypeIconByValue, getGameEngineIconByValue } from '../../utils/gameMetadata'

const props = defineProps({
  node: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'drag-start', 'start-link', 'measure', 'unmount'])
const nodeRef = ref(null)
let resizeObserver = null

const positionStyle = computed(() => ({
  left: `${props.node.position.x}px`,
  top: `${props.node.position.y}px`
}))

const engineIcon = computed(() => getGameEngineIconByValue(props.node.engineLabel))
const codeTypeIcon = computed(() => getGameCodeTypeIconByValue(props.node.codeTypeLabel))

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
    class="bp-node-frame bp-game-node"
    :class="{
      'is-selected': props.selected,
      'is-highlighted': props.highlighted
    }"
    :style="positionStyle"
    data-no-pan
    @click="emit('select', props.node.id)"
    @pointerdown.stop="onPointerDown"
  >
    <BlueprintNodePorts
      :node-id="props.node.id"
      @start-link="onOutputPointerDown"
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
  width: 238px;
  color: var(--bp-text);
}

.bp-game-node-cover-wrap {
  position: relative;
  height: 128px;
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
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.92);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1;
  text-align: center;
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
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 999px;
  background: #f5f5f5;
  font-size: 0.74rem;
  font-weight: 600;
}

.bp-game-node-chip img {
  width: 14px;
  height: 14px;
  object-fit: contain;
  display: block;
}

</style>
