<template>
  <div class="chat-more-ai-grid">
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
          <select
            :value="slot.builtinModel"
            @change="$emit('update-slot-field', slot.id, 'builtinModel', $event.target.value)"
          >
            <option v-for="model in builtinModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
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
          <span>{{ slot.name || `协作 AI ${slotIndex + 1}` }}</span>
          <small>{{ resolveAiSlotModelLabel(slot) }}</small>
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

        <div class="chat-more-avatar-row">
          <div class="chat-more-ai-avatar-preview">
            <img
              v-if="slot.avatarUrl"
              :src="slot.avatarUrl"
              :alt="slot.name || `AI ${slotIndex + 1}`"
            />
            <span v-else>{{ (slot.name || `A${slotIndex + 1}`).slice(0, 2) }}</span>
          </div>
          <label class="chat-more-upload-btn">
            <input
              type="file"
              accept="image/*"
              @change="$emit('avatar-file-change', slot.id, $event)"
            />
            上传头像
          </label>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
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
    }
  },
  emits: ['update-slot-field', 'avatar-file-change'],
  methods: {
    resolveAiSlotModelLabel(slot = {}) {
      if (slot.provider === 'custom') {
        return slot.customModel || '自定义 API'
      }
      return slot.builtinModel || this.builtinModels[0] || '内置模型'
    }
  }
}
</script>
