<script setup>
import { onMounted } from 'vue'
import { useInfiniteCanvas } from '../../composables/useInfiniteCanvas'

const props = defineProps({
  placeholder: { type: String, default: '描述您的创意...' }
})

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
  onWheel
} = useInfiniteCanvas()

onMounted(() => {
  centerOnWorld({ xRatio: 0.54, yRatio: 0.41 })
})
</script>

<template>
  <section
    ref="stageRef"
    class="bp-stage"
    :class="{ 'is-panning': isPanning }"
    @pointerdown="beginPan"
    @pointermove="movePan"
    @pointerup="endPan"
    @pointercancel="endPan"
    @wheel.prevent="onWheel"
  >
    <div class="bp-stage-grid" :style="gridStyle"></div>

    <div class="bp-stage-world" :style="worldStyle">
      <slot name="world">
        <div class="bp-empty-state" :style="{ left: `${worldCenter.x}px`, top: `${worldCenter.y}px` }">
          <div class="bp-empty-brand">
            <span class="bp-empty-brand-mark"></span>
            <span>BluePrint</span>
          </div>
          <h1>独创游戏生成工作流</h1>
          <p>拖拽移动节点，滚轮缩放视图。每一个节点都是一次创意的进发。</p>
        </div>
      </slot>
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
  min-height: 100vh;
  overflow: hidden;
  background: var(--bp-canvas-bg);
  cursor: grab;
  touch-action: none;
}

.bp-stage.is-panning {
  cursor: grabbing;
}

.bp-stage-grid,
.bp-stage-world,
.bp-stage-overlay {
  position: absolute;
  inset: 0;
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
  width: 22px;
  height: 22px;
  background:
    linear-gradient(#101010 0 0) left 2px top 0 / 8px 22px no-repeat,
    radial-gradient(circle at 72% 22%, #101010 0 3px, transparent 3.2px),
    radial-gradient(circle at 73% 86%, #101010 0 9px, transparent 9.2px);
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
