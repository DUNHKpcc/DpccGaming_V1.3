<template>
  <div class="games-page">
    <!-- 主要内容 -->
    <div class="content-wrapper">
      <div class="container mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold text-white">游戏库</h1>
          <button
            @click="openAddGameModal"
            class="bg-white hover:bg-white/90 text-[#1d1d1f] px-6 py-3 rounded-lg transition-colors duration-300 flex items-center gap-2">
            <i class="fa fa-plus"></i>
            添加游戏
          </button>
        </div>
        <!-- 筛选菜单部分：改为浮动滑块 -->
    <div 
      class="filter-menu flex gap-3 mb-4 bg-transparent rounded-xl p-3 inline-block"
    >
      <div class="filter-group">
        <button 
          class="filter-btn bg-white text-[#1d1d1f] border border-black/10 px-4 py-2 rounded-full transition-all duration-300 hover:bg-white/90"
          @click="openEngineSlider"
        >
          <i class="fa fa-cogs mr-2"></i>游戏引擎分类
        </button>
      </div>
      <div class="filter-group">
        <button 
          class="filter-btn bg-white text-[#1d1d1f] border border-black/10 px-4 py-2 rounded-full transition-all duration-300 hover:bg-white/90"
          @click="openCodeSlider"
        >
          <i class="fa fa-code mr-2"></i>代码分类
        </button>
      </div>
    </div>

    <!-- 固定选项条：不跟随鼠标，毛玻璃罩层跟随并覆盖当前选项 -->
    <div v-show="sliderVisible" class="options-bar-wrapper">
      <div 
        class="options-bar"
        :class="{ 'is-engine': currentSliderType === 'engine', 'is-code': currentSliderType === 'code' }"
        @mousemove="onOptionsMouseMove"
        @mouseleave="onOptionsBarLeave"
      >
        <div 
          v-show="overlay.visible"
          class="glass-overlay"
          :style="{
            transform: `translate3d(${overlay.x}px, ${overlay.y}px, 0)`,
            width: overlay.w + 'px',
            height: overlay.h + 'px'
          }"
        ></div>
        <button
          v-for="opt in currentOptions"
          :key="opt"
          class="option-chip"
          :data-opt="opt"
          :class="['option-chip', {
            magnifier: overlay.hoverKey === opt,
            'active': (currentSliderType === 'engine' && (selectedEngine === opt || (selectedEngine === 'all' && opt === '全部')))
                   || (currentSliderType === 'code' && (selectedCodeType === opt || (selectedCodeType === 'all' && opt === '全部')))
          }]"
          @click="onSliderSelect(opt)"
        >
          {{ opt }}
        </button>
      </div>
    </div>

        <!-- 网格锚点，滚动定位使用 -->
        <div class="games-grid-anchor"></div>
        <!-- 游戏网格 -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- 游戏卡片 -->
          <div 
            v-for="game in filteredGames" 
            :key="game.id"
            class="game-card glass-card overflow-hidden">
            <div class="relative group">
  
              <div 
                class="video-wrapper relative w-full h-48 overflow-hidden"
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
                      @click.stop="restartVideo(getGameKey(game))">
                      <i class="fa fa-undo"></i>
                    </button>
                  </div>
                </template>
                <template v-else>
                  <img :src="game.thumbnail_url || '/GameImg.jpg'" class="w-full h-full object-cover" />
                </template>
              </div>
              <div class="absolute top-4 right-4 bg-white text-[#1d1d1f] text-sm font-bold px-3 py-1 rounded-full border border-black/10 shadow-sm">
                {{ categoryToZh(game.category || 'action') }}
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
              <div class="flex items-center text-sm text-white/80 mb-4">
                <i class="fa fa-tag mr-2"></i>
                <span>类别: {{ categoryToZh(game.category || 'action') }}</span>
                <i class="fa fa-cogs mr-2 ml-4"></i>
                <span>引擎: {{ getEngine(game) || 'Cocos' }}</span>
                <i class="fa fa-code mr-2 ml-4"></i>
                <span>代码: {{ getCodeType(game) || 'TypeScript' }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-white/80">
                  <i class="fa fa-play mr-1"></i> 
                  {{ game.play_count || 0 }} 玩过
                </span>
                <div class="flex gap-2">
                  <button
                    @click="playGame(game)"
                    class="play-game-btn bg-white hover:bg-white/90 text-[#1d1d1f] px-4 py-2 rounded-full text-sm transition-all duration-300">
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
import { ref, reactive, onMounted, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { useModalStore } from '../stores/modal'
import { resolveMediaUrl } from '../utils/media'
import { gsap } from 'gsap'
import { categoryToZh } from '../utils/category'

const gameStore = useGameStore()
const modalStore = useModalStore()
const games = ref([])
const engines = ['全部', 'Godot', 'Unity', 'Cocos', '其他']
const codeTypes = ['全部', 'TypeScript', 'JavaScript', 'C#', '其他']
const selectedEngine = ref('all')
const selectedCodeType = ref('all')
const filteredGames = ref([])
const hoveredVideoId = ref(null)
const videoStates = reactive({})
const videoRefs = new Map()
const initializedVideos = new Set()

// 滑块/选项条状态
const sliderVisible = ref(false)
const currentSliderType = ref('engine') 
const currentOptions = ref([])
const overlay = ref({ x: 0, y: 0, w: 0, h: 0, visible: false, hoverKey: null })

// 打开固定选项条
const openEngineSlider = (e) => {
  currentSliderType.value = 'engine'
  currentOptions.value = engines
  sliderVisible.value = true
}

const openCodeSlider = (e) => {
  currentSliderType.value = 'code'
  currentOptions.value = codeTypes
  sliderVisible.value = true
}

// 滑块选择
const onSliderSelect = (opt) => {
  if (currentSliderType.value === 'engine') {
    selectedEngine.value = opt === '全部' ? 'all' : opt
  } else {
    selectedCodeType.value = opt === '全部' ? 'all' : opt
  }
  applyFilters()
  requestAnimationFrame(() => scrollToGrid())
  sliderVisible.value = false
}

// 字段读取统一
const getEngine = (game) => (game.engine || game.game_engine || '').toString().trim()
const getCodeType = (game) => (game.code_type || game.codeType || game.code_category || '').toString().trim()

// 归一化（同义词、大小写、符号）
const normalizeEngine = (val) => {
  const v = (val || '').toString().trim().toLowerCase()
  if (!v) return ''
  if (['godot'].includes(v)) return 'godot'
  if (['unity'].includes(v)) return 'unity'
  if (['cocos', 'cocos2d', 'cocos-creator', 'cocos creator'].includes(v)) return 'cocos'
  if (['other', 'others', '其他'].includes(v)) return 'other'
  return v
}

const normalizeCodeType = (val) => {
  const v = (val || '').toString().trim().toLowerCase()
  if (!v) return ''
  if (['typescript', 'ts'].includes(v)) return 'typescript'
  if (['javascript', 'js'].includes(v)) return 'javascript'
  if (['c#', 'csharp', 'cs'].includes(v)) return 'c#'
  if (['other', 'others', '其他'].includes(v)) return 'other'
  return v
}

// 应用所有筛选条件（大小写不敏感，去空格，兼容多字段名）
const applyFilters = () => {
  const selEngine = normalizeEngine(selectedEngine.value)
  const selCode = normalizeCodeType(selectedCodeType.value)

  filteredGames.value = games.value.filter(game => {
    const engine = normalizeEngine(getEngine(game))
    const code = normalizeCodeType(getCodeType(game))

    const engineMatch = selEngine === 'all' || (engine && engine === selEngine)
    const codeMatch = selCode === 'all' || (code && code === selCode)
    return engineMatch && codeMatch
  })
}
applyFilters()

// 选项条内毛玻璃遮盖跟随并对齐当前选项
const onOptionsMouseMove = (event) => {
  if (!sliderVisible.value) return
  const container = event.currentTarget
  const containerRect = container.getBoundingClientRect()
  const chip = event.target.closest('.option-chip')
  if (!chip) {
    overlay.value.visible = false
    overlay.value.hoverKey = null
    return
  }
  const chipRect = chip.getBoundingClientRect()
  const key = chip.dataset.opt
  overlay.value = {
    x: chipRect.left - containerRect.left,
    y: chipRect.top - containerRect.top,
    w: chipRect.width,
    h: chipRect.height,
    visible: true,
    hoverKey: key
  }
}
const onOptionsBarLeave = () => {
  overlay.value.visible = false
  overlay.value.hoverKey = null
}

const scrollToGrid = () => {
  const gridEl = document.querySelector('.games-grid-anchor')
  if (gridEl) {
    gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const loadGames = async () => {
  try {
    await gameStore.loadGames()
    games.value = gameStore.games
    ensureFeaturedGame()
    applyFilters() 
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
      code_type: 'TypeScript'
    }]
    ensureFeaturedGame()
    applyFilters()
  }
}

const playGame = (game) => {
  const key = game.game_id || game.id
  // 避免对本地“主卡”占位数据上报玩过记录
  if (key && !(typeof key === 'string' && key.startsWith('featured-'))) {
    gameStore.recordGamePlay(key)
  }
  modalStore.openGameModal(game)
}

// 将主卡纳入 games 列表，受筛选控制
const ensureFeaturedGame = () => {
  const exists = games.value.some(g => (g.game_id || g.id) === 'featured-pixel-escape' || g.title === '像素逃生')
  if (!exists) {
    games.value.unshift({
      id: 'featured-pixel-escape',
      title: '像素逃生',
      description: '骑士挥舞刺刀击败骷髅.',
      average_rating: '0.0',
      play_count: 0,
      category: 'action',
      engine: 'Cocos',
      code_type: 'TypeScript',
      thumbnail_url: '/GameImg.jpg',
      video_url: null
    })
  }
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
      const key = [...videoRefs.entries()].find(([, el]) => el === video)?.[0]
      if (key !== undefined) {
        videoStates[key] = { ...state }
      }
    }).catch(() => {})
  }
}

