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
                    <UserLevelBadge v-if="currentChat.displayUserId" :user-id="currentChat.displayUserId" />
                  </div>
                  <div class="chat-user-status">{{ currentChat.status }}</div>
                </div>
              </div>

            <div class="chat-header-actions">
              <button class="icon-btn">⋮</button>
            </div>
          </header>

          <section ref="messagesPaneRef" class="chat-messages">
            <div class="day-tag">Today</div>
            <div v-if="loadingMessages" class="chat-empty">正在加载消息...</div>
            <div v-else-if="!currentChat.messages.length" class="chat-empty">暂无消息，发送第一条开始讨论</div>

            <div
              v-for="message in currentChat.messages"
              :key="message.id"
              class="message-row"
              :class="message.from === 'me' ? 'mine' : 'theirs'"
            >
              <div class="message-thread" :class="message.from === 'me' ? 'mine' : 'theirs'">
                <span class="message-sender-name" :class="message.from === 'me' ? 'mine' : 'theirs'">
                  <template v-if="message.from === 'me'">
                    <span class="message-sender-text">{{ message.senderName }}</span>
                    <UserLevelBadge v-if="message.senderUserId" :user-id="message.senderUserId" />
                  </template>
                  <template v-else>
                    <UserLevelBadge v-if="message.senderUserId" :user-id="message.senderUserId" />
                    <span class="message-sender-text">{{ message.senderName }}</span>
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
                      'code-preview-standalone': message.codePreview && !message.text && !message.attachment,
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
                    <div class="message-meta">
                      <span>{{ message.time }}</span>
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

            <div v-if="errorText" class="chat-error">{{ errorText }}</div>
          </section>

          <footer class="chat-input-bar">
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
              </div>
            </transition>
          </footer>

          <div v-if="showCodePicker" class="code-picker-mask" @click="closeCodePicker">
            <div class="code-picker-panel" @click.stop>
              <div class="code-picker-head">
                <strong>选择当前游戏源码文件</strong>
                <button type="button" class="icon-btn" @click="closeCodePicker">✕</button>
              </div>
              <div class="code-picker-search">
                <input
                  v-model.trim="codePickerKeyword"
                  type="text"
                  placeholder="搜索文件路径..."
                />
              </div>
              <div class="code-picker-body">
                <div v-if="codePickerLoading" class="chat-empty">源码加载中...</div>
                <div v-else-if="!filteredCodePickerFiles.length" class="chat-empty">没有可选源码文件</div>
                <button
                  v-for="file in filteredCodePickerFiles"
                  :key="file.path"
                  type="button"
                  class="code-picker-item"
                  :disabled="uploadingAttachment"
                  @click="sendCodePreviewFromFile(file)"
                >
                  <span class="code-picker-item-path">{{ file.path }}</span>
                  <span class="code-picker-item-lang">{{ file.language }}</span>
                </button>
              </div>
            </div>
          </div>
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
          <KeepAlive :include="['DiscussionDocsPanel', 'DiscussionCodePanel']">
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
import { io } from 'socket.io-client'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import python from 'highlight.js/lib/languages/python'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import { apiCall, API_BASE_URL } from '../utils/api'
import { getAvatarUrl, handleAvatarError as fallbackAvatar } from '../utils/avatar'
import AvatarFriendAction from '../components/AvatarFriendAction.vue'
import UserLevelBadge from '../components/UserLevelBadge.vue'
import DiscussionChatSidebar from '../components/discussion/DiscussionChatSidebar.vue'
import DiscussionDocsPanel from '../components/discussion/DiscussionDocsPanel.vue'
import DiscussionCodePanel from '../components/discussion/DiscussionCodePanel.vue'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('python', python)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c', cpp)
hljs.registerLanguage('csharp', csharp)

const MODE_LABELS = {
  friend: '好友',
  room: '房间',
  match: '匹配'
}

