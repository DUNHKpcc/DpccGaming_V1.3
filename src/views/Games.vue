<template>
  <div class="games-page">
    <!-- Main content -->
    <div class="content-wrapper">
      <div class="container mx-auto px-4 py-8 games-main">
        <!-- Fixed header and filters (do not scroll with cards) -->
        <div class="games-header">
          <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-white">游戏库</h1>
            <button
              @click="openAddGameModal"
              class="bg-white hover:bg-white/90 text-[#1d1d1f] px-6 py-3 rounded-lg transition-colors duration-300 flex items-center gap-2"
            >
              <i class="fa fa-plus"></i>
              添加游戏
            </button>
          </div>

          <!-- Filter menu -->
          <div
            class="filter-menu flex gap-3 mb-4 bg-transparent rounded-xl p-3 inline-block"
          >
            <div class="filter-group">
              <button
                class="filter-btn bg-white text-[#1d1d1f] border border-black/10 px-4 py-2 rounded-full transition-all duration-300 hover:bg-white/90"
                @click="openEngineSlider"
              >
                <i class="fa fa-cogs mr-2"></i>游戏引擎
              </button>
            </div>
            <div class="filter-group">
              <button
                class="filter-btn bg-white text-[#1d1d1f] border border-black/10 px-4 py-2 rounded-full transition-all duration-300 hover:bg-white/90"
                @click="openCodeSlider"
              >
                <i class="fa fa-code mr-2"></i>编程语言
              </button>
            </div>
          </div>

          <!-- Fixed options bar -->
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
                :class="[
                  'option-chip',
                  {
                    magnifier: overlay.hoverKey === opt,
                    active:
                      (currentSliderType === 'engine' &&
                        (selectedEngine === opt ||
                          (selectedEngine === 'all' && opt === '其它'))) ||
                      (currentSliderType === 'code' &&
                        (selectedCodeType === opt ||
                          (selectedCodeType === 'all' && opt === '其它')))
                  }
                ]"
                @click="onSliderSelect(opt)"
              >
                {{ opt }}
              </button>
            </div>
          </div>
        </div>

        <!-- Only cards area scrolls -->
        <div class="games-cards-scroll">
          <!-- Anchor for scrollToGrid -->
          <div class="games-grid-anchor"></div>

          <!-- Games grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Game card -->
            <div
              v-for="game in filteredGames"
              :key="game.id"
              class="game-card glass-card overflow-hidden"
            >
              <div class="relative group">
                <div
                  class="video-wrapper relative w-full h-48 overflow-hidden"
                  @mouseenter="handleVideoEnter(getGameKey(game))"
                  @mouseleave="handleVideoLeave(getGameKey(game))"
                >
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
                      :ref="el => setVideoRef(el, getGameKey(game))"
                    >
                    </video>
                    <div
                      class="video-control-panel absolute bottom-3 left-3 flex items-center gap-3 bg-black/55 backdrop-blur-sm text-white px-3 py-2 rounded-full transition-opacity duration-200 ease-out"
                      :class="
                        isVideoHovered(getGameKey(game))
                          ? 'opacity-100 pointer-events-auto'
                          : 'opacity-0 pointer-events-none'
                      "
                    >
                      <button
                        class="control-btn"
                        type="button"
                        @click.stop="toggleVideoPlay(getGameKey(game))"
                      >
                        <i
                          :class="
                            isVideoPlaying(getGameKey(game))
                              ? 'fa fa-pause'
                              : 'fa fa-play'
                          "
                        ></i>
                      </button>
                      <button
                        class="control-btn"
                        type="button"
                        @click.stop="restartVideo(getGameKey(game))"
                      >
                        <i class="fa fa-undo"></i>
                      </button>
                    </div>
                  </template>
                  <template v-else>
                    <img
                      :src="game.thumbnail_url || '/GameImg.jpg'"
                      class="w-full h-full object-cover"
                    />
                  </template>
                </div>
                <div
                  class="absolute top-4 right-4 bg-white text-[#1d1d1f] text-sm font-bold px-3 py-1 rounded-full border border-black/10 shadow-sm"
                >
                  {{ categoryToZh(game.category || 'action') }}
                </div>
              </div>
              <div class="p-6">
                <div class="flex justify-between items-start mb-3">
                  <h3 class="text-xl font-bold text-white">
                    {{ game.title }}
                  </h3>
                  <div class="flex items-center">
                    <i class="fa fa-star text-yellow-400"></i>
                    <span class="ml-1 text-white">
                      {{ game.average_rating || '0.0' }}
                    </span>
                  </div>
                </div>
                <p class="text-white/80 text-sm mb-4">
                  {{ game.description }}
                </p>
                <div class="flex items-center text-sm text-white/80 mb-4">
                  <i class="fa fa-tag mr-2"></i>
                  <span>游戏类别: {{ categoryToZh(game.category || 'action') }}</span>
                  <img
                    :src="getEngineIcon(game)"
                    alt="游戏引擎"
                    class="engine-type-icon ml-4 mr-2"
                  />
                  <span>游戏引擎: {{ getEngine(game) || 'Cocos' }}</span>
                  <img
                    :src="getCodeTypeIcon(game)"
                    alt="编程语言"
                    class="code-type-icon ml-4 mr-2"
                  />
                  <span>编程语言: {{ getCodeType(game) || 'TypeScript' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm text-white/80">
                    <i class="fa fa-play mr-1"></i>
                    {{ game.play_count || 0 }} 次
                  </span>
                  <div class="flex gap-2">
                    <button
                      @click="playGame(game)"
                      class="play-game-btn bg-white hover:bg-white/90 text-[#1d1d1f] px-4 py-2 rounded-full text-sm transition-all duration-300"
                    >
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

// Slider state
const sliderVisible = ref(false)
const currentSliderType = ref('engine')
const currentOptions = ref([])
const overlay = ref({
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  visible: false,
  hoverKey: null
})

// Open sliders
const openEngineSlider = () => {
  currentSliderType.value = 'engine'
  currentOptions.value = engines
  sliderVisible.value = true
}

const openCodeSlider = () => {
  currentSliderType.value = 'code'
  currentOptions.value = codeTypes
  sliderVisible.value = true
}

// Slider selection
const onSliderSelect = opt => {
  if (currentSliderType.value === 'engine') {
    selectedEngine.value = opt === '全部' ? 'all' : opt
  } else {
    selectedCodeType.value = opt === '全部' ? 'all' : opt
  }
  applyFilters()

  // Scroll only the cards area to the grid anchor
  requestAnimationFrame(() => scrollToGrid())
  sliderVisible.value = false
}

// Helpers for engine / code fields
const getEngine = game =>
  (game.engine || game.game_engine || '').toString().trim()

const getCodeType = game =>
  (game.code_type || game.codeType || game.code_category || '')
    .toString()
    .trim()

// Normalization helpers
const normalizeEngine = val => {
  const v = (val || '').toString().trim().toLowerCase()
  if (!v) return ''
  if (['godot'].includes(v)) return 'godot'
  if (['unity'].includes(v)) return 'unity'
  if (['cocos', 'cocos2d', 'cocos-creator', 'cocos creator'].includes(v)) {
    return 'cocos'
  }
  if (['other', 'others', '其他'].includes(v)) return 'other'
  return v
}

const normalizeCodeType = val => {
  const v = (val || '').toString().trim().toLowerCase()
  if (!v) return ''
  if (['typescript', 'ts'].includes(v)) return 'typescript'
  if (['javascript', 'js'].includes(v)) return 'javascript'
  if (['c#', 'csharp', 'cs'].includes(v)) return 'c#'
  if (['other', 'others', '其他'].includes(v)) return 'other'
  return v
}

const codeTypeIconMap = {
  typescript: '/codeType/typescript.jpg',
  javascript: '/codeType/js.webp',
  'c#': '/codeType/csharp.webp'
}

const engineIconMap = {
  godot: '/engineType/godot.webp',
  unity: '/engineType/unity.webp',
  cocos: '/engineType/cocos.webp',
  other: '/engineType/cocos.webp'
}

const getCodeTypeIcon = game => {
  const normalized = normalizeCodeType(getCodeType(game)) || 'typescript'
  return codeTypeIconMap[normalized] || codeTypeIconMap.typescript
}

const getEngineIcon = game => {
  const normalized = normalizeEngine(getEngine(game)) || 'cocos'
  return engineIconMap[normalized] || engineIconMap.cocos
}

// Apply filters to games
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

// Magnifier overlay on option chips
const onOptionsMouseMove = event => {
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
  const scrollContainer = document.querySelector('.games-cards-scroll')
  const gridEl = document.querySelector('.games-grid-anchor')
  if (scrollContainer && gridEl) {
    const containerRect = scrollContainer.getBoundingClientRect()
    const targetRect = gridEl.getBoundingClientRect()
    const offset = targetRect.top - containerRect.top
    scrollContainer.scrollTo({
      top: scrollContainer.scrollTop + offset,
      behavior: 'smooth'
    })
  }
}

// Load games
const loadGames = async () => {
  try {
    await gameStore.loadGames()
    games.value = gameStore.games
    ensureFeaturedGame()
    applyFilters()
  } catch (error) {
    console.error('加载错误', error)
    games.value = [
      {
        id: 'web-mobile-001',
        title: '像素冰原(test)',
        description: '在冰天雪地中闯关.',
        average_rating: '0.0',
        play_count: 0,
        category: 'action',
        engine: 'Cocos',
        code_type: 'TypeScript'
      }
    ]
    ensureFeaturedGame()
    applyFilters()
  }
}

const playGame = game => {
  const key = game.game_id || game.id
  // Skip counting for special featured placeholders
  if (key && !(typeof key === 'string' && key.startsWith('featured-'))) {
    gameStore.recordGamePlay(key)
  }
  modalStore.openGameModal(game)
}

// Ensure there is a featured game at the top
const ensureFeaturedGame = () => {
  const exists = games.value.some(
    g =>
      (g.game_id || g.id) === 'featured-pixel-escape' ||
      g.title === '像素冰原'
  )
}

const openAddGameModal = () => {
  modalStore.openModal('addGame')
}

// Media helpers
const getVideoUrl = videoUrl => resolveMediaUrl(videoUrl)
const getGameKey = game => game.game_id || game.id

// Video state helpers
const ensureVideoState = key => {
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
    playPromise
      .then(() => {
        state.playing = true
        const key = [...videoRefs.entries()].find(([, el]) => el === video)?.[0]
        if (key !== undefined) {
          videoStates[key] = { ...state }
        }
      })
      .catch(() => {})
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

const handleVideoEnter = key => {
  const video = videoRefs.get(key)
  if (!video) return
  const state = ensureVideoState(key)
  hoveredVideoId.value = key
  if (video.paused && state.playing !== false) {
    video
      .play()
      .then(() => {
        state.playing = true
      })
      .catch(() => {})
  }
  gsap.to(video, { scale: 1.08, duration: 0.35, ease: 'power3.out' })
}

const handleVideoLeave = key => {
  if (hoveredVideoId.value === key) {
    hoveredVideoId.value = null
  }
  const video = videoRefs.get(key)
  if (!video) return
  gsap.to(video, { scale: 1, duration: 0.35, ease: 'power3.out' })
}

const toggleVideoPlay = key => {
  const video = videoRefs.get(key)
  if (!video) return
  const state = ensureVideoState(key)
  if (video.paused) {
    // Resume playback and keep autoplay behavior
    video.autoplay = true
    video.setAttribute('autoplay', '')
    const p = video.play()
    if (p?.then) {
      p
        .then(() => {
          state.playing = true
          videoStates[key] = { ...state }
        })
        .catch(() => {})
    } else {
      state.playing = true
      videoStates[key] = { ...state }
    }
  } else {
    // Pause and remove autoplay so hover does not immediately restart
    video.pause()
    video.autoplay = false
    video.removeAttribute('autoplay')
    state.playing = false
    videoStates[key] = { ...state }
  }
}

const toggleVideoMute = key => {
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

const restartVideo = key => {
  const video = videoRefs.get(key)
  if (!video) return
  const state = ensureVideoState(key)
  video.currentTime = 0
  video.autoplay = true
  video.setAttribute('autoplay', '')
  const p = video.play()
  if (p?.then) {
    p
      .then(() => {
        state.playing = true
        videoStates[key] = { ...state }
      })
      .catch(() => {})
  } else {
    state.playing = true
    videoStates[key] = { ...state }
  }
}

const isVideoHovered = key => hoveredVideoId.value === key
const isVideoMuted = key => videoStates[key]?.muted ?? true
const isVideoPlaying = key => {
  const v = videoRefs.get(key)
  if (v) return !v.paused
  return videoStates[key]?.playing === true
}

onMounted(() => {
  loadGames()
})

// React to filter changes
watch([selectedEngine, selectedCodeType, games], () => {
  applyFilters()
})
</script>

<style scoped>
.games-page {
  /* Distance from topbar; adjust if needed */
  --topbar-gap: 72px;
  min-height: 100vh;
  height: 100vh;
  position: fixed;
  width: 100%;
  overflow: hidden; 
  font-family: 'Quicksand', sans-serif;
  background-color: #000;
  color: #f3f4f6;
}

@media (max-width: 768px) {
  .games-page {
    --topbar-gap: 64px;
  }
}

.games-page::after {
  content: '';
  position: fixed;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.45),
    rgba(0, 0, 0, 0.75)
  );
  pointer-events: none;
  z-index: 0;
}

.content-wrapper {
  position: relative;
  margin-top: var(--topbar-gap);
  z-index: 10;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 100vh;
}

.games-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: hidden;
  max-height: 100vh;
} 

.games-header {
  flex-shrink: 0;
  margin-bottom: 4px;
  width: 100%;
  overflow: hidden;
}

.games-cards-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto; 
  padding-bottom: 24px;
}

