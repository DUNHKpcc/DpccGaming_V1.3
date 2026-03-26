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
          <div v-if="activeSection === item.key" class="chat-more-inline-panel">
            <div v-if="item.key === 'group-profile'" class="chat-more-editor">
              <div class="chat-more-editor-head">
                <strong>群聊信息</strong>
                <span class="chat-more-inline-tip">{{ joinedMembers.length }} / {{ settings.roomMaxMembers || currentChat?.maxMembers || 4 }}</span>
              </div>
              <p class="chat-more-editor-note">
                群聊头像、群名称、邀请权限和人数上限会同步到整个群聊。当前仅群主可修改这些群设置。
              </p>

              <div class="chat-more-group-summary-card">
                <div class="chat-more-group-avatar">
                  <img
                    v-if="settings.roomAvatarUrl || currentChat?.avatarUrl"
                    :src="settings.roomAvatarUrl || currentChat?.avatarUrl"
                    :alt="settings.roomTitle || currentChat?.name || '群聊头像'"
                  />
                  <span v-else>{{ currentChat?.avatar || 'G' }}</span>
                </div>
                <div class="chat-more-group-summary-meta">
                  <strong>{{ settings.roomTitle || currentChat?.name || '未命名群聊' }}</strong>
                  <small>{{ currentChat?.status || '群聊协作中' }}</small>
                </div>
              </div>

              <div class="chat-more-action-row">
                <label class="chat-more-upload-btn" :class="{ disabled: !canManageCurrentGroup || roomAvatarUploading }">
                  {{ roomAvatarUploading ? '上传中...' : '更换群头像' }}
                  <input
                    type="file"
                    accept="image/*"
                    :disabled="!canManageCurrentGroup || roomAvatarUploading"
                    @change="$emit('room-avatar-file-change', $event)"
                  />
                </label>
                <button
                  type="button"
                  class="chat-more-secondary-btn"
                  :disabled="!canManageCurrentGroup || roomAvatarUploading"
                  @click="$emit('reset-room-avatar')"
                >
                  恢复默认头像
                </button>
              </div>

              <label class="chat-more-field">
                <span>群聊名称</span>
                <input
                  type="text"
                  :value="settings.roomTitle"
                  :disabled="!canManageCurrentGroup"
                  maxlength="40"
                  placeholder="输入群聊名称"
                  @input="$emit('update-setting', 'roomTitle', $event.target.value)"
                />
              </label>

              <label class="chat-more-field">
                <span>邀请权限</span>
                <select
                  :value="settings.invitePermission"
                  :disabled="!canManageCurrentGroup"
                  @change="$emit('update-setting', 'invitePermission', $event.target.value, { immediate: true })"
                >
                  <option
                    v-for="option in groupInvitePermissionOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="chat-more-field">
                <span>群内人数上限</span>
                <select
                  :value="String(settings.roomMaxMembers || currentChat?.maxMembers || 4)"
                  :disabled="!canManageCurrentGroup"
                  @change="$emit('update-setting', 'roomMaxMembers', Number($event.target.value), { immediate: true })"
                >
                  <option
                    v-for="value in maxMemberOptions"
                    :key="value"
                    :value="String(value)"
                  >
                    {{ value }} 人
                  </option>
                </select>
              </label>

              <p v-if="!canManageCurrentGroup" class="chat-more-editor-note">
                当前群聊资料和邀请权限由群主统一维护，你仍然可以在“邀请成员”里查看当前邀请状态。
              </p>
            </div>

            <div v-else-if="item.key === 'group-members'" class="chat-more-editor">
              <div class="chat-more-editor-head">
                <strong>群成员详情</strong>
                <span class="chat-more-inline-tip">{{ joinedMembers.length }} 位成员</span>
              </div>
              <p class="chat-more-editor-note">
                头像下显示的是成员在当前群里的名称；名称过长时会自动缩略显示。
              </p>

              <div v-if="!joinedMembers.length" class="chat-empty">当前群聊暂无可展示成员</div>
              <div v-else class="chat-more-member-grid">
                <div
                  v-for="member in joinedMembers"
                  :key="`member-${member.user_id}`"
                  class="chat-more-member-card"
                >
                  <img
                    v-if="member.avatar_url"
                    :src="member.avatar_url"
                    :alt="getMemberDisplayName(member)"
                    class="chat-more-member-avatar"
                  />
                  <div v-else class="chat-more-member-avatar chat-more-member-avatar-fallback">
                    {{ getMemberInitial(member) }}
                  </div>
                  <strong :title="getMemberDisplayName(member)">{{ getMemberDisplayName(member) }}</strong>
                  <small>{{ member.role === 'host' ? '群主' : '成员' }}</small>
                </div>
              </div>
            </div>

            <div v-else-if="item.key === 'group-invite'" class="chat-more-editor">
              <div class="chat-more-editor-head">
                <strong>邀请成员</strong>
                <span class="chat-more-inline-tip">{{ canInviteCurrentGroupMembers ? '支持链接邀请与好友直邀' : '当前不可邀请' }}</span>
              </div>
              <p class="chat-more-editor-note">
                群链接会在设定时效后自动失效；好友直邀会直接把对方加入当前群聊。
              </p>

              <div class="chat-more-group-invite-shell">
                <div class="chat-more-group-invite-card">
                  <label class="chat-more-field">
                    <span>链接时效</span>
                    <select
                      :value="String(roomInviteExpireMinutes)"
                      :disabled="!canInviteCurrentGroupMembers || roomInviteLinkGenerating"
                      @change="$emit('update-room-invite-expire-minutes', Number($event.target.value))"
                    >
                      <option value="30">30 分钟</option>
                      <option value="60">1 小时</option>
                      <option value="360">6 小时</option>
                      <option value="1440">24 小时</option>
                    </select>
                  </label>
                  <div class="chat-more-action-row">
                    <button
                      type="button"
                      class="chat-more-primary-btn"
                      :disabled="!canInviteCurrentGroupMembers || roomInviteLinkGenerating"
                      @click="$emit('generate-room-invite-link')"
                    >
                      {{ roomInviteLinkGenerating ? '生成中...' : '生成邀请链接' }}
                    </button>
                    <button
                      type="button"
                      class="chat-more-secondary-btn"
                      :disabled="!roomInviteLink"
                      @click="$emit('copy-room-invite-link')"
                    >
                      复制链接
                    </button>
                  </div>
                  <label v-if="roomInviteLink" class="chat-more-field">
                    <span>当前链接</span>
                    <input type="text" :value="roomInviteLink" readonly />
                  </label>
                </div>

                <div class="chat-more-group-invite-card chat-more-group-invite-card-scroll">
                  <div class="chat-more-editor-head chat-more-editor-head-compact">
                    <strong>好友直邀</strong>
                    <span class="chat-more-inline-tip">{{ inviteFriends.length }} 位可邀请好友</span>
                  </div>
                  <div v-if="inviteFriendsLoading" class="chat-empty">好友列表加载中...</div>
                  <div v-else-if="inviteFriendsError" class="chat-error">{{ inviteFriendsError }}</div>
                  <div v-else-if="!inviteFriends.length" class="chat-empty">暂无可直接邀请的好友</div>
                  <div v-else class="chat-more-invite-friend-list">
                    <div
                      v-for="friend in inviteFriends"
                      :key="`invite-friend-${friend.id}`"
                      class="chat-more-invite-friend-row"
                    >
                      <div class="chat-more-invite-friend-user">
                        <img
                          v-if="friend.avatar_url"
                          :src="friend.avatar_url"
                          :alt="friend.username"
                          class="chat-more-member-avatar"
                        />
                        <div v-else class="chat-more-member-avatar chat-more-member-avatar-fallback">
                          {{ String(friend.username || '?').charAt(0).toUpperCase() }}
                        </div>
                        <div class="chat-more-invite-friend-meta">
                          <strong :title="friend.username">{{ friend.username }}</strong>
                          <span
                            class="chat-more-invite-friend-detail"
                            :title="friend.email || '未设置邮箱'"
                          >
                            {{ friend.email || '未设置邮箱' }}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="chat-more-secondary-btn chat-more-secondary-btn-compact chat-more-invite-friend-action"
                        :disabled="!canInviteCurrentGroupMembers || isFriendInviteLoading(friend)"
                        @click="$emit('invite-room-friend', friend)"
                      >
                        {{ isFriendInviteLoading(friend) ? '邀请中...' : '邀请' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <p v-if="!canInviteCurrentGroupMembers" class="chat-more-editor-note">
                当前群聊设置为仅群主可邀请，暂时不能生成邀请链接或直接邀请好友。
              </p>
            </div>

            <div v-else-if="item.key === 'game-code'" class="chat-more-editor chat-more-editor-compact chat-more-editor-game-code">
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
                <strong>{{ isGroupRoom ? '我在本群的昵称' : '自定义对方昵称' }}</strong>
              </div>
              <p class="chat-more-editor-note">
                {{ isGroupRoom ? '保存后会作为你在这个群里的显示昵称，其他群成员也会看到。' : '仅在你当前账号的设备里显示，不会同步到对方那边。' }}
              </p>
              <label class="chat-more-field">
                <span>昵称</span>
                <input
                  type="text"
                  :value="settings.customNickname"
                  :placeholder="isGroupRoom ? '输入你在本群的昵称' : (currentChat?.baseName || '输入新的昵称')"
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
                  :ai-slot-save-states="aiSlotSaveStates"
                  @update-slot-field="handleUpdateAiSlotField"
                  @avatar-file-change="handleAvatarFileChange"
                  @refresh-room-memory="$emit('refresh-room-memory')"
                  @open-memory-file="$emit('open-memory-file', $event)"
                  @save-ai-slot="handleSaveAiSlot"
                />
              </div>
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
        @click="$emit('open-clear-history-confirm')"
      >
        删除当前聊天记录
      </button>
      <button
        v-if="isFriendRoom"
        type="button"
        class="chat-more-danger"
        @click="$emit('open-delete-friend-confirm')"
      >
        删除好友
      </button>
    </div>

    <div
      v-if="showClearHistoryConfirm"
      class="chat-more-confirm-mask"
      @click="$emit('close-clear-history-confirm')"
    >
      <div
        class="chat-more-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="删除聊天记录确认"
        @click.stop
      >
        <div class="chat-more-confirm-head">
          <strong>确认删除聊天记录</strong>
          <button
            type="button"
            class="icon-btn"
            aria-label="关闭"
            @click="$emit('close-clear-history-confirm')"
          >
            ✕
          </button>
        </div>
        <p class="chat-more-confirm-text">{{ clearHistoryWarningText }}</p>
        <div class="chat-more-confirm-actions">
          <button
            type="button"
            class="chat-more-secondary-btn"
            @click="$emit('close-clear-history-confirm')"
          >
            取消
          </button>
          <button
            type="button"
            class="chat-more-danger-btn"
            @click="$emit('confirm-clear-history')"
          >
            确认删除
          </button>
        </div>
      </div>
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
    roomDetail: {
      type: Object,
      default: null
    },
    roomAvatarUploading: {
      type: Boolean,
      default: false
    },
    inviteFriends: {
      type: Array,
      default: () => []
    },
    inviteFriendsLoading: {
      type: Boolean,
      default: false
    },
    inviteFriendsError: {
      type: String,
      default: ''
    },
    roomInviteLink: {
      type: String,
      default: ''
    },
    roomInviteLinkGenerating: {
      type: Boolean,
      default: false
    },
    roomInviteExpireMinutes: {
      type: Number,
      default: 60
    },
    canManageCurrentGroup: {
      type: Boolean,
      default: false
    },
    canInviteCurrentGroupMembers: {
      type: Boolean,
      default: false
    },
    groupInvitePermissionOptions: {
      type: Array,
      default: () => []
    },
    roomFriendInviteLoadingByUser: {
      type: Object,
      default: () => ({})
    },
    builtinModels: {
      type: Array,
      default: () => []
    },
    collabStatusOptions: {
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
    aiSlotSaveStates: {
      type: Object,
      default: () => ({})
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
    showClearHistoryConfirm: {
      type: Boolean,
      default: false
    },
    clearHistoryWarningText: {
      type: String,
      default: ''
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
    'open-clear-history-confirm',
    'close-clear-history-confirm',
    'confirm-clear-history',
    'open-delete-friend-confirm',
    'close-delete-friend-confirm',
    'confirm-delete-friend',
    'select-room-code-game',
    'reset-room-code-game',
    'update-setting',
    'reset-nickname',
    'update-ai-slot-field',
    'avatar-file-change',
    'room-avatar-file-change',
    'reset-room-avatar',
    'update-room-invite-expire-minutes',
    'generate-room-invite-link',
    'copy-room-invite-link',
    'invite-room-friend',
    'refresh-room-memory',
    'open-memory-file',
    'toggle-dual-ai-loop',
    'generate-dual-ai-loop-round',
    'save-ai-slot'
  ],
  computed: {
    isGroupRoom() {
      return this.currentChat?.mode === 'room'
    },
    isFriendRoom() {
      return this.currentChat?.mode === 'friend'
    },
    joinedMembers() {
      const members = Array.isArray(this.roomDetail?.members) ? this.roomDetail.members : []
      return members.filter((member) => String(member?.status || '') === 'joined')
    },
    maxMemberOptions() {
      return [2, 3, 4]
    }
  },
  methods: {
    handleUpdateAiSlotField(slotId, field, value) {
      this.$emit('update-ai-slot-field', slotId, field, value)
    },
    handleAvatarFileChange(slotId, event) {
      this.$emit('avatar-file-change', slotId, event)
    },
    handleSaveAiSlot(slotId) {
      this.$emit('save-ai-slot', slotId)
    },
    getLibraryGameKey(game = {}) {
      return game?.game_id || game?.id || ''
    },
    getLibraryGameTitle(game = {}) {
      return game?.title || game?.name || `游戏 ${this.getLibraryGameKey(game)}`
    },
    getMemberDisplayName(member = {}) {
      return String(member.display_name || member.username || '成员').trim() || '成员'
    },
    getMemberInitial(member = {}) {
      return this.getMemberDisplayName(member).charAt(0).toUpperCase() || 'M'
    },
    isFriendInviteLoading(friend = {}) {
      return this.roomFriendInviteLoadingByUser[String(friend?.id || '')] === true
    }
  }
}
</script>