const setVideoRef = (el, key) => {
  if (el) {
    videoRefs.set(key, el)
    const state = ensureVideoState(key)
    if (!initializedVideos.has(key)) {
      setupVideoElement(el, state)
      initializedVideos.add(key)
    }
  } else {
    videoRefs.delete(key)
    initializedVideos.delete(key)
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
    // 恢复播放时，确保重新允许自动播放
    video.autoplay = true
    video.setAttribute('autoplay', '')
    const p = video.play()
    if (p?.then) {
      p.then(() => { 
        state.playing = true 
        videoStates[key] = { ...state }
      }).catch(() => {})
    } else {
      state.playing = true
      videoStates[key] = { ...state }
    }
  } else {
    // 暂停时，移除自动播放，避免在hover等场景被重新拉起
    video.pause()
    video.autoplay = false
    video.removeAttribute('autoplay')
    state.playing = false
    videoStates[key] = { ...state }
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
  video.autoplay = true
  video.setAttribute('autoplay', '')
  const p = video.play()
  if (p?.then) {
    p.then(() => { 
      state.playing = true 
      videoStates[key] = { ...state }
    }).catch(() => {})
  } else {
    state.playing = true
    videoStates[key] = { ...state }
  }
}

const isVideoHovered = (key) => hoveredVideoId.value === key
const isVideoMuted = (key) => videoStates[key]?.muted ?? true
const isVideoPlaying = (key) => {
  const v = videoRefs.get(key)
  if (v) return !v.paused
  return videoStates[key]?.playing === true
}

onMounted(() => {
  loadGames()
})

// 响应筛选变化
watch([selectedEngine, selectedCodeType, games], () => {
  applyFilters()
})


</script>

<style scoped>
.games-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  font-family: 'Quicksand', sans-serif;
  background-color: #000;
  color: #f3f4f6;
}

