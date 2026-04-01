<script setup>
import { computed } from 'vue'

const props = defineProps({
  runtime: { type: Object, default: null }
})

const normalizedProgress = computed(() => {
  const value = Number(props.runtime?.progressValue)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
})

const progressPercentLabel = computed(() =>
  `${Math.round(normalizedProgress.value * 100)}%`
)

const progressSteps = computed(() => {
  const steps = Array.isArray(props.runtime?.progressTrail)
    ? props.runtime.progressTrail
    : []

  return steps.slice(-3)
})

const shouldShow = computed(() =>
  props.runtime?.status === 'running'
  && (props.runtime?.progressDetail || Number.isFinite(Number(props.runtime?.progressValue)))
)
</script>

<template>
  <div v-if="shouldShow" class="bp-node-progress-panel" data-no-pan>
    <div class="bp-node-progress-head">
      <strong>{{ props.runtime.progressDetail || '正在执行节点' }}</strong>
      <span>{{ progressPercentLabel }}</span>
    </div>
    <div class="bp-node-progress-track">
      <span
        class="bp-node-progress-bar"
        :style="{ width: `${normalizedProgress * 100}%` }"
      ></span>
    </div>
    <ul v-if="progressSteps.length" class="bp-node-progress-list">
      <li v-for="(step, index) in progressSteps" :key="`${step.stage}-${index}`">
        <span>{{ step.label || step.stage || '阶段' }}</span>
        <small>{{ step.detail }}</small>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bp-node-progress-panel {
  position: absolute;
  top: calc(100% + calc(10px * var(--bp-ui-scale, 1)));
  left: 50%;
  z-index: 3;
  width: calc(220px * var(--bp-ui-scale, 1));
  padding: calc(10px * var(--bp-ui-scale, 1));
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: calc(14px * var(--bp-ui-scale, 1));
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 28px rgba(27, 32, 46, 0.12);
  transform: translateX(-50%);
  backdrop-filter: blur(14px);
}

.bp-node-progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: calc(10px * var(--bp-ui-scale, 1));
}

.bp-node-progress-head strong {
  color: #171513;
  font-size: calc(0.72rem * var(--bp-ui-scale, 1));
  line-height: 1.35;
}

.bp-node-progress-head span {
  color: #8a7746;
  font-size: calc(0.66rem * var(--bp-ui-scale, 1));
  font-weight: 700;
  white-space: nowrap;
}

.bp-node-progress-track {
  position: relative;
  margin-top: calc(8px * var(--bp-ui-scale, 1));
  height: calc(8px * var(--bp-ui-scale, 1));
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  overflow: hidden;
}

.bp-node-progress-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #d5a53a 0%, #73d4ff 100%);
  transition: width 0.2s ease;
}

.bp-node-progress-list {
  display: flex;
  flex-direction: column;
  gap: calc(5px * var(--bp-ui-scale, 1));
  margin: calc(10px * var(--bp-ui-scale, 1)) 0 0;
  padding: 0;
  list-style: none;
}

.bp-node-progress-list li {
  display: flex;
  flex-direction: column;
  gap: calc(2px * var(--bp-ui-scale, 1));
  padding: calc(6px * var(--bp-ui-scale, 1)) calc(8px * var(--bp-ui-scale, 1));
  border-radius: calc(10px * var(--bp-ui-scale, 1));
  background: rgba(248, 245, 239, 0.92);
}

.bp-node-progress-list span {
  color: #463f34;
  font-size: calc(0.66rem * var(--bp-ui-scale, 1));
  font-weight: 700;
}

.bp-node-progress-list small {
  color: #70695d;
  font-size: calc(0.62rem * var(--bp-ui-scale, 1));
  line-height: 1.35;
}
</style>
