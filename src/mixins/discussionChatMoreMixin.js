import { apiCall } from '../utils/api'
import { useNotificationStore } from '../stores/notification'
import {
  CHAT_MORE_MENU_ITEMS,
  CHAT_MORE_COLLAB_STATUS_OPTIONS,
  CHAT_MORE_ROLE_PRESET_OPTIONS,
  CHAT_MORE_BUILTIN_MODELS,
  createDefaultChatMoreSettings,
  normalizeChatMoreSettings,
  getCollaborationStatusLabel,
  getCollaborationStatusMeta,
  compressImageToWebpDataUrl
} from '../utils/discussionChatMore'

export default {
  data() {
    return {
      showGameLibraryPicker: false,
      showDeleteFriendConfirm: false,
      chatMoreMenuItems: CHAT_MORE_MENU_ITEMS,
      chatMoreBuiltinModels: CHAT_MORE_BUILTIN_MODELS,
      chatMoreCollabStatusOptions: CHAT_MORE_COLLAB_STATUS_OPTIONS,
      chatMoreRolePresetOptions: CHAT_MORE_ROLE_PRESET_OPTIONS,
      activeChatMoreSection: '',
      chatMoreSettingsByRoom: {},
      roomSettingsSaveTimers: {},
      gameLibraryLoading: false,
      gameLibraryError: '',
      gameLibraryGames: []
    }
  },
  methods: {
    getDeleteFriendWarningText() {
      const targetName = this.currentChat?.name || '该好友'
      return `删除 ${targetName} 后，将同时删除你们的私聊房间、历史消息、文档、任务、AI 设置以及相关通知记录，此操作不可恢复。`
    },
    openDeleteFriendConfirm() {
      if (!this.currentChat?.displayUserId) return
      this.showDeleteFriendConfirm = true
    },
    closeDeleteFriendConfirm() {
      this.showDeleteFriendConfirm = false
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
    setRoomSettings(roomId, nextSettings = {}) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return
      this.chatMoreSettingsByRoom = {
        ...this.chatMoreSettingsByRoom,
        [roomKey]: normalizeChatMoreSettings(nextSettings)
      }
    },
    async fetchRoomSettings(roomId) {
      const roomKey = String(roomId || '').trim()
      if (!roomKey) return createDefaultChatMoreSettings()
      const data = await apiCall(`/discussion/rooms/${roomKey}/settings`)
      const settings = normalizeChatMoreSettings(data?.settings || {})
      this.setRoomSettings(roomKey, settings)
      this.applyRoomSettingsToLoadedChats()
      return settings
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
      const settings = this.getRoomSettings(roomKey)
      try {
        const data = await apiCall(`/discussion/rooms/${roomKey}/settings`, {
          method: 'PATCH',
          body: JSON.stringify({ settings })
        })
        this.setRoomSettings(roomKey, data?.settings || settings)
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
      chat.name = settings.customNickname || chat.baseName
      chat.status = this.buildChatStatus(chat)
      chat.displayRolePreset = settings.peerRolePreset || ''
    },
    applyRoomSettingsToLoadedChats() {
      this.chats.forEach((chat) => this.applyRoomSettingsToChat(chat))
    },
    closeChatMorePanel() {
      this.flushRoomSettingsSave(this.currentChat?.id)
      this.showChatMorePanel = false
      this.showDeleteFriendConfirm = false
      this.activeChatMoreSection = ''
      this.closeGameLibraryPicker()
    },
    toggleChatMorePanel() {
      if (!this.currentChatSupportsMorePanel) return
      this.closeAttachmentMenu()
      this.closeCodePicker()
      this.closeDocumentPicker()
      const nextVisible = !this.showChatMorePanel
      this.showChatMorePanel = nextVisible
      if (!nextVisible) {
        this.closeGameLibraryPicker()
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
    async openGameLibraryPicker() {
      if (!this.currentChatSupportsMorePanel) return
      this.showGameLibraryPicker = true
      await this.ensureGameLibraryLoaded()
    },
    closeGameLibraryPicker() {
      this.showGameLibraryPicker = false
    },
    async selectRoomCodeGame(game = {}) {
      const nextGameId = String(this.getLibraryGameKey(game) || '').trim()
      if (!nextGameId) return
      this.updateCurrentRoomSetting('sourceGameId', nextGameId)
      this.updateCurrentRoomSetting('sourceGameTitle', this.getLibraryGameTitle(game))
      this.currentCodePath = ''
      this.closeGameLibraryPicker()
      await this.syncCurrentRoomCode({ force: true })
    },
    async resetRoomCodeGame() {
      this.updateCurrentRoomSetting('sourceGameId', '')
      this.updateCurrentRoomSetting('sourceGameTitle', '')
      this.currentCodePath = ''
      await this.syncCurrentRoomCode({ force: true })
    },
    updateCurrentRoomSetting(field, value) {
      const roomId = this.currentChat?.id
      const settings = this.getRoomSettings(roomId)
      settings[field] = typeof value === 'string' ? value.trimStart() : value
      if (field === 'peerRolePreset' || field === 'customNickname' || field === 'collaborationStatus') {
        this.applyRoomSettingsToLoadedChats()
      }
      this.queueRoomSettingsSave(roomId)
    },
    resetCurrentRoomNickname() {
      this.updateCurrentRoomSetting('customNickname', '')
    },
    updateAiSlotField(slotId, field, value) {
      const settings = this.getRoomSettings(this.currentChat?.id)
      const slot = settings.aiSlots.find((item) => item.id === slotId)
      if (!slot) return
      slot[field] = value
      this.queueRoomSettingsSave(this.currentChat?.id, field === 'apiKey' ? 0 : 280)
    },
    async onAiAvatarFileChange(slotId, event) {
      const file = event?.target?.files?.[0]
      if (!file) return
      try {
        const avatarUrl = await compressImageToWebpDataUrl(file)
        this.updateAiSlotField(slotId, 'avatarUrl', avatarUrl)
        this.updateAiSlotField(slotId, 'avatarUpdatedAt', Date.now())
      } catch (error) {
        this.errorText = error.message || 'AI 头像处理失败'
      } finally {
        if (event?.target) event.target.value = ''
      }
    },
    async handleChatMoreItemClick(item) {
      const key = String(item?.key || '').trim()
      if (!key) return
      this.activeChatMoreSection = this.activeChatMoreSection === key ? '' : key
      if (key === 'game-code') {
        await this.openGameLibraryPicker()
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
    toggleDualAiLoop(nextValue) {
      this.updateCurrentRoomSetting('dualAiLoopEnabled', Boolean(nextValue))
      if (nextValue && !this.dualAiLoopReady) {
        this.errorText = '需要先加入两个 AI，双 AI 轮询才会真正开始。'
      }
    },
    async generateDualAiLoopRound() {
      if (!this.currentChat?.id || !this.dualAiLoopReady) return
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
