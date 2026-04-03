<script setup>
import { computed, ref, watch } from 'vue'
import { BLUEPRINT_COMPACT_NODE_META } from '../../utils/blueprintNodes.js'
import { normalizeBlueprintRuntimeText } from '../../utils/blueprintRuntime.js'

const props = defineProps({
  editor: { type: Object, required: true }
})

const emit = defineEmits(['close', 'save', 'update:draft'])

const editorMeta = computed(() =>
  BLUEPRINT_COMPACT_NODE_META[props.editor.kind] || null
)

const activeRuntimeTab = ref('input')
const activeFileName = ref('')

const runtimeTabs = computed(() => {
  if (!props.editor.runtime) return []

  return [
    { key: 'input', label: '输入' },
    { key: 'process', label: '过程' },
    { key: 'result', label: '结果' },
    { key: 'files', label: '文件' }
  ]
})

const runtimeFiles = computed(() => {
  const directFiles = props.editor.runtime?.artifactJson?.files
  if (directFiles && typeof directFiles === 'object') {
    return Object.entries(directFiles).map(([fileName, content]) => ({
      fileName,
      content: String(content || '')
    }))
  }

  const artifactFiles = Array.isArray(props.editor.runtime?.artifacts)
    ? props.editor.runtime.artifacts
    : []

  return artifactFiles
    .filter((artifact) => artifact?.type === 'file' && artifact?.fileName)
    .map((artifact) => ({
      fileName: String(artifact.fileName),
      content: String(artifact.content || '')
    }))
})

const activeFileContent = computed(() => {
  const targetFile = runtimeFiles.value.find((file) => file.fileName === activeFileName.value)
  return targetFile?.content || ''
})

const browserValidation = computed(() =>
  props.editor.runtime?.artifactJson?.browserValidation || null
)

const runtimeOutputText = computed(() =>
  normalizeBlueprintRuntimeText(props.editor.runtime?.output)
)

