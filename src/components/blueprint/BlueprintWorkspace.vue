<script setup>
import { BP_WORLD_HEIGHT, BP_WORLD_WIDTH } from '../../utils/blueprintNodes.js'
import BlueprintToolbar from './BlueprintToolbar.vue'
import BlueprintCanvasStage from './BlueprintCanvasStage.vue'
import BlueprintWorldLayer from './BlueprintWorldLayer.vue'
import BlueprintOverlayLayer from './BlueprintOverlayLayer.vue'

const props = defineProps({
  busy: { type: Boolean, default: false },
  planning: { type: Boolean, default: false },
  planningLabel: { type: String, default: '' },
  promptValue: { type: String, default: '' },
  promptDisabled: { type: Boolean, default: false },
  showEmptyState: { type: Boolean, default: false },
  renderedEdges: { type: Array, default: () => [] },
  previewEdgePath: { type: String, default: '' },
  previewEdgeStroke: { type: String, default: '#8c8c8c' },
  gameNodes: { type: Array, default: () => [] },
  compactNodes: { type: Array, default: () => [] },
  nodeRuntimeMap: { type: Object, default: () => ({}) },
  selectedNodeId: { type: String, default: '' },
  highlightedNodeId: { type: String, default: '' },
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
  'toolbar-action',
  'save-workflow',
  'execute-workflow',
  'canvas-ready',
  'drop-game',
  'update:prompt',
  'submit-prompt',
  'select-node',
  'drag-start',
  'start-link',
  'context-menu',
  'measure-node',
  'unmount-node',
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
  <BlueprintToolbar
    @action="emit('toolbar-action', $event)"
    @save="emit('save-workflow')"
    @run="emit('execute-workflow')"
  />

  <BlueprintCanvasStage
    :busy="props.busy"
    :planning="props.planning"
    :planning-label="props.planningLabel"
    :prompt-value="props.promptValue"
    :prompt-disabled="props.promptDisabled"
    :show-empty-state="props.showEmptyState"
    placeholder="直接描述需求，AI 会自动调用合适节点并生成工作流"
    @canvas-ready="emit('canvas-ready', $event)"
    @drop-game="emit('drop-game', $event)"
    @update:prompt="emit('update:prompt', $event)"
    @submit-prompt="emit('submit-prompt')"
  >
    <template #world="{ screenToWorldPoint }">
      <BlueprintWorldLayer
        :rendered-edges="props.renderedEdges"
        :preview-edge-path="props.previewEdgePath"
        :preview-edge-stroke="props.previewEdgeStroke"
        :game-nodes="props.gameNodes"
        :compact-nodes="props.compactNodes"
        :node-runtime-map="props.nodeRuntimeMap"
        :selected-node-id="props.selectedNodeId"
        :highlighted-node-id="props.highlightedNodeId"
        :screen-to-world-point="screenToWorldPoint"
        :world-width="BP_WORLD_WIDTH"
        :world-height="BP_WORLD_HEIGHT"
        @select-node="emit('select-node', $event)"
        @drag-start="(payload, point) => emit('drag-start', payload, point)"
        @start-link="(payload, point) => emit('start-link', payload, point)"
        @context-menu="(payload, point) => emit('context-menu', payload, point)"
        @measure-node="emit('measure-node', $event)"
        @unmount-node="emit('unmount-node', $event)"
      />
    </template>

    <template #overlay>
      <BlueprintOverlayLayer
        :active-context-menu="props.activeContextMenu"
        :active-editor="props.activeEditor"
        :log-panel-position="props.logPanelPosition"
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
        @rerun-node="emit('rerun-node', $event)"
        @continue-from-node="emit('continue-from-node', $event)"
        @edit-node="emit('edit-node', $event)"
        @delete-node="emit('delete-node', $event)"
        @close-overlays="emit('close-overlays')"
        @save-editor="emit('save-editor')"
        @update-editor-draft="emit('update-editor-draft', $event)"
        @clear-history="emit('clear-history')"
        @cancel-latest-run="emit('cancel-latest-run')"
        @continue-latest-run="emit('continue-latest-run')"
      />
    </template>
  </BlueprintCanvasStage>
</template>
