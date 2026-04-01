<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  BLUEPRINT_FAVORITE_NODE_KEYS,
  BLUEPRINT_LIBRARY_GROUPS,
  BLUEPRINT_QUICK_PICK_NODE_KEYS,
  buildBlueprintToolbarNodeButtons
} from '../../utils/blueprintToolbar.js'

const emit = defineEmits(['action', 'save', 'run'])

const toolbarRef = ref(null)
const isLibraryOpen = ref(false)
const isQuickPickOpen = ref(false)

const favoriteButtons = computed(() =>
  buildBlueprintToolbarNodeButtons(BLUEPRINT_FAVORITE_NODE_KEYS)
)

const quickPickButtons = computed(() =>
  buildBlueprintToolbarNodeButtons(BLUEPRINT_QUICK_PICK_NODE_KEYS)
)

const libraryGroups = computed(() =>
  BLUEPRINT_LIBRARY_GROUPS.map((group) => ({
    ...group,
    buttons: buildBlueprintToolbarNodeButtons(group.nodeKeys)
  }))
)

const closeMenus = () => {
  isLibraryOpen.value = false
  isQuickPickOpen.value = false
}

const emitNodeAction = (actionKey) => {
  closeMenus()
  emit('action', actionKey)
}

const toggleLibrary = () => {
  isLibraryOpen.value = !isLibraryOpen.value
  if (isLibraryOpen.value) {
    isQuickPickOpen.value = false
  }
}

const toggleQuickPick = () => {
  isQuickPickOpen.value = !isQuickPickOpen.value
  if (isQuickPickOpen.value) {
    isLibraryOpen.value = false
  }
}