watch(
  () => props.editor.runtime,
  () => {
    activeRuntimeTab.value = 'input'
    activeFileName.value = runtimeFiles.value[0]?.fileName || ''
  },
  { immediate: true }
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
      <div class="bp-node-editor-head-copy">
        <strong>{{ editorMeta?.title || '编辑节点' }}</strong>
        <em
          v-if="props.editor.runtime"
          class="bp-node-editor-status"
          :class="`is-${String(props.editor.runtime.status || 'idle')}`"
        >
          {{ props.editor.runtime.status === 'running' ? 'AI 思考中' : (props.editor.runtime.status || 'idle') }}
        </em>
      </div>
      <button
        type="button"
        class="bp-node-editor-close bp-control-button-secondary"
        @click="emit('close')"
      >
        <i class="fa fa-xmark"></i>
      </button>
    </div>
    <div class="bp-node-editor-body">
      <label class="bp-node-editor-field">
        <span>{{ editorMeta?.contentLabel || '内容' }}</span>
        <textarea
          class="bp-textarea-control bp-node-editor-textarea"
          :value="props.editor.draft"
          :placeholder="editorMeta?.contentPlaceholder || '输入内容'"
          data-no-pan
          @input="emit('update:draft', $event.target.value)"
        ></textarea>
      </label>
      <section v-if="props.editor.runtime" class="bp-node-editor-runtime">
        <div class="bp-node-editor-runtime-head">
          <strong>最近一次执行</strong>
        </div>
        <div class="bp-node-editor-tabs">
          <button
            v-for="tab in runtimeTabs"
            :key="tab.key"
            type="button"
            class="bp-node-editor-tab"
            :class="{ 'is-active': activeRuntimeTab === tab.key }"
            @click="activeRuntimeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
        <div v-if="activeRuntimeTab === 'input'" class="bp-node-editor-runtime-panel">
          <p v-if="props.editor.runtime.visibleInputText || props.editor.runtime.input">
            {{ props.editor.runtime.visibleInputText || props.editor.runtime.input }}
          </p>
          <p v-else>当前节点还没有可展示的输入上下文。</p>
        </div>
        <div v-else-if="activeRuntimeTab === 'process'" class="bp-node-editor-runtime-panel">
          <p v-if="props.editor.runtime.progressDetail">进度：{{ props.editor.runtime.progressDetail }}</p>
          <p v-if="props.editor.runtime.summary">摘要：{{ props.editor.runtime.summary }}</p>
          <p v-if="props.editor.runtime.analysis">分析：{{ props.editor.runtime.analysis }}</p>
          <p v-if="props.editor.runtime.model">模型：{{ props.editor.runtime.model }}</p>
          <p v-if="Number.isFinite(Number(props.editor.runtime.retryCount))">修复轮次：{{ props.editor.runtime.retryCount }}</p>
          <p v-if="browserValidation">
            浏览器校验：{{
              browserValidation.skipped
                ? '已跳过'
                : browserValidation.ok
                  ? '已通过'
                  : '失败'
            }}
          </p>
          <p v-if="browserValidation?.issues?.length">
            详情：{{ browserValidation.issues.join('；') }}
          </p>
          <p v-if="props.editor.runtime.errorMessage">错误：{{ props.editor.runtime.errorMessage }}</p>
        </div>
        <div v-else-if="activeRuntimeTab === 'result'" class="bp-node-editor-runtime-panel">
          <pre v-if="runtimeOutputText" class="bp-node-editor-runtime-pre">{{ runtimeOutputText }}</pre>
          <p v-else>当前节点还没有结果输出。</p>
        </div>
        <div v-else class="bp-node-editor-runtime-panel is-files">
          <div v-if="runtimeFiles.length" class="bp-node-editor-file-bar">
            <button
              v-for="file in runtimeFiles"
              :key="file.fileName"
              type="button"
              class="bp-node-editor-file-tab"
              :class="{ 'is-active': activeFileName === file.fileName }"
              @click="activeFileName = file.fileName"
            >
              {{ file.fileName }}
            </button>
          </div>
          <pre v-if="activeFileContent" class="bp-node-editor-file-content">{{ activeFileContent }}</pre>
          <p v-else>当前节点还没有文件产物。</p>
          <a
            v-if="props.editor.previewUrl"
            class="bp-node-editor-preview-link"
            :href="props.editor.previewUrl"
            target="_blank"
            rel="noreferrer"
          >
            打开网页预览
          </a>
        </div>
      </section>
    </div>
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
  position: absolute;
  z-index: 26;
  display: flex;
  flex-direction: column;
  width: calc(360px * var(--bp-ui-scale, 1));
  min-height: calc(292px * var(--bp-ui-scale, 1));
  max-height: min(calc(460px * var(--bp-ui-scale, 1)), 76vh);
  padding: calc(12px * var(--bp-ui-scale, 1));
  box-sizing: border-box;
  pointer-events: auto;
}

.bp-node-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(12px * var(--bp-ui-scale, 1));
  margin-bottom: calc(10px * var(--bp-ui-scale, 1));
}

.bp-node-editor-head-copy {
  display: flex;
  align-items: center;
  gap: calc(8px * var(--bp-ui-scale, 1));
  min-width: 0;
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

.bp-node-editor-body {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: calc(12px * var(--bp-ui-scale, 1));
  overflow-y: auto;
  padding-right: calc(2px * var(--bp-ui-scale, 1));
}

.bp-node-editor-field span {
  color: var(--bp-muted);
  font-size: calc(0.75rem * var(--bp-ui-scale, 1));
  font-weight: 600;
}

.bp-node-editor-field textarea {
  min-height: calc(96px * var(--bp-ui-scale, 1));
  max-height: calc(132px * var(--bp-ui-scale, 1));
  resize: vertical;
}

.bp-node-editor-textarea {
  overflow-y: auto;
}

.bp-node-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: calc(8px * var(--bp-ui-scale, 1));
  margin-top: calc(12px * var(--bp-ui-scale, 1));
  padding-top: calc(4px * var(--bp-ui-scale, 1));
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

.bp-node-editor-runtime {
  display: flex;
  flex: 0 0 auto;
  min-height: 0;
  flex-direction: column;
  gap: calc(6px * var(--bp-ui-scale, 1));
  border-top: 1px solid rgba(17, 17, 17, 0.08);
  padding-top: calc(12px * var(--bp-ui-scale, 1));
}

.bp-node-editor-runtime-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(8px * var(--bp-ui-scale, 1));
}

