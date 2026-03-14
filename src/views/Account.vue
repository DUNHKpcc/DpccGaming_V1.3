<template>
  <div class="account-page">
    <div class="content-wrapper">
      <div class="container mx-auto px-4 pt-5 pb-3 account-container">
        <div class="max-w-6xl mx-auto h-full">
          <div v-if="!isLoggedIn" class="glass-card text-center py-12 account-login-state">
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

          <div v-else class="account-dashboard">
            <section class="glass-card widget widget-profile p-6">
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
            </section>

            <section class="glass-card widget widget-notifications p-0">
              <NotificationsSection compact />
            </section>

            <section class="glass-card widget widget-stats p-6">
              <div class="widget-title-row">
                <h3 class="text-xl font-bold text-white">游戏统计</h3>
              </div>

              <div class="stats-scroll">
                <div class="stats-tiles">
                  <div class="stats-tile">
                    <div class="w-12 h-12 account-icon-circle rounded-full flex items-center justify-center mx-auto mb-2">
                      <i class="fa fa-laptop text-lg account-icon-glyph"></i>
                    </div>
                    <div class="text-xl font-bold text-white">{{ totalGamesPlayed }}</div>
                    <div class="text-xs text-white/80">总游戏次数</div>
                  </div>

                  <div class="stats-tile">
                    <div class="w-12 h-12 account-icon-circle rounded-full flex items-center justify-center mx-auto mb-2">
                      <i class="fa fa-star text-lg account-icon-glyph"></i>
                    </div>
                    <div class="text-xl font-bold text-white">{{ averageRating }}</div>
                    <div class="text-xs text-white/80">平均评分</div>
                  </div>

                  <div class="stats-tile">
                    <div class="w-12 h-12 account-icon-circle rounded-full flex items-center justify-center mx-auto mb-2">
                      <i class="fa fa-comment text-lg account-icon-glyph"></i>
                    </div>
                    <div class="text-xl font-bold text-white">{{ totalComments }}</div>
                    <div class="text-xs text-white/80">总评论数</div>
                  </div>
                </div>

                <div class="recent-games-block mt-5">
                  <h4 class="text-sm font-bold text-white mb-3">最近游戏记录</h4>
                  <div v-if="recentGames.length === 0" class="text-center py-6 text-white/80">
                    <i class="fa fa-laptop text-3xl mb-2"></i>
                    <p>还没有游戏记录</p>
                  </div>
                  <div v-else class="recent-games-scroll space-y-2">
                    <div
                      v-for="game in recentGames"
                      :key="game.id"
                      class="account-recent-row flex items-center justify-between p-3 rounded-lg"
                    >
                      <div class="flex items-center">
                        <div class="recent-game-media mr-3">
                          <video
                            v-if="hasPlayableVideo(game)"
                            :src="getGameVideoUrl(game)"
                            :poster="getGameCoverUrl(game) || '/GameImg.jpg'"
                            class="recent-game-media-el"
                            autoplay
                            muted
                            loop
                            playsinline
                            preload="metadata"
                          ></video>
                          <img
                            v-else-if="getGameCoverUrl(game)"
                            :src="getGameCoverUrl(game)"
                            :alt="game.title"
                            class="recent-game-media-el"
                          />
                          <div v-else class="recent-game-media-fallback">
                            <i class="fa fa-laptop account-icon-glyph"></i>
                          </div>
                        </div>
                        <div>
                          <div class="font-medium text-white">{{ game.title }}</div>
                          <div class="text-xs text-white/80">{{ categoryToZh(game.category) }}</div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-xs text-white/80">{{ game.play_count }} 次</div>
                        <div class="flex items-center account-rating justify-end">
                          <i class="fa fa-star text-[10px]"></i>
                          <span class="ml-1 text-xs">{{ game.average_rating }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="glass-card widget widget-friends p-6">
              <div class="widget-title-row">
                <h3 class="text-xl font-bold text-white">好友</h3>
                <span class="text-xs text-white/80">{{ friends.length }} 人</span>
              </div>

              <div class="friends-scroll">
                <div v-if="friendsLoading" class="text-sm text-white/80 py-3">加载中...</div>
                <div v-else-if="!friends.length" class="text-sm text-white/80 py-3">暂无好友</div>
                <div v-else class="space-y-2">
                  <div
                    v-for="friend in friends"
                    :key="friend.id"
                    class="friend-row"
                  >
                    <div class="friend-avatar">
                      {{ (friend.username || '?').charAt(0).toUpperCase() }}
                    </div>
                    <div class="friend-meta">
                      <strong>{{ friend.username }}</strong>
                      <small>{{ friend.email || '未设置邮箱' }}</small>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import { useModalStore } from '../stores/modal'
import { useNotificationStore } from '../stores/notification'
import NotificationsSection from '../components/NotificationsSection.vue'
import { categoryToZh } from '../utils/category'
import { getAvatarUrl, handleAvatarError } from '../utils/avatar'
import { apiCall } from '../utils/api'
import { resolveMediaUrl } from '../utils/media'

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
const friends = ref([])
const friendsLoading = ref(false)
const avatarInputRef = ref(null)
const avatarUploading = ref(false)

const resetStats = () => {
  recentGames.value = []
  totalGamesPlayed.value = 0
  averageRating.value = '0.0'
  totalComments.value = 0
}

const loadUserStats = async () => {
  if (!isLoggedIn.value) {
    resetStats()
    return
  }

  try {
    await gameStore.loadGames()
    recentGames.value = gameStore.games.slice(0, 8)

    totalGamesPlayed.value = gameStore.games.reduce((sum, game) => sum + (game.play_count || 0), 0)
    const ratings = gameStore.games.filter(game => game.average_rating && game.average_rating > 0)

    averageRating.value = ratings.length
      ? (ratings.reduce((sum, game) => sum + parseFloat(game.average_rating), 0) / ratings.length).toFixed(1)
      : '0.0'

    totalComments.value = gameStore.games.reduce((sum, game) => sum + (game.comment_count || 0), 0)
  } catch (error) {
    console.error('加载用户统计失败:', error)
    resetStats()
  }
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

const VIDEO_EXT_PATTERN = /\.(mp4|webm|ogg|m4v|mov)(\?.*)?$/i

const getGameCoverUrl = (game = {}) => {
  return resolveMediaUrl(game.thumbnail_url || game.thumbnail || '')
}

const getGameVideoUrl = (game = {}) => {
  return resolveMediaUrl(game.video_url || '')
}

const hasPlayableVideo = (game = {}) => {
  const rawUrl = String(game.video_url || '').trim()
  return VIDEO_EXT_PATTERN.test(rawUrl)
}

onMounted(() => {
  if (isLoggedIn.value) {
    loadUserStats()
    loadFriends()
  }
})

watch(isLoggedIn, (loggedIn) => {
  if (!loggedIn) {
    resetStats()
    friends.value = []
    friendsLoading.value = false
    return
  }

  loadUserStats()
  loadFriends()
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
  position: relative;
  height: calc(100vh - 4rem);
  min-height: calc(100vh - 4rem);
  overflow: hidden;
  font-family: 'Quicksand', sans-serif;
  background: var(--account-bg) !important;
  color: var(--account-text);
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

.content-wrapper,
.account-container {
  height: 100%;
}

.account-container > .max-w-6xl {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.account-page :where(.text-white) {
  color: var(--account-text) !important;
}

.account-page :where(.text-white\/80) {
  color: var(--account-text-soft) !important;
}

.glass-card {
  background: var(--account-card-bg);
  border: 1px solid var(--account-card-border);
  border-radius: 20px;
  box-shadow: var(--account-card-shadow);
  transition: background 0.2s ease, transform 0.2s ease;
}

.glass-card:hover {
  background: var(--account-card-bg-hover);
  transform: translateY(-1px);
}

.account-login-state {
  max-width: 34rem;
  margin: auto;
}

.account-dashboard {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 0.9rem;
  grid-template-columns: 1.05fr 1.45fr 1.1fr;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
}

.widget {
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.widget-profile {
  grid-column: 1 / 2;
  grid-row: 1 / 2;
  aspect-ratio: 1 / 1;
  height: auto;
  align-self: start;
  justify-content: center;
}

.widget-notifications {
  grid-column: 2 / 4;
  grid-row: 1 / 2;
  padding: 0;
}

.widget-stats {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
}

.widget-friends {
  grid-column: 3 / 4;
  grid-row: 2 / 3;
}

.widget-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
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

.stats-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.recent-games-block {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.recent-games-scroll,
.friends-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.stats-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.stats-tile {
  text-align: center;
  background: var(--account-recent-bg);
  border: 1px solid var(--account-recent-border);
  border-radius: 12px;
  padding: 0.7rem 0.5rem;
}

.account-recent-row {
  background: var(--account-recent-bg);
  border: 1px solid var(--account-recent-border);
}

.recent-game-media {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--account-recent-border);
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.2);
}

.recent-game-media-el {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.recent-game-media-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--account-icon-bg);
}

.account-rating {
  color: var(--account-rating);
}

.friend-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  background: var(--account-recent-bg);
  border: 1px solid var(--account-recent-border);
  border-radius: 12px;
  padding: 0.55rem 0.65rem;
}

.friend-avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--account-icon-bg);
  color: var(--account-icon-text);
  border: 1px solid var(--account-upload-border);
  font-weight: 700;
  font-size: 0.85rem;
}

.friend-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.friend-meta strong,
.friend-meta small {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-meta strong {
  font-size: 0.9rem;
}

.friend-meta small {
  color: var(--account-text-soft);
  font-size: 0.75rem;
}

.widget-notifications :deep(.notifications-section) {
  height: 100%;
  border-radius: 20px;
}

@media (max-width: 1280px) {
  .account-dashboard {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: minmax(0, 0.95fr) minmax(0, 1fr) minmax(0, 1fr);
  }

  .widget-profile {
    grid-column: 1 / 2;
    grid-row: 1 / 2;
  }

  .widget-notifications {
    grid-column: 2 / 3;
    grid-row: 1 / 2;
  }

  .widget-stats {
    grid-column: 1 / 3;
    grid-row: 2 / 3;
  }

  .widget-friends {
    grid-column: 1 / 3;
    grid-row: 3 / 4;
  }
}

@media (max-width: 768px) {
  .account-page {
    height: calc(100vh - 3.5rem);
    min-height: calc(100vh - 3.5rem);
    overflow: auto;
  }

  .account-container {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .account-dashboard {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, minmax(240px, 1fr));
    min-height: auto;
  }

  .widget-profile,
  .widget-notifications,
  .widget-stats,
  .widget-friends {
    grid-column: 1 / 2;
    grid-row: auto;
  }
}
</style>
