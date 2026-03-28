import { onMounted, onUnmounted, ref, watch } from 'vue'
import { API_BASE_URL, apiCall } from '../utils/api'
import { getGameCoverUrl, getGameVideoUrl, hasPlayableVideo } from '../utils/gameLibraryPresentation'
const LOGOUT_CONFIRM_WINDOW_MS = 4500

export const useAccountProfile = ({
  authStore,
  gameStore,
  modalStore,
  notificationStore,
  currentUser,
  isLoggedIn,
  openLoginModal
}) => {
  const libraryGames = ref([])
  const libraryLoading = ref(false)
  const avatarInputRef = ref(null)
  const coverInputRef = ref(null)
  const avatarUploading = ref(false)
  const coverUploading = ref(false)
  const profileSaving = ref(false)
  const wechatBinding = ref(false)
  const wechatBound = ref(false)
  const wechatBoundLabel = ref('')
  const googleBinding = ref(false)
  const googleBound = ref(false)
  const googleBoundLabel = ref('')
  const logoutConfirmPending = ref(false)
  const logoutConfirmTimer = ref(null)
  const profileDraftState = ref({
    bio: '',
    preferred_language: '',
    preferred_engine: ''
  })
  const profilePendingPayload = ref(null)

  const loadPlayerGames = async () => {
    if (!isLoggedIn.value) return

    try {
      await gameStore.loadGames()
    } catch (error) {
      console.error('加载用户游戏失败:', error)
    }
  }

  const loadLibraryGames = async () => {
    if (!isLoggedIn.value) {
      libraryGames.value = []
      return
    }

    libraryLoading.value = true
    try {
      const data = await apiCall('/games/library/mine')
      libraryGames.value = Array.isArray(data?.games) ? data.games : []
    } catch (error) {
      console.error('加载游戏库失败:', error)
      libraryGames.value = []
    } finally {
      libraryLoading.value = false
    }
  }

  const loadWechatBindStatus = async () => {
    if (!isLoggedIn.value) {
      wechatBound.value = false
      wechatBoundLabel.value = ''
      return
    }

    try {
      const data = await apiCall('/auth/wechat/bind-status')
      wechatBound.value = Boolean(data?.bound)
      const nickname = String(data?.account?.provider_username || '').trim()
      const maskedId = String(data?.account?.provider_user_id_masked || '').trim()
      wechatBoundLabel.value = wechatBound.value
        ? (nickname ? `已绑定：${nickname}` : (maskedId ? `已绑定：${maskedId}` : '当前账号已绑定微信'))
        : ''
    } catch (error) {
      console.error('加载微信绑定状态失败:', error)
      wechatBound.value = false
      wechatBoundLabel.value = ''
    }
  }

  const loadGoogleBindStatus = async () => {
    if (!isLoggedIn.value) {
      googleBound.value = false
      googleBoundLabel.value = ''
      return
    }

    try {
      const data = await apiCall('/auth/google/bind-status')
      googleBound.value = Boolean(data?.bound)
      const nickname = String(data?.account?.provider_username || '').trim()
      const email = String(data?.account?.email || '').trim()
      const maskedId = String(data?.account?.provider_user_id_masked || '').trim()
      googleBoundLabel.value = googleBound.value
        ? (nickname ? `Google 已绑定：${nickname}` : (email || maskedId ? `Google 已绑定：${email || maskedId}` : '当前账号已绑定 Google'))
        : ''
    } catch (error) {
      console.error('加载 Google 绑定状态失败:', error)
      googleBound.value = false
      googleBoundLabel.value = ''
    }
  }

  const startOauthBind = (provider) => {
    if (!isLoggedIn.value) {
      openLoginModal()
      return
    }

    const isWechat = provider === 'wechat'
    const alreadyBound = isWechat ? wechatBound.value : googleBound.value
    const alreadyBoundTitle = isWechat ? '已绑定微信' : '已绑定 Google'
    const alreadyBoundMessage = isWechat ? '当前账号已绑定微信，无需重复操作' : '当前账号已绑定 Google，无需重复操作'
    if (alreadyBound) {
      notificationStore.info(alreadyBoundTitle, alreadyBoundMessage)
      return
    }

    if (isWechat) {
      wechatBinding.value = true
    } else {
      googleBinding.value = true
    }

    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const bindUrl = new URL(`${API_BASE_URL}/auth/${provider}/bind/start`, window.location.origin)
    bindUrl.searchParams.set('returnTo', currentPath || '/account')
    window.location.href = bindUrl.toString()
  }

  const startWechatBind = async () => {
    startOauthBind('wechat')
  }

  const startGoogleBind = () => {
    startOauthBind('google')
  }

  const clearLogoutConfirmState = () => {
    logoutConfirmPending.value = false
    if (logoutConfirmTimer.value) {
      window.clearTimeout(logoutConfirmTimer.value)
      logoutConfirmTimer.value = null
    }
  }

  const logout = () => {
    if (!logoutConfirmPending.value) {
      logoutConfirmPending.value = true
      if (logoutConfirmTimer.value) {
        window.clearTimeout(logoutConfirmTimer.value)
      }
      logoutConfirmTimer.value = window.setTimeout(() => {
        logoutConfirmPending.value = false
        logoutConfirmTimer.value = null
      }, LOGOUT_CONFIRM_WINDOW_MS)
      notificationStore.warning('确认退出登录', '再次点击“退出登录”将退出当前账号')
      return
    }

    clearLogoutConfirmState()
    authStore.logout()
  }

  const openAvatarPicker = () => {
    if (avatarUploading.value) return
    avatarInputRef.value?.click()
  }

  const openCoverPicker = () => {
    if (coverUploading.value) return
    coverInputRef.value?.click()
  }

  const onAvatarFileChange = async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      notificationStore.warning('文件类型不支持', '请上传图片文件')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      notificationStore.warning('文件过大', '头像文件大小不能超过 5MB')
      event.target.value = ''
      return
    }

    avatarUploading.value = true
    const result = await authStore.uploadAvatar(file)
    avatarUploading.value = false
    event.target.value = ''

    if (result.success) {
      notificationStore.success('头像已更新', result.message)
    } else {
      notificationStore.error('头像上传失败', result.message)
    }
  }

  const onCoverFileChange = async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      notificationStore.warning('文件类型不支持', '请上传图片文件')
      event.target.value = ''
      return
    }

    if (file.size > 12 * 1024 * 1024) {
      notificationStore.warning('文件过大', '背景图文件大小不能超过 12MB')
      event.target.value = ''
      return
    }

    coverUploading.value = true
    const result = await authStore.uploadCover(file)
    coverUploading.value = false
    event.target.value = ''

    if (result.success) {
      notificationStore.success('背景图已更新', result.message)
    } else {
      notificationStore.error('背景图上传失败', result.message)
    }
  }

  const getProfilePayloadFromUser = (user = {}) => {
    const source = user || {}
    return {
      bio: String(source.bio || source.profile_bio || '').trim(),
      preferred_language: String(source.preferred_language || '').trim(),
      preferred_engine: String(source.preferred_engine || '').trim()
    }
  }

  const isSameProfilePayload = (left = {}, right = {}) => {
    return String(left.bio || '') === String(right.bio || '')
      && String(left.preferred_language || '') === String(right.preferred_language || '')
      && String(left.preferred_engine || '') === String(right.preferred_engine || '')
  }

  const saveProfileSettings = async (patch = {}, options = {}) => {
    const { silent = true } = options
    const normalizedPatch = {
      bio: patch?.bio !== undefined ? String(patch.bio || '').trim() : undefined,
      preferred_language: patch?.preferred_language !== undefined ? String(patch.preferred_language || '').trim() : undefined,
      preferred_engine: patch?.preferred_engine !== undefined ? String(patch.preferred_engine || '').trim() : undefined
    }

    const basePayload = {
      ...profileDraftState.value
    }
    const nextPayload = {
      ...basePayload,
      ...(normalizedPatch.bio !== undefined ? { bio: normalizedPatch.bio } : {}),
      ...(normalizedPatch.preferred_language !== undefined ? { preferred_language: normalizedPatch.preferred_language } : {}),
      ...(normalizedPatch.preferred_engine !== undefined ? { preferred_engine: normalizedPatch.preferred_engine } : {})
    }

    if (isSameProfilePayload(nextPayload, basePayload)) {
      return { success: true, skipped: true }
    }

    profileDraftState.value = nextPayload

    if (profileSaving.value) {
      profilePendingPayload.value = { ...nextPayload }
      return { success: true, queued: true }
    }

    profileSaving.value = true
    try {
      let payloadToSave = { ...nextPayload }

      while (payloadToSave) {
        const result = await authStore.updateProfile(payloadToSave)
        if (!result.success) {
          profileDraftState.value = getProfilePayloadFromUser(currentUser.value)
          notificationStore.error('资料保存失败', result.message)
          return result
        }

        if (!silent) {
          notificationStore.success('资料已更新', result.message)
        }

        const queuedPayload = profilePendingPayload.value
        profilePendingPayload.value = null
        if (queuedPayload && !isSameProfilePayload(queuedPayload, payloadToSave)) {
          payloadToSave = { ...queuedPayload }
          continue
        }

        return result
      }
    } finally {
      profileSaving.value = false
    }
  }

  const onPlayerProfileAutoSave = async (patch = {}) => {
    await saveProfileSettings(patch, { silent: true })
  }

  const formatSavedDate = (value) => {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--'
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }

  const openLibraryGame = (game = {}) => {
    const gameId = game.game_id || game.id
    if (!gameId) return

    modalStore.enterFullscreen({
      ...game,
      id: game.id || gameId,
      game_id: gameId,
      launch_url: game.launch_url || game.game_url || ''
    })
  }

  onMounted(() => {
    if (isLoggedIn.value) {
      loadPlayerGames()
      loadLibraryGames()
      loadWechatBindStatus()
      loadGoogleBindStatus()
    }
  })

  onUnmounted(() => {
    clearLogoutConfirmState()
  })

  watch(currentUser, (user) => {
    profileDraftState.value = getProfilePayloadFromUser(user)
  }, { immediate: true })

  watch(isLoggedIn, (loggedIn) => {
    if (!loggedIn) {
      clearLogoutConfirmState()
      libraryGames.value = []
      libraryLoading.value = false
      wechatBinding.value = false
      wechatBound.value = false
      wechatBoundLabel.value = ''
      googleBinding.value = false
      googleBound.value = false
      googleBoundLabel.value = ''
      coverUploading.value = false
      profileSaving.value = false
      profileDraftState.value = getProfilePayloadFromUser(null)
      profilePendingPayload.value = null
      return
    }

    loadPlayerGames()
    loadLibraryGames()
    loadWechatBindStatus()
    loadGoogleBindStatus()
  })

  return {
    libraryGames,
    libraryLoading,
    avatarInputRef,
    coverInputRef,
    avatarUploading,
    coverUploading,
    profileSaving,
    wechatBinding,
    wechatBound,
    wechatBoundLabel,
    googleBinding,
    googleBound,
    googleBoundLabel,
    logoutConfirmPending,
    startWechatBind,
    startGoogleBind,
    logout,
    openAvatarPicker,
    openCoverPicker,
    onAvatarFileChange,
    onCoverFileChange,
    onPlayerProfileAutoSave,
    getGameCoverUrl,
    getGameVideoUrl,
    hasPlayableVideo,
    formatSavedDate,
    openLibraryGame
  }
}