.games-cards-scroll::-webkit-scrollbar {
  width: 8px;
}

.games-cards-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
}

.games-cards-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.games-grid-anchor {
  scroll-margin-top: 12px;
}

/* Sidebar spacing on large screens */
@media (min-width: 1024px) {
  .games-page .content-wrapper {
    padding-left: 96px;
  }
}

@media (min-width: 1536px) {
  .games-page .content-wrapper {
    padding-left: 120px;
  }
}

.glass-card {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0;
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
  z-index: 10;
}

.filter-group {
  position: relative;
  z-index: 10;
}

.filter-dropdown {
  min-width: 120px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 100;
}

.filter-menu:focus-within .filter-dropdown {
  display: block;
}

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

.options-bar.is-engine {
  background: transparent;
}

.options-bar.is-code {
  background: transparent;
}

.option-chip {
  position: relative;
  white-space: nowrap;
  padding: 10px 16px;
  border-radius: 9999px;
  background: #ffffff;
  color: #1d1d1f;
  font-weight: 600;
  font-size: 14px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  transition:
    transform 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;
}

.option-chip:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}

.option-chip.active {
  background: #ffffff;
  color: #1d1d1f;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.06) inset;
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
  border: 1px solid rgba(0, 0, 0, 0.15);
  transition:
    background 0.2s ease,
    transform 0.2s ease,
    color 0.2s ease;
}

.video-control-panel .control-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
}

.video-control-panel {
  z-index: 2;
}

.code-type-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  display: inline-flex;
}

.engine-type-icon{
  width: 30px;
  height: 30px;
  object-fit: contain;
  display: inline-flex;
}

.glass-overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.32);
  border: 2px solid #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  transition:
    transform 140ms ease,
    width 140ms ease,
    height 140ms ease,
    opacity 160ms ease;
  z-index: 1000;
}

.magnifier {
  transform: scale(1.24);
  color: #fff;
  font-weight: bold;
  z-index: 1200;
  background: rgba(255, 255, 255, 0.46) !important;
  box-shadow: 0 0 20px 6px rgba(255, 255, 255, 0.18);
  transition:
    transform 0.13s cubic-bezier(0.67, 0.12, 0.85, 1.21),
    background 0.18s,
    box-shadow 0.18s;
}

@keyframes movement {
  0%,
  100% {
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
