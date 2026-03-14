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
              {{ item.avatar }}
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
                {{ currentChat.avatar }}
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
                <span class="message-sender-name">{{ message.senderName }}</span>

                <div class="message-main">
                  <img
                    v-if="message.from !== 'me'"
                    class="message-avatar"
                    :src="message.avatarUrl"
                    :alt="message.senderName"
                    @error="handleAvatarError"
                  />
                  <div class="message-bubble">
                    <div class="message-text">{{ message.text }}</div>
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
            <button class="icon-btn light">😊</button>
            <input
              v-model="draft"
              type="text"
              :placeholder="sendingMessage ? '发送中...' : 'Message'"
              :disabled="sendingMessage"
              @keyup.enter="sendMessage"
            />
            <button class="send-btn" :disabled="sendingMessage" @click="sendMessage">➤</button>
          </footer>
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
          <p>显示当前房间的实时结构化数据，方便调试与联调。</p>
        </div>
        <button class="run-btn" :disabled="sendingAi || !currentChat" @click="sendAiMessage">
          {{ sendingAi ? 'Running...' : 'Run AI' }}
        </button>
      </div>

      <div class="code-toolbar">
        <span class="file-name">{{ currentFileName }}</span>
      </div>

      <pre class="code-panel"><code class="hljs" v-html="highlightedCodeText"></code></pre>
    </section>
  </div>
</template>

<script>
import { io } from 'socket.io-client'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { apiCall, API_BASE_URL } from '../utils/api'
import { getAvatarUrl, handleAvatarError as fallbackAvatar } from '../utils/avatar'

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
    currentFileName() {
      if (!this.currentChat) return 'room-data.json'
      return `room-${this.currentChat.id}.json`
    },
    codeText() {
      if (!this.currentChat) {
        return JSON.stringify({ message: '暂无房间可展示' }, null, 2)
      }

      return JSON.stringify(
        {
          roomId: this.currentChat.id,
          roomCode: this.currentChat.roomCode,
          gameId: this.currentChat.gameId,
          gameTitle: this.currentChat.gameTitle,
          mode: this.currentChat.mode,
          visibility: this.currentChat.visibility,
          status: this.currentChat.statusRaw,
          memberCount: this.currentChat.memberCount,
          maxMembers: this.currentChat.maxMembers,
          lastMessages: this.currentChat.messages.slice(-8).map((item) => ({
            id: item.id,
            from: item.senderType,
            content: item.text,
            time: item.time
          }))
        },
        null,
        2
      )
    },
    highlightedCodeText() {
      try {
        return hljs.highlight(this.codeText, { language: 'json' }).value
      } catch (error) {
        return hljs.highlightAuto(this.codeText).value
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
    this.initializeDiscussion()
  },
  beforeUnmount() {
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
    mapRoomToChat(room) {
      const roomName = room.title?.trim() || `${room.game_title || '未命名游戏'} 讨论房`
      const memberCount = Number(room.joined_count || 0)
      const maxMembers = Number(room.max_members || 4)
      const modeLabel = MODE_LABELS[room.mode] || '房间'
      const statusLabel = STATUS_LABELS[room.status] || room.status || '未知状态'
      const preview = (room.last_message_content || '暂无消息，发送第一条开始讨论').toString()

      return {
        id: Number(room.id),
        name: roomName,
        verified: room.mode === 'match',
        time: formatClock(room.last_message_at || room.updated_at || room.created_at),
        preview,
        unread: 0,
        avatar: roomName.charAt(0).toUpperCase() || 'R',
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
      let text = (item.content || '').toString()
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
        senderName,
        avatarUrl,
        text,
        time: formatClock(item.created_at),
        rawTime: item.created_at
      }
    },
    handleAvatarError(event) {
      fallbackAvatar(event)
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
      this.currentChatId = chatId
      this.joinSocketRoom(chatId)

      const chat = this.chats.find(item => item.id === chatId)
      if (!chat) return
      if (chat.messagesLoaded && !options.force) {
        this.$nextTick(() => this.scrollMessagesToBottom())
        return
      }
      await this.fetchMessages(chatId)
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
  padding: 10px;
  background: #ffffff;
  border-bottom: 1px solid #d1d5db;
}

.chat-panel {
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
}

.avatar.small {
  width: 38px;
  height: 38px;
  font-size: 18px;
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
  font-size: 11px;
  line-height: 1.3;
  min-height: 14px;
  padding-top: 1px;
  color: #6b7280;
  max-width: 100%;
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

.file-name {
  margin-left: 0;
  font-size: 13px;
  color: #6b7280;
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
}
</style>
