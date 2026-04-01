<script setup>
const props = defineProps({
  position: { type: Object, required: true },
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
  'clear-history',
  'cancel-latest-run',
  'continue-latest-run'
])

const resolveLogLineText = (line) => {
  if (typeof line === 'string') return line
  return String(line?.text || '')
}
</script>

<template>
  <section
    class="bp-log-panel bp-control-surface"
    :style="{
      left: `${props.position.x}px`,
      top: `${props.position.y}px`
    }"
    data-no-pan
  >
    <header class="bp-log-panel-header" data-no-pan>
      <div class="bp-log-panel-title">
        <i class="fa fa-bars-staggered" aria-hidden="true"></i>
        <span>生成日志</span>
      </div>
      <div class="bp-log-panel-actions">
        <span v-if="props.latestRunId" class="bp-log-panel-run-id">
          Run #{{ props.latestRunId }}
        </span>
        <button
          v-if="props.canClearHistory"
          type="button"
          class="bp-log-panel-action"
          @click="emit('clear-history')"
        >
          清空记录
        </button>
        <button
          v-if="props.canCancelLatestRun"
          type="button"
          class="bp-log-panel-action"
          @click="emit('cancel-latest-run')"
        >
          取消运行
        </button>
        <button
          v-if="props.canContinueFailedRun"
          type="button"
          class="bp-log-panel-action"
          @click="emit('continue-latest-run')"
        >
          从失败节点继续
        </button>
      </div>
    </header>
    <div class="bp-log-panel-body" data-no-pan>
      <section
        v-if="props.shouldShowOutputCard"
        class="bp-log-output-card"
      >
        <div class="bp-log-output-head">
          <div>
            <strong>最近产物</strong>
            <span>{{ props.latestOutputFileEntries.length }} 个文件</span>
          </div>
          <a
            v-if="props.latestPreviewUrl"
            class="bp-log-output-link"
            :href="props.latestPreviewUrl"
            target="_blank"
            rel="noreferrer"
          >
            打开预览
          </a>
        </div>
        <div v-if="props.latestOutputFileEntries.length" class="bp-log-output-files">
          <span
            v-for="file in props.latestOutputFileEntries"
            :key="file.fileName"
            class="bp-log-output-file"
          >
            {{ file.fileName }}
          </span>
        </div>
        <iframe
          v-if="props.latestPreviewUrl"
          class="bp-log-output-iframe"
          :src="props.latestPreviewUrl"
          title="Blueprint H5 预览"
          loading="lazy"
        ></iframe>
        <pre
          v-if="props.latestOutputReadmeSnippet"
          class="bp-log-output-readme"
        >{{ props.latestOutputReadmeSnippet }}</pre>
      </section>
      <div v-if="props.shouldShowRunHistory" class="bp-log-run-list">
        <article
          v-for="run in props.recentRuns"
          :key="run.id"
          class="bp-log-run-item"
        >
          <div class="bp-log-run-meta">
            <strong>#{{ run.id }}</strong>
            <span>{{ run.model || '未知模型' }}</span>
          </div>
          <div class="bp-log-run-row">
            <span
              class="bp-log-run-status"
              :class="`is-${String(run.status || 'pending')}`"
            >
              {{ props.formatRunStatusLabel(run.status) }}
            </span>
            <div class="bp-log-run-actions">
              <button
                v-if="run.continuation?.nodeId && run.status === 'failed'"
                type="button"
                class="bp-log-run-mini-btn"
                @click="emit('continue-latest-run', run.id)"
              >
                续跑
              </button>
              <button
                v-if="['running', 'cancel_requested'].includes(String(run.status || ''))"
                type="button"
                class="bp-log-run-mini-btn"
                @click="emit('cancel-latest-run', run.id)"
              >
                取消
              </button>
            </div>
          </div>
        </article>
      </div>
      <p v-if="!props.logs.length" class="bp-log-panel-empty">暂无日志</p>
      <p
        v-for="(line, index) in props.logs"
        :key="line?.id || index"
        :class="['bp-log-line', `is-${String(line?.level || 'info')}`]"
      >
        {{ resolveLogLineText(line) }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.bp-log-panel {
  position: absolute;
  z-index: 7;
  width: 360px;
  height: min(420px, calc(100dvh - 112px));
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 36px rgba(32, 24, 11, 0.14);
  overflow: hidden;
  pointer-events: auto;
}

.bp-log-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
  background: linear-gradient(180deg, rgba(252, 251, 248, 0.98), rgba(245, 241, 234, 0.98));
}

