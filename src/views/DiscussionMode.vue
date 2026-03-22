<template>
  <div class="page">
    <section class="left-side">
      <div class="chat-layout">
        <DiscussionChatSidebar
          :search-keyword="searchKeyword"
          :filtered-chats="filteredChats"
          :current-chat-id="currentChatId"
          :loading-rooms="loadingRooms"
          :chats-length="chats.length"
          @update:search-keyword="searchKeyword = $event"
          @select-chat="selectChat"
          @room-avatar-error="handleRoomAvatarError"
        />

        <main v-if="currentChat" class="chat-panel">
          <header class="chat-header">
              <div class="chat-user">
                <div class="avatar small" :style="{ background: currentChat.avatarColor }">
                <img
                  v-if="currentChat.avatarUrl"
                  :src="currentChat.avatarUrl"
                  :alt="currentChat.name"
                  class="avatar-image"
                  @error="handleRoomAvatarError(currentChat)"
                />
                <span v-else>{{ currentChat.avatar }}</span>
                </div>
                <div>
                  <div class="chat-user-name-row">
                    <span class="chat-user-name">{{ currentChat.name }}</span>
                    <span v-if="currentChat.displayRolePreset" class="chat-user-role">{{ currentChat.displayRolePreset }}</span>
                    <UserLevelBadge v-if="currentChat.displayUserId" :user-id="currentChat.displayUserId" />
                  </div>
                  <div class="chat-user-status-row">
                    <span class="chat-user-status">{{ currentChat.baseStatus }}</span>
                    <span
                      class="chat-user-status-badge"
                      :class="`is-${currentChatHeaderStatusMeta.tone}`"
                    >
                      {{ currentChatHeaderStatusMeta.headerLabel }}
                    </span>
                  </div>
                </div>
              </div>

            <div v-if="currentChatSupportsMorePanel" class="chat-header-actions">
              <button
                type="button"
                class="icon-btn chat-more-btn"
                :class="{ active: showChatMorePanel }"
                aria-label="更多"
                @click="toggleChatMorePanel"
              >
                ⋮
              </button>
            </div>
          </header>

          <section
            v-if="!showChatMorePanel || !currentChatSupportsMorePanel"
            ref="messagesPaneRef"
            class="chat-messages"
          >
            <div v-if="loadingMessages" class="chat-empty">正在加载消息...</div>
            <div v-else-if="!currentChat.messages.length" class="chat-empty">暂无消息，发送第一条开始讨论</div>

            <template v-for="(message, index) in currentChat.messages" :key="message.id">
              <div
                v-if="shouldShowMessageTimeDivider(currentChat.messages, index)"
                class="message-time-divider"
              >
                {{ formatMessageTimeDivider(message.rawTime) }}
              </div>

              <div
                class="message-row"
                :class="message.from === 'me' ? 'mine' : 'theirs'"
              >
                <div class="message-thread" :class="message.from === 'me' ? 'mine' : 'theirs'">
                  <span class="message-sender-name" :class="message.from === 'me' ? 'mine' : 'theirs'">
                    <template v-if="message.from === 'me'">
                      <span class="message-sender-text">{{ resolveDisplayedMessageSenderName(message) }}</span>
                      <UserLevelBadge v-if="message.senderUserId" :user-id="message.senderUserId" />
                    </template>
                    <template v-else>
                      <UserLevelBadge v-if="message.senderUserId" :user-id="message.senderUserId" />
                      <span class="message-sender-text">{{ resolveDisplayedMessageSenderName(message) }}</span>
                    </template>
                  </span>

                  <div class="message-main">
                    <AvatarFriendAction
                      v-if="message.from !== 'me'"
                      :user-id="message.senderUserId"
                      :username="message.senderName"
                      placement="left"
                    >
                      <img
                        class="message-avatar"
                        :src="message.avatarUrl"
                        :alt="message.senderName"
                        @error="handleAvatarError"
                      />
                    </AvatarFriendAction>
                    <div
                      class="message-bubble"
                      :class="{
                        'code-preview-standalone': message.codePreview && !message.text && !message.attachment && !message.documentPreview,
                        'document-preview-standalone': message.documentPreview && !message.text && !message.attachment && !message.codePreview,
                        'image-attachment-standalone': message.attachment?.type === 'image' && !message.text && !message.codePreview
                      }"
                    >
                      <div v-if="message.text" class="message-text">{{ message.text }}</div>
                      <div v-if="message.attachment" class="message-attachment">
                        <img
                          v-if="message.attachment.type === 'image'"
                          :src="message.attachment.url"
                          :alt="message.attachment.name || '图片附件'"
                          class="message-attachment-image"
                        />
                        <video
                          v-else-if="message.attachment.type === 'video'"
                          class="message-attachment-video"
                          controls
                          preload="metadata"
                        >
                          <source :src="message.attachment.url" />
                        </video>
                        <a
                          v-else
                          class="message-attachment-file"
                          :href="message.attachment.url"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <i class="fa fa-code"></i>
                          <span>{{ message.attachment.name || '代码文件' }}</span>
                        </a>
                      </div>
                      <div
                        v-if="message.codePreview"
                        class="message-code-preview message-code-preview-clickable"
                        role="button"
                        tabindex="0"
                        title="点击在右侧代码区查看完整源码"
                        @click="openCodePreviewInRightPanel(message.codePreview)"
                        @keyup.enter.prevent="openCodePreviewInRightPanel(message.codePreview)"
                        @keyup.space.prevent="openCodePreviewInRightPanel(message.codePreview)"
                      >
                        <div class="message-code-preview-head">
                          <img
                            class="code-type-icon"
                            :src="getCodeTypeIconByPath(message.codePreview.path)"
                            alt="code type"
                          />
                          <span class="message-code-preview-path" :title="message.codePreview.path">
                            {{ message.codePreview.path }}
                          </span>
                        </div>
                        <pre class="message-code-preview-snippet">
                          <code class="hljs" v-html="getCodePreviewSnippetHtml(message.codePreview)"></code>
                        </pre>
                      </div>
                      <div
                        v-if="message.documentPreview"
                        class="message-document-preview message-document-preview-clickable"
                        role="button"
                        tabindex="0"
                        title="点击在右侧文档区查看文档"
                        @click="openDocumentPreviewInRightPanel(message.documentPreview)"
                        @keyup.enter.prevent="openDocumentPreviewInRightPanel(message.documentPreview)"
                        @keyup.space.prevent="openDocumentPreviewInRightPanel(message.documentPreview)"
                      >
                        <div class="message-document-preview-head">
                          <i class="fa fa-file-text-o message-document-preview-icon" aria-hidden="true"></i>
                          <span class="message-document-preview-name" :title="message.documentPreview.name">
                            {{ message.documentPreview.name }}
                          </span>
                          <span v-if="message.documentPreview.pageCount" class="message-document-preview-pages">
                            {{ message.documentPreview.pageCount }} 页
                          </span>
                        </div>
                        <div class="message-document-preview-body">
                          {{ message.documentPreview.previewText || '点击右侧文档区查看当前文档内容。' }}
                        </div>
                      </div>
                    </div>
                    <img
                      v-if="message.from === 'me'"
                      class="message-avatar"
                      :src="message.avatarUrl"
                      :alt="message.senderName"
                      @error="handleAvatarError"
                    />
                  </div>
                </div>
              </div>
            </template>

            <div v-if="errorText" class="chat-error">{{ errorText }}</div>
          </section>

          <footer v-if="!showChatMorePanel || !currentChatSupportsMorePanel" class="chat-input-bar">
            <div class="chat-input-main">
              <div class="attach-entry" @click.stop>
                <button
                  class="icon-btn light attach-plus-btn"
                  :disabled="uploadingAttachment || !currentChat"
                  @click.stop="toggleAttachmentMenu"
                >
                  <i class="fa fa-plus"></i>
                </button>
              </div>
              <input
                ref="attachmentInputRef"
                type="file"
                class="attachment-input-hidden"
                :accept="attachmentAccept"
                @change="onAttachmentFileChange"
              />
              <input
                ref="draftInputRef"
                v-model="draft"
                type="text"
                :placeholder="sendingMessage ? '发送中...' : (uploadingAttachment ? '上传中...' : 'Message')"
                :disabled="sendingMessage || uploadingAttachment"
                @keyup.enter="sendMessage"
              />
              <button class="send-btn" :disabled="sendingMessage || uploadingAttachment" @click="sendMessage" aria-label="发送">
                <svg
                  class="send-icon-lucide"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            </div>

            <transition name="attach-tray">
              <div v-if="showAttachmentMenu" class="attach-menu" @click.stop>
                <button
                  type="button"
                  class="attach-option"
                  title="上传图片"
                  @click="openAttachmentPicker('image')"
                >
                  <i class="fa fa-image"></i>
                </button>
                <button
                  type="button"
                  class="attach-option"
                  title="上传视频"
                  @click="openAttachmentPicker('video')"
                >
                  <i class="fa fa-video-camera"></i>
                </button>
                <button
                  type="button"
                  class="attach-option"
                  title="发送代码预览"
                  @click="openCodePreviewPicker"
                >
                  <i class="fa fa-code"></i>
                </button>
                <button
                  type="button"
                  class="attach-option"
                  title="发送文档预览"
                  @click="openDocumentPreviewPicker"
                >
                  <i class="fa fa-book"></i>
                </button>
              </div>
            </transition>
          </footer>

          <DiscussionChatMorePanel
            v-if="showChatMorePanel && currentChatSupportsMorePanel"
            :menu-items="chatMoreMenuItems"
            :active-section="activeChatMoreSection"
            :settings="currentChatMoreSettings"
            :enabled-ai-slots="enabledAiSlots"
            :dual-ai-loop-ready="dualAiLoopReady"
            :effective-code-game-title="effectiveCodeGameTitle"
            :effective-code-game-id="effectiveCodeGameId"
            :current-chat="currentChat"
            :builtin-models="chatMoreBuiltinModels"
            :collab-status-options="chatMoreCollabStatusOptions"
            :role-preset-options="chatMoreRolePresetOptions"
            :show-game-library-picker="showGameLibraryPicker"
            :game-library-loading="gameLibraryLoading"
            :game-library-error="gameLibraryError"
            :game-library-games="gameLibraryGames"
            :show-delete-friend-confirm="showDeleteFriendConfirm"
            :delete-friend-warning-text="getDeleteFriendWarningText()"
            @item-click="handleChatMoreItemClick"
            @open-game-picker="openGameLibraryPicker"
            @close-game-picker="closeGameLibraryPicker"
            @open-delete-friend-confirm="openDeleteFriendConfirm"
            @close-delete-friend-confirm="closeDeleteFriendConfirm"
            @confirm-delete-friend="handleDeleteFriendClick"
            @select-room-code-game="selectRoomCodeGame"
            @reset-room-code-game="resetRoomCodeGame"
            @update-setting="updateCurrentRoomSetting"
            @reset-nickname="resetCurrentRoomNickname"
            @update-ai-slot-field="updateAiSlotField"
            @avatar-file-change="onAiAvatarFileChange"
            @toggle-dual-ai-loop="toggleDualAiLoop"
            @generate-dual-ai-loop-round="generateDualAiLoopRound"
          />

          <DiscussionResourcePicker
            :visible="showCodePicker"
            title="选择当前游戏源码文件"
            :search-keyword="codePickerKeyword"
            placeholder="搜索文件路径..."
            :loading="codePickerLoading"
            loading-text="源码加载中..."
            empty-text="没有可选源码文件"
            :items="filteredCodePickerFiles"
            :disabled="uploadingAttachment"
            item-key-field="path"
            item-primary-field="path"
            item-secondary-field="language"
            @close="closeCodePicker"
            @update:search-keyword="codePickerKeyword = $event.trim()"
            @select="sendCodePreviewFromFile"
          />

          <DiscussionResourcePicker
            :visible="showDocumentPicker"
            title="选择当前房间文档"
            :search-keyword="documentPickerKeyword"
            placeholder="搜索文档名称..."
            :loading="documentPickerLoading"
            loading-text="文档加载中..."
            empty-text="没有可选文档"
            :items="documentPickerPickerItems"
            :disabled="uploadingAttachment"
            item-key-field="id"
            item-primary-field="name"
            item-secondary-field="metaLabel"
            @close="closeDocumentPicker"
            @update:search-keyword="documentPickerKeyword = $event.trim()"
            @select="sendDocumentPreview"
          />
        </main>

        <main v-else class="chat-panel chat-panel-empty">
          <div class="chat-empty">暂无可用房间，请先加入一个讨论房间</div>
        </main>
      </div>
    </section>

    <section class="right-side">
      <div class="right-slider-wrap">
        <div class="right-slider">
          <div class="right-slider-pill" :style="{ transform: `translateX(${rightTabIndex * 100}%)` }"></div>
          <button
            v-for="tab in rightPanelTabs"
            :key="tab.key"
            type="button"
            class="right-slider-tab"
            :class="{ active: activeRightTab === tab.key }"
            @click="switchRightTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
      <div class="right-panel-stage">
        <transition name="right-panel-switch" mode="out-in">
          <KeepAlive :include="['DiscussionDocsPanel', 'DiscussionCodePanel', 'DiscussionTasksPanel']">
            <component
              :is="activeRightPanelComponent"
              :key="activeRightPanelKey"
              class="right-panel-view"
              v-bind="activeRightPanelProps"
              v-on="activeRightPanelListeners"
            />
          </KeepAlive>
        </transition>
      </div>
    </section>
  </div>
