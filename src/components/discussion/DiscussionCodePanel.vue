<template>
  <div class="discussion-code-panel">
    <div class="right-path-row">
      <img
        class="right-filetype-icon"
        :src="getCodeTypeIconByPath(currentFileName)"
        alt="code type"
      />
      <select
        v-if="currentRoomCodeFiles.length"
        :value="currentCodePath"
        class="right-path-input right-path-select"
        @change="$emit('update:currentCodePath', $event.target.value)"
      >
        <option
          v-for="file in currentRoomCodeFiles"
          :key="file.path"
          :value="file.path"
        >
          {{ file.path }}
        </option>
      </select>
      <input
        v-else
        class="right-path-input"
        type="text"
        :value="currentFileName"
        readonly
      />
      <button
        type="button"
        class="right-plus-btn"
        :disabled="codePanelLoading || !currentChat?.gameId"
        title="刷新当前房间源码"
        @click="$emit('refresh')"
      >
        <i :class="codePanelLoading ? 'fa fa-spinner fa-spin' : 'fa fa-rotate-right'"></i>
      </button>
    </div>

    <div class="right-code-shell">
      <div v-if="codePanelLoading" class="code-empty-state">源码加载中...</div>
      <div v-else-if="codePanelError" class="code-empty-state error">{{ codePanelError }}</div>
      <div v-else-if="!currentChat" class="code-empty-state">请先选择一个讨论房间</div>
      <div v-else-if="!currentRoomCodeFiles.length" class="code-empty-state">当前房间游戏暂无可浏览源码</div>
      <pre v-else class="code-panel"><code class="hljs" v-html="highlightedCodeText"></code></pre>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DiscussionCodePanel',
  props: {
    currentChat: {
      type: Object,
      default: null
    },
    currentRoomCodeFiles: {
      type: Array,
      default: () => []
    },
    currentCodePath: {
      type: String,
      default: ''
    },
    currentFileName: {
      type: String,
      default: ''
    },
    codePanelLoading: {
      type: Boolean,
      default: false
    },
    codePanelError: {
      type: String,
      default: ''
    },
    highlightedCodeText: {
      type: String,
      default: ''
    }
  },
  emits: ['refresh', 'update:currentCodePath'],
  methods: {
    getCodeTypeIconByPath(filePath = '') {
      const normalized = String(filePath || '').toLowerCase()
      if (normalized.endsWith('.ts') || normalized.endsWith('.tsx')) return '/codeType/typescript.jpg'
      if (normalized.endsWith('.cs')) return '/codeType/csharp.webp'
      return '/codeType/js.webp'
    }
  }
}
</script>

<style scoped>
.discussion-code-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.right-path-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 4px;
  border-top: 1px solid #d6d9dd;
  border-bottom: 1px solid #d6d9dd;
  background: #ececec;
}

.right-filetype-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid #bfc4ca;
  background: #ffffff;
  flex-shrink: 0;
}

.right-path-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  border: 1px solid #bfc4ca;
  border-radius: 10px;
  background: #f6f7f8;
  color: #111827;
  font-size: 14px;
  padding: 0 12px;
  outline: none;
}

.right-path-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 36px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath d='M3 5.25L7 9.25L11 5.25' fill='none' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: calc(100% - 16px) center;
  background-size: 14px 14px;
}

.right-plus-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: #05070b;
  color: #ffffff;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 7px 16px rgba(17, 24, 39, 0.22);
}

.right-plus-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.right-code-shell {
  margin: 10px 12px 12px;
  border: 1px solid #bfc4ca;
  border-radius: 14px;
  background: #f1f2f4;
  min-height: 0;
  flex: 1;
  display: flex;
  overflow: hidden;
}

.code-panel {
  flex: 1;
  margin: 0;
  padding: 14px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.5;
  font-family: Consolas, Monaco, monospace;
  white-space: pre-wrap;
  border-radius: 14px;
  background: transparent;
  border: none;
  box-shadow: none;
}

.code-empty-state {
  flex: 1;
  margin: 0;
  padding: 14px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
}

.code-empty-state.error {
  color: #7f1d1d;
}

:deep(.hljs) {
  display: block;
  background: transparent;
  color: #1f2937;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

:deep(.hljs-comment),
:deep(.hljs-quote) {
  color: #6b7280;
  font-style: italic;
}

:deep(.hljs-keyword),
:deep(.hljs-selector-tag),
:deep(.hljs-subst) {
  color: #7c3aed;
}

:deep(.hljs-string),
:deep(.hljs-doctag),
:deep(.hljs-regexp),
:deep(.hljs-template-tag),
:deep(.hljs-template-variable) {
  color: #0f766e;
}

:deep(.hljs-title),
:deep(.hljs-title.function_),
:deep(.hljs-title.class_),
:deep(.hljs-function .hljs-title) {
  color: #0f4c81;
}

:deep(.hljs-number),
:deep(.hljs-literal),
:deep(.hljs-symbol),
:deep(.hljs-bullet) {
  color: #b45309;
}

:deep(.hljs-type),
:deep(.hljs-built_in),
:deep(.hljs-class .hljs-title) {
  color: #1d4ed8;
}

:deep(.hljs-attr),
:deep(.hljs-attribute),
:deep(.hljs-variable),
:deep(.hljs-property) {
  color: #be185d;
}

:deep(.hljs-operator),
:deep(.hljs-punctuation),
:deep(.hljs-meta) {
  color: #475569;
}

@media (max-width: 900px) {
  .right-path-input {
    font-size: 13px;
  }
}
</style>
