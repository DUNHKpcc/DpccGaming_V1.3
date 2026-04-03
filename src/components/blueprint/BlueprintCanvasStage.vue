<script setup>
import { onMounted, ref } from 'vue'
import { useInfiniteCanvas } from '../../composables/useInfiniteCanvas'
import { BP_GAME_DRAG_MIME, parseBlueprintGameDragData } from '../../utils/blueprintNodes.js'

const props = defineProps({
  placeholder: { type: String, default: '描述您的创意...' },
  promptValue: { type: String, default: '' },
  promptDisabled: { type: Boolean, default: false },
  planning: { type: Boolean, default: false },
  planningLabel: { type: String, default: 'AI 正在规划工作流...' },
  showEmptyState: { type: Boolean, default: true },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['drop-game', 'canvas-ready', 'submit-prompt', 'update:prompt'])
const isGameDragOver = ref(false)

const {
  stageRef,
  isPanning,
  worldStyle,
  gridStyle,
  beginPan,
  movePan,
  endPan,
  centerOnWorld,
  focusWorldBounds,
  onWheel,
  screenToWorldPoint,
  worldToViewportPoint
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

const updatePromptValue = (event) => {
  emit('update:prompt', event?.target?.value || '')
}

const submitPrompt = () => {
  emit('submit-prompt')
}

onMounted(() => {
  centerOnWorld()
  emit('canvas-ready', {
    screenToWorldPoint,
    worldToViewportPoint,
    getStageRect: () => stageRef.value?.getBoundingClientRect() || null,
    focusWorldBounds
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
    @wheel="onWheel"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.self="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="bp-stage-grid" :style="gridStyle"></div>

    <div v-if="props.showEmptyState" class="bp-stage-empty-state">
      <div class="bp-empty-state">
        <div class="bp-empty-state-hero">
          <div class="bp-empty-brand">
            <img class="bp-empty-brand-mark" src="/logo_light.png" alt="BluePrint" />
            <span>BluePrint</span>
          </div>
          <h1>独创游戏生成工作流</h1>
          <p>拖拽移动节点，滚轮缩放视图。每一个节点都是一次创意的进发。</p>
          <span class="bp-empty-tip">从左侧拖入一个游戏节点，或在侧边栏输入种子继续已有蓝图。</span>
        </div>
      </div>
    </div>

    <div class="bp-stage-world" :style="worldStyle">
      <slot name="world" :screen-to-world-point="screenToWorldPoint"></slot>
    </div>

    <div class="bp-stage-overlay" data-no-pan>
      <slot name="overlay"></slot>
      <div v-if="props.planning" class="bp-prompt-planning" data-no-pan aria-live="polite">
        <div class="bp-prompt-planning-copy">
          <strong>AI 正在规划工作流</strong>
          <span>{{ props.planningLabel }}</span>
        </div>
        <div class="bp-prompt-planning-track" aria-hidden="true">
          <span></span>
        </div>
      </div>
      <form class="bp-prompt-dock" data-no-pan @submit.prevent="submitPrompt">
        <input
          class="bp-prompt-input"
          :value="props.promptValue"
          :placeholder="props.placeholder"
          :disabled="props.promptDisabled"
          data-no-pan
          @input="updatePromptValue"
        />
        <button type="submit" class="bp-prompt-send" :disabled="props.promptDisabled" data-no-pan>
          <i class="fa fa-paper-plane"></i>
        </button>
      </form>
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
.bp-stage-overlay,
.bp-stage-empty-state {
  position: absolute;
  inset: 0;
}

.bp-stage-overlay {
  pointer-events: none;
}

.bp-stage-empty-state {
  z-index: 1;
  display: grid;
  place-items: center;
  padding: calc(28px * var(--bp-ui-scale)) calc(28px * var(--bp-ui-scale)) calc(120px * var(--bp-ui-scale));
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
  position: relative;
  width: min(calc(460px * var(--bp-ui-scale)), calc(100% - calc(56px * var(--bp-ui-scale))));
  color: var(--bp-text);
}

.bp-empty-state-hero {
  text-align: center;
  pointer-events: none;
}

.bp-empty-brand {
  display: inline-flex;
  align-items: center;
  gap: calc(10px * var(--bp-ui-scale));
  min-height: calc(46px * var(--bp-ui-scale));
  margin-bottom: calc(16px * var(--bp-ui-scale));
  padding: 0 calc(15px * var(--bp-ui-scale));
  border: 1px solid var(--bp-border);
  border-radius: calc(11px * var(--bp-ui-scale));
  background: var(--bp-surface);
  box-shadow: var(--bp-shadow-sm);
  color: var(--bp-accent);
  font-size: calc(0.84rem * var(--bp-ui-scale));
  font-weight: 700;
}

.bp-empty-brand-mark {
  width: calc(16px * var(--bp-ui-scale));
  height: calc(16px * var(--bp-ui-scale));
  object-fit: contain;
  display: block;
}

.bp-empty-state h1 {
  margin: 0 0 calc(12px * var(--bp-ui-scale));
  font-size: clamp(calc(0.96rem * var(--bp-ui-scale)), calc(0.88rem * var(--bp-ui-scale)) + 0.33vw, calc(1.06rem * var(--bp-ui-scale)));
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.bp-empty-state p {
  width: min(220px, 100%);
  margin: 0 auto;
  color: var(--bp-muted);
  font-size: clamp(calc(0.78rem * var(--bp-ui-scale)), calc(0.73rem * var(--bp-ui-scale)) + 0.2vw, calc(0.83rem * var(--bp-ui-scale)));
  line-height: 1.6;
}

.bp-empty-tip {
  display: inline-flex;
  margin-top: calc(14px * var(--bp-ui-scale));
  color: #7a746a;
  font-size: calc(0.72rem * var(--bp-ui-scale));
  line-height: 1.5;
}

.bp-prompt-dock {
  position: absolute;
  left: 50%;
  bottom: clamp(calc(28px * var(--bp-ui-scale)), 6.6vh, calc(64px * var(--bp-ui-scale)));
  z-index: 2;
  display: flex;
  align-items: center;
  gap: clamp(calc(8px * var(--bp-ui-scale)), 0.9vw, calc(10px * var(--bp-ui-scale)));
  width: clamp(calc(360px * var(--bp-ui-scale)), 57%, calc(495px * var(--bp-ui-scale)));
  max-width: calc(100% - calc(40px * var(--bp-ui-scale)));
  transform: translateX(-50%);
  pointer-events: auto;
}

.bp-prompt-planning {
  position: absolute;
  left: 50%;
  bottom: calc(clamp(calc(28px * var(--bp-ui-scale)), 6.6vh, calc(64px * var(--bp-ui-scale))) + calc(56px * var(--bp-ui-scale)));
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: calc(8px * var(--bp-ui-scale));
  width: clamp(calc(320px * var(--bp-ui-scale)), 46%, calc(440px * var(--bp-ui-scale)));
  max-width: calc(100% - calc(52px * var(--bp-ui-scale)));
  padding: calc(12px * var(--bp-ui-scale)) calc(14px * var(--bp-ui-scale));
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: calc(12px * var(--bp-ui-scale));
  background: rgba(255, 252, 246, 0.96);
  box-shadow: 0 16px 34px rgba(32, 24, 11, 0.12);
  transform: translateX(-50%);
  pointer-events: none;
}

.bp-prompt-planning-copy {
  display: flex;
  flex-direction: column;
  gap: calc(4px * var(--bp-ui-scale));
}

.bp-prompt-planning-copy strong {
  color: #171513;
  font-size: clamp(calc(0.8rem * var(--bp-ui-scale)), calc(0.76rem * var(--bp-ui-scale)) + 0.12vw, calc(0.86rem * var(--bp-ui-scale)));
  font-weight: 700;
}

.bp-prompt-planning-copy span {
  color: #6f685e;
  font-size: clamp(calc(0.72rem * var(--bp-ui-scale)), calc(0.7rem * var(--bp-ui-scale)) + 0.08vw, calc(0.76rem * var(--bp-ui-scale)));
  line-height: 1.5;
}

.bp-prompt-planning-track {
  position: relative;
  width: 100%;
  height: calc(6px * var(--bp-ui-scale));
  border-radius: 999px;
  overflow: hidden;
  background: rgba(190, 180, 163, 0.32);
}

.bp-prompt-planning-track span {
  position: absolute;
  inset: 0 auto 0 0;
  width: 38%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(188, 137, 21, 0.24), #c88e11, rgba(238, 185, 66, 0.72));
  animation: bp-planning-marquee 1.2s ease-in-out infinite;
}

.bp-prompt-dock button:disabled,
.bp-prompt-dock input:disabled {
  cursor: not-allowed;
}

.bp-prompt-input {
  flex: 1;
  min-width: 0;
  height: calc(40px * var(--bp-ui-scale));
  padding: 0 calc(14px * var(--bp-ui-scale));
  border: 1px solid var(--bp-border);
  border-radius: calc(8px * var(--bp-ui-scale));
  outline: none;
  background: var(--bp-surface);
  box-shadow: var(--bp-shadow-sm);
  color: var(--bp-text);
  font-size: clamp(calc(0.88rem * var(--bp-ui-scale)), calc(0.82rem * var(--bp-ui-scale)) + 0.13vw, calc(0.94rem * var(--bp-ui-scale)));
}

.bp-prompt-input::placeholder {
  color: var(--bp-muted);
}

.bp-prompt-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(calc(34px * var(--bp-ui-scale)), 3.1vw, calc(36px * var(--bp-ui-scale)));
  height: clamp(calc(34px * var(--bp-ui-scale)), 3.1vw, calc(36px * var(--bp-ui-scale)));
  border: 1px solid #181818;
  border-radius: calc(8px * var(--bp-ui-scale));
  background: #181818;
  color: #ffffff;
  box-shadow: var(--bp-shadow-sm);
  cursor: pointer;
}

@media (max-width: 1200px) {
  .bp-empty-state {
    grid-template-columns: 1fr;
    width: min(calc(540px * var(--bp-ui-scale)), calc(100% - calc(24px * var(--bp-ui-scale))));
  }

  .bp-prompt-dock {
    max-width: calc(100% - calc(28px * var(--bp-ui-scale)));
  }

  .bp-prompt-planning {
    max-width: calc(100% - calc(28px * var(--bp-ui-scale)));
  }
}

@keyframes bp-planning-marquee {
  0% {
    transform: translateX(-15%);
  }
  50% {
    transform: translateX(120%);
  }
  100% {
    transform: translateX(245%);
  }
}
</style>
