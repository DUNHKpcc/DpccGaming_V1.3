<template>
  <section id="games" class="py-20 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="fade-in-up text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-center mb-12">
        游戏库
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto pl-4 lg:pl-8">
        <div 
          v-for="game in games" 
          :key="game.id"
          class="fade-in-up game-card bg-white rounded-xl overflow-hidden game-card-hover">
          <div class="relative w-full h-48 overflow-hidden mb-2">
            <template v-if="game.video_url">
              <video controls
                     class="w-full h-full object-cover transition-transform duration-300"
                     :src="getVideoUrl(game.video_url)"
                     preload="metadata"
                     poster="/GameImg.jpg">
              </video>
            </template>
            <template v-else>
              <img :src="game.thumbnail_url || '/GameImg.jpg'"
                   class="w-full h-full object-cover" />
            </template>
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
          
            <!-- 添加游戏引擎信息 -->
            <div class="flex items-center text-sm text-secondary mb-2">
              <i class="fa fa-cogs mr-2"></i>
              <span>游戏引擎: {{ game.engine || '未知' }}</span>
            </div>
            <!-- 添加游戏代码信息 -->
            <div class="flex items-center text-sm text-tertiary mb-2">
              <i class="fa fa-code mr-2"></i>
              <span>游戏代码: {{ game.code_type || '未知' }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-neutral">
                <i class="fa fa-play mr-1"></i> 
                {{ game.play_count || 0 }} 玩过
              </span>
              <div class="flex gap-2">
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
    games.value = [{
      id: 'web-mobile-001',
      title: '像素逃生',
      description: '骑士挥舞刺刀击败骷髅.',
      average_rating: '0.0',
      play_count: 0,
      category: '动作',
      engine: 'Cocos',
      codeType: 'TypeScript'
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

// 处理视频URL，确保它是正确的路径格式
const getVideoUrl = (videoUrl) => {
  if (!videoUrl) return ''
  
  // 如果已经是完整的URL，则直接返回
  if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
    return videoUrl
  }
  
  // 确保URL以/开头，避免重复添加
  if (!videoUrl.startsWith('/')) {
    return '/' + videoUrl
  }
  
  // 修复可能存在的双斜杠问题
  return videoUrl.replace(/^\/\//, '/')
}

onMounted(() => {
  loadGames()
})
</script>