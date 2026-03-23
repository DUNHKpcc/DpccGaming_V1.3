import { io } from 'socket.io-client'
import { API_BASE_URL, apiCall } from '../utils/api'
import { normalizeChatMoreSettings } from '../utils/discussionChatMore'

export default {
  data() {
    return {
      socket: null,
      subscribedRoomIds: {},
      messagePollTimer: null,
      messagePollPending: false
    }
  },
  methods: {
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
          await this.pollRoomLatestMessages(chat, options)
        }
      } catch {
        // 静默失败，下一轮继续补拉。
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

      this.socket.on('discussion:documents', (payload) => {
        this.handleSocketDocuments(payload)
      })

      this.socket.on('discussion:tasks', (payload) => {
        this.handleSocketTasks(payload)
      })

      this.socket.on('discussion:room-settings', (payload) => {
        this.handleSocketRoomSettings(payload)
      })

      this.socket.on('discussion:room-memory', (payload) => {
        this.handleSocketRoomMemory(payload)
      })

      this.socket.on('discussion:room-removed', (payload) => {
        this.handleSocketRoomRemoved(payload)
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

      const chat = this.chats.find((item) => item.id === roomId)
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
    },
    dispatchRoomPanelEvent(name, detail = {}) {
      if (typeof window === 'undefined') return
      window.dispatchEvent(new CustomEvent(name, { detail }))
    },
    handleSocketDocuments(payload) {
      const roomId = Number(payload?.roomId)
      if (!roomId) return
      this.dispatchRoomPanelEvent('discussion-documents-sync', {
        roomId,
        action: String(payload?.action || '').trim(),
        document: payload?.document || null,
        documentId: payload?.documentId ?? null,
        selectedDocumentId: payload?.selectedDocumentId ?? null,
        updatedByUserId: Number(payload?.updatedByUserId || 0) || null
      })
    },
    handleSocketTasks(payload) {
      const roomId = Number(payload?.roomId)
      if (!roomId) return
      this.dispatchRoomPanelEvent('discussion-tasks-sync', {
        roomId,
        action: String(payload?.action || '').trim(),
        task: payload?.task || null,
        taskId: payload?.taskId ?? null,
        updatedByUserId: Number(payload?.updatedByUserId || 0) || null
      })
    },
    handleSocketRoomSettings(payload) {
      const roomId = Number(payload?.roomId)
      if (!roomId) return
      const nextSettings = normalizeChatMoreSettings(payload?.settings || {})
      const previousGameId = String(this.getRoomSettings(roomId)?.sourceGameId || '').trim()
      const nextGameId = String(nextSettings?.sourceGameId || '').trim()
      this.setRoomSettings(roomId, nextSettings)
      this.applyRoomSettingsToLoadedChats()

      if (Number(this.currentChatId) === roomId && previousGameId !== nextGameId) {
        this.currentCodePath = ''
        this.syncCurrentRoomCode({ force: true })
      }
    },
    handleSocketRoomMemory(payload) {
      const roomId = Number(payload?.roomId)
      if (!roomId) return
      this.setRoomMemoryPayload(roomId, payload || {})
    },
    async handleSocketRoomRemoved(payload) {
      const roomId = Number(payload?.roomId)
      if (!roomId) return
      const roomExists = this.chats.some((chat) => Number(chat?.id) === roomId)
      if (!roomExists) return
      await this.initializeDiscussion()
    }
  }
}
