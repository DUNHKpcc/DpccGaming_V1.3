import { onMounted, onUnmounted, ref, watch } from 'vue'
import { apiCall } from '../utils/api'

export const useAccountFriends = ({
  route,
  router,
  isLoggedIn,
  notificationStore,
  openLoginModal
}) => {
  const friends = ref([])
  const friendsLoading = ref(false)
  const friendModalVisible = ref(false)
  const groupModalVisible = ref(false)
  const groupInviteModalVisible = ref(false)
  const groupTitle = ref('')
  const selectedGroupFriendIds = ref([])
  const friendSearchKeyword = ref('')
  const friendSearching = ref(false)
  const friendSearchResults = ref([])
  const friendActionLoading = ref({})
  const inviteExpireMinutes = ref(60)
  const inviteGenerating = ref(false)
  const generatedInviteLink = ref('')
  const inviteCodeInput = ref('')
  const inviteRedeeming = ref(false)
  const groupInviteInput = ref('')
  const groupInviteRedeeming = ref(false)
  const friendRequestsLoading = ref(false)
  const incomingRequests = ref([])
  const outgoingRequests = ref([])
  const friendChatOpening = ref({})
  const groupCreating = ref(false)

  const dispatchFriendsChanged = () => {
    window.dispatchEvent(new CustomEvent('friends:changed'))
  }

  const loadFriends = async () => {
    if (!isLoggedIn.value) {
      friends.value = []
      return
    }

    friendsLoading.value = true
    try {
      const data = await apiCall('/discussion/friends')
      friends.value = Array.isArray(data?.friends) ? data.friends : []
    } catch (error) {
      console.error('加载好友失败:', error)
      friends.value = []
    } finally {
      friendsLoading.value = false
    }
  }

  const loadFriendRequests = async () => {
    if (!isLoggedIn.value) {
      incomingRequests.value = []
      outgoingRequests.value = []
      return
    }

    friendRequestsLoading.value = true
    try {
      const data = await apiCall('/discussion/friends/requests')
      incomingRequests.value = Array.isArray(data?.incoming) ? data.incoming : []
      outgoingRequests.value = Array.isArray(data?.outgoing) ? data.outgoing : []
    } catch (error) {
      console.error('加载好友申请失败:', error)
      incomingRequests.value = []
      outgoingRequests.value = []
    } finally {
      friendRequestsLoading.value = false
    }
  }

  const refreshFriendData = async () => {
    await Promise.all([
      loadFriends(),
      loadFriendRequests()
    ])
  }

  const openFriendModal = async () => {
    if (!isLoggedIn.value) {
      openLoginModal()
      return
    }
    friendModalVisible.value = true
    await loadFriendRequests()
  }

  const closeFriendModal = () => {
    friendModalVisible.value = false
    friendSearchKeyword.value = ''
    friendSearchResults.value = []
  }

  const openGroupInviteModal = () => {
    if (!isLoggedIn.value) {
      openLoginModal()
      return
    }
    groupInviteModalVisible.value = true
  }

  const closeGroupInviteModal = () => {
    groupInviteModalVisible.value = false
    groupInviteInput.value = ''
  }

  const openGroupModal = async () => {
    if (!isLoggedIn.value) {
      openLoginModal()
      return
    }
    groupModalVisible.value = true
    if (!friends.value.length) {
      await loadFriends()
    }
  }

  const closeGroupModal = () => {
    groupModalVisible.value = false
    groupTitle.value = ''
    selectedGroupFriendIds.value = []
  }

  const toggleGroupFriend = (friendId) => {
    const parsedId = Number.parseInt(friendId, 10)
    if (!parsedId) return
    if (selectedGroupFriendIds.value.includes(parsedId)) {
      selectedGroupFriendIds.value = selectedGroupFriendIds.value.filter((id) => id !== parsedId)
      return
    }
    if (selectedGroupFriendIds.value.length >= 3) {
      notificationStore.warning('人数已满', '当前最多可邀请 3 位好友一起拉群')
      return
    }
    selectedGroupFriendIds.value = [...selectedGroupFriendIds.value, parsedId]
  }

  const searchFriendUsers = async () => {
    const keyword = friendSearchKeyword.value.trim()
    if (!keyword) {
      friendSearchResults.value = []
      return
    }

    friendSearching.value = true
    try {
      const data = await apiCall(`/discussion/friends/search?q=${encodeURIComponent(keyword)}`)
      friendSearchResults.value = Array.isArray(data?.users) ? data.users : []
    } catch (error) {
      console.error('搜索用户失败:', error)
      friendSearchResults.value = []
      notificationStore.error('搜索失败', error.message || '请稍后重试')
    } finally {
      friendSearching.value = false
    }
  }

  const sendFriendRequestByUser = async (user) => {
    if (!user?.id) return
    const key = String(user.id)
    friendActionLoading.value[key] = true
    try {
      const data = await apiCall('/discussion/friends/request', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: user.id })
      })
      notificationStore.success('已发送好友申请', data?.message || `已向 ${user.username} 发送申请`)
      await refreshFriendData()
      await searchFriendUsers()
      dispatchFriendsChanged()
    } catch (error) {
      notificationStore.warning('发送失败', error.message || '请稍后重试')
    } finally {
      friendActionLoading.value[key] = false
    }
  }

  const respondFriendRequest = async (requestId, action) => {
    const requestKey = Number.parseInt(requestId, 10)
    if (!requestKey) return
    try {
      await apiCall(`/discussion/friends/requests/${requestKey}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action })
      })
      notificationStore.success('处理成功', action === 'accept' ? '已同意好友申请' : '已拒绝好友申请')
      await refreshFriendData()
      await searchFriendUsers()
      dispatchFriendsChanged()
    } catch (error) {
      notificationStore.error('处理失败', error.message || '请稍后重试')
    }
  }

  const generateFriendInvite = async () => {
    inviteGenerating.value = true
    try {
      const data = await apiCall('/discussion/friends/invite-links', {
        method: 'POST',
        body: JSON.stringify({ expiresInMinutes: inviteExpireMinutes.value })
      })
      generatedInviteLink.value = data?.invite_link || data?.invite_code || ''
      notificationStore.success('邀请链接已生成', '可复制后发送给好友')
    } catch (error) {
      notificationStore.error('生成失败', error.message || '请稍后重试')
    } finally {
      inviteGenerating.value = false
    }
  }

  const copyInviteLink = async () => {
    if (!generatedInviteLink.value) return
    try {
      await navigator.clipboard.writeText(generatedInviteLink.value)
      notificationStore.success('复制成功', '邀请链接已复制到剪贴板')
    } catch (error) {
      notificationStore.warning('复制失败', '请手动复制邀请链接')
    }
  }

  const parseGroupInvitePayload = (rawValue = '') => {
    const raw = String(rawValue || '').trim()
    if (!raw) return null

    let roomId = null
    let inviteCode = ''

    const parseFromUrl = (value) => {
      try {
        const parsed = new URL(value, window.location.origin)
        const matchedRoomId = parsed.pathname.match(/\/discussion\/(\d+)/i)
        const nextRoomId = Number.parseInt(matchedRoomId?.[1] || '', 10)
        const nextInviteCode = String(
          parsed.searchParams.get('roomInvite') ||
          parsed.searchParams.get('invite') ||
          parsed.searchParams.get('code') ||
          ''
        ).trim()
        return {
          roomId: Number.isInteger(nextRoomId) && nextRoomId > 0 ? nextRoomId : null,
          inviteCode: nextInviteCode
        }
      } catch {
        return { roomId: null, inviteCode: '' }
      }
    }

    const parsedFromUrl = parseFromUrl(raw)
    roomId = parsedFromUrl.roomId
    inviteCode = parsedFromUrl.inviteCode

    if (!roomId) {
      const roomMatch = raw.match(/\/discussion\/(\d+)/i)
      const nextRoomId = Number.parseInt(roomMatch?.[1] || '', 10)
      if (Number.isInteger(nextRoomId) && nextRoomId > 0) {
        roomId = nextRoomId
      }
    }

    if (!inviteCode) {
      const inviteMatch = raw.match(/[?&](?:roomInvite|invite|code)=([^&#]+)/i)
      inviteCode = inviteMatch?.[1] ? decodeURIComponent(inviteMatch[1]) : ''
    }

    if (!roomId || !inviteCode) return null
    return { roomId, inviteCode }
  }

  const redeemGroupInvite = async () => {
    const parsed = parseGroupInvitePayload(groupInviteInput.value)
    if (!parsed) {
      notificationStore.warning('链接无效', '请填写完整且有效的群邀请链接')
      return
    }

    groupInviteRedeeming.value = true
    try {
      const data = await apiCall(`/discussion/rooms/${parsed.roomId}/invite-links/redeem`, {
        method: 'POST',
        body: JSON.stringify({ code: parsed.inviteCode })
      })
      closeGroupInviteModal()
      notificationStore.success('加入成功', data?.message || '已加入群聊')
      router.push({ name: 'DiscussionMode', params: { id: String(parsed.roomId) } })
    } catch (error) {
      notificationStore.error('加入失败', error.message || '请确认邀请链接有效后重试')
    } finally {
      groupInviteRedeeming.value = false
    }
  }

  const redeemFriendInvite = async () => {
    const code = inviteCodeInput.value.trim()
    if (!code) {
      notificationStore.warning('请输入邀请码', '可输入完整邀请链接或邀请码')
      return
    }

    inviteRedeeming.value = true
    try {
      const data = await apiCall('/discussion/friends/invite-links/redeem', {
        method: 'POST',
        body: JSON.stringify({ code })
      })
      inviteCodeInput.value = ''
      notificationStore.success('添加成功', data?.message || '已通过邀请链接添加好友')
      await refreshFriendData()
      await searchFriendUsers()
      dispatchFriendsChanged()
    } catch (error) {
      notificationStore.error('兑换失败', error.message || '请确认链接有效后重试')
    } finally {
      inviteRedeeming.value = false
    }
  }

  const isOpeningFriendChat = (friendId) => {
    if (!friendId) return false
    return friendChatOpening.value[String(friendId)] === true
  }

  const createGroupDiscussion = async () => {
    if (!selectedGroupFriendIds.value.length) {
      notificationStore.warning('请先选择好友', '至少选择 1 位好友后才能创建群聊')
      return
    }

    groupCreating.value = true
    try {
      const data = await apiCall('/discussion/rooms', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'room',
          visibility: 'private',
          title: groupTitle.value.trim(),
          memberIds: selectedGroupFriendIds.value
        })
      })
      const roomId = Number.parseInt(data?.room?.id, 10)
      if (!roomId) {
        throw new Error('未获取到可用群聊房间')
      }
      notificationStore.success('群聊已创建', '已把选中的好友加入新的多人群聊')
      closeGroupModal()
      router.push({ name: 'DiscussionMode', params: { id: String(roomId) } })
    } catch (error) {
      notificationStore.error('创建群聊失败', error.message || '请稍后重试')
    } finally {
      groupCreating.value = false
    }
  }

  const openFriendDiscussion = async (friend = {}) => {
    const friendId = Number.parseInt(friend?.id, 10)
    if (!friendId || !isLoggedIn.value) return

    const key = String(friendId)
    if (friendChatOpening.value[key]) return

    friendChatOpening.value[key] = true
    try {
      const data = await apiCall(`/discussion/friends/${friendId}/direct-room`, {
        method: 'POST'
      })
      const roomId = Number.parseInt(data?.room?.id, 10)
      if (!roomId) {
        throw new Error('未获取到可用聊天房间')
      }
      router.push({ name: 'DiscussionMode', params: { id: String(roomId) } })
    } catch (error) {
      notificationStore.error('打开协作聊天失败', error.message || '请稍后重试')
    } finally {
      friendChatOpening.value[key] = false
    }
  }

  const syncFriendInviteFromRoute = (rawValue = '') => {
    const inviteFromQuery = String(rawValue || '').trim()
    if (!inviteFromQuery) return
    inviteCodeInput.value = inviteFromQuery
    if (isLoggedIn.value) {
      friendModalVisible.value = true
    }
  }

  const resetFriendState = () => {
    groupInviteModalVisible.value = false
    closeGroupModal()
    friends.value = []
    friendsLoading.value = false
    incomingRequests.value = []
    outgoingRequests.value = []
    friendModalVisible.value = false
    friendSearchKeyword.value = ''
    friendSearchResults.value = []
    friendSearching.value = false
    friendActionLoading.value = {}
    friendRequestsLoading.value = false
    friendChatOpening.value = {}
    groupInviteInput.value = ''
    groupInviteRedeeming.value = false
    groupCreating.value = false
  }

  onMounted(() => {
    syncFriendInviteFromRoute(route.query?.friendInvite)
    if (isLoggedIn.value) {
      loadFriends()
      loadFriendRequests()
    }
    window.addEventListener('friends:changed', refreshFriendData)
  })

  onUnmounted(() => {
    window.removeEventListener('friends:changed', refreshFriendData)
  })

  watch(() => route.query?.friendInvite, (nextInvite) => {
    syncFriendInviteFromRoute(nextInvite)
  })

  watch(isLoggedIn, (loggedIn) => {
    if (!loggedIn) {
      resetFriendState()
      return
    }

    loadFriends()
    loadFriendRequests()
    if (inviteCodeInput.value) {
      friendModalVisible.value = true
    }
  })

  return {
    friends,
    friendsLoading,
    friendModalVisible,
    groupModalVisible,
    groupInviteModalVisible,
    groupTitle,
    selectedGroupFriendIds,
    friendSearchKeyword,
    friendSearching,
    friendSearchResults,
    friendActionLoading,
    inviteExpireMinutes,
    inviteGenerating,
    generatedInviteLink,
    inviteCodeInput,
    inviteRedeeming,
    groupInviteInput,
    groupInviteRedeeming,
    friendRequestsLoading,
    incomingRequests,
    outgoingRequests,
    friendChatOpening,
    groupCreating,
    loadFriends,
    loadFriendRequests,
    refreshFriendData,
    openFriendModal,
    closeFriendModal,
    openGroupInviteModal,
    closeGroupInviteModal,
    openGroupModal,
    closeGroupModal,
    toggleGroupFriend,
    searchFriendUsers,
    sendFriendRequestByUser,
    respondFriendRequest,
    generateFriendInvite,
    copyInviteLink,
    redeemGroupInvite,
    redeemFriendInvite,
    isOpeningFriendChat,
    createGroupDiscussion,
    openFriendDiscussion
  }
}
