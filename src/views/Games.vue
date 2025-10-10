<template>
  <div class="games-page">
    <!-- 主要内容 -->
    <div class="content-wrapper">
      <div class="container mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold text-white">游戏库</h1>
          <button
            @click="openAddGameModal"
            class="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg transition-colors duration-300 flex items-center gap-2">
            <i class="fa fa-plus"></i>
            添加游戏
          </button>
        </div>

        <!-- 游戏网格 -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- 游戏卡片 -->
          <div 
            v-for="game in games" 
            :key="game.id"
            class="game-card glass-card overflow-hidden hover:shadow-xl transition-all duration-300">
            <div class="relative group">
              <!-- 视频预览 -->
              <div class="relative w-full h-48 overflow-hidden">
                <video 
                  ref="videoRef"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  muted 
                  loop 
                  preload="metadata"
                  poster="/GameImg.jpg"
                  @mouseenter="playVideo"
                  @mouseleave="pauseVideo">
                  <source src="/BGV.mp4" type="video/mp4">
                </video>
              </div>
              <div class="absolute top-4 right-4 bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">
                {{ game.category || '动作' }}
              </div>
            </div>
            <div class="p-6">
              <div class="flex justify-between items-start mb-3">
                <h3 class="text-xl font-bold text-white">{{ game.title }}</h3>
                <div class="flex items-center">
                  <i class="fa fa-star text-yellow-400"></i>
                  <span class="ml-1 text-white">{{ game.average_rating || '0.0' }}</span>
                </div>
              </div>
              <p class="text-white/80 text-sm mb-4">{{ game.description }}</p>
              <div class="flex items-center text-sm text-primary mb-4">
                <i class="fa fa-tag mr-2"></i>
                <span>游戏类别: {{ game.category || '闯关 像素' }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-white/80">
                  <i class="fa fa-play mr-1"></i> 
                  {{ game.play_count || 0 }} 玩过
                </span>
                <div class="flex gap-2">
                  <button
                    @click="playGame(game)"
                    class="play-game-btn bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-full text-sm transition-all duration-300">
                    立即开始
                  </button>
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
import { ref, onMounted } from 'vue'
import { useGameStore } from '../stores/game'
import { useModalStore } from '../stores/modal'

const gameStore = useGameStore()
const modalStore = useModalStore()

const games = ref([])

const loadGames = async () => {
  try {
    await gameStore.loadGames()
    games.value = gameStore.games
  } catch (error) {
    console.error('加载游戏失败:', error)
    // 使用默认游戏数据
    games.value = [{
      id: 'web-mobile-001',
      title: '像素逃生',
      description: '骑士挥舞刺刀击败骷髅.',
      average_rating: '0.0',
      play_count: 0,
      category: '动作'
    }]
  }
}

const playGame = (game) => {
  gameStore.recordGamePlay(game.game_id || game.id)
  modalStore.openGameModal(game)
}

const openAddGameModal = () => {
  modalStore.openModal('addGame')
}

// 视频播放控制
const playVideo = (event) => {
  const video = event.target
  if (video && video.paused) {
    video.play().catch(error => {
      console.log('视频播放失败:', error)
    })
  }
}

const pauseVideo = (event) => {
  const video = event.target
  if (video && !video.paused) {
    video.pause()
  }
}

onMounted(() => {
  loadGames()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Quicksand&display=swap');

.games-page {
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

.games-page::after {
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
  transform: translateY(-4px);
}

.game-card {
  transition: transform 0.3s ease;
}

.game-card:hover {
  transform: translateY(-4px);
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