.games-page::after {
  content: '';
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.75));
  pointer-events: none;
  z-index: 0;
}

.content-wrapper {
  position: relative;
  z-index: 10;
}

/* 避免与桌面端悬浮侧边栏（宽80px，距左20px）重叠 */
@media (min-width: 1024px) {
  .games-page .content-wrapper {
    padding-left: 96px; /* 80px 侧边栏 + 16px 安全间距 */
  }
}

/* 更宽的屏幕上再多留一些空间（典型 16 寸笔记本分辨率） */
@media (min-width: 1536px) {
  .games-page .content-wrapper {
    padding-left: 120px; /* 额外留白，避免视觉拥挤 */
  }
}

.glass-card {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  background-clip: padding-box;
  -webkit-background-clip: padding-box;
  isolation: isolate;
  contain: paint;
  will-change: transform;
  transition: background 0.3s ease;
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.game-card {
  transition: transform 0.3s ease;
}

.game-card:hover {
  transform: translateY(-4px);
}

.filter-menu {
  position: relative;
  z-index: 100;
}

.filter-group {
  position: relative;
  z-index: 100;
}

.filter-dropdown {
  min-width: 120px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 100; 
}

/* 确保点击页面其他地方时关闭下拉菜单 */
.filter-menu:focus-within .filter-dropdown {
  display: block;
}

/* 固定选项条样式 */
.options-bar-wrapper {
  margin-bottom: 16px;
}

.options-bar {
  position: relative;
  display: flex;
  gap: 8px;
  padding: 10px;
  border-radius: 14px;
  background: transparent;
  box-shadow: none;
  border: 1px solid transparent;
  overflow: hidden;
}

.options-bar.is-engine { background: transparent; }
.options-bar.is-code { background: transparent; }

.option-chip {
  position: relative;
  white-space: nowrap;
  padding: 10px 16px;
  border-radius: 9999px;
  background: #ffffff;
  color: #1d1d1f;
  font-weight: 600;
  font-size: 14px;
  border: 1px solid rgba(0,0,0,0.15);
  transition: transform 160ms ease, background 160ms ease, box-shadow 160ms ease, color 160ms ease;
}

.option-chip:hover { 
  transform: translateY(-1px);
  background: rgba(255,255,255,0.9);
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
}

.option-chip.active {
  background: #ffffff;
  color: #1d1d1f;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.06) inset;
}

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
  background: #ffffff;
  color: #1d1d1f;
  border: 1px solid rgba(0,0,0,0.15);
  transition: background 0.2s ease, transform 0.2s ease, color 0.2s ease;
}

.video-control-panel .control-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
}

/* 确保控制面板在视频之上可点 */
.video-control-panel {
  z-index: 2;
}

.glass-overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  border-radius: 9999px;
  background: rgba(255,255,255,0.32); /* 由0.22提升至0.32更显眼*/
  border: 2px solid #fff; /* 更亮边框 */
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  transition: transform 140ms ease, width 140ms ease, height 140ms ease, opacity 160ms ease;
  z-index: 1000;
}

.magnifier {
  transform: scale(1.24);
  color: #fff;
  font-weight: bold;
  z-index: 1200;
  background: rgba(255,255,255,0.46) !important;
  box-shadow: 0 0 20px 6px rgba(255,255,255,0.18);
  transition: transform 0.13s cubic-bezier(.67,.12,.85,1.21), background 0.18s, box-shadow 0.18s;
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
