<template>
  <div ref="rootRef" class="avatar-friend-action">
    <div
      ref="triggerRef"
      class="avatar-trigger"
      @mouseenter="handleTriggerEnter"
      @mouseleave="handleTriggerLeave"
      @click.stop="handleTriggerClick"
    >
      <slot />
    </div>

    <Teleport to="body">
      <button
        v-if="bubbleVisible && canAddFriend"
        ref="bubbleRef"
        type="button"
        class="friend-plus-bubble"
        :style="bubbleStyle"
        :disabled="sending"
        @mouseenter="handleBubbleEnter"
        @mouseleave="handleBubbleLeave"
        @click.stop="sendFriendRequest"
      >
        <i :class="sending ? 'fa fa-spinner fa-spin' : 'fa fa-plus'"></i>
      </button>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { apiCall } from '../utils/api'
import { useAuthStore } from '../stores/auth'
import { useModalStore } from '../stores/modal'
import { useNotificationStore } from '../stores/notification'

const props = defineProps({
  userId: {
    type: [Number, String],
    default: null
  },
  username: {
    type: String,
    default: ''
  },
  placement: {
    type: String,
    default: 'right'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['requested'])

const authStore = useAuthStore()
const modalStore = useModalStore()
const notificationStore = useNotificationStore()

const rootRef = ref(null)
const triggerRef = ref(null)
const bubbleRef = ref(null)
const sending = ref(false)
const bubbleVisible = ref(false)
const bubbleStyle = ref({})
let autoHideTimer = null
const hoveringTrigger = ref(false)
const hoveringBubble = ref(false)

const targetUserId = computed(() => {
  const parsed = Number.parseInt(props.userId, 10)
  return Number.isNaN(parsed) ? null : parsed
})

const currentUserId = computed(() => {
  const parsed = Number.parseInt(authStore.currentUser?.id, 10)
  return Number.isNaN(parsed) ? null : parsed
})

const canAddFriend = computed(() => {
  if (props.disabled) return false
  if (!targetUserId.value) return false
  if (!authStore.isLoggedIn) return false
  return targetUserId.value !== currentUserId.value
})

const clearAutoHide = () => {
  if (!autoHideTimer) return
  window.clearTimeout(autoHideTimer)
  autoHideTimer = null
}

const hideBubble = () => {
  clearAutoHide()
  hoveringTrigger.value = false
  hoveringBubble.value = false
  bubbleVisible.value = false
}

const scheduleAutoHide = () => {
  clearAutoHide()
  autoHideTimer = window.setTimeout(() => {
    if (!hoveringTrigger.value && !hoveringBubble.value) {
      bubbleVisible.value = false
    }
    autoHideTimer = null
  }, 360)
}

const updateBubblePosition = () => {
  const el = triggerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const size = 30
  const top = Math.max(rect.top + window.scrollY - size * 0.35, 8)
  const left = rect.left + window.scrollX + rect.width - size * 0.35
  bubbleStyle.value = {
    top: `${top}px`,
    left: `${left}px`
  }
}

const handleOutsideClick = (event) => {
  if (!bubbleVisible.value) return
  const root = rootRef.value
  if (root && root.contains(event.target)) return
  const bubble = bubbleRef.value
  if (bubble && bubble.contains(event.target)) return
  hideBubble()
}

const handleWindowChange = () => {
  if (!bubbleVisible.value) return
  updateBubblePosition()
}

const ensureListeners = () => {
  window.addEventListener('mousedown', handleOutsideClick, true)
  window.addEventListener('scroll', handleWindowChange, true)
  window.addEventListener('resize', handleWindowChange)
}

const removeListeners = () => {
  window.removeEventListener('mousedown', handleOutsideClick, true)
  window.removeEventListener('scroll', handleWindowChange, true)
  window.removeEventListener('resize', handleWindowChange)
}

const handleTriggerClick = () => {
  if (props.disabled) return

  if (!targetUserId.value) {
    notificationStore.info('当前无法添加', '该头像未绑定可添加的用户账号')
    return
  }

  if (!authStore.isLoggedIn) {
    modalStore.openModal('login')
    notificationStore.info('请先登录', '登录后可添加好友')
    return
  }

  if (targetUserId.value === currentUserId.value) {
    notificationStore.info('这是你自己', '不能添加自己为好友')
    return
  }

  showBubble()
  notificationStore.info('添加好友', '点击头像旁边的 + 即可发送好友申请')
}

const showBubble = () => {
  if (!canAddFriend.value) return
  updateBubblePosition()
  bubbleVisible.value = true
}

const handleTriggerEnter = () => {
  hoveringTrigger.value = true
  showBubble()
}

const handleTriggerLeave = () => {
  hoveringTrigger.value = false
  scheduleAutoHide()
}

const handleBubbleEnter = () => {
  hoveringBubble.value = true
}

const handleBubbleLeave = () => {
  hoveringBubble.value = false
  scheduleAutoHide()
}

const sendFriendRequest = async () => {
  if (!canAddFriend.value || sending.value) return

  sending.value = true
  try {
    const data = await apiCall('/discussion/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: targetUserId.value })
    })

    notificationStore.success('好友申请已发送', data?.message || `已向 ${props.username || '该用户'} 发出好友申请`)
    hideBubble()
    emit('requested', { userId: targetUserId.value })
    window.dispatchEvent(new CustomEvent('friends:changed'))
  } catch (error) {
    const message = String(error?.message || '请求失败')
    if (message.includes('已经是好友')) {
      notificationStore.info('你们已经是好友', message)
    } else if (message.includes('已存在')) {
      notificationStore.warning('好友申请已存在', message)
    } else {
      notificationStore.error('添加好友失败', message)
    }
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  ensureListeners()
})

onBeforeUnmount(() => {
  hideBubble()
  removeListeners()
})
</script>

<style scoped>
.avatar-friend-action {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.avatar-trigger {
  display: inline-flex;
  cursor: pointer;
}

.friend-plus-bubble {
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(17, 17, 17, 0.96);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.32);
  z-index: 2147483000;
  transform: translate3d(0, 0, 0);
}

.friend-plus-bubble:hover:not(:disabled) {
  background: #111111;
}

.friend-plus-bubble:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

[data-theme='light'] .friend-plus-bubble {
  border-color: rgba(17, 17, 17, 0.22);
  background: #ffffff;
  color: #111111;
  box-shadow: 0 8px 22px rgba(17, 17, 17, 0.22);
}

[data-theme='light'] .friend-plus-bubble:hover:not(:disabled) {
  background: #f3f3f3;
}
</style>
