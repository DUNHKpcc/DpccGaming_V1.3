<script setup>
import { computed } from 'vue'
import { BLUEPRINT_COMPACT_NODE_META } from '../../utils/blueprintNodes.js'

const props = defineProps({
  editor: { type: Object, required: true }
})

const emit = defineEmits(['close', 'save', 'update:draft'])

const editorMeta = computed(() =>
  BLUEPRINT_COMPACT_NODE_META[props.editor.kind] || null
)
</script>

<template>
  <div
    class="bp-node-editor-panel bp-floating-panel"
    :style="{
      left: `${props.editor.position.x}px`,
      top: `${props.editor.position.y}px`
    }"
    data-no-pan
    @pointerdown.stop
    @click.stop
    @contextmenu.prevent.stop
  >
    <div class="bp-node-editor-head">
      <strong>{{ editorMeta?.title || '编辑节点' }}</strong>
      <button
        type="button"
        class="bp-node-editor-close bp-control-button-secondary"
        @click="emit('close')"
      >
        <i class="fa fa-xmark"></i>
      </button>
    </div>
    <label class="bp-node-editor-field">
      <span>{{ editorMeta?.contentLabel || '内容' }}</span>
      <textarea
        class="bp-textarea-control"
        :value="props.editor.draft"
        :placeholder="editorMeta?.contentPlaceholder || '输入内容'"
        data-no-pan
        @input="emit('update:draft', $event.target.value)"
      ></textarea>
    </label>
    <div class="bp-node-editor-actions">
      <button
        type="button"
        class="bp-node-editor-btn bp-control-button-secondary"
        @click="emit('close')"
      >
        取消
      </button>
      <button
        type="button"
        class="bp-node-editor-btn bp-control-button-secondary is-primary"
        @click="emit('save')"
      >
        保存
      </button>
    </div>
  </div>
</template>

<style scoped>
.bp-node-editor-panel {
  width: calc(280px * var(--bp-ui-scale, 1));
  padding: calc(12px * var(--bp-ui-scale, 1));
}

.bp-node-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(12px * var(--bp-ui-scale, 1));
  margin-bottom: calc(10px * var(--bp-ui-scale, 1));
}

.bp-node-editor-head strong {
  font-size: calc(0.9rem * var(--bp-ui-scale, 1));
  line-height: 1.2;
}

.bp-node-editor-close {
  width: calc(30px * var(--bp-ui-scale, 1));
  height: calc(30px * var(--bp-ui-scale, 1));
}

.bp-node-editor-field {
  display: flex;
  flex-direction: column;
  gap: calc(8px * var(--bp-ui-scale, 1));
}

.bp-node-editor-field span {
  color: var(--bp-muted);
  font-size: calc(0.75rem * var(--bp-ui-scale, 1));
  font-weight: 600;
}

.bp-node-editor-field textarea {
  min-height: calc(108px * var(--bp-ui-scale, 1));
}

.bp-node-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: calc(8px * var(--bp-ui-scale, 1));
  margin-top: calc(12px * var(--bp-ui-scale, 1));
}

.bp-node-editor-btn {
  min-height: calc(34px * var(--bp-ui-scale, 1));
  padding: 0 calc(14px * var(--bp-ui-scale, 1));
  font-size: calc(0.82rem * var(--bp-ui-scale, 1));
  font-weight: 600;
}

.bp-node-editor-btn.is-primary {
  border-color: #181818;
  background: #181818;
  color: #ffffff;
}
</style>
