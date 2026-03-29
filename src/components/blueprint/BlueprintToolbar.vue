<script setup>
const emit = defineEmits(['action'])

const buttons = [
  { key: 'add-node', icon: 'fa fa-plus', label: '添加节点' },
  { key: 'prompt-positive', icon: 'fa fa-wand-magic-sparkles', label: '正向提示词' },
  { key: 'prompt-negative', icon: 'fa fa-arrows-rotate', label: '反向提示词' },
  { key: 'mixer', icon: 'fa fa-link', label: 'Mixer' },
  { key: 'design', icon: 'fa fa-map', label: '游戏设定' },
  { key: 'play', icon: 'fa fa-gamepad', label: '游戏玩法' },
  { key: 'music', icon: 'fa fa-music', label: '游戏音乐' }
]
</script>

<template>
  <div class="bp-toolbar">
    <div class="bp-toolbar-main">
      <button
        v-for="button in buttons"
        :key="button.key"
        type="button"
        class="bp-toolbar-btn"
        @click="emit('action', button.key)"
      >
        <i :class="button.icon"></i>
        <span>{{ button.label }}</span>
      </button>
      <button type="button" class="bp-toolbar-square">
        <i class="fa fa-plus"></i>
      </button>
    </div>

    <div class="bp-toolbar-side">
      <button type="button" class="bp-toolbar-square">
        <i class="fa fa-download"></i>
      </button>
      <button type="button" class="bp-toolbar-run">
        <i class="fa fa-play"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.bp-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: auto;
  padding: 0;
}

.bp-toolbar-main,
.bp-toolbar-side {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.bp-toolbar-side {
  margin-right: 30px;
}

.bp-toolbar-main {
  flex: 1;
  overflow: auto hidden;
  scrollbar-width: none;
}

.bp-toolbar-main::-webkit-scrollbar {
  display: none;
}

.bp-toolbar button {
  appearance: none;
  cursor: pointer;
}

.bp-toolbar-btn,
.bp-toolbar-square,
.bp-toolbar-run {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  border: 1px solid var(--bp-border);
  background: var(--bp-surface);
  box-shadow: var(--bp-shadow-sm);
  color: var(--bp-text);
  transition: box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease;
}

.bp-toolbar-btn {
  flex: 0 0 auto;
  padding: 0 7px;
  border-radius: 8px;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 600;
}

.bp-toolbar-btn i {
  color: #26231d;
  font-size: 0.74rem;
}

.bp-toolbar-square,
.bp-toolbar-run {
  width: 32px;
  border-radius: 8px;
}

.bp-toolbar-run {
  background: #181818;
  color: #ffffff;
  border-color: #181818;
}

.bp-toolbar button:hover {
  border-color: rgba(17, 17, 17, 0.22);
  box-shadow: var(--bp-shadow-md);
}

.bp-toolbar-run:hover {
  border-color: #181818;
  background: #262626;
}
</style>
