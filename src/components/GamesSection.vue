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
          <div 
            class="video-wrapper relative w-full h-48 overflow-hidden mb-2"
            @mouseenter="handleVideoEnter(getGameKey(game))"
            @mouseleave="handleVideoLeave(getGameKey(game))">
            <template v-if="game.video_url">
              <video
                     class="game-video w-full h-full object-cover"
                     :src="getVideoUrl(game.video_url)"
                     preload="metadata"
                     muted
                     loop
                     autoplay
                     playsinline
                     poster="/GameImg.jpg"
                     :ref="el => setVideoRef(el, getGameKey(game))">
              </video>
              <div 
                class="video-control-panel absolute bottom-3 left-3 flex items-center gap-3 bg-black/55 backdrop-blur-sm text-white px-3 py-2 rounded-full transition-opacity duration-200 ease-out"
                :class="isVideoHovered(getGameKey(game)) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'">
                <button
                  class="control-btn"
                  type="button"
                  @click.stop="toggleVideoPlay(getGameKey(game))">
                  <i :class="isVideoPlaying(getGameKey(game)) ? 'fa fa-pause' : 'fa fa-play'"></i>
                </button>
                <button
                  class="control-btn"
                  type="button"
                  @click.stop="toggleVideoMute(getGameKey(game))">
                  <i :class="isVideoMuted(getGameKey(game)) ? 'fa fa-volume-mute' : 'fa fa-volume-up'"></i>
                </button>
                <button
                  class="control-btn"
                  type="button"
                  @click.stop="restartVideo(getGameKey(game))">
                  <i class="fa fa-undo"></i>
                </button>
              </div>
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
import { ref, reactive, onMounted } from 'vue'
import { useGameStore } from '../stores/game'
import { useModalStore } from '../stores/modal'
import { resolveMediaUrl } from '../utils/media'
import { gsap } from 'gsap'

const gameStore = useGameStore()
const modalStore = useModalStore()

const games = ref([])
const hoveredVideoId = ref(null)
const videoStates = reactive({})
const videoRefs = new Map()

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
      category: 'action',
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

// 处理视频URL，输出规范的可访问地址
const getVideoUrl = (videoUrl) => resolveMediaUrl(videoUrl)

const getGameKey = (game) => game.game_id || game.id

const ensureVideoState = (key) => {
  if (!videoStates[key]) {
    videoStates[key] = {
      muted: true,
      playing: true
    }
  }
  return videoStates[key]
}

const setupVideoElement = (video, state) => {
  video.muted = state.muted
  video.loop = true
  video.autoplay = true
  video.playsInline = true
  video.defaultMuted = true
  video.setAttribute('muted', '')
  video.setAttribute('loop', '')
  video.setAttribute('autoplay', '')
  video.setAttribute('playsinline', '')
  video.volume = state.muted ? 0 : 1
  const playPromise = video.play()
  if (playPromise?.then) {
    playPromise.then(() => {
      state.playing = true
    }).catch(() => {})
  }
}

const setVideoRef = (el, key) => {
  if (el) {
    videoRefs.set(key, el)
    const state = ensureVideoState(key)
    setupVideoElement(el, state)
  } else {
    videoRefs.delete(key)
  }
}

const handleVideoEnter = (key) => {
  const video = videoRefs.get(key)
  if (!video) return
  const state = ensureVideoState(key)
  hoveredVideoId.value = key
  if (video.paused && state.playing !== false) {
    video.play().then(() => {
      state.playing = true
    }).catch(() => {})
  }
  gsap.to(video, { scale: 1.08, duration: 0.35, ease: 'power3.out' })
}

const handleVideoLeave = (key) => {
  if (hoveredVideoId.value === key) {
    hoveredVideoId.value = null
  }
  const video = videoRefs.get(key)
  if (!video) return
  gsap.to(video, { scale: 1, duration: 0.35, ease: 'power3.out' })
}

const toggleVideoPlay = (key) => {
  const video = videoRefs.get(key)
  if (!video) return
  const state = ensureVideoState(key)
  if (video.paused) {
    video.play().then(() => {
      state.playing = true
    }).catch(() => {})
  } else {
    video.pause()
    state.playing = false
  }
}

const toggleVideoMute = (key) => {
  const video = videoRefs.get(key)
  if (!video) return
  const state = ensureVideoState(key)
  state.muted = !state.muted
  video.muted = state.muted
  video.volume = state.muted ? 0 : 1
  if (!state.muted && video.paused && state.playing !== false) {
    video.play().catch(() => {})
  }
}

const restartVideo = (key) => {
  const video = videoRefs.get(key)
  if (!video) return
  const state = ensureVideoState(key)
  video.currentTime = 0
  video.play().then(() => {
    state.playing = true
  }).catch(() => {})
}

const isVideoHovered = (key) => hoveredVideoId.value === key
const isVideoMuted = (key) => videoStates[key]?.muted ?? true
const isVideoPlaying = (key) => videoStates[key]?.playing !== false

onMounted(() => {
  loadGames()
})
</script>

<style scoped>
.video-wrapper .game-video {
  transform-origin: center;
  will-change: transform;
}

.video-control-panel .control-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.25);
  transition: background 0.2s ease, transform 0.2s ease;
}

.video-control-panel .control-btn:hover {
  background: rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}
</style>
