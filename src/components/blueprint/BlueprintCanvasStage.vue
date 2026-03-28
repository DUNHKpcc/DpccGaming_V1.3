<script setup>
import { onMounted } from 'vue'
import { useInfiniteCanvas } from '../../composables/useInfiniteCanvas'

const props = defineProps({
  placeholder: { type: String, default: '描述您的创意...' }
})

const {
  stageRef,
  scale,
  offset,
  isPanning,
  lastPointer,
  worldCenter,
  worldStyle,
  gridStyle,
  onWheel
} = useInfiniteCanvas()

const beginPan = (event) => {
  isPanning.value = true
  lastPointer.value = { x: event.clientX, y: event.clientY }
}

const movePan = (event) => {
  if (!isPanning.value) return
  offset.value = {
    x: offset.value.x + event.clientX - lastPointer.value.x,
    y: offset.value.y + event.clientY - lastPointer.value.y
  }
  lastPointer.value = { x: event.clientX, y: event.clientY }
}

const endPan = () => {
  isPanning.value = false
}

onMounted(() => {
  offset.value = {
    x: window.innerWidth * 0.52 - worldCenter.x,
    y: window.innerHeight * 0.43 - worldCenter.y
  }
})
</script>

<template>
  <section
    ref="stageRef"
    class="bp-stage"
    @mousedown="beginPan"
    @mousemove="movePan"
    @mouseup="endPan"
    @mouseleave="endPan"
    @wheel.prevent="onWheel"
  >
    <div class="bp-stage-grid" :style="gridStyle"></div>

    <div class="bp-stage-world" :style="worldStyle">
      <div class="bp-empty-state" :style="{ left: `${worldCenter.x}px`, top: `${worldCenter.y}px` }">
        <div class="bp-empty-brand">BluePrint</div>
        <h1>独创游戏生成工作流</h1>
        <p>拖拽移动节点，滚轮缩放视图。每一个节点都是一次创意的进发。</p>
      </div>
    </div>

    <div class="bp-prompt-dock">
      <input class="bp-prompt-input" :placeholder="props.placeholder" />
      <button type="button" class="bp-prompt-send">
        <i class="fa fa-paper-plane"></i>
      </button>
    </div>
  </section>
</template>
