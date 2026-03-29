<script setup>
const props = defineProps({
  node: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'drag-start', 'start-link', 'update-field'])

const fieldDefs = [
  { key: 'theme', label: '主题', placeholder: '例如：赛博都市追逐' },
  { key: 'style', label: '风格', placeholder: '例如：霓虹、像素、未来感' },
  { key: 'gameplay', label: '核心玩法', placeholder: '例如：高速漂移与躲避追击' },
  { key: 'keywords', label: '关键词', placeholder: '例如：竞速, 夜景, 合成器配乐' }
]

const onPointerDown = (event) => {
  if (event.button !== 0) return
  if (event.target instanceof Element && event.target.closest('input, textarea, [data-port-type]')) return

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
</script>

<template>
  <article
    class="bp-prompt-node"
    :class="{
      'is-selected': props.selected,
      'is-highlighted': props.highlighted
    }"
    :style="{ left: `${props.node.position.x}px`, top: `${props.node.position.y}px` }"
    data-no-pan
    @click="emit('select', props.node.id)"
    @pointerdown.stop="onPointerDown"
  >
    <button
      type="button"
      class="bp-prompt-node-port bp-prompt-node-port-in"
      title="输入"
      data-port-type="input"
      :data-node-id="props.node.id"
      @pointerdown.stop
    ></button>
    <button
      type="button"
      class="bp-prompt-node-port bp-prompt-node-port-out"
      title="输出"
      data-port-type="output"
      :data-node-id="props.node.id"
      @pointerdown.stop="onOutputPointerDown"
    ></button>

    <header class="bp-prompt-node-head" data-no-pan>
      <span>正向提示词</span>
      <small>结构化</small>
    </header>

    <div class="bp-prompt-node-fields" data-no-pan>
      <label
        v-for="field in fieldDefs"
        :key="field.key"
        class="bp-prompt-field"
      >
        <span>{{ field.label }}</span>
        <input
          :value="props.node.fields[field.key]"
          :placeholder="field.placeholder"
          data-no-pan
          @click.stop
          @pointerdown.stop
          @input="emit('update-field', { nodeId: props.node.id, fieldKey: field.key, value: $event.target.value })"
        />
      </label>
    </div>
  </article>
</template>

<style scoped>
.bp-prompt-node {
  position: absolute;
  width: 280px;
  padding: 14px;
  border: 1px solid rgba(84, 116, 186, 0.2);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(247, 249, 255, 0.97));
  box-shadow: 0 18px 42px rgba(26, 33, 50, 0.14);
  color: var(--bp-text);
  user-select: none;
  backdrop-filter: blur(10px);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.bp-prompt-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 46px rgba(26, 33, 50, 0.18);
}

.bp-prompt-node.is-selected {
  border-color: rgba(84, 116, 186, 0.52);
  box-shadow: 0 0 0 2px rgba(84, 116, 186, 0.12), 0 20px 46px rgba(26, 33, 50, 0.18);
}

.bp-prompt-node.is-highlighted {
  animation: bp-prompt-pulse 1.2s ease;
}

.bp-prompt-node-port {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.94);
  border-radius: 999px;
  background: linear-gradient(135deg, #5f87ef, #3257bb);
  box-shadow: 0 6px 16px rgba(41, 59, 102, 0.24);
  transform: translateY(-50%);
  cursor: crosshair;
}

.bp-prompt-node-port-in {
  left: -8px;
}

.bp-prompt-node-port-out {
  right: -8px;
}

.bp-prompt-node-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
  margin-bottom: 12px;
}

.bp-prompt-node-head span {
  font-size: 0.95rem;
  font-weight: 700;
}

.bp-prompt-node-head small {
  color: #5474ba;
  font-size: 0.72rem;
  font-weight: 700;
}

.bp-prompt-node-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bp-prompt-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bp-prompt-field span {
  color: var(--bp-muted);
  font-size: 0.74rem;
  font-weight: 600;
}

.bp-prompt-field input {
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(84, 116, 186, 0.16);
  border-radius: 10px;
  outline: none;
  background: rgba(255, 255, 255, 0.94);
  color: var(--bp-text);
  font-size: 0.82rem;
  box-sizing: border-box;
}

.bp-prompt-field input:focus {
  border-color: rgba(84, 116, 186, 0.4);
  box-shadow: 0 0 0 3px rgba(84, 116, 186, 0.1);
}

@keyframes bp-prompt-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(84, 116, 186, 0.28), 0 18px 42px rgba(26, 33, 50, 0.14);
  }

  50% {
    box-shadow: 0 0 0 10px rgba(84, 116, 186, 0.08), 0 20px 46px rgba(26, 33, 50, 0.18);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(84, 116, 186, 0), 0 18px 42px rgba(26, 33, 50, 0.14);
  }
}
</style>
