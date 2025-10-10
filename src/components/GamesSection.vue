<template>
  <section id="games" class="py-20 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="fade-in-up text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-center mb-12">
        游戏库
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <!-- 游戏卡片 -->
        <div 
          v-for="game in games" 
          :key="game.id"
          class="fade-in-up game-card bg-white rounded-xl overflow-hidden game-card-hover">
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
              <h3 class="text-xl font-bold">{{ game.title }}</h3>
              <div class="flex items-center">
                <i class="fa fa-star text-yellow-400"></i>
                <span class="ml-1">{{ game.average_rating || '0.0' }}</span>
              </div>
            </div>
            <p class="text-neutral text-sm mb-4">{{ game.description }}</p>
            <div class="flex items-center text-sm text-primary mb-4">
              <i class="fa fa-tag mr-2"></i>
              <span>游戏类别: {{ game.category || '闯关 像素' }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-neutral">
                <i class="fa fa-play mr-1"></i> 
                {{ game.play_count || 0 }} 玩过
              </span>
              <div class="flex gap-2">
                <button
                  @click.stop="playGame(game)"
                  class="play-game-btn bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-full text-sm transition-all duration-300">
                  立即开始
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 添加游戏卡片 -->
        <div 
          class="fade-in-up add-game-card bg-white rounded-xl overflow-hidden h-full flex flex-col items-center justify-center p-6 cursor-pointer"
          @click="openAddGameModal">
          <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <i class="fa fa-plus text-primary text-3xl"></i>
          </div>
          <h3 class="text-xl font-bold text-primary mb-2">添加游戏</h3>
          <p class="text-neutral text-center text-sm">上传您自己的 HTML5 游戏到游戏库</p>
        </div>
      </div>
    </div>
  </section>
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

const openGame = (game) => {
  modalStore.openGameModal(game)
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
