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
      <button v-for="button in buttons" :key="button.key" type="button" class="bp-toolbar-btn">
        <i :class="button.icon"></i>
        <span>{{ button.label }}</span>
      </button>
      <button type="button" class="bp-toolbar-square"><i class="fa fa-plus"></i></button>
    </div>

    <div class="bp-toolbar-side">
      <button type="button" class="bp-toolbar-square"><i class="fa fa-download"></i></button>
      <button type="button" class="bp-toolbar-run"><i class="fa fa-play"></i></button>
    </div>
  </div>
</template>

<style scoped>
.bp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(207, 224, 250, 0.1);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(15, 24, 38, 0.96), rgba(8, 14, 24, 0.92)),
    radial-gradient(circle at top, rgba(87, 145, 255, 0.14), transparent 45%);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(18px);
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
  gap: 10px;
  min-height: 46px;
  border: 1px solid rgba(207, 224, 250, 0.12);
  background: rgba(9, 18, 31, 0.84);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
  color: #edf4ff;
  backdrop-filter: blur(14px);
}

.bp-toolbar-btn {
  flex: 0 0 auto;
  padding: 0 16px;
  border-radius: 16px;
  white-space: nowrap;
  font-size: 0.9rem;
}

.bp-toolbar-btn i {
  color: #8eb8ff;
}

.bp-toolbar-square,
.bp-toolbar-run {
  width: 46px;
  border-radius: 16px;
}

.bp-toolbar-run {
  background: linear-gradient(135deg, #5ea2ff 0%, #7ed0ff 100%);
  color: #04101d;
}

@media (max-width: 960px) {
  .bp-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .bp-toolbar-main,
  .bp-toolbar-side {
    justify-content: flex-start;
  }
}
</style>
