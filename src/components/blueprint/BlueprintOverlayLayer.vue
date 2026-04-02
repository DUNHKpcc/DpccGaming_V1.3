<script setup>
import BlueprintNodeContextMenu from './BlueprintNodeContextMenu.vue'
import BlueprintNodeEditorPanel from './BlueprintNodeEditorPanel.vue'
import BlueprintLogPanel from './BlueprintLogPanel.vue'

const props = defineProps({
  activeContextMenu: { type: Object, default: null },
  activeEditor: { type: Object, default: null },
  logPanelPosition: { type: Object, required: true },
  latestRunId: { type: String, default: '' },
  canClearHistory: { type: Boolean, default: false },
  canCancelLatestRun: { type: Boolean, default: false },
  canContinueFailedRun: { type: Boolean, default: false },
  shouldShowOutputCard: { type: Boolean, default: false },
  latestOutputFileEntries: { type: Array, default: () => [] },
  latestPreviewUrl: { type: String, default: '' },
  latestOutputReadmeSnippet: { type: String, default: '' },
  shouldShowRunHistory: { type: Boolean, default: false },
  recentRuns: { type: Array, default: () => [] },
  logs: { type: Array, default: () => [] },
  formatRunStatusLabel: { type: Function, required: true }
})

const emit = defineEmits([
  'rerun-node',
  'continue-from-node',
  'edit-node',
  'delete-node',
  'close-overlays',
  'save-editor',
  'update-editor-draft',
  'clear-history',
  'cancel-latest-run',
  'continue-latest-run'
])
</script>

<template>
  <BlueprintNodeContextMenu
    v-if="props.activeContextMenu"
    :menu="props.activeContextMenu"
    @rerun-node="emit('rerun-node', $event)"
    @continue-from-node="emit('continue-from-node', $event)"
    @edit="emit('edit-node', $event)"
    @delete="emit('delete-node', $event)"
  />

  <BlueprintNodeEditorPanel
    v-if="props.activeEditor"
    :editor="props.activeEditor"
    @close="emit('close-overlays')"
    @save="emit('save-editor')"
    @update:draft="emit('update-editor-draft', $event)"
  />

  <BlueprintLogPanel
    :position="props.logPanelPosition"
    :latest-run-id="props.latestRunId"
    :can-clear-history="props.canClearHistory"
    :can-cancel-latest-run="props.canCancelLatestRun"
    :can-continue-failed-run="props.canContinueFailedRun"
    :should-show-output-card="props.shouldShowOutputCard"
    :latest-output-file-entries="props.latestOutputFileEntries"
    :latest-preview-url="props.latestPreviewUrl"
    :latest-output-readme-snippet="props.latestOutputReadmeSnippet"
    :should-show-run-history="props.shouldShowRunHistory"
    :recent-runs="props.recentRuns"
    :logs="props.logs"
    :format-run-status-label="props.formatRunStatusLabel"
    @clear-history="emit('clear-history')"
    @cancel-latest-run="emit('cancel-latest-run')"
    @continue-latest-run="emit('continue-latest-run')"
  />
</template>