.bp-log-panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #171513;
  font-size: 0.84rem;
  font-weight: 700;
}

.bp-log-panel-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.bp-log-panel-run-id {
  color: #8b8274;
  font-size: 0.7rem;
  white-space: nowrap;
}

.bp-log-panel-action {
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 999px;
  padding: 5px 9px;
  background: rgba(255, 255, 255, 0.82);
  color: #2f2a22;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
}

.bp-log-panel-action:hover {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(17, 17, 17, 0.2);
  transform: translateY(-1px);
}

.bp-log-panel-body {
  flex: 1;
  min-height: 0;
  padding: 12px 14px;
  overflow: auto;
}

.bp-log-output-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  min-height: 0;
  padding: 11px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(251, 249, 244, 0.96), rgba(245, 241, 233, 0.94));
}

.bp-log-output-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.bp-log-output-head strong,
.bp-log-output-head span {
  display: block;
}

.bp-log-output-head strong {
  color: #171513;
  font-size: 0.78rem;
}

.bp-log-output-head span {
  margin-top: 4px;
  color: #7d7569;
  font-size: 0.68rem;
}

.bp-log-output-link {
  color: #946400;
  font-size: 0.7rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.bp-log-output-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bp-log-output-file {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #4f483d;
  font-size: 0.68rem;
  font-weight: 600;
}

.bp-log-output-iframe {
  width: 100%;
  height: 180px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  background: #ffffff;
}

.bp-log-output-readme {
  margin: 0;
  padding: 10px;
  max-height: 140px;
  overflow: auto;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.74);
  color: #5a5347;
  font-size: 0.7rem;
  line-height: 1.55;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.bp-log-run-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.bp-log-run-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  background: rgba(248, 245, 239, 0.85);
}

.bp-log-run-meta,
.bp-log-run-row,
.bp-log-run-actions {
  display: flex;
  align-items: center;
}

.bp-log-run-meta,
.bp-log-run-row {
  justify-content: space-between;
  gap: 8px;
}

.bp-log-run-meta strong {
  color: #171513;
  font-size: 0.74rem;
}

.bp-log-run-meta span {
  color: #7d7569;
  font-size: 0.7rem;
}

.bp-log-run-actions {
  gap: 6px;
}

.bp-log-run-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
  color: #544b3f;
  background: rgba(138, 129, 118, 0.14);
}

.bp-log-run-status.is-completed {
  color: #14633c;
  background: rgba(42, 167, 103, 0.16);
}

.bp-log-run-status.is-failed {
  color: #8a2d2d;
  background: rgba(215, 90, 90, 0.16);
}

.bp-log-run-status.is-running,
.bp-log-run-status.is-cancel_requested {
  color: #85580d;
  background: rgba(224, 171, 74, 0.2);
}

.bp-log-run-status.is-cancelled {
  color: #5b556a;
  background: rgba(131, 126, 151, 0.16);
}

.bp-log-run-mini-btn {
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.82);
  color: #2f2a22;
  font-size: 0.68rem;
  line-height: 1;
  cursor: pointer;
}

.bp-log-line {
  margin: 0;
  color: #5c554a;
  font-size: 0.78rem;
  line-height: 1.65;
}

.bp-log-line + .bp-log-line {
  margin-top: 8px;
}

.bp-log-line.is-warning {
  color: #946400;
}

.bp-log-line.is-error {
  color: #8a2d2d;
}

.bp-log-panel-empty {
  color: #9a9388;
}
</style>
