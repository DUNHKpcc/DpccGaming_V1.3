<script setup>
import { computed } from 'vue'
import { CHAT_MORE_BUILTIN_MODEL_META, getBuiltinModelMeta } from '../../utils/discussionChatMore'

const props = defineProps({
  runtime: { type: Object, default: null }
})

const normalizedModel = computed(() => String(props.runtime?.model || '').trim())

const badgeMeta = computed(() => {
  if (props.runtime?.status !== 'running') return null
  if (!normalizedModel.value) return null

  if (!Object.prototype.hasOwnProperty.call(CHAT_MORE_BUILTIN_MODEL_META, normalizedModel.value)) {
    return null
  }

  return getBuiltinModelMeta(normalizedModel.value)
})
</script>

<template>
  <div
    v-if="badgeMeta"
    class="bp-node-ai-badge"
    :title="`${badgeMeta.label} 正在思考`"
    aria-hidden="true"
    data-no-pan
  >
    <img :src="badgeMeta.logo" alt="" />
  </div>
</template>

<style scoped>
.bp-node-ai-badge {
  position: absolute;
  top: calc(-10px * var(--bp-ui-scale, 1));
  left: calc(-10px * var(--bp-ui-scale, 1));
  z-index: 5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(30px * var(--bp-ui-scale, 1));
  height: calc(30px * var(--bp-ui-scale, 1));
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 18px rgba(14, 31, 62, 0.18);
  pointer-events: none;
  animation: bp-node-ai-badge-pulse 1.15s ease-in-out infinite;
}

.bp-node-ai-badge::after {
  content: '';
  position: absolute;
  inset: calc(-3px * var(--bp-ui-scale, 1));
  border-radius: inherit;
  border: 1px solid rgba(91, 198, 255, 0.38);
  opacity: 0.42;
  animation: bp-node-ai-badge-halo 1.15s ease-in-out infinite;
}

.bp-node-ai-badge img {
  width: calc(18px * var(--bp-ui-scale, 1));
  height: calc(18px * var(--bp-ui-scale, 1));
  object-fit: contain;
  display: block;
}

@keyframes bp-node-ai-badge-pulse {
  0%,
  100% {
    opacity: 0.42;
    transform: scale(0.94);
    box-shadow: 0 6px 14px rgba(14, 31, 62, 0.14);
  }

  50% {
    opacity: 1;
    transform: scale(1.04);
    box-shadow: 0 10px 24px rgba(25, 111, 188, 0.24);
  }
}

@keyframes bp-node-ai-badge-halo {
  0%,
  100% {
    opacity: 0.24;
    transform: scale(0.92);
  }

  50% {
    opacity: 0.78;
    transform: scale(1.08);
  }
}
</style>