</template>

<script>
import { h } from 'vue'
import { apiCall } from '../utils/api'
import { getAvatarUrl, handleAvatarError as fallbackAvatar } from '../utils/avatar'
import AvatarFriendAction from '../components/AvatarFriendAction.vue'
import UserLevelBadge from '../components/UserLevelBadge.vue'
import DiscussionChatSidebar from '../components/discussion/DiscussionChatSidebar.vue'
import DiscussionDocsPanel from '../components/discussion/DiscussionDocsPanel.vue'
import DiscussionCodePanel from '../components/discussion/DiscussionCodePanel.vue'
import DiscussionTasksPanel from '../components/discussion/DiscussionTasksPanel.vue'
import DiscussionChatMorePanel from '../components/discussion/DiscussionChatMorePanel.vue'
import DiscussionResourcePicker from '../components/discussion/DiscussionResourcePicker.vue'
import { normalizeChatMoreSettings } from '../utils/discussionChatMore'
import {
  toDiscussionInt,
  parseDiscussionMetadata,
  formatDiscussionMessageTimeDivider,
  shouldShowDiscussionMessageTimeDivider,
  getDiscussionCodeTypeIconByPath,
  highlightDiscussionCode,
  normalizeDiscussionCodeFile,
  createDiscussionChatFromRoom
} from '../utils/discussionModeCore'
import discussionChatMoreMixin from '../mixins/discussionChatMoreMixin'
import discussionMessagesMixin from '../mixins/discussionMessagesMixin'
import discussionRealtimeMixin from '../mixins/discussionRealtimeMixin'
const DiscussionPlaceholderPanel = {
  name: 'DiscussionPlaceholderPanel',
  props: {
    activeTab: {
      type: String,
      default: 'task'
    }
  },
  render() {
    const title = this.activeTab === 'task' ? '任务区' : '文件区'
    return h('div', { class: 'right-fallback-shell' }, [
      h('h3', title),
      h('p', '该区域正在完善中，当前版本优先支持文档区与代码区。')
    ])
  }
}

