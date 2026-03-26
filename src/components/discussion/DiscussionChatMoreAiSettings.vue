<template>
  <div class="chat-more-ai-grid" :class="`chat-more-ai-grid-${mode}`">
    <div
      v-for="(slot, slotIndex) in aiSlots"
      :key="`${slot.id}-${mode}`"
      class="chat-more-ai-card"
    >
      <div class="chat-more-ai-card-head">
        <strong>AI {{ slotIndex + 1 }}</strong>
        <template v-if="mode === 'pull-ai'">
          <label class="chat-more-switch">
            <input
              type="checkbox"
              :checked="slot.enabled"
              @change="$emit('update-slot-field', slot.id, 'enabled', $event.target.checked)"
            />
            <span>{{ slot.enabled ? '已加入' : '未加入' }}</span>
          </label>
        </template>
        <span v-else class="chat-more-inline-tip">{{ slot.enabled ? '已加入房间' : '未加入房间' }}</span>
      </div>

      <template v-if="mode === 'pull-ai'">
        <label class="chat-more-field">
          <span>接入方式</span>
          <select
            :value="slot.provider"
            @change="$emit('update-slot-field', slot.id, 'provider', $event.target.value)"
          >
            <option value="builtin">内置模型</option>
            <option value="custom">自定义 API</option>
          </select>
        </label>

        <label v-if="slot.provider === 'builtin'" class="chat-more-field">
          <span>模型</span>
          <div class="chat-more-model-picker">
            <button
              v-for="model in builtinModels"
              :key="model"
              type="button"
              class="chat-more-model-option"
              :class="{ active: slot.builtinModel === model }"
              @click="$emit('update-slot-field', slot.id, 'builtinModel', model)"
            >
              <img
                class="chat-more-model-option-logo"
                :src="resolveBuiltinModelLogo(model)"
                :alt="model"
              />
              <span>{{ model }}</span>
            </button>
          </div>
        </label>

        <template v-else>
          <label class="chat-more-field">
            <span>API 地址</span>
            <input
              type="text"
              :value="slot.customEndpoint"
              placeholder="https://example.com/v1/chat/completions"
              @input="$emit('update-slot-field', slot.id, 'customEndpoint', $event.target.value)"
            />
          </label>
          <label class="chat-more-field">
            <span>模型名</span>
            <input
              type="text"
              :value="slot.customModel"
              placeholder="my-model"
              @input="$emit('update-slot-field', slot.id, 'customModel', $event.target.value)"
            />
          </label>
          <label class="chat-more-field">
            <span>API Key</span>
            <input
              type="password"
              :value="slot.apiKey"
              :placeholder="slot.hasApiKey ? '已保存，重新输入可覆盖' : 'sk-...'"
              @input="$emit('update-slot-field', slot.id, 'apiKey', $event.target.value)"
            />
          </label>
        </template>

        <div class="chat-more-ai-card-meta">
          <span class="chat-more-ai-card-meta-title">
            <img
              v-if="slot.provider === 'builtin'"
              class="chat-more-ai-card-meta-logo"
              :src="resolveBuiltinModelLogo(slot.builtinModel)"
              :alt="resolveAiSlotModelLabel(slot)"
            />
            <span>{{ slot.name || `协作 AI ${slotIndex + 1}` }}</span>
          </span>
          <small>{{ resolveAiSlotModelLabel(slot) }}</small>
          <small>回复上限 80 字</small>
        </div>
      </template>

      <template v-else>
        <label class="chat-more-field">
          <span>AI 名称</span>
          <input
            type="text"
            :value="slot.name"
            maxlength="24"
            @input="$emit('update-slot-field', slot.id, 'name', $event.target.value)"
          />
        </label>

        <label class="chat-more-field">
          <span>AI 上下文</span>
          <textarea
            rows="4"
            :value="slot.context"
            placeholder="描述这个 AI 的风格、职责、语气和关注点"
            @input="$emit('update-slot-field', slot.id, 'context', $event.target.value)"
          ></textarea>
        </label>
        <div class="chat-more-field-foot">
          <span>上下文约 {{ estimateTokenCount(slot.context) }} tokens</span>
          <span>回复上限 80 字</span>
        </div>

        <div class="chat-more-avatar-row">
          <div class="chat-more-ai-avatar-preview">
            <img
              v-if="resolveAiAvatarPreview(slot)"
              :src="resolveAiAvatarPreview(slot)"
              :alt="slot.name || `AI ${slotIndex + 1}`"
            />
            <span v-else>{{ (slot.name || `A${slotIndex + 1}`).slice(0, 2) }}</span>
          </div>
          <label class="chat-more-upload-btn chat-more-upload-tile">
            <input
              type="file"
              accept="image/*"
              @change="$emit('avatar-file-change', slot.id, $event)"
            />
            上传头像
          </label>
          <button
            type="button"
            class="chat-more-save-tile"
            :class="{ active: aiSlotSaveStates[String(slot.id || '')] === 'saved' }"
            :disabled="aiSlotSaveStates[String(slot.id || '')] === 'saving'"
            @click="$emit('save-ai-slot', slot.id)"
          >
            {{ resolveAiSlotSaveLabel(slot.id) }}
          </button>
          <button
            type="button"
            class="chat-more-memory-toggle-tile"
            :class="{ active: slot.memoryEnabled !== false }"
            @click="$emit('update-slot-field', slot.id, 'memoryEnabled', !(slot.memoryEnabled !== false))"
          >
            <i class="fa fa-brain"></i>
            <span>{{ slot.memoryEnabled !== false ? '共享记忆' : '记忆关闭' }}</span>
          </button>
        </div>

        <div v-if="slotIndex === 0" class="chat-more-memory-manager">
          <div class="chat-more-editor-head">
            <strong>记忆管理</strong>
            <button
              type="button"
              class="chat-more-secondary-btn"
              :disabled="memoryLoading"
              @click="$emit('refresh-room-memory')"
            >
              {{ memoryLoading ? '刷新中...' : '刷新记忆' }}
            </button>
          </div>
          <p v-if="roomSummary?.updatedAt" class="chat-more-editor-note">
            最近更新：{{ formatMemoryTime(roomSummary.updatedAt) }}
          </p>
          <div v-if="memoryError" class="chat-error">{{ memoryError }}</div>
          <div v-else-if="!roomMemoryItems.length" class="chat-empty">当前房间还没有可用记忆文件</div>
          <div v-else class="chat-more-memory-list">
            <div class="chat-more-memory-scroll-shell">
              <button
                v-for="memoryItem in roomMemoryItems"
                :key="memoryItem.sourceKey || memoryItem.id"
                type="button"
                class="chat-more-memory-item"
                @click="$emit('open-memory-file', memoryItem)"
              >
                <span class="chat-more-memory-item-title">{{ memoryItem.title }}</span>
                <span class="chat-more-memory-item-meta">{{ formatMemoryMeta(memoryItem) }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { getBuiltinModelAvatarUrl, getBuiltinModelMeta } from '../../utils/discussionChatMore'

export default {
  name: 'DiscussionChatMoreAiSettings',
  props: {
    mode: {
      type: String,
      default: 'pull-ai'
    },
    aiSlots: {
      type: Array,
      default: () => []
    },
    builtinModels: {
      type: Array,
      default: () => []
    },
    roomSummary: {
      type: Object,
      default: null
    },
    roomMemoryItems: {
      type: Array,
      default: () => []
    },
    memoryLoading: {
      type: Boolean,
      default: false
    },
    memoryError: {
      type: String,
      default: ''
    },
    aiSlotSaveStates: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['update-slot-field', 'avatar-file-change', 'refresh-room-memory', 'open-memory-file', 'save-ai-slot'],
  methods: {
    resolveAiSlotModelLabel(slot = {}) {
      if (slot.provider === 'custom') {
        return slot.customModel || '自定义 API'
      }
      return slot.builtinModel || this.builtinModels[0] || '内置模型'
    },
    resolveBuiltinModelLogo(modelName = '') {
      return getBuiltinModelMeta(modelName).logo
    },
    resolveAiAvatarPreview(slot = {}) {
      const customAvatar = String(slot.avatarUrl || '').trim()
      if (customAvatar) return customAvatar
      if (slot.provider === 'builtin') {
        return getBuiltinModelAvatarUrl(slot.builtinModel || this.builtinModels[0] || '')
      }
      return ''
    },
    resolveAiSlotSaveLabel(slotId = '') {
      const saveState = this.aiSlotSaveStates[String(slotId || '')] || 'idle'
      if (saveState === 'saving') return '保存中'
      if (saveState === 'saved') return '已保存'
      return '保存修改'
    },
    formatMemoryTime(value) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(',', '')
    },
    formatMemoryMeta(memoryItem = {}) {
      const typeLabelMap = {
        summary: '摘要',
        profile: '配置',
        document: '文档',
        code: '源码',
        message: '消息'
      }
      const typeLabel = typeLabelMap[memoryItem.memoryType] || '记忆'
      const updatedAt = this.formatMemoryTime(memoryItem.updatedAt)
      return updatedAt ? `${typeLabel} · ${updatedAt}` : typeLabel
    },
    estimateTokenCount(text = '') {
      const source = String(text || '').trim()
      if (!source) return 0
      const asciiMatches = source.match(/[A-Za-z0-9_.-]+/g) || []
      const asciiCount = asciiMatches.reduce((sum, item) => sum + Math.max(1, Math.ceil(item.length / 4)), 0)
      const nonAsciiCount = source.replace(/[A-Za-z0-9_.-\s]/g, '').length
      return asciiCount + nonAsciiCount
    }
  }
}
</script>