const handleDocumentPointerDown = (event) => {
  if (toolbarRef.value?.contains(event.target)) return
  closeMenus()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <div ref="toolbarRef" class="bp-toolbar">
    <div class="bp-toolbar-main">
      <div class="bp-toolbar-anchor">
        <button
          type="button"
          class="bp-toolbar-btn bp-control-surface bp-control-button bp-control-button-hover-highlight"
          :class="{ 'is-active': isLibraryOpen }"
          data-no-pan
          @click.stop="toggleLibrary"
        >
          <i class="fa fa-plus"></i>
          <span>添加节点</span>
        </button>

        <div
          v-if="isLibraryOpen"
          class="bp-toolbar-popover bp-toolbar-library bp-floating-panel"
          data-no-pan
          @pointerdown.stop
          @click.stop
        >
          <section
            v-for="group in libraryGroups"
            :key="group.key"
            class="bp-toolbar-library-section"
          >
            <strong>{{ group.title }}</strong>
            <div class="bp-toolbar-library-grid">
              <button
                v-for="button in group.buttons"
                :key="button.key"
                type="button"
                class="bp-toolbar-library-btn bp-control-button"
                @click="emitNodeAction(button.key)"
              >
                <i :class="button.icon"></i>
                <span>{{ button.label }}</span>
                <small>{{ button.subtitle }}</small>
              </button>
            </div>
          </section>
        </div>
      </div>

      <button
        v-for="button in favoriteButtons"
        :key="button.key"
        type="button"
        class="bp-toolbar-btn bp-control-surface bp-control-button bp-control-button-hover-highlight"
        data-no-pan
        @click="emitNodeAction(button.key)"
      >
        <i :class="button.icon"></i>
        <span>{{ button.label }}</span>
      </button>

      <div class="bp-toolbar-anchor">
        <button
          type="button"
          class="bp-toolbar-square bp-control-surface bp-control-button bp-control-button-hover-highlight"
          :class="{ 'is-active': isQuickPickOpen }"
          title="更多常用节点"
          data-no-pan
          @click.stop="toggleQuickPick"
        >
          <i class="fa fa-plus"></i>
        </button>

        <div
          v-if="isQuickPickOpen"
          class="bp-toolbar-popover bp-toolbar-quick-pick bp-floating-panel"
          data-no-pan
          @pointerdown.stop
          @click.stop
        >
          <button
            v-for="button in quickPickButtons"
            :key="button.key"
            type="button"
            class="bp-floating-menu-button bp-toolbar-menu-button"
            @click="emitNodeAction(button.key)"
          >
            <i :class="button.icon"></i>
            <span>{{ button.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="bp-toolbar-side">
      <button
        type="button"
        class="bp-toolbar-square bp-control-surface bp-control-button bp-control-button-hover-highlight"
        data-no-pan
        @click="emit('save')"
      >
        <i class="fa fa-save"></i>
      </button>
      <button
        type="button"
        class="bp-toolbar-run bp-control-button bp-control-button-dark bp-control-button-hover-highlight"
        data-no-pan
        @click="emit('run')"
      >
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
  overflow: visible;
  scrollbar-width: none;
}

.bp-toolbar-main::-webkit-scrollbar {
  display: none;
}

.bp-toolbar-anchor {
  position: relative;
  flex: 0 0 auto;
}

.bp-toolbar-popover {
  top: calc(100% + calc(8px * var(--bp-ui-scale, 1)));
  left: 0;
  padding: calc(10px * var(--bp-ui-scale, 1));
}

.bp-toolbar-library {
  width: min(calc(720px * var(--bp-ui-scale, 1)), calc(100vw - 180px));
}

.bp-toolbar-quick-pick {
  left: auto;
  right: 0;
  min-width: calc(168px * var(--bp-ui-scale, 1));
  display: flex;
  flex-direction: column;
  gap: calc(4px * var(--bp-ui-scale, 1));
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

.bp-toolbar-btn i,
.bp-toolbar-square i {
  color: #26231d;
  font-size: calc(0.74rem * var(--bp-ui-scale));
}

.bp-toolbar-btn.is-active,
.bp-toolbar-square.is-active {
  border-color: rgba(17, 17, 17, 0.28);
  box-shadow: var(--bp-shadow-md);
}

.bp-toolbar-square,
.bp-toolbar-run {
  width: clamp(calc(30px * var(--bp-ui-scale)), 2.9vw, calc(32px * var(--bp-ui-scale)));
  border-radius: calc(8px * var(--bp-ui-scale));
}

.bp-toolbar-run {
  color: #ffffff;
}

.bp-toolbar-library-section + .bp-toolbar-library-section {
  margin-top: calc(12px * var(--bp-ui-scale, 1));
  padding-top: calc(12px * var(--bp-ui-scale, 1));
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

.bp-toolbar-library-section strong {
  display: block;
  margin-bottom: calc(8px * var(--bp-ui-scale, 1));
  color: #4c4c4c;
  font-size: calc(0.74rem * var(--bp-ui-scale, 1));
  font-weight: 700;
  letter-spacing: 0.02em;
}

.bp-toolbar-library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(136px * var(--bp-ui-scale, 1)), 1fr));
  gap: calc(8px * var(--bp-ui-scale, 1));
}

.bp-toolbar-library-btn {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: calc(4px * var(--bp-ui-scale, 1)) calc(8px * var(--bp-ui-scale, 1));
  align-items: center;
  min-height: calc(58px * var(--bp-ui-scale, 1));
  padding: calc(10px * var(--bp-ui-scale, 1));
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: calc(8px * var(--bp-ui-scale, 1));
  background: rgba(255, 255, 255, 0.92);
  color: var(--bp-text);
  text-align: left;
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.bp-toolbar-library-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(17, 17, 17, 0.18);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.06);
}

.bp-toolbar-library-btn i {
  grid-row: span 2;
  color: #222222;
  font-size: calc(0.92rem * var(--bp-ui-scale, 1));
}

.bp-toolbar-library-btn span {
  font-size: calc(0.8rem * var(--bp-ui-scale, 1));
  font-weight: 700;
  line-height: 1.15;
}

.bp-toolbar-library-btn small {
  color: #727272;
  font-size: calc(0.68rem * var(--bp-ui-scale, 1));
  line-height: 1.15;
}

.bp-toolbar-menu-button {
  width: 100%;
  justify-content: flex-start;
}

@media (max-width: 1200px) {
  .bp-toolbar-btn {
    min-height: calc(32px * var(--bp-ui-scale));
  }

  .bp-toolbar-btn i {
    font-size: calc(0.7rem * var(--bp-ui-scale));
  }

  .bp-toolbar-library {
    width: min(calc(540px * var(--bp-ui-scale, 1)), calc(100vw - 120px));
  }
}
</style>
