<script setup>
const buttons = [
  { key: 'add-node', icon: 'fa fa-plus', label: '添加节点' },
  { key: 'prompt-positive', icon: 'fa fa-wand-magic-sparkles', label: '正向提示词' },
  { key: 'prompt-negative', icon: 'fa fa-arrows-rotate', label: '反向提示词' },
  { key: 'mixer', icon: 'fa fa-link', label: 'Mixer' },
  { key: 'design', icon: 'fa fa-map', label: '游戏设定' },
  { key: 'play', icon: 'fa fa-gamepad', label: '游戏玩法' },
  { key: 'music', icon: 'fa fa-music', label: '游戏音乐' },
  { key: 'import-selected', icon: 'fa fa-arrow-down-to-line', label: '导入选中游戏' }
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 0;
}

.bp-toolbar-main,
.bp-toolbar-side {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
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
  gap: 8px;
  min-height: 40px;
  border: 1px solid var(--bp-border);
  background: var(--bp-surface);
  box-shadow: var(--bp-shadow-sm);
  color: var(--bp-text);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.bp-toolbar-btn {
  flex: 0 0 auto;
  padding: 0 16px;
  border-radius: 8px;
  white-space: nowrap;
  font-size: 0.88rem;
  font-weight: 600;
}

.bp-toolbar-btn i {
  color: #26231d;
  font-size: 0.85rem;
}

.bp-toolbar-square,
.bp-toolbar-run {
  width: 40px;
  border-radius: 8px;
}

.bp-toolbar-run {
  background: #181818;
  color: #ffffff;
  border-color: #181818;
}

.bp-toolbar button:hover {
  transform: translateY(-1px);
  box-shadow: var(--bp-shadow-md);
}
</style>
