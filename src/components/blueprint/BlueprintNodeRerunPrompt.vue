<script setup>
import { nextTick, onMounted, ref } from 'vue'

const props = defineProps({
  prompt: { type: Object, required: true }
})

const emit = defineEmits(['submit', 'cancel', 'update:draft'])

const textareaRef = ref(null)

const focusTextarea = async () => {
  await nextTick()
  textareaRef.value?.focus()
  textareaRef.value?.setSelectionRange?.(textareaRef.value.value.length, textareaRef.value.value.length)
}

onMounted(() => {
  void focusTextarea()
})
</script>

<template>
  <div
    class="bp-node-rerun-prompt bp-floating-panel"
    :style="{
      left: `${props.prompt.position.x}px`,
      top: `${props.prompt.position.y}px`
    }"
    data-no-pan
    @pointerdown.stop
    @click.stop
    @contextmenu.prevent.stop
  >
    <div class="bp-node-rerun-prompt__header">
      <strong>重跑说明</strong>
      <span>{{ props.prompt.nodeTitle || props.prompt.nodeId }}</span>
    </div>
    <textarea
      ref="textareaRef"
      class="bp-node-rerun-prompt__textarea bp-control-surface"
      :value="props.prompt.draft || ''"
      rows="5"
      placeholder="告诉 AI 这次希望如何修改，例如：保留玩法，但把 UI 改成像素风，并降低难度。"
      @input="emit('update:draft', $event.target.value)"
    />
    <div class="bp-node-rerun-prompt__actions">
      <button
        type="button"
        class="bp-floating-menu-button"
        @click="emit('cancel')"
      >
        取消
      </button>
      <button
        type="button"
        class="bp-floating-menu-button is-primary"
        @click="emit('submit')"
      >
        确认重跑
      </button>
    </div>
  </div>
</template>

<style scoped>
.bp-node-rerun-prompt {
  position: absolute;
  z-index: 25;
  display: flex;
  flex-direction: column;
  gap: calc(10px * var(--bp-ui-scale, 1));
  width: calc(320px * var(--bp-ui-scale, 1));
  padding: calc(12px * var(--bp-ui-scale, 1));
  pointer-events: auto;
}

.bp-node-rerun-prompt__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bp-node-rerun-prompt__header span {
  font-size: 12px;
  opacity: 0.72;
}

.bp-node-rerun-prompt__textarea {
  width: 100%;
  min-height: calc(112px * var(--bp-ui-scale, 1));
  resize: vertical;
  padding: calc(10px * var(--bp-ui-scale, 1));
  border: none;
  color: inherit;
  background: rgba(255, 255, 255, 0.78);
}

.bp-node-rerun-prompt__actions {
  display: flex;
  justify-content: flex-end;
  gap: calc(8px * var(--bp-ui-scale, 1));
}

.bp-floating-menu-button.is-primary {
  background: rgba(30, 87, 255, 0.16);
  color: #173caa;
}
</style>
