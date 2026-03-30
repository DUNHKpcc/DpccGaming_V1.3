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
        class="bp-toolbar-btn bp-control-surface bp-control-button bp-control-button-hover-highlight"
        @click="emit('action', button.key)"
      >
        <i :class="button.icon"></i>
        <span>{{ button.label }}</span>
      </button>
      <button type="button" class="bp-toolbar-square bp-control-surface bp-control-button bp-control-button-hover-highlight">
        <i class="fa fa-plus"></i>
      </button>
    </div>

    <div class="bp-toolbar-side">
      <button type="button" class="bp-toolbar-square bp-control-surface bp-control-button bp-control-button-hover-highlight">
        <i class="fa fa-save"></i>
      </button>
      <button type="button" class="bp-toolbar-run bp-control-button bp-control-button-dark bp-control-button-hover-highlight">
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
  gap: clamp(6px, 0.8vw, 8px);
  width: auto;
  padding: 0;
}

.bp-toolbar-main,
.bp-toolbar-side {
  display: flex;
  align-items: center;
  gap: clamp(6px, 0.8vw, 9px);
  min-width: 0;
}

.bp-toolbar-side {
  flex: 0 0 auto;
  margin-right: clamp(8px, 1.6vw, 30px);
}

.bp-toolbar-main {
  flex: 1;
  overflow: auto hidden;
  scrollbar-width: none;
}

.bp-toolbar-main::-webkit-scrollbar {
  display: none;
}

.bp-toolbar-btn,
.bp-toolbar-square,
.bp-toolbar-run {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(6px * var(--bp-ui-scale));
  min-height: calc(34px * var(--bp-ui-scale));
  color: var(--bp-text);
}

.bp-toolbar-btn {
  flex: 0 0 auto;
  padding: 0 clamp(6px, 0.75vw, 8px);
  border-radius: calc(8px * var(--bp-ui-scale));
  white-space: nowrap;
  font-size: clamp(calc(0.74rem * var(--bp-ui-scale)), calc(0.69rem * var(--bp-ui-scale)) + 0.15vw, calc(0.78rem * var(--bp-ui-scale)));
  font-weight: 600;
}

.bp-toolbar-btn i {
  color: #26231d;
  font-size: calc(0.74rem * var(--bp-ui-scale));
}

.bp-toolbar-square,
.bp-toolbar-run {
  width: clamp(calc(30px * var(--bp-ui-scale)), 2.9vw, calc(32px * var(--bp-ui-scale)));
  border-radius: calc(8px * var(--bp-ui-scale));
}

.bp-toolbar-run {
  color: #ffffff;
}

@media (max-width: 1200px) {
  .bp-toolbar-btn {
    min-height: calc(32px * var(--bp-ui-scale));
  }

  .bp-toolbar-btn i {
    font-size: calc(0.7rem * var(--bp-ui-scale));
  }
}
</style>
