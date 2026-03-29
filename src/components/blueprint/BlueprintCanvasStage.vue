<script setup>
import { onMounted, ref } from 'vue'
import { useInfiniteCanvas } from '../../composables/useInfiniteCanvas'
import { BP_GAME_DRAG_MIME, parseBlueprintGameDragData } from '../../utils/blueprintNodes.js'

const props = defineProps({
  placeholder: { type: String, default: '描述您的创意...' },
  showEmptyState: { type: Boolean, default: true }
})

const emit = defineEmits(['drop-game', 'canvas-ready'])
const isGameDragOver = ref(false)

const {
  stageRef,
  isPanning,
  worldCenter,
  worldStyle,
  gridStyle,
  beginPan,
  movePan,
  endPan,
  centerOnWorld,
  onWheel,
  screenToWorldPoint
} = useInfiniteCanvas()

const readDraggedGame = (dataTransfer) =>
  parseBlueprintGameDragData(
    dataTransfer?.getData(BP_GAME_DRAG_MIME)
    || dataTransfer?.getData('text/plain')
  )

const onDragEnter = (event) => {
  if (!readDraggedGame(event.dataTransfer)) return

  event.preventDefault()
  isGameDragOver.value = true
}

const onDragOver = (event) => {
  if (!readDraggedGame(event.dataTransfer)) return

  event.preventDefault()
  isGameDragOver.value = true

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

const onDragLeave = () => {
  isGameDragOver.value = false
}

const onDrop = (event) => {
  const draggedGame = readDraggedGame(event.dataTransfer)
  isGameDragOver.value = false

  if (!draggedGame) return

  event.preventDefault()
  emit('drop-game', {
    gameId: draggedGame.gameId,
    position: screenToWorldPoint({
      x: event.clientX,
      y: event.clientY
    })
  })
}

onMounted(() => {
  centerOnWorld({ xRatio: 0.54, yRatio: 0.41 })
  emit('canvas-ready', {
    screenToWorldPoint
  })
})
</script>

<template>
  <section
    ref="stageRef"
    class="bp-stage"
    :class="{
      'is-panning': isPanning,
      'is-drop-active': isGameDragOver
    }"
    @pointerdown="beginPan"
    @pointermove="movePan"
    @pointerup="endPan"
    @pointercancel="endPan"
    @wheel.prevent="onWheel"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.self="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="bp-stage-grid" :style="gridStyle"></div>

    <div class="bp-stage-world" :style="worldStyle">
      <div v-if="props.showEmptyState" class="bp-empty-state" :style="{ left: `${worldCenter.x}px`, top: `${worldCenter.y}px` }">
        <div class="bp-empty-brand">
          <img class="bp-empty-brand-mark" src="/logo_light.png" alt="BluePrint" />
          <span>BluePrint</span>
        </div>
        <h1>独创游戏生成工作流</h1>
        <p>拖拽移动节点，滚轮缩放视图。每一个节点都是一次创意的进发。</p>
      </div>
      <slot name="world" :screen-to-world-point="screenToWorldPoint"></slot>
    </div>

    <div class="bp-stage-overlay" data-no-pan>
      <slot name="overlay">
        <div class="bp-prompt-dock" data-no-pan>
          <input class="bp-prompt-input" :placeholder="props.placeholder" data-no-pan />
          <button type="button" class="bp-prompt-send" data-no-pan>
            <i class="fa fa-paper-plane"></i>
          </button>
        </div>
      </slot>
    </div>
  </section>
</template>

<style scoped>
.bp-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--bp-canvas-bg);
  cursor: grab;
  touch-action: none;
}

.bp-stage.is-panning {
  cursor: grabbing;
}

.bp-stage.is-drop-active::after {
  content: '';
  position: absolute;
  inset: 18px;
  border: 2px dashed rgba(210, 160, 43, 0.65);
  border-radius: 24px;
  background: rgba(210, 160, 43, 0.06);
  pointer-events: none;
}

.bp-stage-grid,
.bp-stage-world,
.bp-stage-overlay {
  position: absolute;
  inset: 0;
}

.bp-stage-overlay {
  pointer-events: none;
}

.bp-stage-grid {
  pointer-events: none;
  background-image:
    linear-gradient(var(--bp-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--bp-grid) 1px, transparent 1px);
  background-repeat: repeat;
  opacity: 0.82;
}

.bp-stage-world {
  will-change: transform;
}

.bp-empty-state {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 290px;
  color: var(--bp-text);
  text-align: center;
}

.bp-empty-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  margin-bottom: 16px;
  padding: 0 15px;
  border: 1px solid var(--bp-border);
  border-radius: 11px;
  background: var(--bp-surface);
  box-shadow: var(--bp-shadow-sm);
  color: var(--bp-accent);
  font-size: 0.84rem;
  font-weight: 700;
}

.bp-empty-brand-mark {
  width: 16px;
  height: 16px;
  object-fit: contain;
  display: block;
}

.bp-empty-state h1 {
  margin: 0 0 12px;
  font-size: 1.06rem;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.bp-empty-state p {
  width: 172px;
  margin: 0 auto;
  color: var(--bp-muted);
  font-size: 0.83rem;
  line-height: 1.6;
}

.bp-prompt-dock {
  position: absolute;
  left: 50%;
  bottom: 64px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 495px;
  transform: translateX(-50%);
  pointer-events: auto;
}

.bp-prompt-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--bp-border);
  border-radius: 8px;
  outline: none;
  background: var(--bp-surface);
  box-shadow: var(--bp-shadow-sm);
  color: var(--bp-text);
  font-size: 0.94rem;
}

.bp-prompt-input::placeholder {
  color: var(--bp-muted);
}

.bp-prompt-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid #181818;
  border-radius: 8px;
  background: #181818;
  color: #ffffff;
  box-shadow: var(--bp-shadow-sm);
  cursor: pointer;
}
</style>
