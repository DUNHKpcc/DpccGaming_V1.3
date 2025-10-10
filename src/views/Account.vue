<template>
  <div class="account-page">
    <!-- 主要内容 -->
    <div class="content-wrapper">
      <div class="container mx-auto px-4 py-8">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-3xl font-bold text-white mb-8">账户详情</h1>
        
          <div v-if="!isLoggedIn" class="glass-card text-center py-12">
            <div class="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6">
              <i class="fa fa-user text-4xl text-white"></i>
            </div>
            <h2 class="text-2xl font-bold text-white mb-4">请先登录</h2>
            <p class="text-white/80 mb-6">登录后可以查看您的账户信息和游戏记录</p>
            <button
              @click="openLoginModal"
              class="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg transition-colors duration-300">
              立即登录
            </button>
          </div>

          <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- 用户信息卡片 -->
            <div class="lg:col-span-1">
              <div class="glass-card p-6">
                <div class="text-center">
                  <div class="w-24 h-24 bg-primary/30 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fa fa-user text-3xl text-white"></i>
                  </div>
                  <h3 class="text-xl font-bold text-white mb-2">{{ currentUser.username }}</h3>
                  <p class="text-white/80 text-sm mb-4">{{ currentUser.email || '未设置邮箱' }}</p>
                  <button
                    @click="logout"
                    class="text-red-300 hover:text-red-200 text-sm font-medium">
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
                    <div class="w-16 h-16 bg-blue-500/30 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                      <i class="fa fa-gamepad text-2xl text-white"></i>
                    </div>
                    <div class="text-2xl font-bold text-white">{{ totalGamesPlayed }}</div>
                    <div class="text-sm text-white/80">总游戏次数</div>
                  </div>
                  
                  <div class="text-center">
                    <div class="w-16 h-16 bg-green-500/30 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                      <i class="fa fa-star text-2xl text-white"></i>
                    </div>
                    <div class="text-2xl font-bold text-white">{{ averageRating }}</div>
                    <div class="text-sm text-white/80">平均评分</div>
                  </div>
                  
                  <div class="text-center">
                    <div class="w-16 h-16 bg-purple-500/30 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                      <i class="fa fa-comment text-2xl text-white"></i>
                    </div>
                    <div class="text-2xl font-bold text-white">{{ totalComments }}</div>
                    <div class="text-sm text-white/80">总评论数</div>
                  </div>
                </div>

                <!-- 最近游戏记录 -->
                <div>
                  <h4 class="text-lg font-bold text-white mb-4">最近游戏记录</h4>
                  <div v-if="recentGames.length === 0" class="text-center py-8 text-white/80">
                    <i class="fa fa-gamepad text-4xl mb-4"></i>
                    <p>还没有游戏记录</p>
                  </div>
                  <div v-else class="space-y-3">
                    <div 
                      v-for="game in recentGames" 
                      :key="game.id"
                      class="flex items-center justify-between p-3 bg-white/10 backdrop-blur-sm rounded-lg">
                      <div class="flex items-center">
                        <div class="w-12 h-12 bg-primary/30 backdrop-blur-sm rounded-lg flex items-center justify-center mr-3">
                          <i class="fa fa-gamepad text-white"></i>
                        </div>
                        <div>
                          <div class="font-medium text-white">{{ game.title }}</div>
                          <div class="text-sm text-white/80">{{ game.category }}</div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-sm text-white/80">{{ game.play_count }} 次</div>
                        <div class="flex items-center text-yellow-300">
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
import NotificationsSection from '../components/NotificationsSection.vue'

const authStore = useAuthStore()
const gameStore = useGameStore()
const modalStore = useModalStore()

const currentUser = computed(() => authStore.currentUser)
const isLoggedIn = computed(() => authStore.isLoggedIn)

const recentGames = ref([])
const totalGamesPlayed = ref(0)
const averageRating = ref(0)
const totalComments = ref(0)

const loadUserStats = async () => {
  if (!isLoggedIn.value) return
  
  try {
    // 加载游戏数据
    await gameStore.loadGames()
    recentGames.value = gameStore.games.slice(0, 5) // 显示最近5个游戏
    
    // 计算统计数据
    totalGamesPlayed.value = gameStore.games.reduce((sum, game) => sum + (game.play_count || 0), 0)
    
    const ratings = gameStore.games.filter(game => game.average_rating && game.average_rating > 0)
    if (ratings.length > 0) {
      averageRating.value = (ratings.reduce((sum, game) => sum + parseFloat(game.average_rating), 0) / ratings.length).toFixed(1)
    }
    
    // 这里可以添加更多统计数据的计算
    totalComments.value = 0 // 暂时设为0，后续可以从API获取
  } catch (error) {
    console.error('加载用户统计失败:', error)
  }
}

const openLoginModal = () => {
  modalStore.openModal('login')
}

const logout = () => {
  authStore.logout()
  // 可以添加登出后的通知
}

onMounted(() => {
  loadUserStats()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Quicksand&display=swap');

.account-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  font-family: 'Quicksand', sans-serif;
  background-color: #e493d0;
  background-image: 
    radial-gradient(closest-side, rgb(42, 8, 233), rgba(235, 105, 78, 0)),
    radial-gradient(closest-side, rgb(189, 6, 239), rgba(243, 11, 164, 0)),
    radial-gradient(closest-side, rgb(183, 0, 255), rgba(254, 234, 131, 0)),
    radial-gradient(closest-side, rgba(170, 142, 245, 1), rgba(170, 142, 245, 0)),
    radial-gradient(closest-side, rgb(237, 164, 255), rgba(55, 0, 119, 0));
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
  background-repeat: no-repeat;
  animation: 10s movement linear infinite;
}

.account-page::after {
  content: '';
  display: block;
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 0;
}

.content-wrapper {
  position: relative;
  z-index: 10;
}

.glass-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
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
