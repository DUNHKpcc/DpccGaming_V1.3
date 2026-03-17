<template>
  <div class="page">
    <section class="left-side">
      <div class="chat-layout">
        <aside class="chat-list">
          <div class="chat-list-search">
            <div class="search-box">
              <input v-model.trim="searchKeyword" type="text" placeholder="Search rooms" />
            </div>
          </div>

          <div
            v-for="item in filteredChats"
            :key="item.id"
            class="chat-item"
            :class="{ active: currentChatId === item.id }"
            @click="selectChat(item.id)"
          >
            <div class="avatar" :style="{ background: item.avatarColor }">
              <img
                v-if="item.avatarUrl"
                :src="item.avatarUrl"
                :alt="item.name"
                class="avatar-image"
                @error="handleRoomAvatarError(item)"
              />
              <span v-else>{{ item.avatar }}</span>
            </div>

            <div class="chat-item-main">
              <div class="chat-item-top">
                <div class="name-row">
                  <span class="name">{{ item.name }}</span>
                  <span v-if="item.verified" class="verified">✔</span>
                </div>
                <span class="time">{{ item.time }}</span>
              </div>

              <div class="chat-item-bottom">
                <p class="preview">{{ item.preview }}</p>
                <span v-if="item.unread > 0" class="unread">{{ item.unread }}</span>
              </div>
            </div>
          </div>

          <div v-if="loadingRooms" class="chat-list-empty">正在加载讨论房间...</div>
          <div v-else-if="!filteredChats.length" class="chat-list-empty">
            {{ chats.length ? '没有匹配的房间' : '你还没有加入任何讨论房间' }}
          </div>
        </aside>

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
                <div class="chat-user-name">{{ currentChat.name }}</div>
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
                <span class="message-sender-name">
                  <span class="message-sender-text">{{ message.senderName }}</span>
                  <UserLevelBadge v-if="message.senderUserId" :user-id="message.senderUserId" />
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
                  <div class="message-bubble">
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
                    <div v-if="message.codePreview" class="message-code-preview">
                      <div class="message-code-preview-head">
                        <i class="fa fa-code"></i>
                        <span class="message-code-preview-path" :title="message.codePreview.path">
                          {{ message.codePreview.path }}
                        </span>
                      </div>
                      <pre class="message-code-preview-snippet"><code>{{ message.codePreview.snippet }}</code></pre>
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
              v-model="draft"
              type="text"
              :placeholder="sendingMessage ? '发送中...' : (uploadingAttachment ? '上传中...' : 'Message')"
              :disabled="sendingMessage || uploadingAttachment"
              @keyup.enter="sendMessage"
            />
            <button class="send-btn" :disabled="sendingMessage || uploadingAttachment" @click="sendMessage">➤</button>
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
      <div class="code-header">
        <div>
          <h2>Code Preview</h2>
          <p>自动展示当前房间 gameId 对应的源码。</p>
        </div>
        <button class="run-btn" :disabled="sendingAi || !currentChat" @click="sendAiMessage">
          {{ sendingAi ? 'Running...' : 'Run AI' }}
        </button>
      </div>

      <div class="code-toolbar">
        <select
          v-if="currentRoomCodeFiles.length"
          v-model="currentCodePath"
          class="code-file-selector"
        >
          <option
            v-for="file in currentRoomCodeFiles"
            :key="file.path"
            :value="file.path"
          >
            {{ file.path }}
          </option>
        </select>
        <span v-else class="file-name">{{ currentFileName }}</span>
        <button
          class="icon-btn light code-refresh-btn"
          :disabled="codePanelLoading || !currentChat?.gameId"
          @click="refreshCurrentRoomCode"
          title="刷新当前房间源码"
        >
          <i :class="codePanelLoading ? 'fa fa-spinner fa-spin' : 'fa fa-rotate-right'"></i>
        </button>
      </div>

      <div v-if="codePanelLoading" class="code-empty-state">源码加载中...</div>
      <div v-else-if="codePanelError" class="code-empty-state error">{{ codePanelError }}</div>
      <div v-else-if="!currentChat" class="code-empty-state">请先选择一个讨论房间</div>
      <div v-else-if="!currentRoomCodeFiles.length" class="code-empty-state">当前房间游戏暂无可浏览源码</div>
      <pre v-else class="code-panel"><code class="hljs" v-html="highlightedCodeText"></code></pre>
    </section>
  </div>
</template>

<script>
import { io } from 'socket.io-client'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { apiCall, API_BASE_URL } from '../utils/api'
import { getAvatarUrl, handleAvatarError as fallbackAvatar } from '../utils/avatar'
import AvatarFriendAction from '../components/AvatarFriendAction.vue'
import UserLevelBadge from '../components/UserLevelBadge.vue'

