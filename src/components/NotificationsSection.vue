<template>
  <div class="notifications-section">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold text-white">通知中心</h3>
      <div class="flex items-center gap-2">
        <span class="text-sm text-white/80">{{ unreadCount }} 条未读</span>
        <button 
          @click="markAllAsRead"
          v-if="unreadCount > 0"
          class="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors">
          全部已读
        </button>
      </div>
    </div>

    <!-- 通知列表 -->
    <div v-if="notifications.length === 0" class="text-center py-8 text-white/80">
      <i class="fa fa-bell text-4xl mb-4"></i>
      <p>暂无通知</p>
    </div>

    <div v-else class="space-y-3">
      <div 
        v-for="notification in displayedNotifications" 
        :key="notification.id"
        :class="[
          'notification-item',
          notification.is_read ? 'read' : 'unread'
        ]"
        @click="markAsRead(notification)">
        
        <!-- 通知图标 -->
        <div class="notification-icon">
          <i :class="getNotificationIcon(notification.type)"></i>
        </div>

        <!-- 通知内容 -->
        <div class="notification-content">
          <div class="notification-header">
            <h4 class="notification-title">{{ notification.title }}</h4>
            <span class="notification-time">{{ formatTime(notification.created_at) }}</span>
          </div>
          <p class="notification-text">{{ notification.content }}</p>
          
          <!-- 相关游戏链接 -->
          <div v-if="notification.related_game_id" class="notification-actions">
            <button 
              @click="handleNotificationClick(notification)"
              class="bg-white text-[#1d1d1f] hover:bg-white/90 px-3 py-1 rounded-md text-sm font-medium transition-colors">
              <i :class="getActionIcon(notification.type)" class="mr-1"></i>
              {{ getActionText(notification.type) }}
            </button>
          </div>
        </div>

        <!-- 未读标识 -->
        <div v-if="!notification.is_read" class="unread-indicator"></div>
      </div>
    </div>

    <!-- 展开/收起 -->
    <div v-if="shouldShowToggle" class="text-center mt-4">
      <button
        @click="toggleNotificationVisibility"
        class="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors">
        {{ showAllNotifications ? '收起通知' : '展开通知' }}
      </button>
    </div>

    <!-- 加载更多 -->
    <div v-if="hasMore" class="text-center mt-6">
      <button 
        @click="loadMore"
        :disabled="loading"
        class="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
        <i v-if="loading" class="fa fa-spinner fa-spin mr-2"></i>
        {{ loading ? '加载中...' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import { useModalStore } from '../stores/modal'

const authStore = useAuthStore()
const gameStore = useGameStore()
const modalStore = useModalStore()

const notifications = ref([])
const loading = ref(false)
const hasMore = ref(true)
const currentPage = ref(1)
const pageSize = ref(10)
const DEFAULT_VISIBLE_NOTIFICATION_COUNT = 3
const showAllNotifications = ref(false)

const displayedNotifications = computed(() => {
  return showAllNotifications.value
    ? notifications.value
    : notifications.value.slice(0, DEFAULT_VISIBLE_NOTIFICATION_COUNT)
})

const shouldShowToggle = computed(() => {
  return notifications.value.length > DEFAULT_VISIBLE_NOTIFICATION_COUNT
})

const toggleNotificationVisibility = () => {
  showAllNotifications.value = !showAllNotifications.value
}

// 计算未读通知数量
const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.is_read).length
})

// 获取通知列表
const fetchNotifications = async (page = 1, reset = false) => {
  if (!authStore.isLoggedIn) return
  
  try {
    loading.value = true
    const token = localStorage.getItem('token')
    
    const response = await fetch(`/api/notifications?page=${page}&limit=${pageSize.value}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      
      if (reset) {
        notifications.value = data.notifications
      } else {
        notifications.value.push(...data.notifications)
      }
      
      hasMore.value = data.hasMore
      currentPage.value = page
    } else {
      console.error('获取通知失败')
    }
  } catch (error) {
    console.error('获取通知错误:', error)
  } finally {
    loading.value = false
  }
}

// 标记通知为已读
const markAsRead = async (notification) => {
  if (notification.is_read) return
  
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/notifications/${notification.id}/read`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      notification.is_read = true
    }
  } catch (error) {
    console.error('标记已读失败:', error)
  }
}