const STATUS_LABELS = {
  waiting: '等待中',
  active: '讨论中',
  closed: '已关闭'
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #8ab4ff, #4d7cff)',
  'linear-gradient(135deg, #ffb199, #ff6a88)',
  'linear-gradient(135deg, #6dd5ed, #2193b0)',
  'linear-gradient(135deg, #a18cd1, #6a82fb)',
  'linear-gradient(135deg, #f6d365, #fda085)'
]
const AI_AVATAR_URL = '/Ai/DouBaoSeed1.6.png'

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

const formatClock = (value) => {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

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
  components: {
    AvatarFriendAction,
    UserLevelBadge,
    DiscussionChatSidebar,
    DiscussionDocsPanel,
    DiscussionCodePanel,
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
      loadingMessages: false,
      sendingMessage: false,
      sendingAi: false,
      uploadingAttachment: false,
      showAttachmentMenu: false,
      showCodePicker: false,
      codePickerLoading: false,
      codePickerKeyword: '',
      codePickerFiles: [],
      codeFilesByGame: {},
      codePanelLoading: false,
      codePanelError: '',
      currentCodePath: '',
      attachmentKind: '',
      attachmentAccept: '',
      errorText: '',
      socket: null,
      subscribedRoomIds: {},
      messagePollTimer: null,
      messagePollPending: false,
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
    currentRoomCodeFiles() {
      const gameKey = String(this.currentChat?.gameId || '').trim()
      if (!gameKey) return []
      return Array.isArray(this.codeFilesByGame[gameKey]) ? this.codeFilesByGame[gameKey] : []
    },
    currentCodeFile() {
      if (!this.currentRoomCodeFiles.length) return null
      return this.currentRoomCodeFiles.find((file) => file.path === this.currentCodePath) || this.currentRoomCodeFiles[0] || null
    },
    currentFileName() {
      if (this.currentCodeFile?.path) return this.currentCodeFile.path
      if (!this.currentChat?.gameId) return '未绑定游戏源码'
      return `game-${this.currentChat.gameId} 无源码`
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
      return DiscussionPlaceholderPanel
    },
    activeRightPanelProps() {
      if (this.activeRightTab === 'docs') {
        return {
          currentChat: this.currentChat,
          isActive: true
        }
      }
      if (this.activeRightTab === 'code') {
        return {
          currentChat: this.currentChat,
          currentRoomCodeFiles: this.currentRoomCodeFiles,
          currentCodePath: this.currentCodePath,
          currentFileName: this.currentFileName,
          codePanelLoading: this.codePanelLoading,
          codePanelError: this.codePanelError,
          highlightedCodeText: this.highlightedCodeText
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
    this.stopMessagePolling()
    this.teardownSocket()
  },
  methods: {
    readCurrentUserId() {
      try {
        const user = JSON.parse(localStorage.getItem('currentUser') || 'null')
        this.currentUsername = user?.username || 'You'
        this.currentUserAvatarUrl = getAvatarUrl(user?.avatar_url || '')
        return toInt(user?.id)
      } catch (error) {
        this.currentUsername = 'You'
        this.currentUserAvatarUrl = getAvatarUrl('')
        return null
      }
    },
    parseRoomId(value) {
      const roomId = toInt(value)
      return roomId && roomId > 0 ? roomId : null
    },
    roomColorById(roomId) {
      const colorIndex = Math.abs(Number(roomId || 0)) % AVATAR_COLORS.length
      return AVATAR_COLORS[colorIndex]
    },
    resolveRoomAvatarUrl(rawAvatarUrl) {
      const value = String(rawAvatarUrl || '').trim()
      if (!value || value === '/avatars/default-avatar.svg') return ''
      return getAvatarUrl(value)
    },
    parseMetadata(raw) {
      if (!raw) return null
      if (typeof raw === 'object') return raw
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      }
      return null
    },
    normalizeAttachment(attachment) {
      if (!attachment || typeof attachment !== 'object') return null
      const url = String(attachment.url || '').trim()
      if (!url) return null
      const type = String(attachment.type || '').trim().toLowerCase()
      if (!['image', 'video', 'code'].includes(type)) return null
      return {
        type,
        url,
        name: String(attachment.name || '').trim()
      }
    },
    normalizeCodePreview(codePreview) {
      if (!codePreview || typeof codePreview !== 'object') return null
      const path = String(codePreview.path || '').trim()
      const snippet = String(codePreview.snippet || '').replace(/\r/g, '').trim()
      if (!path || !snippet) return null
      return {
        path,
        snippet,
        language: String(codePreview.language || '').trim(),
        totalLines: Number.parseInt(codePreview.total_lines, 10) || null
      }
    },
    inferCodeLanguage(filePath = '') {
      const normalized = String(filePath || '').toLowerCase()
      if (normalized.endsWith('.ts')) return 'TypeScript'
      if (normalized.endsWith('.tsx')) return 'TSX'
      if (normalized.endsWith('.js')) return 'JavaScript'
      if (normalized.endsWith('.jsx')) return 'JSX'
      if (normalized.endsWith('.vue')) return 'Vue'
      if (normalized.endsWith('.css') || normalized.endsWith('.scss') || normalized.endsWith('.less')) return 'CSS'
      if (normalized.endsWith('.json')) return 'JSON'
      if (normalized.endsWith('.md')) return 'Markdown'
      if (normalized.endsWith('.py')) return 'Python'
      if (normalized.endsWith('.cs')) return 'C#'
      if (normalized.endsWith('.cpp') || normalized.endsWith('.cc') || normalized.endsWith('.c')) return 'C/C++'
      if (normalized.endsWith('.h')) return 'Header'
      if (normalized.endsWith('.html')) return 'HTML'
      return 'Code'
    },
    getCodeTypeIconByPath(filePath = '') {
      const normalized = String(filePath || '').toLowerCase()
      if (normalized.endsWith('.ts') || normalized.endsWith('.tsx')) return '/codeType/typescript.jpg'
      if (normalized.endsWith('.cs')) return '/codeType/csharp.webp'
      return '/codeType/js.webp'
    },
    inferHighlightLanguage(filePath = '') {
      const normalized = String(filePath || '').toLowerCase()
      if (normalized.endsWith('.ts') || normalized.endsWith('.tsx')) return 'typescript'
      if (normalized.endsWith('.js') || normalized.endsWith('.jsx')) return 'javascript'
      if (normalized.endsWith('.vue') || normalized.endsWith('.html')) return 'xml'
      if (normalized.endsWith('.css')) return 'css'
      if (normalized.endsWith('.scss') || normalized.endsWith('.less')) return 'css'
      if (normalized.endsWith('.json')) return 'json'
      if (normalized.endsWith('.py')) return 'python'
      if (normalized.endsWith('.cs')) return 'csharp'
      if (normalized.endsWith('.cpp') || normalized.endsWith('.cc')) return 'cpp'
      if (normalized.endsWith('.c') || normalized.endsWith('.h')) return 'c'
      return ''
    },
    highlightCode(content = '', filePath = '') {
      const source = String(content || '')
      if (!source) return ''

      const language = this.inferHighlightLanguage(filePath)
      if (language && hljs.getLanguage(language)) {
        try {
          return hljs.highlight(source, { language }).value
        } catch {
          // fallback to auto detect
        }
      }

      try {
        return hljs.highlightAuto(source).value
      } catch {
        return source
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      }
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

      const gameId = this.currentChat?.gameId
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
    normalizeCodeFile(file = {}) {
      const path = String(file.path || '').trim()
      const content = String(file.content || '').replace(/\r/g, '')
      if (!path) return null
      return {
        path,
        content,
        language: this.inferCodeLanguage(path)
      }
    },
    buildCodePreview(file = {}) {
      const lines = String(file.content || '').replace(/\r/g, '').split('\n')
      const snippet = lines.slice(0, 14).join('\n').slice(0, 1500)
      return {
        path: file.path,
        snippet,
        language: file.language || this.inferCodeLanguage(file.path),
        total_lines: lines.length
      }
    },
    closeCodePicker() {
      this.showCodePicker = false
      this.codePickerKeyword = ''
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
        ? data.files.map((file) => this.normalizeCodeFile(file)).filter(Boolean)
        : []
      this.codeFilesByGame[gameKey] = files
      return files
    },
    async syncCurrentRoomCode(options = {}) {
      const gameId = this.currentChat?.gameId
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
      if (!this.currentChat?.gameId || this.codePanelLoading) return
      await this.syncCurrentRoomCode({ force: true })
    },
    async openCodePreviewPicker() {
      if (!this.currentChat || this.uploadingAttachment) return
      const gameId = this.currentChat.gameId
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
    async sendCodePreviewFromFile(file) {
      if (!file || !this.currentChat || this.uploadingAttachment) return

      const codePreview = this.buildCodePreview(file)
      if (!codePreview.path || !codePreview.snippet) {
        this.errorText = '该文件内容为空，无法发送预览'
        return
      }

      this.uploadingAttachment = true
      this.errorText = ''
      try {
        const response = await apiCall(`/discussion/rooms/${this.currentChat.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content: `代码预览：${codePreview.path}`,
            metadata: {
              code_preview: codePreview
            }
          })
        })

        const rawMessage = response.message
        this.appendMessageIfNeeded(this.currentChat, rawMessage)
        this.currentChat.messagesLoaded = true
        this.updateChatSummary(this.currentChat, rawMessage)
        this.closeCodePicker()
        this.$nextTick(() => this.scrollMessagesToBottom())
      } catch (error) {
        this.errorText = error.message || '代码预览发送失败'
      } finally {
        this.uploadingAttachment = false
      }
    },
    mapRoomToChat(room) {
      const roomName = room.title?.trim() || `${room.game_title || '未命名游戏'} 讨论房`
      const isFriendRoom = room.mode === 'friend'
      const friendUserId = toInt(room.friend_user_id)
      const hostUserId = toInt(room.host_user_id)
      const friendName = String(room.friend_username || '').trim()
      const displayName = isFriendRoom && friendName ? friendName : roomName
      const displayUserId = isFriendRoom ? friendUserId : hostUserId
      const avatarText = displayName.charAt(0).toUpperCase() || 'R'
      const avatarUrl = isFriendRoom ? this.resolveRoomAvatarUrl(room.friend_avatar_url) : ''
      const memberCount = Number(room.joined_count || 0)
      const maxMembers = Number(room.max_members || 4)
      const modeLabel = MODE_LABELS[room.mode] || '房间'
      const statusLabel = STATUS_LABELS[room.status] || room.status || '未知状态'
      const preview = (room.last_message_content || '暂无消息，发送第一条开始讨论').toString()

      return {
        id: Number(room.id),
        name: displayName,
        verified: room.mode === 'match',
        time: formatClock(room.last_message_at || room.updated_at || room.created_at),
        preview,
        unread: 0,
        avatar: avatarText,
        avatarUrl,
        avatarColor: this.roomColorById(room.id),
        status: `${modeLabel} · ${memberCount}/${maxMembers} · ${statusLabel}`,
        statusRaw: room.status,
        roomCode: room.room_code,
        mode: room.mode,
        visibility: room.visibility,
        displayUserId,
        gameId: room.game_id,
        gameTitle: room.game_title,
        memberCount,
        maxMembers,
        messages: [],
        messagesLoaded: false
      }
    },
    mapMessage(item) {
      const senderType = item.sender_type || 'user'
      const senderUserId = toInt(item.sender_user_id)
      const isMine = senderType === 'user' && senderUserId === this.currentUserId
      const metadata = this.parseMetadata(item.metadata_json)
      const attachment = this.normalizeAttachment(metadata?.attachment || null)
      const codePreview = this.normalizeCodePreview(metadata?.code_preview || null)
      let text = (item.content || '').toString()
      if (codePreview && /^代码预览[:：]/.test(text)) {
        text = ''
      }
      if (attachment?.type === 'image') {
        // 图片消息仅展示图片本体，不显示后端自动生成的“上传了图片：文件名”文本
        text = ''
      }
      const senderName = isMine
        ? this.currentUsername
        : item.username || (senderType === 'ai' ? 'AI 助手' : senderType === 'system' ? '系统' : '成员')
      const avatarUrl = senderType === 'ai'
        ? AI_AVATAR_URL
        : isMine
          ? this.currentUserAvatarUrl
          : getAvatarUrl(item.avatar_url || '')
      if (senderType === 'system') text = `[系统] ${text}`
      if (senderType === 'ai') text = `[AI] ${text}`

      return {
        id: item.id || Date.now(),
        from: isMine ? 'me' : 'theirs',
        senderType,
        senderUserId,
        senderName,
        avatarUrl,
        attachment,
        codePreview,
        text,
        time: formatClock(item.created_at),
        rawTime: item.created_at
      }
    },
    normalizeMessageId(rawId) {
      if (rawId === null || rawId === undefined) return ''
      const text = String(rawId).trim()
      if (!text) return ''
      if (/^\d+$/.test(text)) return String(Number(text))
      return text
    },
    findMessageIndexById(chat, rawId) {
      if (!chat || !Array.isArray(chat.messages)) return -1
      const targetId = this.normalizeMessageId(rawId)
      if (!targetId) return -1
      return chat.messages.findIndex((item) => this.normalizeMessageId(item?.id) === targetId)
    },
    appendMessageIfNeeded(chat, rawMessage) {
      if (!chat || !rawMessage) return false
      const nextMessage = this.mapMessage(rawMessage)
      const index = this.findMessageIndexById(chat, rawMessage.id)
      if (index >= 0) {
        chat.messages.splice(index, 1, nextMessage)
        return false
      }
      chat.messages.push(nextMessage)
      return true
    },
    handleAvatarError(event) {
      fallbackAvatar(event)
    },
    handleRoomAvatarError(chat) {
      if (!chat || typeof chat !== 'object') return
      chat.avatarUrl = ''
    },
    closeAttachmentMenu() {
      this.showAttachmentMenu = false
    },
    toggleAttachmentMenu() {
      if (!this.currentChat || this.uploadingAttachment) return
      this.showCodePicker = false
      this.showAttachmentMenu = !this.showAttachmentMenu
    },
    getAttachmentAccept(kind) {
      if (kind === 'image') return 'image/*'
      if (kind === 'video') return 'video/*'
      return ''
    },
    openAttachmentPicker(kind) {
      if (!this.currentChat || this.uploadingAttachment) return
      if (!['image', 'video'].includes(kind)) return
      this.attachmentKind = kind
      this.attachmentAccept = this.getAttachmentAccept(kind)
      this.showAttachmentMenu = false
      this.$nextTick(() => {
        const input = this.$refs.attachmentInputRef
        if (!input) return
        input.value = ''
        input.click()
      })
    },
    async onAttachmentFileChange(event) {
      const file = event?.target?.files?.[0]
      if (!file || !this.currentChat || this.uploadingAttachment) return

      const kind = this.attachmentKind
      if (!['image', 'video'].includes(kind)) {
        this.errorText = '附件类型无效，请重试'
        event.target.value = ''
        return
      }

      this.uploadingAttachment = true
      this.errorText = ''

      try {
        const rawMessage = await this.uploadAttachment(file, kind)
        this.appendMessageIfNeeded(this.currentChat, rawMessage)
        this.currentChat.messagesLoaded = true
        this.updateChatSummary(this.currentChat, rawMessage)
        this.$nextTick(() => this.scrollMessagesToBottom())
      } catch (error) {
        this.errorText = error.message || '附件上传失败'
      } finally {
        this.uploadingAttachment = false
        this.attachmentKind = ''
        if (event?.target) event.target.value = ''
      }
    },
    async uploadAttachment(file, kind) {
      const roomId = this.currentChat?.id
      if (!roomId) throw new Error('当前没有可用房间')

      const formData = new FormData()
      formData.append('file', file)
      const data = await apiCall(
        `/discussion/rooms/${roomId}/attachments/${kind}`,
        {
          method: 'POST',
          body: formData
        }
      )
      if (!data?.message) {
        throw new Error('上传成功但消息写入失败')
      }
      return data.message
    },
    updateChatSummary(chat, rawMessage) {
      if (!chat || !rawMessage) return
      const senderType = rawMessage.sender_type || 'user'
      const senderUserId = toInt(rawMessage.sender_user_id)
      const prefix = senderType === 'ai'
        ? 'AI: '
        : senderType === 'system'
          ? '系统: '
          : senderType === 'user' && senderUserId === this.currentUserId
            ? 'You: '
            : ''
      const content = (rawMessage.content || '').toString()
      chat.preview = `${prefix}${content}`.slice(0, 120)
      chat.time = formatClock(rawMessage.created_at || new Date())
    },
    async initializeDiscussion() {
      this.loadingRooms = true
      this.errorText = ''
      this.chats = []
      this.currentChatId = null
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
      this.showAttachmentMenu = false
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
      if (this.activeRightTab === 'code') {
        loadingTasks.push(this.syncCurrentRoomCode())
      }
      await Promise.all(loadingTasks)
    },
    async fetchMessages(roomId) {
      this.loadingMessages = true
      this.errorText = ''

      try {
        const data = await apiCall(`/discussion/rooms/${roomId}/messages?limit=100`)
        const chat = this.chats.find(item => item.id === roomId)
        if (!chat) return

        const rawMessages = data.messages || []
        chat.messages = rawMessages.map(item => this.mapMessage(item))
        chat.messagesLoaded = true
        if (Number(roomId) === Number(this.currentChatId)) {
          chat.unread = 0
        }

        if (rawMessages.length) {
          this.updateChatSummary(chat, rawMessages[rawMessages.length - 1])
        }
      } catch (error) {
        this.errorText = error.message || '加载消息失败'
      } finally {
        this.loadingMessages = false
        this.$nextTick(() => this.scrollMessagesToBottom())
      }
    },
    async sendMessage() {
      const value = this.draft.trim()
      if (!value || !this.currentChat || this.sendingMessage) return

      this.sendingMessage = true
      this.errorText = ''

      try {
        const response = await apiCall(`/discussion/rooms/${this.currentChat.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: value })
        })

        const rawMessage = response.message
        this.appendMessageIfNeeded(this.currentChat, rawMessage)
        this.currentChat.messagesLoaded = true
        this.updateChatSummary(this.currentChat, rawMessage)
        this.draft = ''
        this.$nextTick(() => this.scrollMessagesToBottom())
      } catch (error) {
        this.errorText = error.message || '发送消息失败'
      } finally {
        this.sendingMessage = false
        this.$nextTick(() => this.focusDraftInput())
      }
    },
    async sendAiMessage() {
      if (!this.currentChat || this.sendingAi) return

      const prompt = this.draft.trim() || '请结合当前讨论内容，给出下一步可执行建议。'
      this.sendingAi = true
      this.errorText = ''

      try {
        const response = await apiCall(`/discussion/rooms/${this.currentChat.id}/ai-message`, {
          method: 'POST',
          body: JSON.stringify({ prompt })
        })

        const rawMessage = response.message
        this.appendMessageIfNeeded(this.currentChat, rawMessage)
        this.currentChat.messagesLoaded = true
        this.updateChatSummary(this.currentChat, rawMessage)
        this.$nextTick(() => this.scrollMessagesToBottom())
      } catch (error) {
        this.errorText = error.message || 'AI 回复失败'
      } finally {
        this.sendingAi = false
      }
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
    getLastMessageId(chat) {
      if (!chat || !Array.isArray(chat.messages) || !chat.messages.length) return 0
      return chat.messages.reduce((maxId, message) => {
        const nextId = Number(message?.id || 0)
        return nextId > maxId ? nextId : maxId
      }, 0)
    },
    markChatAsRead(roomId) {
      const chat = this.chats.find((item) => Number(item.id) === Number(roomId))
      if (!chat) return
      chat.unread = 0
    },
    shouldCountAsUnread(rawMessage) {
      const senderType = rawMessage?.sender_type || 'user'
      const senderUserId = toInt(rawMessage?.sender_user_id)
      if (senderType === 'user') {
        return senderUserId !== this.currentUserId
      }
      return senderType === 'ai'
    },
    startMessagePolling() {
      if (this.messagePollTimer) return
      this.messagePollTimer = window.setInterval(() => {
        this.pollLatestMessages()
      }, 3000)
    },
    stopMessagePolling() {
      if (!this.messagePollTimer) return
      window.clearInterval(this.messagePollTimer)
      this.messagePollTimer = null
    },
    isSocketRoomSubscribed(roomId) {
      const key = String(Number(roomId) || '')
      if (!key) return false
      return this.subscribedRoomIds[key] === true
    },
    async pollRoomLatestMessages(chat, options = {}) {
      const roomId = Number(chat?.id)
      if (!roomId) return

      const realtimeHealthy = this.socket?.connected && this.isSocketRoomSubscribed(roomId)
      if (realtimeHealthy && !options.force) return

      const afterId = this.getLastMessageId(chat)
      const query = new URLSearchParams()
      query.set('limit', '100')
      if (afterId > 0) query.set('afterId', String(afterId))

      const data = await apiCall(`/discussion/rooms/${roomId}/messages?${query.toString()}`)
      const rawMessages = Array.isArray(data?.messages) ? data.messages : []
      if (!rawMessages.length) {
        if (!chat.messagesLoaded) chat.messagesLoaded = true
        return
      }

      let appendedCount = 0
      let unreadAdded = 0
      rawMessages.forEach((rawItem) => {
        if (!this.appendMessageIfNeeded(chat, rawItem)) return
        appendedCount += 1
        if (Number(this.currentChatId) !== roomId && this.shouldCountAsUnread(rawItem)) {
          unreadAdded += 1
        }
      })
      if (!appendedCount) return

      chat.messagesLoaded = true
      this.updateChatSummary(chat, rawMessages[rawMessages.length - 1])
      if (Number(this.currentChatId) === roomId) {
        chat.unread = 0
        this.$nextTick(() => this.scrollMessagesToBottom())
      } else if (unreadAdded > 0) {
        chat.unread = Number(chat.unread || 0) + unreadAdded
      }
    },
    async pollLatestMessages(options = {}) {
      if (this.messagePollPending) return
      const rooms = this.chats.filter((item) => Number(item?.id))
      if (!rooms.length) return

      const allRealtimeHealthy = this.socket?.connected
        && rooms.every((room) => this.isSocketRoomSubscribed(room.id))
      if (allRealtimeHealthy && !options.force) return

      this.messagePollPending = true
      try {
        for (const chat of rooms) {
          // 串行轮询避免并发过高。
          await this.pollRoomLatestMessages(chat, options)
        }
      } catch {
        // 静默失败，避免对话中断；下一轮轮询会继续尝试。
      } finally {
        this.messagePollPending = false
      }
    },
    getSocketBaseUrl() {
      const customSocketBase = import.meta.env.VITE_WS_BASE_URL
      if (customSocketBase) return customSocketBase
      if (/^https?:\/\//.test(API_BASE_URL)) return API_BASE_URL.replace(/\/api\/?$/, '')
      return window.location.origin
    },
    getAuthToken() {
      return localStorage.getItem('token') || localStorage.getItem('authToken') || ''
    },
    setupSocket() {
      if (this.socket) return
      const token = this.getAuthToken()
      if (!token) return

      this.socket = io(this.getSocketBaseUrl(), {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        auth: {
          token: `Bearer ${token}`
        }
      })

      this.socket.on('connect', () => {
        this.subscribedRoomIds = {}
        this.syncSocketSubscriptions()
        this.pollLatestMessages({ force: true })
      })

      this.socket.on('discussion:message', (payload) => {
        this.handleSocketMessage(payload)
      })

      this.socket.on('disconnect', () => {
        this.subscribedRoomIds = {}
      })

      this.socket.on('connect_error', () => {
        this.subscribedRoomIds = {}
      })
    },
    teardownSocket() {
      if (!this.socket) return
      Object.keys(this.subscribedRoomIds).forEach((roomId) => {
        this.socket.emit('discussion:leave', { roomId: Number(roomId) })
      })
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
      this.subscribedRoomIds = {}
    },
    joinSocketRoom(roomId) {
      const parsedRoomId = Number(roomId)
      if (!this.socket || !this.socket.connected || !parsedRoomId) {
        return Promise.resolve(false)
      }
      if (this.isSocketRoomSubscribed(parsedRoomId)) {
        return Promise.resolve(true)
      }

      return new Promise((resolve) => {
        this.socket.emit('discussion:join', { roomId: parsedRoomId }, (response) => {
          if (!response?.ok) {
            resolve(false)
            return
          }
          this.subscribedRoomIds = {
            ...this.subscribedRoomIds,
            [String(parsedRoomId)]: true
          }
          resolve(true)
        })
      })
    },
    leaveSocketRoom(roomId) {
      const parsedRoomId = Number(roomId)
      if (!this.socket || !this.socket.connected || !parsedRoomId) return
      if (!this.isSocketRoomSubscribed(parsedRoomId)) return

      this.socket.emit('discussion:leave', { roomId: parsedRoomId })
      const nextMap = { ...this.subscribedRoomIds }
      delete nextMap[String(parsedRoomId)]
      this.subscribedRoomIds = nextMap
    },
    async syncSocketSubscriptions() {
      if (!this.socket || !this.socket.connected) return

      const desiredRoomIds = [...new Set(
        this.chats
          .map((item) => Number(item?.id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )]

      const subscribedRoomIds = Object.keys(this.subscribedRoomIds)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)

      subscribedRoomIds
        .filter((id) => !desiredRoomIds.includes(id))
        .forEach((id) => this.leaveSocketRoom(id))

      await Promise.all(desiredRoomIds.map((id) => this.joinSocketRoom(id)))
    },
    handleSocketMessage(payload) {
      const roomId = Number(payload?.roomId)
      const rawMessage = payload?.message
      if (!roomId || !rawMessage) return

      const chat = this.chats.find(item => item.id === roomId)
      if (!chat) return
      if (!this.appendMessageIfNeeded(chat, rawMessage)) return
      chat.messagesLoaded = true
      this.updateChatSummary(chat, rawMessage)

      if (Number(this.currentChatId) === roomId) {
        chat.unread = 0
        this.$nextTick(() => this.scrollMessagesToBottom())
      } else if (this.shouldCountAsUnread(rawMessage)) {
        chat.unread = Number(chat.unread || 0) + 1
      }
    }
  }
}
</script>

<style scoped src="../styles/discussion-mode.css"></style>
