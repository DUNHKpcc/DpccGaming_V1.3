<script setup>
import { computed } from 'vue'
import BlueprintNodePorts from './BlueprintNodePorts.vue'
import BlueprintNodeProgressPanel from './BlueprintNodeProgressPanel.vue'
import BlueprintNodeAiBadge from './BlueprintNodeAiBadge.vue'
import { useBlueprintNodeInteractions } from './useBlueprintNodeInteractions.js'
import { getGameCodeTypeIconByValue } from '../../utils/gameMetadata'
import { normalizeBlueprintRuntimeText } from '../../utils/blueprintRuntime.js'

const props = defineProps({
  node: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false },
  runtime: { type: Object, default: null }
})

const emit = defineEmits(['select', 'drag-start', 'start-link', 'measure', 'unmount', 'context-menu'])
const {
  nodeRef,
  onPointerDown,
  onPortPointerDown,
  onContextMenu
} = useBlueprintNodeInteractions(props, emit)

const nodeStyle = computed(() => ({
  left: `${props.node.position.x}px`,
  top: `${props.node.position.y}px`,
  '--bp-compact-icon-background': props.node.iconBackground || '#ededed',
  '--bp-compact-icon-color': props.node.iconColor || '#111111'
}))

const languageIcon = computed(() => {
  if (props.node.kind === 'language') {
    return getGameCodeTypeIconByValue(props.node.content || '')
  }

  return ''
})

const runtimeStatusLabel = computed(() => {
  if (props.runtime?.status === 'running') return 'AI 思考中'
  if (props.runtime?.status === 'failed') return '失败'
  if (props.runtime?.status === 'completed') return '已完成'
  return ''
})

const runtimeProgressCopy = computed(() =>
  String(
    props.runtime?.progressDetail
    || props.runtime?.summary
    || ''
  ).trim()
)

const runtimePreview = computed(() =>
  {
    if (props.runtime?.status === 'running') {
      return runtimeProgressCopy.value || '正在分析当前节点输入与上下文'
    }

    if (props.runtime?.artifactType === 'file-bundle') {
      const fileCount = Object.keys(props.runtime?.artifactJson?.files || {}).length
      if (fileCount) {
        return `已生成 ${fileCount} 个文件`
      }
    }

    return normalizeBlueprintRuntimeText(
      props.runtime?.output
      || props.runtime?.summary
      || props.node.content
      || props.node.subtitle
      || ''
    )
  }
)
</script>

<template>
  <article
    ref="nodeRef"
    class="bp-node-frame bp-compact-node"
    :class="{
      'is-selected': props.selected,
      'is-highlighted': props.highlighted,
      'is-running': props.runtime?.status === 'running'
    }"
    :style="nodeStyle"
    data-no-pan
    @click="emit('select', props.node.id)"
    @pointerdown.stop="onPointerDown"
    @contextmenu.prevent.stop="onContextMenu"
  >
    <BlueprintNodePorts
      :node-id="props.node.id"
      @start-link="onPortPointerDown"
    />
    <BlueprintNodeAiBadge :runtime="props.runtime" />

    <span class="bp-compact-node-icon" :class="{ 'has-logo': Boolean(languageIcon) }" aria-hidden="true">
      <img v-if="languageIcon" :src="languageIcon" alt="" />
      <i v-else :class="props.node.iconClass"></i>
    </span>
    <div class="bp-compact-node-copy" data-no-pan>
      <strong>{{ props.node.title }}</strong>
      <div class="bp-compact-node-preview">
        <span>{{ runtimePreview }}</span>
      </div>
      <div v-if="props.runtime" class="bp-compact-node-runtime">
        <em
          class="bp-compact-runtime-chip"
          :class="{
            'is-running': props.runtime.status === 'running',
            'is-done': props.runtime.status === 'completed',
            'is-failed': props.runtime.status === 'failed'
          }"
        >
          {{ runtimeStatusLabel }}
        </em>
        <small v-if="props.runtime.status === 'running' && runtimeProgressCopy">{{ runtimeProgressCopy }}</small>
        <small v-else-if="props.runtime.summary">{{ props.runtime.summary }}</small>
        <small v-if="props.runtime.analysis">{{ props.runtime.analysis }}</small>
      </div>
    </div>

    <BlueprintNodeProgressPanel :runtime="props.runtime" />
  </article>
</template>