hljs.registerLanguage('json', json)

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

export default {
  name: 'DiscussionMode',
  components: {
    AvatarFriendAction,
    UserLevelBadge
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
      subscribedRoomId: null
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
      try {
        return hljs.highlightAuto(this.codeText || '').value
      } catch (error) {
        return hljs.highlightAuto(String(this.codeText || '')).value
      }
    },
    filteredCodePickerFiles() {
      const keyword = String(this.codePickerKeyword || '').toLowerCase()
      if (!keyword) return this.codePickerFiles
      return this.codePickerFiles.filter((file) => file.path.toLowerCase().includes(keyword))
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
    this.initializeDiscussion()
    window.addEventListener('click', this.closeAttachmentMenu)
  },
  beforeUnmount() {
    window.removeEventListener('click', this.closeAttachmentMenu)
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
        const nextMessage = this.mapMessage(rawMessage)
        this.currentChat.messages.push(nextMessage)
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
      const friendName = String(room.friend_username || '').trim()
      const displayName = isFriendRoom && friendName ? friendName : roomName
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
        const nextMessage = this.mapMessage(rawMessage)
        this.currentChat.messages.push(nextMessage)
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

      const headers = {}
      const token = this.getAuthToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(
        `${API_BASE_URL}/discussion/rooms/${roomId}/attachments/${kind}`,
        {
          method: 'POST',
          credentials: 'include',
          headers,
          body: formData
        }
      )

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || data.message || '附件上传失败')
      }
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
      this.joinSocketRoom(chatId)

      const chat = this.chats.find(item => item.id === chatId)
      if (!chat) return
      if (chat.messagesLoaded && !options.force) {
        await this.syncCurrentRoomCode()
        this.$nextTick(() => this.scrollMessagesToBottom())
        return
      }
      await Promise.all([
        this.fetchMessages(chatId),
        this.syncCurrentRoomCode()
      ])
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
        const nextMessage = this.mapMessage(rawMessage)
        this.currentChat.messages.push(nextMessage)
        this.currentChat.messagesLoaded = true
        this.updateChatSummary(this.currentChat, rawMessage)
        this.draft = ''
        this.$nextTick(() => this.scrollMessagesToBottom())
      } catch (error) {
        this.errorText = error.message || '发送消息失败'
      } finally {
        this.sendingMessage = false
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
        const nextMessage = this.mapMessage(rawMessage)
        this.currentChat.messages.push(nextMessage)
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
        if (this.currentChatId) {
          this.joinSocketRoom(this.currentChatId)
        }
      })

      this.socket.on('discussion:message', (payload) => {
        this.handleSocketMessage(payload)
      })

      this.socket.on('disconnect', () => {
        this.subscribedRoomId = null
      })
    },
    teardownSocket() {
      if (!this.socket) return
      if (this.subscribedRoomId) {
        this.socket.emit('discussion:leave', { roomId: this.subscribedRoomId })
      }
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
      this.subscribedRoomId = null
    },
    joinSocketRoom(roomId) {
      if (!this.socket || !this.socket.connected || !roomId) return
      if (this.subscribedRoomId === roomId) return

      if (this.subscribedRoomId) {
        this.socket.emit('discussion:leave', { roomId: this.subscribedRoomId })
      }

      this.socket.emit('discussion:join', { roomId }, (response) => {
        if (!response?.ok) {
          this.errorText = response?.error || '加入实时房间失败'
          return
        }
        this.subscribedRoomId = roomId
      })
    },
    handleSocketMessage(payload) {
      const roomId = Number(payload?.roomId)
      const rawMessage = payload?.message
      if (!roomId || !rawMessage) return

      const chat = this.chats.find(item => item.id === roomId)
      if (!chat) return
      if (chat.messages.some(message => message.id === rawMessage.id)) return

      const nextMessage = this.mapMessage(rawMessage)
      chat.messages.push(nextMessage)
      chat.messagesLoaded = true
      this.updateChatSummary(chat, rawMessage)

      if (this.currentChatId === roomId) {
        this.$nextTick(() => this.scrollMessagesToBottom())
      }
    }
  }
}
</script>

<style scoped>
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

.page {
  display: flex;
  height: calc(100vh - 4rem);
  max-height: calc(100vh - 4rem);
  padding-top: 17px;
  padding-left: 10px;
  padding-right: 10px;
  padding-bottom: 10px;
  gap: 10px;
  overflow: hidden;
  background: #ececec;
  color: #1f2937;
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}

.left-side {
  width: 58%;
  min-width: 700px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #d1d5db;
  border-radius: 2px;
  background: #ffffff;
  overflow: hidden;
}