.bp-node-editor-runtime strong {
  font-size: calc(0.8rem * var(--bp-ui-scale, 1));
}

.bp-node-editor-status {
  display: inline-flex;
  align-items: center;
  min-height: calc(22px * var(--bp-ui-scale, 1));
  padding: 0 calc(8px * var(--bp-ui-scale, 1));
  border-radius: 999px;
  background: #f1f1f1;
  color: #5f5f5f;
  font-size: calc(0.68rem * var(--bp-ui-scale, 1));
  font-style: normal;
  font-weight: 700;
  text-transform: lowercase;
}

.bp-node-editor-status.is-running {
  background: #edf3ff;
  color: #2b63c8;
}

.bp-node-editor-status.is-completed {
  background: #ebf8ee;
  color: #257647;
}

.bp-node-editor-status.is-failed {
  background: #ffe7e7;
  color: #a22f2f;
}

.bp-node-editor-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: calc(6px * var(--bp-ui-scale, 1));
}

.bp-node-editor-tab,
.bp-node-editor-file-tab {
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #5f5f5f;
  cursor: pointer;
  font-size: calc(0.68rem * var(--bp-ui-scale, 1));
  font-weight: 700;
  line-height: 1;
}

.bp-node-editor-tab {
  min-height: calc(28px * var(--bp-ui-scale, 1));
  padding: 0 calc(10px * var(--bp-ui-scale, 1));
}

.bp-node-editor-tab.is-active,
.bp-node-editor-file-tab.is-active {
  border-color: rgba(17, 17, 17, 0.16);
  background: #181818;
  color: #ffffff;
}

.bp-node-editor-runtime-panel {
  display: flex;
  flex-direction: column;
  flex: 0 1 auto;
  min-height: calc(88px * var(--bp-ui-scale, 1));
  max-height: calc(176px * var(--bp-ui-scale, 1));
  gap: calc(6px * var(--bp-ui-scale, 1));
  padding: calc(10px * var(--bp-ui-scale, 1));
  border-radius: calc(12px * var(--bp-ui-scale, 1));
  background: rgba(248, 245, 239, 0.88);
  overflow-y: auto;
}

.bp-node-editor-runtime p {
  margin: 0;
  color: #5f5f5f;
  font-size: calc(0.72rem * var(--bp-ui-scale, 1));
  line-height: 1.4;
  white-space: pre-wrap;
}

.bp-node-editor-runtime-pre {
  margin: 0;
  color: #5f5f5f;
  font-size: calc(0.72rem * var(--bp-ui-scale, 1));
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.bp-node-editor-file-bar {
  display: flex;
  flex-wrap: wrap;
  flex: 0 0 auto;
  gap: calc(6px * var(--bp-ui-scale, 1));
}

.bp-node-editor-file-tab {
  min-height: calc(24px * var(--bp-ui-scale, 1));
  padding: 0 calc(8px * var(--bp-ui-scale, 1));
}

.bp-node-editor-file-content {
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: calc(10px * var(--bp-ui-scale, 1));
  border-radius: calc(10px * var(--bp-ui-scale, 1));
  background: rgba(255, 255, 255, 0.9);
  color: #403a31;
  font-size: calc(0.7rem * var(--bp-ui-scale, 1));
  line-height: 1.5;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.bp-node-editor-runtime-panel.is-files {
  gap: calc(10px * var(--bp-ui-scale, 1));
}

.bp-node-editor-preview-link {
  color: #8a5e00;
  font-size: calc(0.7rem * var(--bp-ui-scale, 1));
  font-weight: 700;
  text-decoration: none;
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
