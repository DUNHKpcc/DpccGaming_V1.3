<template>
  <section class="chat-more-panel" aria-label="更多设置">
    <div class="chat-more-list">
      <button
        v-for="item in menuItems"
        :key="item.key"
        type="button"
        class="chat-more-item"
        :class="{ accent: item.accent, active: activeSection === item.key }"
        @click="$emit('item-click', item)"
      >
        <span class="chat-more-item-label">{{ item.label }}</span>
        <span class="chat-more-item-arrow" aria-hidden="true">›</span>
      </button>
    </div>

    <div class="chat-more-workspace">
      <div class="chat-more-overview">
        <div class="chat-more-overview-card">
          <span class="chat-more-overview-label">当前代码源</span>
          <strong>{{ effectiveCodeGameTitle || '房间默认游戏' }}</strong>
        </div>
        <div class="chat-more-overview-card">
          <span class="chat-more-overview-label">已加入 AI</span>
          <strong>{{ enabledAiSlots.length }}/2</strong>
        </div>
        <div class="chat-more-overview-card">
          <span class="chat-more-overview-label">双 AI 轮询</span>
          <strong>{{ settings.dualAiLoopEnabled ? '已开启' : '未开启' }}</strong>
        </div>
      </div>

      <div v-if="activeSection === 'game-code'" class="chat-more-editor">
        <div class="chat-more-editor-head">
          <strong>固定右侧代码区的源码游戏</strong>
          <button type="button" class="chat-more-secondary-btn" @click="$emit('open-game-picker')">
            打开游戏库
          </button>
        </div>
        <p class="chat-more-editor-note">
          从你的游戏库里选一个有源码的游戏，右侧代码区会固定显示它的源码。
        </p>
        <div class="chat-more-selection-card">
          <span>当前选择</span>
          <strong>{{ effectiveCodeGameTitle || '使用当前房间默认游戏' }}</strong>
          <small>{{ effectiveCodeGameId || (currentChat?.gameId ? `room:${currentChat.gameId}` : '暂无可用源码') }}</small>
        </div>
        <div class="chat-more-action-row">
          <button type="button" class="chat-more-primary-btn" @click="$emit('open-game-picker')">
            选择源码游戏
          </button>
          <button type="button" class="chat-more-secondary-btn" @click="$emit('reset-room-code-game')">
            恢复房间默认
          </button>
        </div>
      </div>

      <div v-else-if="activeSection === 'pull-ai'" class="chat-more-editor">
        <div class="chat-more-editor-head">
          <strong>房间 AI 接入</strong>
          <span class="chat-more-inline-tip">最多 2 个</span>
        </div>
        <p class="chat-more-editor-note">
          这里保存的是房间 AI 配置。内置模型和自定义 API 参数会走后端持久化，并同步到同房间成员。
        </p>
        <DiscussionChatMoreAiSettings
          mode="pull-ai"
          :ai-slots="settings.aiSlots"
          :builtin-models="builtinModels"
          @update-slot-field="handleUpdateAiSlotField"
        />
      </div>

      <div v-else-if="activeSection === 'custom-name'" class="chat-more-editor">
        <div class="chat-more-editor-head">
          <strong>自定义对方昵称</strong>
        </div>
        <label class="chat-more-field">
          <span>昵称</span>
          <input
            type="text"
            :value="settings.customNickname"
            :placeholder="currentChat?.baseName || '输入新的昵称'"
            maxlength="24"
            @input="$emit('update-setting', 'customNickname', $event.target.value)"
          />
        </label>
        <div class="chat-more-action-row">
          <button type="button" class="chat-more-secondary-btn" @click="$emit('reset-nickname')">
            恢复默认昵称
          </button>
        </div>
      </div>

      <div v-else-if="activeSection === 'meeting-status'" class="chat-more-editor">
        <div class="chat-more-editor-head">
          <strong>会议 / 协作状态</strong>
        </div>
        <label class="chat-more-field">
          <span>当前模式</span>
          <select
            :value="settings.collaborationStatus"
            @change="$emit('update-setting', 'collaborationStatus', $event.target.value)"
          >
            <option
              v-for="status in collabStatusOptions"
              :key="status.value"
              :value="status.value"
            >
              {{ status.label }}
            </option>
          </select>
        </label>
        <label class="chat-more-field">
          <span>协作备注</span>
          <textarea
            rows="4"
            :value="settings.collaborationNote"
            placeholder="例如：当前在确认功能范围、等待客户反馈、准备提测..."
            @input="$emit('update-setting', 'collaborationNote', $event.target.value)"
          ></textarea>
        </label>
      </div>

      <div v-else-if="activeSection === 'personal-ai'" class="chat-more-editor">
        <div class="chat-more-editor-head">
          <strong>个性化 AI</strong>
          <span class="chat-more-inline-tip">名称 / 上下文 / 头像</span>
        </div>
        <DiscussionChatMoreAiSettings
          mode="personal-ai"
          :ai-slots="settings.aiSlots"
          :builtin-models="builtinModels"
          @update-slot-field="handleUpdateAiSlotField"
          @avatar-file-change="handleAvatarFileChange"
        />
      </div>

      <div v-else-if="activeSection === 'role-preset'" class="chat-more-editor">
        <div class="chat-more-editor-head">
          <strong>角色预设</strong>
        </div>
        <p class="chat-more-editor-note">
          用来描述对方当前在这段对话里的身份，会展示在当前私聊房间头部。
        </p>
        <div class="chat-more-chip-row">
          <button
            v-for="role in rolePresetOptions"
            :key="role"
            type="button"
            class="chat-more-chip"
            :class="{ active: settings.peerRolePreset === role }"
            @click="$emit('update-setting', 'peerRolePreset', role)"
          >
            {{ role }}
          </button>
        </div>
        <label class="chat-more-field">
          <span>自定义角色</span>
          <input
            type="text"
            :value="settings.peerRolePreset"
            maxlength="24"
            @input="$emit('update-setting', 'peerRolePreset', $event.target.value)"
          />
        </label>
      </div>

      <div v-else-if="activeSection === 'dual-ai-loop'" class="chat-more-editor">
        <div class="chat-more-editor-head">
          <strong>双 AI 轮询对话</strong>
          <label class="chat-more-switch">
            <input
              type="checkbox"
              :checked="settings.dualAiLoopEnabled"
              @change="$emit('toggle-dual-ai-loop', $event.target.checked)"
            />
            <span>{{ settings.dualAiLoopEnabled ? '已开启' : '未开启' }}</span>
          </label>
        </div>
        <p class="chat-more-editor-note">
          双 AI 轮询会由后端持续生成房间 AI 消息，同房间成员和你的其他设备都能实时看到。
        </p>
        <label class="chat-more-field">
          <span>轮询引导词</span>
          <textarea
            rows="4"
            :value="settings.dualAiLoopPrompt"
            placeholder="告诉两个 AI 应该围绕什么继续讨论"
            @input="$emit('update-setting', 'dualAiLoopPrompt', $event.target.value)"
          ></textarea>
        </label>
        <div class="chat-more-selection-card">
          <span>当前状态</span>
          <strong>{{ dualAiLoopReady ? '可运行' : '需要先加入两个 AI' }}</strong>
          <small>已生成 {{ settings.dualAiLoopTurnCount || 0 }} 轮消息</small>
        </div>
        <div class="chat-more-action-row">
          <button
            type="button"
            class="chat-more-primary-btn"
            :disabled="!dualAiLoopReady"
            @click="$emit('generate-dual-ai-loop-round')"
          >
            立即生成一轮
          </button>
        </div>
      </div>

      <div v-else class="chat-more-placeholder">
        <strong>选择一个功能开始配置</strong>
        <p>这里的配置会持久化到服务器，并实时同步给同一房间成员。</p>
      </div>
    </div>

    <button
      type="button"
      class="chat-more-danger"
      @click="$emit('open-delete-friend-confirm')"
    >
      删除好友
    </button>

    <div
      v-if="showDeleteFriendConfirm"
      class="chat-more-confirm-mask"
      @click="$emit('close-delete-friend-confirm')"
    >
      <div
        class="chat-more-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="删除好友确认"
        @click.stop
      >
        <div class="chat-more-confirm-head">
          <strong>确认删除好友</strong>
          <button
            type="button"
            class="icon-btn"
            aria-label="关闭"
            @click="$emit('close-delete-friend-confirm')"
          >
            ✕
          </button>
        </div>
        <p class="chat-more-confirm-text">{{ deleteFriendWarningText }}</p>
        <div class="chat-more-confirm-actions">
          <button
            type="button"
            class="chat-more-secondary-btn"
            @click="$emit('close-delete-friend-confirm')"
          >
            取消
          </button>
          <button
            type="button"
            class="chat-more-danger-btn"
            @click="$emit('confirm-delete-friend')"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>

    <div v-if="showGameLibraryPicker" class="code-picker-mask" @click="$emit('close-game-picker')">
      <div class="code-picker-panel chat-more-game-picker" @click.stop>
        <div class="code-picker-head">
          <strong>选择游戏源码</strong>
          <button type="button" class="icon-btn" @click="$emit('close-game-picker')">✕</button>
        </div>
        <div class="chat-more-picker-tip">
          选择后，右侧代码区会固定展示该游戏的源码文件。
        </div>
        <div class="code-picker-body">
          <div v-if="gameLibraryLoading" class="chat-empty">游戏库加载中...</div>
          <div v-else-if="gameLibraryError" class="chat-error">{{ gameLibraryError }}</div>
          <div v-else-if="!gameLibraryGames.length" class="chat-empty">你的游戏库里还没有可选游戏</div>
          <button
            v-for="game in gameLibraryGames"
            :key="getLibraryGameKey(game)"
            type="button"
            class="code-picker-item"
            @click="$emit('select-room-code-game', game)"
          >
            <span class="code-picker-item-path">
              {{ getLibraryGameTitle(game) }}
            </span>
            <span class="code-picker-item-lang">
              {{ String(getLibraryGameKey(game)) }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import DiscussionChatMoreAiSettings from './DiscussionChatMoreAiSettings.vue'

export default {
  name: 'DiscussionChatMorePanel',
  components: {
    DiscussionChatMoreAiSettings
  },
  props: {
    menuItems: {
      type: Array,
      default: () => []
    },
    activeSection: {
      type: String,
      default: ''
    },
    settings: {
      type: Object,
      default: () => ({ aiSlots: [] })
    },
    enabledAiSlots: {
      type: Array,
      default: () => []
    },
    dualAiLoopReady: {
      type: Boolean,
      default: false
    },
    effectiveCodeGameTitle: {
      type: String,
      default: ''
    },
    effectiveCodeGameId: {
      type: String,
      default: ''
    },
    currentChat: {
      type: Object,
      default: null
    },
    builtinModels: {
      type: Array,
      default: () => []
    },
    collabStatusOptions: {
      type: Array,
      default: () => []
    },
    rolePresetOptions: {
      type: Array,
      default: () => []
    },
    showGameLibraryPicker: {
      type: Boolean,
      default: false
    },
    gameLibraryLoading: {
      type: Boolean,
      default: false
    },
    gameLibraryError: {
      type: String,
      default: ''
    },
    gameLibraryGames: {
      type: Array,
      default: () => []
    },
    showDeleteFriendConfirm: {
      type: Boolean,
      default: false
    },
    deleteFriendWarningText: {
      type: String,
      default: ''
    }
  },
  emits: [
    'item-click',
    'open-game-picker',
    'close-game-picker',
    'open-delete-friend-confirm',
    'close-delete-friend-confirm',
    'confirm-delete-friend',
    'select-room-code-game',
    'reset-room-code-game',
    'update-setting',
    'reset-nickname',
    'update-ai-slot-field',
    'avatar-file-change',
    'toggle-dual-ai-loop',
    'generate-dual-ai-loop-round'
  ],
  methods: {
    handleUpdateAiSlotField(slotId, field, value) {
      this.$emit('update-ai-slot-field', slotId, field, value)
    },
    handleAvatarFileChange(slotId, event) {
      this.$emit('avatar-file-change', slotId, event)
    },
    getLibraryGameKey(game = {}) {
      return game?.game_id || game?.id || ''
    },
    getLibraryGameTitle(game = {}) {
      return game?.title || game?.name || `游戏 ${this.getLibraryGameKey(game)}`
    }
  }
}
</script>
