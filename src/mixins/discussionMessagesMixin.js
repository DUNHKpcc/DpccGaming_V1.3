import { apiCall } from '../utils/api'
import {
  normalizeDiscussionDocumentPickerItem,
  buildDiscussionCodePreview,
  mapDiscussionMessage,
  buildDiscussionChatSummary,
  shouldCountDiscussionMessageAsUnread
} from '../utils/discussionModeCore'

export default {
  data() {
    return {
      loadingMessages: false,
      sendingMessage: false,
      sendingAi: false,
      uploadingAttachment: false,
      attachmentKind: '',
      attachmentAccept: ''
    }
  },
  methods: {
    mapMessage(item) {
      return mapDiscussionMessage(item, {
        currentUserId: this.currentUserId,
        currentUsername: this.currentUsername,
        currentUserAvatarUrl: this.currentUserAvatarUrl
      })
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
      this.showDocumentPicker = false
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
      const summary = buildDiscussionChatSummary(rawMessage, {
        currentUserId: this.currentUserId
      })
      chat.preview = summary.preview
      chat.time = summary.time
    },
    async fetchMessages(roomId) {
      this.loadingMessages = true
      this.errorText = ''

      try {
        const data = await apiCall(`/discussion/rooms/${roomId}/messages?limit=100`)
        const chat = this.chats.find((item) => item.id === roomId)
        if (!chat) return

        const rawMessages = Array.isArray(data?.messages) ? data.messages : []
        chat.messages = rawMessages.map((item) => this.mapMessage(item))
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
    async openDocumentPreviewPicker() {
      if (!this.currentChat || this.uploadingAttachment) return

      this.showAttachmentMenu = false
      this.showDocumentPicker = true
      this.documentPickerLoading = true
      this.documentPickerKeyword = ''
      this.errorText = ''

      try {
        const data = await apiCall(`/discussion/rooms/${this.currentChat.id}/documents`)
        this.documentPickerDocuments = Array.isArray(data?.documents)
          ? data.documents.map((doc) => normalizeDiscussionDocumentPickerItem(doc)).filter(Boolean)
          : []
      } catch (error) {
        this.documentPickerDocuments = []
        this.errorText = error.message || '文档加载失败'
      } finally {
        this.documentPickerLoading = false
      }
    },
    async sendCodePreviewFromFile(file) {
      if (!file || !this.currentChat || this.uploadingAttachment) return

      const codePreview = buildDiscussionCodePreview(file)
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
              code_preview: {
                ...codePreview,
                game_id: this.effectiveCodeGameId || this.currentChat?.gameId || ''
              }
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
    async sendDocumentPreview(document) {
      if (!document || !this.currentChat || this.uploadingAttachment) return
      if (!document.id || !document.name) {
        this.errorText = '文档数据无效，无法发送预览'
        return
      }

      this.uploadingAttachment = true
      this.errorText = ''
      try {
        const response = await apiCall(`/discussion/rooms/${this.currentChat.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content: `文档预览：${document.name}`,
            metadata: {
              document_preview: {
                document_id: document.id,
                name: document.name,
                preview_text: document.previewText || '',
                page_count: document.pageCount,
                mime_type: document.mimeType || ''
              }
            }
          })
        })

        const rawMessage = response.message
        this.appendMessageIfNeeded(this.currentChat, rawMessage)
        this.currentChat.messagesLoaded = true
        this.updateChatSummary(this.currentChat, rawMessage)
        this.closeDocumentPicker()
        this.$nextTick(() => this.scrollMessagesToBottom())
      } catch (error) {
        this.errorText = error.message || '文档预览发送失败'
      } finally {
        this.uploadingAttachment = false
      }
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
      return shouldCountDiscussionMessageAsUnread(rawMessage, this.currentUserId)
    }
  }
}
