import { apiCall } from '../utils/api'
import { useNotificationStore } from '../stores/notification'
import {
  CHAT_MORE_COLLAB_STATUS_OPTIONS,
  CHAT_MORE_GROUP_INVITE_PERMISSION_OPTIONS,
  CHAT_MORE_BUILTIN_MODELS,
  createDefaultChatMoreSettings,
  normalizeChatMoreSettings,
  getCollaborationStatusLabel,
  getCollaborationStatusMeta,
  compressImageToWebpDataUrl
} from '../utils/discussionChatMore'
import {
  normalizeDiscussionRoomSummary,
  normalizeDiscussionRoomMemoryItem
} from '../utils/discussionModeCore'

export default {
  data() {
    return {
      showDeleteFriendConfirm: false,
      showClearHistoryConfirm: false,
      chatMoreBuiltinModels: CHAT_MORE_BUILTIN_MODELS,
      chatMoreCollabStatusOptions: CHAT_MORE_COLLAB_STATUS_OPTIONS,
      chatMoreGroupInvitePermissionOptions: CHAT_MORE_GROUP_INVITE_PERMISSION_OPTIONS,
      activeChatMoreSection: '',
      chatMoreSettingsByRoom: {},
      roomSettingsDirtyFieldsByRoom: {},
      roomSettingsLocalRevisionByRoom: {},
      roomSettingsSyncedRevisionByRoom: {},
      roomSettingsRequestSeqByRoom: {},
      roomDetailByRoom: {},
      roomSummaryByRoom: {},
      roomMemoryByRoom: {},
      roomSettingsSaveTimers: {},
      gameLibraryLoading: false,
      gameLibraryError: '',
      gameLibraryGames: [],
      inviteFriendsLoading: false,
      inviteFriendsError: '',
      inviteFriends: [],
      roomInviteLinksByRoom: {},
      roomInviteLinkGeneratingByRoom: {},
      roomInviteExpireMinutesByRoom: {},
      roomAvatarUploadingByRoom: {},
      roomFriendInviteLoadingByUser: {},
      roomMemoryLoading: false,
      roomMemoryError: ''
    }
  },
  methods: {
    getDeleteFriendWarningText() {
      const targetName = this.currentChat?.name || '该好友'
      return `删除 ${targetName} 后，将同时删除你们的私聊房间、历史消息、文档、任务、AI 设置以及相关通知记录，此操作不可恢复。`
    },
    getClearHistoryWarningText() {
      const targetName = this.currentChat?.name || '当前会话'
      return `删除后，仅你这边的聊天记录会被清空；对方设备上的聊天记录不会受影响。与 ${targetName} 的后续新消息仍会正常显示。`
    },
    openDeleteFriendConfirm() {
      if (!this.currentChat?.displayUserId) return
      this.showDeleteFriendConfirm = true
    },
    closeDeleteFriendConfirm() {
      this.showDeleteFriendConfirm = false
    },
    openClearHistoryConfirm() {
      if (!this.currentChat?.id) return
      this.showClearHistoryConfirm = true
    },
    closeClearHistoryConfirm() {
      this.showClearHistoryConfirm = false
    },
    getRoomSettings(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return createDefaultChatMoreSettings()
      if (!this.chatMoreSettingsByRoom[roomKey]) {
        this.chatMoreSettingsByRoom = {
          ...this.chatMoreSettingsByRoom,
          [roomKey]: createDefaultChatMoreSettings()
        }
      }
      return this.chatMoreSettingsByRoom[roomKey]
    },
    getRoomSettingsLocalRevision(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return 0
      return Number(this.roomSettingsLocalRevisionByRoom[roomKey] || 0) || 0
    },
    getRoomSettingsSyncedRevision(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return 0
      return Number(this.roomSettingsSyncedRevisionByRoom[roomKey] || 0) || 0
    },
    getRoomSettingsDirtyFieldMap(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return {}
      const dirtyFields = this.roomSettingsDirtyFieldsByRoom[roomKey]
      return dirtyFields && typeof dirtyFields === 'object' ? dirtyFields : {}
    },
    markRoomSettingsDirtyField(roomId, fieldPath = '') {
      const roomKey = String(roomId || '').trim()
      const normalizedFieldPath = String(fieldPath || '').trim()
      if (!roomKey || !normalizedFieldPath) return
      this.roomSettingsDirtyFieldsByRoom = {
        ...this.roomSettingsDirtyFieldsByRoom,
        [roomKey]: {
          ...this.getRoomSettingsDirtyFieldMap(roomKey),
          [normalizedFieldPath]: true
        }
      }
    },
    clearRoomSettingsDirtyFields(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey || !this.roomSettingsDirtyFieldsByRoom[roomKey]) return
      const nextDirtyFields = { ...this.roomSettingsDirtyFieldsByRoom }
      delete nextDirtyFields[roomKey]
      this.roomSettingsDirtyFieldsByRoom = nextDirtyFields
    },
    markRoomSettingsLocalEdit(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return 0
      const nextRevision = this.getRoomSettingsLocalRevision(roomKey) + 1
      this.roomSettingsLocalRevisionByRoom = {
        ...this.roomSettingsLocalRevisionByRoom,
        [roomKey]: nextRevision
      }
      return nextRevision
    },
    markRoomSettingsSynced(roomId, revision = null) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return 0
      const nextRevision = revision === null
        ? this.getRoomSettingsLocalRevision(roomKey)
        : Math.max(0, Number(revision || 0) || 0)
      this.roomSettingsSyncedRevisionByRoom = {
        ...this.roomSettingsSyncedRevisionByRoom,
        [roomKey]: nextRevision
      }
      return nextRevision
    },
    nextRoomSettingsRequestSeq(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return 0
      const nextSeq = (Number(this.roomSettingsRequestSeqByRoom[roomKey] || 0) || 0) + 1
      this.roomSettingsRequestSeqByRoom = {
        ...this.roomSettingsRequestSeqByRoom,
        [roomKey]: nextSeq
      }
      return nextSeq
    },
    getLatestRoomSettingsRequestSeq(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return 0
      return Number(this.roomSettingsRequestSeqByRoom[roomKey] || 0) || 0
    },
    hasPendingRoomSettingsEdits(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return false
      if (this.roomSettingsSaveTimers[roomKey]) return true
      return this.getRoomSettingsLocalRevision(roomKey) > this.getRoomSettingsSyncedRevision(roomKey)
    },
    setRoomSettings(roomId, nextSettings = {}) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return
      this.chatMoreSettingsByRoom = {
        ...this.chatMoreSettingsByRoom,
        [roomKey]: normalizeChatMoreSettings(nextSettings)
      }
    },
    buildRoomSettingsPatch(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return null
      const dirtyKeys = Object.keys(this.getRoomSettingsDirtyFieldMap(roomKey)).filter(Boolean)
      if (!dirtyKeys.length) return null
      const settings = normalizeChatMoreSettings(this.getRoomSettings(roomKey))
      const patch = {}

      dirtyKeys.forEach((dirtyKey) => {
        if (!dirtyKey.startsWith('aiSlots.')) {
          patch[dirtyKey] = settings[dirtyKey]
          return
        }

        const [, rawIndex, slotField] = dirtyKey.split('.')
        const slotIndex = Number.parseInt(rawIndex, 10)
        if (!Number.isInteger(slotIndex) || slotIndex < 0 || !slotField) return
        const slot = settings.aiSlots?.[slotIndex]
        if (!slot) return
        if (!Array.isArray(patch.aiSlots)) {
          patch.aiSlots = []
        }
        patch.aiSlots[slotIndex] = {
          ...(patch.aiSlots[slotIndex] || {}),
          id: slot.id,
          [slotField]: slot[slotField]
        }
      })

      return patch
    },
    mergeIncomingRoomSettings(roomId, incomingSettings = {}) {
      const roomKey = String(roomId || '').trim()
      const nextSettings = normalizeChatMoreSettings(incomingSettings)
      if (!roomKey) return nextSettings
      const dirtyKeys = Object.keys(this.getRoomSettingsDirtyFieldMap(roomKey)).filter(Boolean)
      if (!dirtyKeys.length) return nextSettings
      const localSettings = normalizeChatMoreSettings(this.getRoomSettings(roomKey))

      dirtyKeys.forEach((dirtyKey) => {
        if (!dirtyKey.startsWith('aiSlots.')) {
          nextSettings[dirtyKey] = localSettings[dirtyKey]
          return
        }

        const [, rawIndex, slotField] = dirtyKey.split('.')
        const slotIndex = Number.parseInt(rawIndex, 10)
        if (!Number.isInteger(slotIndex) || slotIndex < 0 || !slotField) return
        if (!nextSettings.aiSlots?.[slotIndex] || !localSettings.aiSlots?.[slotIndex]) return
        nextSettings.aiSlots[slotIndex][slotField] = localSettings.aiSlots[slotIndex][slotField]
      })

      return nextSettings
    },
    getRoomDetail(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return null
      return this.roomDetailByRoom[roomKey] || null
    },
    setRoomDetail(roomId, room = null) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey || !room || typeof room !== 'object') return
      this.roomDetailByRoom = {
        ...this.roomDetailByRoom,
        [roomKey]: room
      }
    },
    getRoomInviteExpireMinutes(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return 60
      return Number(this.roomInviteExpireMinutesByRoom[roomKey] || 60) || 60
    },
    setRoomInviteExpireMinutes(roomId, value) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return
      const nextValue = Math.max(15, Number(value || 60) || 60)
      this.roomInviteExpireMinutesByRoom = {
        ...this.roomInviteExpireMinutesByRoom,
        [roomKey]: nextValue
      }
    },
    getRoomInviteLink(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return ''
      return String(this.roomInviteLinksByRoom[roomKey] || '')
    },
    isRoomAvatarUploading(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return false
      return this.roomAvatarUploadingByRoom[roomKey] === true
    },
    getRoomSummary(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return null
      return this.roomSummaryByRoom[roomKey] || null
    },
    getRoomMemory(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return []
      return Array.isArray(this.roomMemoryByRoom[roomKey]) ? this.roomMemoryByRoom[roomKey] : []
    },
    setRoomMemoryPayload(roomId, payload = {}) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return
      const summary = payload?.summary ? normalizeDiscussionRoomSummary(payload.summary) : null
      const memory = Array.isArray(payload?.memory)
        ? payload.memory.map((item) => normalizeDiscussionRoomMemoryItem(item)).filter(Boolean)
        : []
      this.roomSummaryByRoom = {
        ...this.roomSummaryByRoom,
        [roomKey]: summary
      }
      this.roomMemoryByRoom = {
        ...this.roomMemoryByRoom,
        [roomKey]: memory
      }
      if (String(this.memoryPreviewItem?.roomId || '') === roomKey && this.memoryPreviewItem?.sourceKey) {
        const nextPreview = memory.find((item) => item.sourceKey === this.memoryPreviewItem.sourceKey) || null
        this.memoryPreviewItem = nextPreview
      }
    },
    async fetchRoomSettings(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return createDefaultChatMoreSettings()
      const data = await apiCall(`/discussion/rooms/${roomKey}/settings`)
      const hasPendingEdits = this.hasPendingRoomSettingsEdits(roomKey)
      const settings = this.mergeIncomingRoomSettings(roomKey, data?.settings || {})
      this.setRoomSettings(roomKey, settings)
      if (!hasPendingEdits) {
        this.markRoomSettingsSynced(roomKey, this.getRoomSettingsLocalRevision(roomKey))
        this.clearRoomSettingsDirtyFields(roomKey)
      }
      this.applyRoomSettingsToLoadedChats()
      return settings
    },
    async fetchRoomDetail(roomId, options = {}) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return null
      if (!options.force && this.getRoomDetail(roomKey)) {
        return this.getRoomDetail(roomKey)
      }
      try {
        const data = await apiCall(`/discussion/rooms/${roomKey}`)
        const room = data?.room && typeof data.room === 'object' ? data.room : null
        if (!room) return null
        this.setRoomDetail(roomKey, room)
        const currentChat = this.chats.find((chat) => String(chat?.id || '') === roomKey) || null
        if (currentChat) {
          currentChat.memberCount = Number(room.joined_count || currentChat.memberCount || 0) || 0
          currentChat.statusRaw = room.status || currentChat.statusRaw
          this.applyRoomSettingsToChat(currentChat)
        }
        return room
      } catch (error) {
        this.errorText = error.message || '加载群聊详情失败'
        return this.getRoomDetail(roomKey)
      }
    },
    async ensureInviteFriendsLoaded(options = {}) {
      if (!options.force && (this.inviteFriendsLoading || this.inviteFriends.length)) return this.inviteFriends
      this.inviteFriendsLoading = true
      this.inviteFriendsError = ''
      try {
        const data = await apiCall('/discussion/friends')
        this.inviteFriends = Array.isArray(data?.friends) ? data.friends : []
      } catch (error) {
        this.inviteFriends = []
        this.inviteFriendsError = error.message || '加载好友失败'
      } finally {
        this.inviteFriendsLoading = false
      }
      return this.inviteFriends
    },
    async fetchRoomMemory(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return { summary: null, memory: [] }
      this.roomMemoryLoading = true
      this.roomMemoryError = ''
      try {
        const data = await apiCall(`/discussion/rooms/${roomKey}/memory`)
        this.setRoomMemoryPayload(roomKey, data)
        return {
          summary: this.getRoomSummary(roomKey),
          memory: this.getRoomMemory(roomKey)
        }
      } catch (error) {
        this.roomMemoryError = error.message || '加载房间记忆失败'
        return { summary: null, memory: [] }
      } finally {
        this.roomMemoryLoading = false
      }
    },
    async refreshCurrentRoomMemory() {
      const roomId = this.currentChat?.id
      if (!roomId) return
      this.roomMemoryLoading = true
      this.roomMemoryError = ''
      try {
        const data = await apiCall(`/discussion/rooms/${roomId}/memory/refresh`, {
          method: 'POST'
        })
        this.setRoomMemoryPayload(roomId, data)
      } catch (error) {
        this.roomMemoryError = error.message || '刷新房间记忆失败'
        this.errorText = error.message || '刷新房间记忆失败'
      } finally {
        this.roomMemoryLoading = false
      }
    },
    queueRoomSettingsSave(roomId, delay = 320) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return
      if (this.roomSettingsSaveTimers[roomKey]) {
        window.clearTimeout(this.roomSettingsSaveTimers[roomKey])
      }
      this.roomSettingsSaveTimers = {
        ...this.roomSettingsSaveTimers,
        [roomKey]: window.setTimeout(() => {
          this.flushRoomSettingsSave(roomKey)
        }, delay)
      }
    },
    async flushRoomSettingsSave(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return
      if (this.roomSettingsSaveTimers[roomKey]) {
        window.clearTimeout(this.roomSettingsSaveTimers[roomKey])
        const nextTimers = { ...this.roomSettingsSaveTimers }
        delete nextTimers[roomKey]
        this.roomSettingsSaveTimers = nextTimers
      }
      const settingsPatch = this.buildRoomSettingsPatch(roomKey)
      if (!settingsPatch) {
        this.markRoomSettingsSynced(roomKey, this.getRoomSettingsLocalRevision(roomKey))
        return
      }
      const requestSeq = this.nextRoomSettingsRequestSeq(roomKey)
      const sentRevision = this.getRoomSettingsLocalRevision(roomKey)
      try {
        const data = await apiCall(`/discussion/rooms/${roomKey}/settings`, {
          method: 'PATCH',
          body: JSON.stringify({ settings: settingsPatch })
        })
        const latestRequestSeq = this.getLatestRoomSettingsRequestSeq(roomKey)
        const currentRevision = this.getRoomSettingsLocalRevision(roomKey)
        if (requestSeq !== latestRequestSeq || currentRevision !== sentRevision) {
          return
        }
        this.setRoomSettings(roomKey, data?.settings || this.getRoomSettings(roomKey))
        this.markRoomSettingsSynced(roomKey, sentRevision)
        this.clearRoomSettingsDirtyFields(roomKey)
        this.applyRoomSettingsToLoadedChats()
        if (String(this.currentChatId) === roomKey && this.activeRightTab === 'code') {
          this.syncCurrentRoomCode({ force: true })
        }
      } catch (error) {
        this.errorText = error.message || '保存房间设置失败'
      }
    },
    getCollaborationStatusLabel(statusValue = '') {
      return getCollaborationStatusLabel(statusValue)
    },
    getCollaborationStatusMeta(statusValue = '') {
      return getCollaborationStatusMeta(statusValue)
    },
    buildChatStatus(chat) {
      if (!chat) return ''
      const settings = this.getRoomSettings(chat.id)
      if (chat.mode === 'room') {
        const nextMaxMembers = Math.max(2, Number(settings.roomMaxMembers || chat.maxMembers || 4) || 4)
        chat.maxMembers = nextMaxMembers
        chat.baseStatus = `${chat.modeLabel || '房间'} · ${Number(chat.memberCount || 0)}/${nextMaxMembers}`
      }
      const collabLabel = this.getCollaborationStatusLabel(settings.collaborationStatus)
      return `${chat.baseStatus}${collabLabel ? ` · ${collabLabel}` : chat?.roomStatusLabel ? ` · ${chat.roomStatusLabel}` : ''}`
    },
    getChatHeaderStatusMeta(chat) {
      if (!chat) {
        return {
          headerLabel: '讨论中',
          tone: 'discussion'
        }
      }
      if (chat.statusRaw === 'waiting') {
        return {
          headerLabel: '等待中',
          tone: 'waiting'
        }
      }
      if (chat.statusRaw === 'closed') {
        return {
          headerLabel: '已关闭',
          tone: 'closed'
        }
      }
      const settings = this.getRoomSettings(chat.id)
      return this.getCollaborationStatusMeta(settings.collaborationStatus)
    },
    applyRoomSettingsToChat(chat) {
      if (!chat) return
      const settings = this.getRoomSettings(chat.id)
      if (chat.mode === 'room') {
        const nextBaseName = settings.roomTitle || chat.defaultName || chat.baseName
        chat.baseName = nextBaseName
        chat.name = nextBaseName
        chat.avatarUrl = settings.roomAvatarUrl || ''
      } else {
        chat.baseName = chat.defaultName || chat.baseName
        chat.name = settings.customNickname || chat.baseName
      }
      chat.avatar = (chat.name || chat.baseName || 'R').charAt(0).toUpperCase() || 'R'
      chat.status = this.buildChatStatus(chat)
      chat.displayRolePreset = ''
    },
    applyRoomSettingsToLoadedChats() {
      this.chats.forEach((chat) => this.applyRoomSettingsToChat(chat))
    },
    closeChatMorePanel() {
      this.flushRoomSettingsSave(this.currentChat?.id)
      this.showChatMorePanel = false
      this.showDeleteFriendConfirm = false
      this.showClearHistoryConfirm = false
      this.activeChatMoreSection = ''
    },
    toggleChatMorePanel() {
      if (!this.currentChatSupportsMorePanel) return
      this.closeMessageContextMenu()
      this.closeAttachmentMenu()
      this.closeCodePicker()
      this.closeDocumentPicker()
      const nextVisible = !this.showChatMorePanel
      this.showChatMorePanel = nextVisible
      if (!nextVisible) {
        this.activeChatMoreSection = ''
      }
    },
    async ensureGameLibraryLoaded() {
      if (this.gameLibraryLoading || this.gameLibraryGames.length) return
      this.gameLibraryLoading = true
      this.gameLibraryError = ''
      try {
        const data = await apiCall('/games/library/mine')
        this.gameLibraryGames = Array.isArray(data?.games) ? data.games : []
      } catch (error) {
        this.gameLibraryGames = []
        this.gameLibraryError = error.message || '加载游戏库失败'
      } finally {
        this.gameLibraryLoading = false
      }
    },
    getLibraryGameKey(game = {}) {
      return game?.game_id || game?.id || ''
    },
    getLibraryGameTitle(game = {}) {
      return game?.title || game?.name || `游戏 ${this.getLibraryGameKey(game)}`
    },
    async selectRoomCodeGame(game = {}) {
      const nextGameId = String(this.getLibraryGameKey(game) || '').trim()
      if (!nextGameId) return
      this.updateCurrentRoomSetting('sourceGameId', nextGameId)
      this.updateCurrentRoomSetting('sourceGameTitle', this.getLibraryGameTitle(game))
      this.currentCodePath = ''
      await this.syncCurrentRoomCode({ force: true })
    },
    async resetRoomCodeGame() {
      this.updateCurrentRoomSetting('sourceGameId', '')
      this.updateCurrentRoomSetting('sourceGameTitle', '')
      this.currentCodePath = ''
      await this.syncCurrentRoomCode({ force: true })
    },
    updateCurrentRoomSetting(field, value, options = {}) {
      const roomId = this.currentChat?.id
      const settings = this.getRoomSettings(roomId)
      settings[field] = typeof value === 'string' ? value.trimStart() : value
      this.markRoomSettingsDirtyField(roomId, field)
      this.markRoomSettingsLocalEdit(roomId)
      if (['customNickname', 'collaborationStatus', 'roomTitle', 'roomAvatarUrl', 'roomMaxMembers'].includes(field)) {
        this.applyRoomSettingsToLoadedChats()
      }
      if (field === 'customNickname' && this.currentChat?.mode === 'room') {
        const detail = this.getRoomDetail(roomId)
        const currentUserId = Number(this.currentUserId || 0) || 0
        if (detail && Array.isArray(detail.members)) {
          detail.members = detail.members.map((member) => {
            if (Number(member?.user_id || 0) !== currentUserId) return member
            return {
              ...member,
              member_custom_nickname: settings.customNickname,
              display_name: settings.customNickname || member.username || member.display_name || '成员'
            }
          })
          this.setRoomDetail(roomId, detail)
        }
      }
      if (options.immediate) {
        this.flushRoomSettingsSave(roomId)
        return
      }
      this.queueRoomSettingsSave(roomId, options.delay ?? 320)
    },
    resetCurrentRoomNickname() {
      this.updateCurrentRoomSetting('customNickname', '')
    },
    updateAiSlotField(slotId, field, value) {
      const roomId = this.currentChat?.id
      const settings = this.getRoomSettings(roomId)
      const slotIndex = settings.aiSlots.findIndex((item) => item.id === slotId)
      const slot = slotIndex >= 0 ? settings.aiSlots[slotIndex] : null
      if (!slot) return
      slot[field] = value
      this.markRoomSettingsDirtyField(roomId, `aiSlots.${slotIndex}.${field}`)
      this.markRoomSettingsLocalEdit(roomId)
      if (field === 'enabled') {
        const enabledCount = settings.aiSlots.filter((item) => item?.enabled).length
        if (enabledCount < 2 && settings.dualAiLoopEnabled) {
          settings.dualAiLoopEnabled = false
          this.markRoomSettingsDirtyField(roomId, 'dualAiLoopEnabled')
        }
        this.flushRoomSettingsSave(roomId)
        return
      }
      this.queueRoomSettingsSave(roomId, field === 'apiKey' ? 360 : 280)
    },
    async onAiAvatarFileChange(slotId, event) {
      const file = event?.target?.files?.[0]
      if (!file) return
      const notificationStore = useNotificationStore()
      try {
        const avatarUrl = await compressImageToWebpDataUrl(file)
        this.updateAiSlotField(slotId, 'avatarUrl', avatarUrl)
        this.updateAiSlotField(slotId, 'avatarUpdatedAt', Date.now())
      } catch (error) {
        const message = error.message || 'AI 头像处理失败'
        this.errorText = message
        notificationStore.error('AI 头像处理失败', message)
      } finally {
        if (event?.target) event.target.value = ''
      }
    },
    async onRoomAvatarFileChange(event) {
      const roomId = Number(this.currentChat?.id || 0)
      const file = event?.target?.files?.[0]
      if (!roomId || !file) return
      const roomKey = String(roomId)
      const notificationStore = useNotificationStore()
      this.roomAvatarUploadingByRoom = {
        ...this.roomAvatarUploadingByRoom,
        [roomKey]: true
      }
      try {
        const formData = new FormData()
        formData.append('avatar', file)
        const data = await apiCall(`/discussion/rooms/${roomId}/avatar`, {
          method: 'POST',
          body: formData
        })
        const avatarUrl = String(data?.avatarUrl || data?.settings?.roomAvatarUrl || '').trim()
        this.setRoomSettings(roomId, {
          ...this.getRoomSettings(roomId),
          roomAvatarUrl: avatarUrl
        })
        this.applyRoomSettingsToLoadedChats()
      } catch (error) {
        const message = error.message || '群聊头像处理失败'
        this.errorText = message
        notificationStore.error('群聊头像上传失败', message)
      } finally {
        this.roomAvatarUploadingByRoom = {
          ...this.roomAvatarUploadingByRoom,
          [roomKey]: false
        }
        if (event?.target) event.target.value = ''
      }
    },
    resetCurrentRoomAvatar() {
      this.updateCurrentRoomSetting('roomAvatarUrl', '', { delay: 120 })
    },
    openMemoryFileInCodePanel(memoryItem = null) {
      if (!memoryItem) return
      this.memoryPreviewItem = memoryItem
      this.codePanelError = ''
      this.switchRightTab('code', { prefetchCode: false })
    },
    async handleChatMoreItemClick(item) {
      const key = String(item?.key || '').trim()
      if (!key) return
      this.activeChatMoreSection = this.activeChatMoreSection === key ? '' : key
      if (this.activeChatMoreSection === 'game-code') {
        await this.ensureGameLibraryLoaded()
      }
      if (this.activeChatMoreSection === 'personal-ai') {
        await this.fetchRoomMemory(this.currentChat?.id)
      }
      if (this.activeChatMoreSection === 'group-profile' || this.activeChatMoreSection === 'group-members' || this.activeChatMoreSection === 'group-invite') {
        await this.fetchRoomDetail(this.currentChat?.id, { force: true })
      }
      if (this.activeChatMoreSection === 'group-invite') {
        await this.ensureInviteFriendsLoaded()
      }
    },
    async handleDeleteFriendClick() {
      if (!this.currentChat?.displayUserId) return
      const notificationStore = useNotificationStore()
      this.showDeleteFriendConfirm = false

      try {
        const data = await apiCall(`/discussion/friends/${this.currentChat.displayUserId}`, {
          method: 'DELETE'
        })
        notificationStore.success(
          '好友已删除',
          data?.deletedRoomCount
            ? `已清理 ${data.deletedRoomCount} 个私聊房间及相关协作记录。`
            : '相关私聊历史与协作信息已清理。'
        )
        window.dispatchEvent(new CustomEvent('friends:changed'))
        window.dispatchEvent(new CustomEvent('notifications:updated'))
        this.closeChatMorePanel()
        await this.initializeDiscussion()
      } catch (error) {
        notificationStore.error('删除好友失败', error.message || '请稍后重试')
        this.errorText = error.message || '删除好友失败'
      }
    },
    async handleClearHistoryClick() {
      const roomId = Number(this.currentChat?.id || 0)
      if (!roomId) return

      const notificationStore = useNotificationStore()
      this.showClearHistoryConfirm = false
      this.errorText = ''

      try {
        const data = await apiCall(`/discussion/rooms/${roomId}/messages/history`, {
          method: 'DELETE'
        })
        this.applyRoomHistoryClear(roomId, data?.clearedBeforeMessageId || 0)
        notificationStore.success('聊天记录已删除', '仅你这边的历史消息已清空，对方聊天记录保持不变。')
      } catch (error) {
        notificationStore.error('删除聊天记录失败', error.message || '请稍后重试')
        this.errorText = error.message || '删除聊天记录失败'
      }
    },
    async generateCurrentRoomInviteLink() {
      const roomId = Number(this.currentChat?.id || 0)
      if (!roomId) return
      const roomKey = String(roomId)
      this.roomInviteLinkGeneratingByRoom = {
        ...this.roomInviteLinkGeneratingByRoom,
        [roomKey]: true
      }
      this.errorText = ''
      try {
        const data = await apiCall(`/discussion/rooms/${roomId}/invite-links`, {
          method: 'POST',
          body: JSON.stringify({ expiresInMinutes: this.getRoomInviteExpireMinutes(roomId) })
        })
        this.roomInviteLinksByRoom = {
          ...this.roomInviteLinksByRoom,
          [roomKey]: data?.invite_link || data?.invite_code || ''
        }
      } catch (error) {
        this.errorText = error.message || '生成群聊邀请链接失败'
      } finally {
        this.roomInviteLinkGeneratingByRoom = {
          ...this.roomInviteLinkGeneratingByRoom,
          [roomKey]: false
        }
      }
    },
    async copyCurrentRoomInviteLink() {
      const notificationStore = useNotificationStore()
      const inviteLink = this.getRoomInviteLink(this.currentChat?.id)
      if (!inviteLink) return
      try {
        await navigator.clipboard.writeText(inviteLink)
        notificationStore.success('邀请链接已复制', '可以把链接发给好友加入群聊。')
      } catch (error) {
        notificationStore.error('复制失败', error.message || '请手动复制邀请链接')
      }
    },
    async inviteFriendIntoCurrentRoom(friend = {}) {
      const roomId = Number(this.currentChat?.id || 0)
      const targetUserId = Number(friend?.id || 0)
      if (!roomId || !targetUserId) return
      const key = String(targetUserId)
      this.roomFriendInviteLoadingByUser = {
        ...this.roomFriendInviteLoadingByUser,
        [key]: true
      }
      this.errorText = ''
      const notificationStore = useNotificationStore()
      try {
        await apiCall(`/discussion/rooms/${roomId}/members/invite`, {
          method: 'POST',
          body: JSON.stringify({ userId: targetUserId })
        })
        notificationStore.success('邀请已发送', `${friend.username || '该好友'} 已加入群聊。`)
        await this.fetchRoomDetail(roomId, { force: true })
      } catch (error) {
        notificationStore.error('邀请失败', error.message || '请稍后重试')
        this.errorText = error.message || '邀请好友进入群聊失败'
      } finally {
        this.roomFriendInviteLoadingByUser = {
          ...this.roomFriendInviteLoadingByUser,
          [key]: false
        }
      }
    },
    toggleDualAiLoop(nextValue) {
      this.updateCurrentRoomSetting('dualAiLoopEnabled', Boolean(nextValue), { delay: 0, immediate: true })
      if (nextValue && !this.dualAiLoopReady) {
        this.errorText = '需要先加入两个 AI，双 AI 轮询才会真正开始。'
      }
    },
    async generateDualAiLoopRound() {
      if (!this.currentChat?.id || !this.dualAiLoopReady || this.isRoomAiBusy(this.currentChat.id)) return
      try {
        await apiCall(`/discussion/rooms/${this.currentChat.id}/ai-loop/turn`, {
          method: 'POST'
        })
        await this.fetchRoomSettings(this.currentChat.id)
      } catch (error) {
        this.errorText = error.message || '生成双 AI 轮询消息失败'
      }
    }
  }
}