export default {
  name: 'DiscussionMode',
  mixins: [discussionChatMoreMixin, discussionMessagesMixin, discussionRealtimeMixin],
  components: {
    AvatarFriendAction,
    UserLevelBadge,
    DiscussionChatSidebar,
    DiscussionDocsPanel,
    DiscussionCodePanel,
    DiscussionTasksPanel,
    DiscussionChatMorePanel,
    DiscussionResourcePicker,
    DiscussionPlaceholderPanel
  },
  props: {
    id: {
      type: [String, Number],
      default: null
    }
  },
  data() {
    return {
      currentUserId: null,
      currentUsername: 'You',
      currentUserAvatarUrl: getAvatarUrl(''),
      currentChatId: null,
      draft: '',
      searchKeyword: '',
      chats: [],
      loadingRooms: false,
      showAttachmentMenu: false,
      showCodePicker: false,
      showDocumentPicker: false,
      codePickerLoading: false,
      codePickerKeyword: '',
      codePickerFiles: [],
      documentPickerLoading: false,
      documentPickerKeyword: '',
      documentPickerDocuments: [],
      documentPreviewRequest: null,
      codeFilesByGame: {},
      codePanelLoading: false,
      codePanelError: '',
      currentCodePath: '',
      errorText: '',
      showChatMorePanel: false,
      rightPanelTabs: [
        { key: 'docs', label: '文档区' },
        { key: 'code', label: '代码区' },
        { key: 'task', label: '任务区' },
        { key: 'file', label: '文件区' }
      ],
      activeRightTab: 'code'
    }
  },
  computed: {
    currentChat() {
      return this.chats.find(item => item.id === this.currentChatId) || null
    },
    filteredChats() {
      const keyword = this.searchKeyword.toLowerCase()
      if (!keyword) return this.chats
      return this.chats.filter((item) => {
        return (
          item.name.toLowerCase().includes(keyword)
          || item.preview.toLowerCase().includes(keyword)
          || item.status.toLowerCase().includes(keyword)
        )
      })
    },
    currentChatSupportsMorePanel() {
      return this.isChatMoreAvailable(this.currentChat)
    },
    currentChatMoreSettings() {
      return this.getRoomSettings(this.currentChat?.id)
    },
    currentChatHeaderStatusMeta() {
      return this.getChatHeaderStatusMeta(this.currentChat)
    },
    effectiveCodeGameId() {
      const settingsGameId = String(this.currentChatMoreSettings?.sourceGameId || '').trim()
      if (settingsGameId) return settingsGameId
      return String(this.currentChat?.gameId || '').trim()
    },
    effectiveCodeGameTitle() {
      const settingsTitle = String(this.currentChatMoreSettings?.sourceGameTitle || '').trim()
      if (settingsTitle) return settingsTitle
      return String(this.currentChat?.gameTitle || '').trim()
    },
    enabledAiSlots() {
      const slots = Array.isArray(this.currentChatMoreSettings?.aiSlots) ? this.currentChatMoreSettings.aiSlots : []
      return slots.filter((slot) => slot && slot.enabled)
    },
    dualAiLoopReady() {
      return this.currentChatSupportsMorePanel && this.enabledAiSlots.length >= 2
    },
    currentRoomCodeFiles() {
      const gameKey = this.effectiveCodeGameId
      if (!gameKey) return []
      return Array.isArray(this.codeFilesByGame[gameKey]) ? this.codeFilesByGame[gameKey] : []
    },
    currentCodeFile() {
      if (!this.currentRoomCodeFiles.length) return null
      return this.currentRoomCodeFiles.find((file) => file.path === this.currentCodePath) || this.currentRoomCodeFiles[0] || null
    },
    currentFileName() {
      if (this.currentCodeFile?.path) return this.currentCodeFile.path
      if (!this.effectiveCodeGameId) return '未绑定游戏源码'
      return `${this.effectiveCodeGameTitle || `game-${this.effectiveCodeGameId}`} 无源码`
    },
    codeText() {
      if (this.currentCodeFile) {
        return String(this.currentCodeFile.content || '')
      }
      if (this.codePanelError) return this.codePanelError
      return '// 当前房间暂无可展示源码'
    },
    highlightedCodeText() {
      return this.highlightCode(String(this.codeText || ''), this.currentCodeFile?.path || '')
    },
    filteredCodePickerFiles() {
      const keyword = String(this.codePickerKeyword || '').toLowerCase()
      if (!keyword) return this.codePickerFiles
      return this.codePickerFiles.filter((file) => file.path.toLowerCase().includes(keyword))
    },
    filteredDocumentPickerDocuments() {
      const keyword = String(this.documentPickerKeyword || '').toLowerCase()
      if (!keyword) return this.documentPickerDocuments
      return this.documentPickerDocuments.filter((doc) => doc.name.toLowerCase().includes(keyword))
    },
    documentPickerPickerItems() {
      return this.filteredDocumentPickerDocuments.map((doc) => ({
        ...doc,
        metaLabel: doc.pageCount ? `${doc.pageCount}页` : '文档'
      }))
    },
    rightTabIndex() {
      const index = this.rightPanelTabs.findIndex((tab) => tab.key === this.activeRightTab)
      return index >= 0 ? index : 1
    },
    activeRightPanelKey() {
      return `right-panel-${this.activeRightTab}`
    },
    activeRightPanelComponent() {
      if (this.activeRightTab === 'docs') return DiscussionDocsPanel
      if (this.activeRightTab === 'code') return DiscussionCodePanel
      if (this.activeRightTab === 'task') return DiscussionTasksPanel
      return DiscussionPlaceholderPanel
    },
    activeRightPanelProps() {
      if (this.activeRightTab === 'docs') {
        return {
          currentChat: this.currentChat,
          isActive: true,
          documentPreviewRequest: this.documentPreviewRequest
        }
      }
      if (this.activeRightTab === 'code') {
        return {
          currentChat: this.currentChat,
          currentRoomCodeFiles: this.currentRoomCodeFiles,
          currentCodePath: this.currentCodePath,
          currentFileName: this.currentFileName,
          currentCodeSourceGameId: this.effectiveCodeGameId,
          currentCodeSourceGameTitle: this.effectiveCodeGameTitle,
          codePanelLoading: this.codePanelLoading,
          codePanelError: this.codePanelError,
          highlightedCodeText: this.highlightedCodeText
        }
      }
      if (this.activeRightTab === 'task') {
        return {
          currentChat: this.currentChat,
          isActive: true
        }
      }
      return {
        activeTab: this.activeRightTab
      }
    },
    activeRightPanelListeners() {
      if (this.activeRightTab !== 'code') return {}
      return {
        refresh: this.refreshCurrentRoomCode,
        'update:currentCodePath': this.handleCodePathUpdate
      }
    }
  },
  watch: {
    id() {
      this.initializeDiscussion()
    },
    currentChatSupportsMorePanel(nextValue) {
      if (!nextValue && this.showChatMorePanel) {
        this.closeChatMorePanel()
      }
    },
    currentChatId() {
      this.activeChatMoreSection = ''
    }
  },
  mounted() {
    this.currentUserId = this.readCurrentUserId()
    this.setupSocket()
    this.startMessagePolling()
    this.initializeDiscussion()
    window.addEventListener('click', this.closeAttachmentMenu)
  },
  beforeUnmount() {
    window.removeEventListener('click', this.closeAttachmentMenu)
    Object.values(this.roomSettingsSaveTimers).forEach((timerId) => window.clearTimeout(timerId))
    this.stopMessagePolling()
    this.teardownSocket()
  },
  methods: {
    readCurrentUserId() {
      try {
        const user = JSON.parse(localStorage.getItem('currentUser') || 'null')
        this.currentUsername = user?.username || 'You'
        this.currentUserAvatarUrl = getAvatarUrl(user?.avatar_url || '')
        return toDiscussionInt(user?.id)
      } catch (error) {
        this.currentUsername = 'You'
        this.currentUserAvatarUrl = getAvatarUrl('')
        return null
      }
    },
    resolveDisplayedMessageSenderName(message = {}) {
      if (message?.from !== 'me' && message?.senderType === 'user' && this.currentChat?.name) {
        return this.currentChat.name
      }
      return message?.senderName || '成员'
    },
    parseRoomId(value) {
      const roomId = toDiscussionInt(value)
      return roomId && roomId > 0 ? roomId : null
    },
    formatMessageTimeDivider(rawTime) {
      return formatDiscussionMessageTimeDivider(rawTime)
    },
    shouldShowMessageTimeDivider(messages = [], index = 0) {
      return shouldShowDiscussionMessageTimeDivider(messages, index)
    },
    getCodeTypeIconByPath(filePath = '') {
      return getDiscussionCodeTypeIconByPath(filePath)
    },
    highlightCode(content = '', filePath = '') {
      return highlightDiscussionCode(content, filePath)
    },
    getCodePreviewSnippetHtml(codePreview) {
      if (!codePreview) return ''
      return this.highlightCode(codePreview.snippet || '', codePreview.path || '')
    },
    switchRightTab(nextTab, options = {}) {
      if (!nextTab || this.activeRightTab === nextTab) return
      this.activeRightTab = nextTab

      const shouldPrefetchCode = options.prefetchCode !== false
      if (shouldPrefetchCode && nextTab === 'code' && this.currentChat && !this.codePanelLoading && !this.currentRoomCodeFiles.length) {
        this.syncCurrentRoomCode()
      }
    },
    handleCodePathUpdate(nextPath) {
      this.currentCodePath = String(nextPath || '')
    },
    async openCodePreviewInRightPanel(codePreview) {
      const previewPath = String(codePreview?.path || '').trim()
      if (!previewPath || !this.currentChat) return

      this.switchRightTab('code', { prefetchCode: false })
      this.codePanelError = ''
      this.errorText = ''

      const gameId = this.effectiveCodeGameId
      if (!gameId) {
        this.codePanelError = '当前房间没有可用源码'
        return
      }

      const gameKey = String(gameId).trim()
      const hasCachedFiles = Array.isArray(this.codeFilesByGame[gameKey]) && this.codeFilesByGame[gameKey].length > 0
      if (!hasCachedFiles) {
        this.codePanelLoading = true
      }

      try {
        const files = await this.loadGameCodeFiles(gameId)
        if (!files.length) {
          this.currentCodePath = ''
          this.codePanelError = '当前房间游戏暂无可浏览源码'
          return
        }

        const targetFile = files.find((file) => file.path === previewPath)
        if (targetFile) {
          this.currentCodePath = targetFile.path
          return
        }

        this.currentCodePath = files[0].path
        this.codePanelError = `未找到对应源码文件：${previewPath}`
      } catch (error) {
        this.codePanelError = error.message || '加载源码失败'
      } finally {
        this.codePanelLoading = false
      }
    },
    async openDocumentPreviewInRightPanel(documentPreview) {
      const documentId = Number(documentPreview?.documentId || 0)
      if (!documentId || !this.currentChat) return

      this.documentPreviewRequest = {
        key: `${documentId}-${Date.now()}`,
        roomId: Number(this.currentChat.id || 0),
        documentId
      }
      this.switchRightTab('docs', { prefetchCode: false })
    },
    closeCodePicker() {
      this.showCodePicker = false
      this.codePickerKeyword = ''
    },
    closeDocumentPicker() {
      this.showDocumentPicker = false
      this.documentPickerKeyword = ''
    },
    async loadGameCodeFiles(gameId, options = {}) {
      const gameKey = String(gameId || '').trim()
      if (!gameKey) return []
      const force = options?.force === true

      if (!force && Array.isArray(this.codeFilesByGame[gameKey])) {
        return this.codeFilesByGame[gameKey]
      }

      const data = await apiCall(`/games/${encodeURIComponent(gameKey)}/code`)
      const files = Array.isArray(data?.files)
        ? data.files.map((file) => normalizeDiscussionCodeFile(file)).filter(Boolean)
        : []
      this.codeFilesByGame[gameKey] = files
      return files
    },
    async syncCurrentRoomCode(options = {}) {
      const gameId = this.effectiveCodeGameId
      this.codePanelError = ''

      if (!gameId) {
        this.currentCodePath = ''
        return
      }

      this.codePanelLoading = true
      try {
        const files = await this.loadGameCodeFiles(gameId, options)
        if (!files.length) {
          this.currentCodePath = ''
          return
        }
        if (!files.some((file) => file.path === this.currentCodePath)) {
          this.currentCodePath = files[0].path
        }
      } catch (error) {
        this.currentCodePath = ''
        this.codePanelError = error.message || '加载源码失败'
      } finally {
        this.codePanelLoading = false
      }
    },
    async refreshCurrentRoomCode() {
      if (!this.effectiveCodeGameId || this.codePanelLoading) return
      await this.syncCurrentRoomCode({ force: true })
    },
    async openCodePreviewPicker() {
      if (!this.currentChat || this.uploadingAttachment) return
      const gameId = this.effectiveCodeGameId
      if (!gameId) {
        this.errorText = '当前房间没有可用的游戏源码'
        return
      }

      this.showAttachmentMenu = false
      this.showCodePicker = true
      this.codePickerLoading = true
      this.codePickerKeyword = ''
      this.errorText = ''

      try {
        this.codePickerFiles = await this.loadGameCodeFiles(gameId)
      } catch (error) {
        this.codePickerFiles = []
        this.errorText = error.message || '源码加载失败'
      } finally {
        this.codePickerLoading = false
      }
    },
    mapRoomToChat(room) {
      const parsedSettings = normalizeChatMoreSettings(parseDiscussionMetadata(room.room_settings_json) || {})
      this.setRoomSettings(room.id, parsedSettings)
      const chat = createDiscussionChatFromRoom(room)
      this.applyRoomSettingsToChat(chat)
      return chat
    },
    handleAvatarError(event) {
      fallbackAvatar(event)
    },
    handleRoomAvatarError(chat) {
      if (!chat || typeof chat !== 'object') return
      chat.avatarUrl = ''
    },
    isChatMoreAvailable(chat) {
      if (!chat || typeof chat !== 'object') return false
      return chat.mode === 'friend' && Number(chat.memberCount || 0) <= 2
    },
    closeAttachmentMenu() {
      this.showAttachmentMenu = false
    },
    toggleAttachmentMenu() {
      if (!this.currentChat || this.uploadingAttachment) return
      this.showChatMorePanel = false
      this.showCodePicker = false
      this.showDocumentPicker = false
      this.showGameLibraryPicker = false
      this.showAttachmentMenu = !this.showAttachmentMenu
    },
    async initializeDiscussion() {
      this.loadingRooms = true
      this.errorText = ''
      this.chats = []
      this.currentChatId = null
      this.showChatMorePanel = false
      this.showGameLibraryPicker = false
      this.activeChatMoreSection = ''
      this.currentCodePath = ''
      this.codePanelError = ''
      this.codePanelLoading = false

      const preferredRoomId = this.parseRoomId(this.id)
      if (preferredRoomId) {
        await this.tryJoinRoom(preferredRoomId)
      }

      try {
        const data = await apiCall('/discussion/rooms/mine')
        this.chats = (data.rooms || []).map(room => this.mapRoomToChat(room))
        await this.syncSocketSubscriptions()

        if (!this.chats.length) return

        const hasPreferred = preferredRoomId && this.chats.some(item => item.id === preferredRoomId)
        const targetRoomId = hasPreferred ? preferredRoomId : this.chats[0].id
        await this.selectChat(targetRoomId, { force: true })
      } catch (error) {
        this.errorText = error.message || '加载讨论房间失败'
      } finally {
        this.loadingRooms = false
      }
    },
    async tryJoinRoom(roomId) {
      try {
        await apiCall(`/discussion/rooms/${roomId}/join`, { method: 'POST' })
      } catch (error) {
        // 非成员或房间不存在时，继续展示当前用户已有房间
        console.warn('尝试加入指定房间失败:', error)
      }
    },
    async selectChat(chatId, options = {}) {
      if (!chatId) return
      if (this.currentChatId) {
        await this.flushRoomSettingsSave(this.currentChatId)
      }
      this.showAttachmentMenu = false
      this.showChatMorePanel = false
      this.showGameLibraryPicker = false
      this.activeChatMoreSection = ''
      this.closeCodePicker()
      this.currentChatId = chatId
      this.markChatAsRead(chatId)
      this.syncSocketSubscriptions()

      const chat = this.chats.find(item => item.id === chatId)
      if (!chat) return
      if (chat.messagesLoaded && !options.force) {
        if (this.activeRightTab === 'code') {
          await this.syncCurrentRoomCode()
        }
        this.$nextTick(() => this.scrollMessagesToBottom())
        return
      }

      const loadingTasks = [this.fetchMessages(chatId)]
      if (this.currentChatSupportsMorePanel) {
        loadingTasks.push(this.fetchRoomSettings(chatId))
      }
      if (this.activeRightTab === 'code') {
        loadingTasks.push(this.syncCurrentRoomCode())
      }
      await Promise.all(loadingTasks)
    },
    scrollMessagesToBottom() {
      const container = this.$refs.messagesPaneRef
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    },
    focusDraftInput() {
      const input = this.$refs.draftInputRef
      if (!input || typeof input.focus !== 'function') return
      input.focus({ preventScroll: true })
    },
  }
}
</script>

<style src="../styles/discussion-mode.css"></style>