// 全部标记为已读
const markAllAsRead = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      notifications.value.forEach(n => n.is_read = true)
    }
  } catch (error) {
    console.error('全部标记已读失败:', error)
  }
}

// 加载更多
const loadMore = () => {
  if (!loading.value && hasMore.value) {
    fetchNotifications(currentPage.value + 1, false)
  }
}

// 获取通知图标（统一为无颜色类）
const getNotificationIcon = (type) => {
  const icons = {
    'game_approved': 'fa fa-check-circle',
    'game_rejected': 'fa fa-times-circle',
    'comment_reply': 'fa fa-reply'
  }
  return icons[type] || 'fa fa-bell'
}

// 处理通知点击
const handleNotificationClick = async (notification) => {
  // 先标记为已读
  await markAsRead(notification)
  
  if (notification.type === 'comment_reply') {
    // 评论回复类型，跳转到游戏模态框并定位到评论
    const gameId = notification.related_game_id
    const commentId = notification.related_comment_id
    
    // 获取游戏信息并打开模态框
    await openGameModalWithComment(gameId, commentId)
  } else {
    // 其他类型通知，跳转到游戏模态框
    const gameId = notification.related_game_id
    await openGameModal(gameId)
  }
}

// 打开游戏模态框
const openGameModal = async (gameId) => {
  try {
    // 从游戏列表中查找游戏
    const game = gameStore.games.find(g => g.game_id === gameId || g.id === gameId)
    
    if (game) {
      modalStore.openGameModal(game)
    } else {
      // 如果游戏不在当前列表中，尝试加载游戏
      await gameStore.loadGames()
      const foundGame = gameStore.games.find(g => g.game_id === gameId || g.id === gameId)
      
      if (foundGame) {
        modalStore.openGameModal(foundGame)
      } else {
        console.error('找不到游戏:', gameId)
      }
    }
  } catch (error) {
    console.error('打开游戏模态框失败:', error)
  }
}

// 打开游戏模态框并定位到评论
const openGameModalWithComment = async (gameId, commentId) => {
  try {
    // 先打开游戏模态框
    await openGameModal(gameId)
    
    // 延迟设置目标评论ID，确保模态框已经打开
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('scroll-to-comment', {
        detail: { commentId }
      }))
    }, 500)
  } catch (error) {
    console.error('打开游戏模态框并定位评论失败:', error)
  }
}

// 获取操作图标
const getActionIcon = (type) => {
  const icons = {
    'game_approved': 'fa fa-external-link',
    'game_rejected': 'fa fa-external-link', 
    'comment_reply': 'fa fa-comment'
  }
  return icons[type] || 'fa fa-external-link'
}

// 获取操作文本
const getActionText = (type) => {
  const texts = {
    'game_approved': '查看游戏',
    'game_rejected': '查看游戏',
    'comment_reply': '查看评论'
  }
  return texts[type] || '查看游戏'
}

// 格式化时间
const formatTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  return date.toLocaleDateString('zh-CN')
}

onMounted(() => {
  fetchNotifications(1, true)
})
</script>

<style scoped>
.notifications-section {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.notification-item:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.notification-item.unread {
  border-left: 4px solid #6c5ce7;
  background: rgba(108, 92, 231, 0.1);
}

.notification-icon {
  width: 2.5rem;
  height: 2.5rem;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notification-icon i {
  font-size: 1.25rem;
  color: #1d1d1f;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.notification-title {
  font-weight: 600;
  color: white;
  margin: 0;
  font-size: 0.95rem;
}

.notification-time {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  white-space: nowrap;
  margin-left: 1rem;
}

.notification-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 0 0 0.5rem 0;
}

.notification-actions {
  margin-top: 0.5rem;
}

.unread-indicator {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 0.5rem;
  height: 0.5rem;
  background: #6c5ce7;
  border-radius: 50%;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .notification-item {
    padding: 0.75rem;
    gap: 0.75rem;
  }
  
  .notification-icon {
    width: 2rem;
    height: 2rem;
  }
  
  .notification-icon i {
    font-size: 1rem;
  }
  
  .notification-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .notification-time {
    margin-left: 0;
    margin-top: 0.25rem;
  }
}
</style>
