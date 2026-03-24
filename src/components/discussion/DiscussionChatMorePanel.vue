<template>
  <section class="chat-more-panel" aria-label="更多设置">
    <div class="chat-more-list">
      <template v-for="item in menuItems" :key="item.key">
        <button
          type="button"
          class="chat-more-item"
          :class="{ accent: item.accent, active: activeSection === item.key }"
          @click="$emit('item-click', item)"
        >
          <span class="chat-more-item-label">{{ item.label }}</span>
          <span class="chat-more-item-arrow" aria-hidden="true">›</span>
        </button>

        <transition name="chat-more-expand">
          <div
            v-if="activeSection === item.key"
            class="chat-more-inline-panel"
          >
            <div v-if="item.key === 'game-code'" class="chat-more-editor chat-more-editor-compact chat-more-editor-game-code">
              <div class="chat-more-editor-head">
                <strong>固定右侧代码区的源码游戏</strong>
                <button type="button" class="chat-more-secondary-btn chat-more-secondary-btn-compact" @click="$emit('reset-room-code-game')">
                  恢复默认
                </button>
              </div>
              <p class="chat-more-editor-note">
                直接在这里选择你游戏库中的源码游戏，右侧代码区会固定显示它的源码。
              </p>
              <div class="chat-more-selection-card chat-more-selection-card-compact">
                <span>当前选择</span>
                <strong>{{ effectiveCodeGameTitle || '使用当前房间默认游戏' }}</strong>
                <small>{{ effectiveCodeGameId || (currentChat?.gameId ? `room:${currentChat.gameId}` : '暂无可用源码') }}</small>
              </div>
              <div class="chat-more-inline-library chat-more-inline-library-compact">
                <div v-if="gameLibraryLoading" class="chat-empty">游戏库加载中...</div>
                <div v-else-if="gameLibraryError" class="chat-error">{{ gameLibraryError }}</div>
                <div v-else-if="!gameLibraryGames.length" class="chat-empty">你的游戏库里还没有可选游戏</div>
                <button
                  v-for="game in gameLibraryGames"
                  :key="getLibraryGameKey(game)"
                  type="button"
                  class="chat-more-library-item"
                  :class="{ active: String(effectiveCodeGameId) === String(getLibraryGameKey(game)) }"
                  @click="$emit('select-room-code-game', game)"
                >
                  <span class="chat-more-library-item-title">{{ getLibraryGameTitle(game) }}</span>
                  <span class="chat-more-library-item-meta">{{ String(getLibraryGameKey(game)) }}</span>
                </button>
              </div>
            </div>

            <div v-else-if="item.key === 'pull-ai'" class="chat-more-editor">
              <div class="chat-more-editor-head">
                <strong>房间 AI 接入</strong>
                <span class="chat-more-inline-tip">最多 2 个</span>
              </div>
              <p class="chat-more-editor-note">
                这里保存的是房间 AI 配置。内置模型和自定义 API 参数会走后端持久化，并同步到同房间成员。
              </p>
              <div class="chat-more-section-scroll chat-more-section-scroll-ai">
                <DiscussionChatMoreAiSettings
                  mode="pull-ai"
                  :ai-slots="settings.aiSlots"
                  :builtin-models="builtinModels"
                  @update-slot-field="handleUpdateAiSlotField"
                />
              </div>
            </div>

            <div v-else-if="item.key === 'custom-name'" class="chat-more-editor">
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

            <div v-else-if="item.key === 'meeting-status'" class="chat-more-editor">
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

            <div v-else-if="item.key === 'personal-ai'" class="chat-more-editor chat-more-editor-compact chat-more-editor-personal-ai">
              <div class="chat-more-editor-head">
                <strong>个性化 AI</strong>
                <span class="chat-more-inline-tip">名称 / 上下文 / 头像</span>
              </div>
              <div class="chat-more-section-scroll chat-more-section-scroll-ai">
                <DiscussionChatMoreAiSettings
                  mode="personal-ai"
                  :ai-slots="settings.aiSlots"
                  :builtin-models="builtinModels"
                  :room-summary="roomSummary"
                  :room-memory-items="roomMemoryItems"
                  :memory-loading="roomMemoryLoading"
                  :memory-error="roomMemoryError"
                  @update-slot-field="handleUpdateAiSlotField"
                  @avatar-file-change="handleAvatarFileChange"
                  @refresh-room-memory="$emit('refresh-room-memory')"
                  @open-memory-file="$emit('open-memory-file', $event)"
                />
              </div>
            </div>

            <div v-else-if="item.key === 'role-preset'" class="chat-more-editor">
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

            <div v-else-if="item.key === 'dual-ai-loop'" class="chat-more-editor chat-more-editor-danger">
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
                开启后，系统会围绕最近一条用户消息安排两个 AI 各回复一轮，然后停下来等待你的下一次输入。
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
              <div class="chat-more-selection-card chat-more-selection-card-danger">
                <span>当前状态</span>
                <strong>{{ dualAiLoopReady ? '用户主导协作中' : '需要先加入两个 AI' }}</strong>
                <small>累计生成 {{ settings.dualAiLoopTurnCount || 0 }} 条 AI 协作消息</small>
              </div>
              <div class="chat-more-action-row">
                <button
                  type="button"
                  class="chat-more-primary-btn chat-more-primary-btn-danger"
                  :disabled="!dualAiLoopReady || roomAiBusy"
                  @click="$emit('generate-dual-ai-loop-round')"
                >
                  {{ roomAiBusy ? 'AI 正在回复中' : '手动推进一次' }}
                </button>
              </div>
            </div>
          </div>
        </transition>
      </template>
      <button
        type="button"
        class="chat-more-danger"
        @click="$emit('open-delete-friend-confirm')"
      >
        删除好友
      </button>
    </div>

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
    roomAiBusy: {
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
    roomSummary: {
      type: Object,
      default: null
    },
    roomMemoryItems: {
      type: Array,
      default: () => []
    },
    roomMemoryLoading: {
      type: Boolean,
      default: false
    },
    roomMemoryError: {
      type: String,
      default: ''
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
    'open-delete-friend-confirm',
    'close-delete-friend-confirm',
    'confirm-delete-friend',
    'select-room-code-game',
    'reset-room-code-game',
    'update-setting',
    'reset-nickname',
    'update-ai-slot-field',
    'avatar-file-change',
    'refresh-room-memory',
    'open-memory-file',
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
