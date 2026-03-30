<script setup>
const props = defineProps({
  menu: { type: Object, required: true }
})

const emit = defineEmits(['edit', 'delete'])
</script>

<template>
  <div
    class="bp-node-context-menu bp-floating-panel"
    :style="{
      left: `${props.menu.position.x}px`,
      top: `${props.menu.position.y}px`
    }"
    data-no-pan
    @pointerdown.stop
    @click.stop
    @contextmenu.prevent.stop
  >
    <button
      v-if="props.menu.kind !== 'game'"
      type="button"
      class="bp-node-menu-btn bp-floating-menu-button"
      @click="emit('edit', props.menu.nodeId)"
    >
      <i class="fa fa-pen"></i>
      <span>编辑节点</span>
    </button>
    <button
      type="button"
      class="bp-node-menu-btn bp-floating-menu-button is-danger"
      @click="emit('delete', props.menu.nodeId)"
    >
      <i class="fa fa-trash"></i>
      <span>删除节点</span>
    </button>
  </div>
</template>

<style scoped>
.bp-node-context-menu {
  display: flex;
  flex-direction: column;
  gap: calc(4px * var(--bp-ui-scale, 1));
  width: calc(152px * var(--bp-ui-scale, 1));
  padding: calc(8px * var(--bp-ui-scale, 1));
}

.bp-node-menu-btn.is-danger {
  color: #8a2222;
}
</style>