<style scoped>
.bp-compact-node {
  --bp-node-surface: #ffffff;
  --bp-node-border: rgba(17, 17, 17, 0.16);
  --bp-node-border-strong: #6f6f6f;
  --bp-node-port-fill: #b7b7b7;
  --bp-node-port-fill-hover: #909090;
  --bp-node-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  --bp-node-shadow-hover: 0 14px 28px rgba(0, 0, 0, 0.11);
  display: flex;
  align-items: flex-start;
  gap: calc(12px * var(--bp-ui-scale, 1));
  width: calc(264px * var(--bp-ui-scale, 1));
  min-height: calc(112px * var(--bp-ui-scale, 1));
  max-height: calc(176px * var(--bp-ui-scale, 1));
  padding: calc(12px * var(--bp-ui-scale, 1)) calc(14px * var(--bp-ui-scale, 1));
  box-sizing: border-box;
  color: var(--bp-text);
  overflow: visible;
}

.bp-compact-node::before {
  content: '';
  position: absolute;
  inset: calc(-3px * var(--bp-ui-scale, 1));
  border-radius: inherit;
  opacity: 0;
  pointer-events: none;
  background:
    linear-gradient(120deg, rgba(66, 133, 244, 0.12), rgba(88, 201, 255, 0.92), rgba(66, 133, 244, 0.12));
  background-size: 220% 100%;
  transition: opacity 0.18s ease;
}

.bp-compact-node.is-running::before {
  opacity: 1;
  animation: bp-node-running-marquee 1.45s linear infinite;
}

.bp-compact-node.is-running {
  box-shadow: 0 0 0 2px rgba(88, 201, 255, 0.32), 0 16px 30px rgba(30, 119, 188, 0.2);
}

.bp-compact-node-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(36px * var(--bp-ui-scale, 1));
  height: calc(36px * var(--bp-ui-scale, 1));
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: calc(10px * var(--bp-ui-scale, 1));
  background: var(--bp-compact-icon-background);
  color: var(--bp-compact-icon-color);
  font-size: calc(1rem * var(--bp-ui-scale, 1));
  line-height: 1;
  flex: 0 0 auto;
}

.bp-compact-node-icon.has-logo {
  background: #ffffff;
}

.bp-compact-node-icon img {
  width: calc(20px * var(--bp-ui-scale, 1));
  height: calc(20px * var(--bp-ui-scale, 1));
  object-fit: contain;
  display: block;
}

.bp-compact-node-copy {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bp-compact-node-copy strong {
  display: block;
  color: #111111;
  font-size: calc(0.9rem * var(--bp-ui-scale, 1));
  font-weight: 700;
  line-height: 1.25;
}

.bp-compact-node-preview {
  margin-top: calc(4px * var(--bp-ui-scale, 1));
  max-height: calc(56px * var(--bp-ui-scale, 1));
  overflow: auto;
  padding-right: calc(4px * var(--bp-ui-scale, 1));
}

.bp-compact-node-preview span {
  display: block;
  color: #727272;
  font-size: calc(0.72rem * var(--bp-ui-scale, 1));
  line-height: 1.28;
  white-space: pre-wrap;
  word-break: break-word;
}

.bp-compact-node-runtime {
  display: flex;
  flex-direction: column;
  gap: calc(4px * var(--bp-ui-scale, 1));
  margin-top: calc(8px * var(--bp-ui-scale, 1));
  padding: calc(8px * var(--bp-ui-scale, 1));
  border-radius: calc(10px * var(--bp-ui-scale, 1));
  background: rgba(243, 247, 255, 0.92);
  max-height: calc(68px * var(--bp-ui-scale, 1));
  overflow: auto;
}

.bp-compact-runtime-chip {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0 calc(8px * var(--bp-ui-scale, 1));
  min-height: calc(20px * var(--bp-ui-scale, 1));
  border-radius: 999px;
  background: #f1f1f1;
  color: #565656;
  font-size: calc(0.64rem * var(--bp-ui-scale, 1));
  font-style: normal;
  font-weight: 700;
}

.bp-compact-runtime-chip.is-running {
  background: #dfeaff;
  color: #184ea8;
}

.bp-compact-runtime-chip.is-done {
  background: #ebf8ee;
  color: #257647;
}

.bp-compact-runtime-chip.is-failed {
  background: #ffe7e7;
  color: #a22f2f;
}

.bp-compact-node-runtime small {
  display: block;
  color: #636363;
  font-size: calc(0.67rem * var(--bp-ui-scale, 1));
  line-height: 1.25;
}

.bp-compact-node-preview::-webkit-scrollbar,
.bp-compact-node-runtime::-webkit-scrollbar {
  width: 6px;
}

.bp-compact-node-preview::-webkit-scrollbar-thumb,
.bp-compact-node-runtime::-webkit-scrollbar-thumb {
  background: rgba(17, 17, 17, 0.16);
  border-radius: 999px;
}

@keyframes bp-node-running-marquee {
  0% {
    background-position: 200% 50%;
  }

  100% {
    background-position: -20% 50%;
  }
}
</style>