.right-side {
  width: 42%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #d1d5db;
  border-radius: 2px;
  background:
    linear-gradient(rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.03)),
    radial-gradient(circle at 20% 20%, rgba(0, 0, 0, 0.08) 1px, transparent 1px);
  background-size: auto, 24px 24px;
  color: #111827;
  overflow: hidden;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 14px;
  border-radius: 24px;
  background: #f3f4f6;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
}

.chat-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}

.chat-list {
  width: 33.3333%;
  min-width: 270px;
  border-right: 1px solid #d1d5db;
  overflow-y: auto;
  background: #ffffff;
}

.chat-list-search {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  background: #ffffff;
  border-bottom: 1px solid #d1d5db;
}

.chat-panel {
  position: relative;
  width: 66.6667%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background:
    linear-gradient(rgba(239, 239, 239, 0.95), rgba(239, 239, 239, 0.95)),
    radial-gradient(circle at 20% 20%, rgba(0, 0, 0, 0.08) 1px, transparent 1px);
  background-size: auto, 28px 28px;
}

.chat-item {
  display: flex;
  gap: 12px;
  padding: 12px 12px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #e5e7eb;
}

.chat-item:hover {
  background: #f3f4f6;
}

.chat-item.active {
  background: #e5e7eb;
}

.chat-list-empty {
  padding: 16px 14px;
  font-size: 13px;
  color: #6b7280;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  font-size: 22px;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar.small {
  width: 38px;
  height: 38px;
  font-size: 18px;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.chat-item-main {
  flex: 1;
  min-width: 0;
}

.chat-item-top,
.chat-item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chat-item-top {
  margin-bottom: 6px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.name {
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.verified {
  color: #111827;
  font-size: 13px;
}

.time {
  font-size: 13px;
  color: #7b8794;
  white-space: nowrap;
}

.preview {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: #111827;
  color: #fff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chat-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid rgba(219, 226, 234, 0.9);
}

.chat-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-user-name {
  font-size: 18px;
  font-weight: 700;
}

.chat-user-status {
  font-size: 13px;
  color: #6b7280;
  margin-top: 3px;
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.chat-empty {
  margin: 10px auto;
  width: fit-content;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  color: #6b7280;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #d1d5db;
}

.chat-error {
  margin: 10px auto 0;
  width: fit-content;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  color: #7f1d1d;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #fecaca;
}

.chat-panel-empty {
  align-items: center;
  justify-content: center;
}

.day-tag {
  width: fit-content;
  margin: 0 auto 18px;
  padding: 8px 14px;
  border-radius: 16px;
  background: rgba(31, 41, 55, 0.55);
  color: #ffffff;
  font-size: 14px;
}

.message-row {
  display: flex;
  margin-bottom: 10px;
}

.message-row.theirs {
  justify-content: flex-start;
}

.message-row.mine {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 100%;
  padding: 10px 12px 7px;
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(31, 41, 55, 0.08);
}

.message-thread {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 78%;
  min-width: 0;
}

.message-thread.theirs {
  align-items: flex-start;
}

.message-thread.mine {
  align-items: flex-end;
}

.message-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.message-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #d1d5db;
  background: #f3f4f6;
  flex-shrink: 0;
}

.message-sender-name {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 11px;
  line-height: 1.3;
  min-height: 14px;
  padding-top: 1px;
  color: #6b7280;
  max-width: 100%;
}

.message-sender-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-row.theirs .message-bubble {
  background: #ffffff;
  border-top-left-radius: 6px;
}

.message-row.mine .message-bubble {
  background: #d1d5db;
  border-top-right-radius: 6px;
}

.message-text {
  font-size: 15px;
  line-height: 1.45;
  color: #111827;
  word-break: break-word;
}

.message-attachment {
  margin-top: 8px;
}

.message-attachment-image {
  max-width: min(360px, 48vw);
  max-height: 260px;
  border-radius: 10px;
  border: 1px solid rgba(17, 24, 39, 0.14);
  display: block;
  object-fit: cover;
}

.message-attachment-video {
  max-width: min(360px, 48vw);
  max-height: 260px;
  border-radius: 10px;
  border: 1px solid rgba(17, 24, 39, 0.14);
  background: #000000;
  display: block;
}

.message-attachment-file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #d1d5db;
  color: #111827;
  text-decoration: none;
  font-size: 13px;
  max-width: min(360px, 48vw);
}

.message-attachment-file span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-code-preview {
  margin-top: 8px;
  border-radius: 10px;
  border: 1px solid rgba(17, 24, 39, 0.16);
  background: rgba(255, 255, 255, 0.88);
  overflow: hidden;
}

.message-code-preview-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  font-size: 12px;
  color: #374151;
  border-bottom: 1px solid rgba(17, 24, 39, 0.12);
}

.message-code-preview-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-code-preview-snippet {
  margin: 0;
  padding: 8px 9px;
  max-width: min(400px, 56vw);
  max-height: 180px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.45;
  color: #111827;
  font-family: Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-meta {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: #4b5563;
}

.chat-input-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px 12px;
  position: relative;
}

.attach-entry {
  position: relative;
  flex-shrink: 0;
}

.attach-plus-btn {
  font-size: 15px;
  line-height: 1;
  font-weight: 500;
}

.attach-menu {
  position: absolute;
  left: 62px;
  bottom: calc(100% + 8px);
  border-radius: 14px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  box-shadow: 0 10px 22px rgba(17, 24, 39, 0.15);
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 8;
}

.attach-option {
  width: 36px;
  height: 36px;
  border: 1px solid #d1d5db;
  border-radius: 50%;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 15px;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.attach-option:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.attachment-input-hidden {
  display: none;
}

.code-picker-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 12;
}

.code-picker-panel {
  width: min(620px, 92%);
  max-height: min(78vh, 620px);
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.code-picker-head {
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.code-picker-search {
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.code-picker-search input {
  width: 100%;
  height: 38px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 0 10px;
  outline: none;
  font-size: 14px;
}

.code-picker-body {
  padding: 8px;
  overflow: auto;
  min-height: 120px;
}

.code-picker-item {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
  color: #111827;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  margin-bottom: 6px;
  text-align: left;
}

.code-picker-item:hover {
  background: #f9fafb;
}

.code-picker-item-path {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.code-picker-item-lang {
  flex-shrink: 0;
  font-size: 11px;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  padding: 2px 7px;
}

.chat-input-bar input {
  flex: 1;
  height: 44px;
  border: none;
  outline: none;
  border-radius: 26px;
  padding: 0 18px;
  font-size: 15px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(31, 41, 55, 0.08);
}

.icon-btn,
.send-btn,
.run-btn {
  border: none;
  cursor: pointer;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  font-size: 18px;
}

.icon-btn.light {
  background: rgba(255, 255, 255, 0.9);
}

.send-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #111827;
  color: #ffffff;
  font-size: 20px;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.28);
}

.send-btn:disabled,
.run-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid rgba(219, 226, 234, 0.9);
}

.code-header h2 {
  margin: 0 0 6px;
  font-size: 17px;
}

.code-header p {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
}

.run-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 18px;
  background: #111827;
  color: #ffffff;
  font-size: 13px;
  box-shadow: 0 6px 14px rgba(17, 24, 39, 0.24);
}

.code-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #d1d5db;
  background: rgba(255, 255, 255, 0.92);
}

