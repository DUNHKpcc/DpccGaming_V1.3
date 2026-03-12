<template>
  <div class="account-page">
    <!-- 主要内容 -->
    <div class="content-wrapper">
      <div class="container mx-auto px-4 py-8">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-3xl font-bold text-white mb-8">账户详情</h1>
        
          <div v-if="!isLoggedIn" class="glass-card text-center py-12">
            <div class="w-24 h-24 account-icon-circle rounded-full flex items-center justify-center mx-auto mb-6">
              <i class="fa fa-user text-4xl account-icon-glyph"></i>
            </div>
            <h2 class="text-2xl font-bold text-white mb-4">请先登录</h2>
            <p class="text-white/80 mb-6">登录后可以查看您的账户信息和游戏记录</p>
            <button
              @click="openLoginModal"
              class="account-primary-btn px-6 py-3 rounded-lg transition-colors duration-300">
              立即登录
            </button>
          </div>

          <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- 用户信息卡片 -->
            <div class="lg:col-span-1">
              <div class="glass-card p-6">
                <div class="text-center">
                  <div class="avatar-wrap mx-auto mb-4">
                    <img
                      :src="getAvatarUrl(currentUser?.avatar_url)"
                      alt="用户头像"
                      class="user-avatar-image"
                      @error="handleAvatarError"
                    />
                  </div>
                  <h3 class="text-xl font-bold text-white mb-2">{{ currentUser.username }}</h3>
                  <p class="text-white/80 text-sm mb-4">{{ currentUser.email || '未设置邮箱' }}</p>
                  <input
                    ref="avatarInputRef"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onAvatarFileChange"
                  />
                  <button
                    type="button"
                    @click="openAvatarPicker"
                    :disabled="avatarUploading"
                    class="upload-avatar-btn mb-3"
                  >
                    {{ avatarUploading ? '上传中...' : '上传头像' }}
                  </button>
                  <button
                    @click="logout"
                    class="account-logout-btn text-sm font-medium">
                    退出登录
                  </button>
                </div>
              </div>
            </div>

            <!-- 主要内容区域 -->
            <div class="lg:col-span-2 space-y-8">
              <!-- 通知中心 -->
              <NotificationsSection />

              <!-- 游戏统计 -->
              <div class="glass-card p-6">
                <h3 class="text-xl font-bold text-white mb-6">游戏统计</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div class="text-center">
                    <div class="w-16 h-16 account-icon-circle rounded-full flex items-center justify-center mx-auto mb-3">
                      <i class="fa fa-laptop text-2xl account-icon-glyph"></i>
                    </div>
                    <div class="text-2xl font-bold text-white">{{ totalGamesPlayed }}</div>
                    <div class="text-sm text-white/80">总游戏次数</div>
                  </div>
                  
                  <div class="text-center">
                    <div class="w-16 h-16 account-icon-circle rounded-full flex items-center justify-center mx-auto mb-3">
                      <i class="fa fa-star text-2xl account-icon-glyph"></i>
                    </div>
                    <div class="text-2xl font-bold text-white">{{ averageRating }}</div>
                    <div class="text-sm text-white/80">平均评分</div>
                  </div>
                  
                  <div class="text-center">
                    <div class="w-16 h-16 account-icon-circle rounded-full flex items-center justify-center mx-auto mb-3">
                      <i class="fa fa-comment text-2xl account-icon-glyph"></i>
                    </div>
                    <div class="text-2xl font-bold text-white">{{ totalComments }}</div>
                    <div class="text-sm text-white/80">总评论数</div>
                  </div>
                </div>

                <!-- 最近游戏记录 -->
                <div>
                  <h4 class="text-lg font-bold text-white mb-4">最近游戏记录</h4>
                  <div v-if="recentGames.length === 0" class="text-center py-8 text-white/80">
                    <i class="fa fa-laptop text-4xl mb-4"></i>
                    <p>还没有游戏记录</p>
                  </div>
                  <div v-else class="space-y-3">
                    <div 
                      v-for="game in recentGames" 
                      :key="game.id"
                      class="account-recent-row flex items-center justify-between p-3 rounded-lg">
                      <div class="flex items-center">
                        <div class="w-12 h-12 account-icon-square rounded-lg flex items-center justify-center mr-3">
                          <i class="fa fa-laptop account-icon-glyph"></i>
                        </div>
                        <div>
                          <div class="font-medium text-white">{{ game.title }}</div>
                          <div class="text-sm text-white/80">{{ categoryToZh(game.category) }}</div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-sm text-white/80">{{ game.play_count }} 次</div>
                        <div class="flex items-center account-rating">
                          <i class="fa fa-star text-xs"></i>
                          <span class="ml-1 text-sm">{{ game.average_rating }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import { useModalStore } from '../stores/modal'
import { useNotificationStore } from '../stores/notification'
import NotificationsSection from '../components/NotificationsSection.vue'
import { categoryToZh } from '../utils/category'
import { getAvatarUrl, handleAvatarError } from '../utils/avatar'

const authStore = useAuthStore()
const gameStore = useGameStore()
const modalStore = useModalStore()
const notificationStore = useNotificationStore()

const currentUser = computed(() => authStore.currentUser)
const isLoggedIn = computed(() => authStore.isLoggedIn)

const recentGames = ref([])
const totalGamesPlayed = ref(0)
const averageRating = ref(0)
const totalComments = ref(0)
const avatarInputRef = ref(null)
const avatarUploading = ref(false)

const loadUserStats = async () => {
  if (!isLoggedIn.value) return
  
  try {
    // 加载游戏数据
    await gameStore.loadGames()
    recentGames.value = gameStore.games.slice(0, 5) 
    
    // 计算统计数据
    totalGamesPlayed.value = gameStore.games.reduce((sum, game) => sum + (game.play_count || 0), 0)
    
    const ratings = gameStore.games.filter(game => game.average_rating && game.average_rating > 0)
    if (ratings.length > 0) {
      averageRating.value = (ratings.reduce((sum, game) => sum + parseFloat(game.average_rating), 0) / ratings.length).toFixed(1)
    }
    
    
    totalComments.value = 0 
  } catch (error) {
    console.error('加载用户统计失败:', error)
  }
}

const openLoginModal = () => {
  modalStore.openModal('login')
}

const logout = () => {
  authStore.logout()
}

const openAvatarPicker = () => {
  if (avatarUploading.value) return
  avatarInputRef.value?.click()
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

onMounted(() => {
  loadUserStats()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Quicksand&display=swap');

.account-page {
  --account-bg: #000000;
  --account-text: #ffffff;
  --account-text-soft: rgba(255, 255, 255, 0.82);
  --account-card-bg: #111113;
  --account-card-bg-hover: #17171a;
  --account-card-border: rgba(255, 255, 255, 0.2);
  --account-card-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
  --account-icon-bg: #ffffff;
  --account-icon-text: #1d1d1f;
  --account-primary-bg: #ffffff;
  --account-primary-bg-hover: #ececec;
  --account-primary-text: #111111;
  --account-upload-bg: #ffffff;
  --account-upload-bg-hover: #f3f4f6;
  --account-upload-text: #111111;
  --account-upload-border: rgba(255, 255, 255, 0.22);
  --account-recent-bg: rgba(255, 255, 255, 0.08);
  --account-recent-border: rgba(255, 255, 255, 0.14);
  --account-logout: #fca5a5;
  --account-logout-hover: #f87171;
  --account-rating: #facc15;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  font-family: 'Quicksand', sans-serif;
  background: var(--account-bg) !important;
  color: var(--account-text);
  background-image: none !important;
  background-repeat: no-repeat;
  animation: none !important;
}

[data-theme='light'] .account-page {
  --account-bg: #ffffff;
  --account-text: #111111;
  --account-text-soft: rgba(17, 17, 17, 0.78);
  --account-card-bg: #ffffff;
  --account-card-bg-hover: #f8f8f8;
  --account-card-border: rgba(17, 17, 17, 0.16);
  --account-card-shadow: 0 8px 24px rgba(17, 17, 17, 0.08);
  --account-icon-bg: #111111;
  --account-icon-text: #ffffff;
  --account-primary-bg: #111111;
  --account-primary-bg-hover: #2a2a2a;
  --account-primary-text: #ffffff;
  --account-upload-bg: #111111;
  --account-upload-bg-hover: #2a2a2a;
  --account-upload-text: #ffffff;
  --account-upload-border: rgba(17, 17, 17, 0.2);
  --account-recent-bg: #f5f5f5;
  --account-recent-border: rgba(17, 17, 17, 0.14);
  --account-logout: #dc2626;
  --account-logout-hover: #b91c1c;
  --account-rating: #b45309;
}

.account-page::after {
  display: none !important;
}

.content-wrapper {
  position: relative;
  z-index: 10;
}

.glass-card {
  background: var(--account-card-bg);
  border: 1px solid var(--account-card-border);
  border-radius: 20px;
  box-shadow: var(--account-card-shadow);
  transition: all 0.3s ease;
}

.glass-card:hover {
  background: var(--account-card-bg-hover);
  border: 1px solid var(--account-card-border);
}

.avatar-wrap {
  width: 96px;
  height: 96px;
  border-radius: 9999px;
  padding: 2px;
  background: var(--account-card-border);
}

.user-avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  object-fit: cover;
  display: block;
}

.upload-avatar-btn {
  width: 100%;
  background: var(--account-upload-bg);
  border: 1px solid var(--account-upload-border);
  color: var(--account-upload-text);
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  transition: background 0.2s ease;
}

.upload-avatar-btn:hover {
  background: var(--account-upload-bg-hover);
}

.upload-avatar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.account-page .text-white {
  color: var(--account-text) !important;
}

.account-page .text-white\/80 {
  color: var(--account-text-soft) !important;
}

.account-icon-circle,
.account-icon-square {
  background: var(--account-icon-bg);
  border: 1px solid var(--account-upload-border);
}

.account-icon-glyph {
  color: var(--account-icon-text);
}

.account-primary-btn {
  background: var(--account-primary-bg);
  color: var(--account-primary-text);
  border: 1px solid var(--account-upload-border);
}

.account-primary-btn:hover {
  background: var(--account-primary-bg-hover);
}

.account-logout-btn {
  color: var(--account-logout);
}

.account-logout-btn:hover {
  color: var(--account-logout-hover);
}

.account-recent-row {
  background: var(--account-recent-bg);
  border: 1px solid var(--account-recent-border);
}

.account-rating {
  color: var(--account-rating);
}

@keyframes movement {
  0%, 100% {
    background-size: 
      130vmax 130vmax,
      80vmax 80vmax,
      90vmax 90vmax,
      110vmax 110vmax,
      90vmax 90vmax;
    background-position:
      -80vmax -80vmax,
      60vmax -30vmax,
      10vmax 10vmax,
      -30vmax -10vmax,
      50vmax 50vmax;
  }
  25% {
    background-size: 
      100vmax 100vmax,
      90vmax 90vmax,
      100vmax 100vmax,
      90vmax 90vmax,
      60vmax 60vmax;
    background-position:
      -60vmax -90vmax,
      50vmax -40vmax,
      0vmax -20vmax,
      -40vmax -20vmax,
      40vmax 60vmax;
  }
  50% {
    background-size: 
      80vmax 80vmax,
      110vmax 110vmax,
      80vmax 80vmax,
      60vmax 60vmax,
      80vmax 80vmax;
    background-position:
      -50vmax -70vmax,
      40vmax -30vmax,
      10vmax 0vmax,
      20vmax 10vmax,
      30vmax 70vmax;
  }
  75% {
    background-size: 
      90vmax 90vmax,
      90vmax 90vmax,
      100vmax 100vmax,
      90vmax 90vmax,
      70vmax 70vmax;
    background-position:
      -50vmax -40vmax,
      50vmax -30vmax,
      20vmax 0vmax,
      -10vmax 10vmax,
      40vmax 60vmax;
  }
}
</style>
