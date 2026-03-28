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
  centerOnWorld()
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
          <div class="bp-empty-brand">BluePrint</div>
          <h1>独创游戏生成工作流</h1>
          <p>拖拽移动节点，滚轮缩放视图。每一个节点都是一次创意的进发。</p>
        </div>
      </slot>
    </div>

    <slot name="overlay">
      <div class="bp-prompt-dock" data-no-pan>
        <input class="bp-prompt-input" :placeholder="props.placeholder" data-no-pan />
        <button type="button" class="bp-prompt-send" data-no-pan>
          <i class="fa fa-paper-plane"></i>
        </button>
      </div>
    </slot>
  </section>
</template>

<style scoped>
.bp-stage {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(76, 112, 163, 0.12), transparent 40%),
    linear-gradient(180deg, #08111d 0%, #0b1521 100%);
  cursor: grab;
  touch-action: none;
}

.bp-stage.is-panning {
  cursor: grabbing;
}

.bp-stage-grid,
.bp-stage-world {
  position: absolute;
  inset: 0;
}

.bp-stage-grid {
  pointer-events: none;
  background-image:
    linear-gradient(rgba(161, 184, 214, 0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgba(161, 184, 214, 0.14) 1px, transparent 1px);
  background-repeat: repeat;
}

.bp-stage-world {
  will-change: transform;
}

.bp-empty-state {
  position: absolute;
  transform: translate(-50%, -50%);
  width: min(480px, calc(100vw - 48px));
  padding: 32px 36px;
  border: 1px solid rgba(196, 214, 240, 0.14);
  border-radius: 28px;
  background: rgba(7, 17, 30, 0.82);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(18px);
  color: #f4f8ff;
  text-align: center;
}

.bp-empty-brand {
  margin-bottom: 14px;
  color: #8db9ff;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.bp-empty-state h1 {
  margin: 0 0 12px;
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  line-height: 1.05;
}

.bp-empty-state p {
  margin: 0;
  color: rgba(228, 238, 255, 0.76);
  font-size: 0.98rem;
  line-height: 1.7;
}

.bp-prompt-dock {
  position: absolute;
  left: 50%;
  bottom: 28px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(720px, calc(100% - 32px));
  padding: 12px;
  border: 1px solid rgba(196, 214, 240, 0.16);
  border-radius: 999px;
  background: rgba(5, 12, 22, 0.88);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(18px);
  transform: translateX(-50%);
}

.bp-prompt-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #f4f8ff;
  font-size: 1rem;
  padding: 0 8px;
}

.bp-prompt-input::placeholder {
  color: rgba(210, 223, 246, 0.48);
}

.bp-prompt-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #5ea2ff 0%, #7ed0ff 100%);
  color: #04101d;
}
</style>