.code-file-selector {
  flex: 1;
  min-width: 0;
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 9px;
  background: #ffffff;
  color: #111827;
  font-size: 13px;
  padding: 0 10px;
  outline: none;
}

.file-name {
  margin-left: 0;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.code-refresh-btn {
  width: 30px;
  height: 30px;
  font-size: 14px;
}

.code-panel {
  flex: 1;
  margin: 12px;
  padding: 14px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.5;
  font-family: Consolas, Monaco, monospace;
  white-space: pre-wrap;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
}

.code-empty-state {
  margin: 12px;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  color: #6b7280;
  font-size: 13px;
}

.code-empty-state.error {
  border-color: #fecaca;
  color: #7f1d1d;
}

:deep(.hljs) {
  display: block;
  background: transparent;
  color: #111827;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

:deep(.hljs-attr),
:deep(.hljs-attribute) {
  color: #374151;
}

:deep(.hljs-string) {
  color: #111827;
  font-weight: 600;
}

:deep(.hljs-number),
:deep(.hljs-literal) {
  color: #4b5563;
}

@media (max-width: 1400px) {
  .page {
    flex-direction: column;
    height: calc(100vh - 3.5rem);
    max-height: calc(100vh - 3.5rem);
  }

  .left-side,
  .right-side {
    width: 100%;
    min-width: 0;
    flex: 1;
    min-height: 0;
  }
}

@media (max-width: 900px) {
  .page {
    height: calc(100vh - 3rem);
    max-height: calc(100vh - 3rem);
    padding: 8px;
    gap: 8px;
  }

  .chat-layout {
    flex-direction: column;
  }

  .chat-list,
  .chat-panel {
    width: 100%;
    min-width: 0;
  }

  .chat-list {
    max-height: 240px;
  }

  .chat-panel {
    min-height: 0;
  }

  .message-bubble {
    max-width: 86%;
  }

  .message-attachment-image,
  .message-attachment-video,
  .message-attachment-file {
    max-width: min(260px, 72vw);
  }

  .message-code-preview-snippet {
    max-width: min(260px, 72vw);
  }
}
</style>
