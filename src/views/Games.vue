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
              class="add-game-btn bg-white hover:bg-white/90 text-[#1d1d1f] px-6 py-3 rounded-lg transition-colors duration-300 flex items-center gap-2"
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
                class="filter-btn bg-white text-[#1d1d1f] border border-black/10 px-4 py-2 rounded-full transition-all duration-300 hover:bg-white/90 flex items-center gap-2"
                @click="openEngineSlider"
              >
                <img
                  v-if="getEngineFilterIcon()"
                  :src="getEngineFilterIcon()"
                  alt="游戏引擎"
                  class="filter-btn-icon"
                />
                <span>游戏引擎</span>
              </button>
            </div>
            <div class="filter-group">
              <button
                class="filter-btn bg-white text-[#1d1d1f] border border-black/10 px-4 py-2 rounded-full transition-all duration-300 hover:bg-white/90 flex items-center gap-2"
                @click="openCodeSlider"
              >
                <img
                  v-if="getCodeFilterIcon()"
                  :src="getCodeFilterIcon()"
                  alt="编程语言"
                  class="filter-btn-icon"
                />
                <span>编程语言</span>
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
                <img
                  v-if="currentSliderType === 'engine' && getEngineOptionIcon(opt)"
                  :src="getEngineOptionIcon(opt)"
                  alt="游戏引擎"
                  class="option-chip-icon"
                />
                <img
                  v-if="currentSliderType === 'code' && getCodeOptionIcon(opt)"
                  :src="getCodeOptionIcon(opt)"
                  alt="编程语言"
                  class="option-chip-icon"
                />
                <span>{{ opt }}</span>
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
              class="game-card glass-card"
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
                  class="game-tag-badge absolute top-4 right-4 bg-white text-[#1d1d1f] text-sm font-bold px-3 py-1 rounded-full border border-black/10 shadow-sm"
                >
                  {{ categoryToZh(game.category || 'action') }}
                </div>
              </div>
              <div class="game-card-body p-6" :style="getCardThemeStyle(game)">
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
                <div class="card-author-line mb-4">
                  <AvatarFriendAction
                    :user-id="game.uploaded_by_id"
                    :username="game.uploaded_by_username"
                    placement="left"
                  >
                    <img
                      :src="getAvatarUrl(game.uploaded_by_avatar_url)"
                      alt="作者头像"
                      class="card-author-avatar"
                      @error="handleAvatarError"
                    />
                  </AvatarFriendAction>
                  <span class="card-author-text">
                    By {{ game.uploaded_by_username || '匿名开发者' }}
                  </span>
                </div>
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
                <div class="game-card-actions flex justify-between items-center">
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
                    <button
                      @click="addGameToLibrary(game)"
                      :disabled="isAddingLibrary(game) || isInLibrary(game)"
                      class="add-library-btn px-4 py-2 rounded-full text-sm transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {{ isInLibrary(game) ? '已在库中' : (isAddingLibrary(game) ? '加入中...' : '加入库') }}
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
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { useGameStore } from '../stores/game'
import { useModalStore } from '../stores/modal'
import { resolveMediaUrl } from '../utils/media'
import { gsap } from 'gsap'
import { categoryToZh } from '../utils/category'
import { getAvatarUrl, handleAvatarError } from '../utils/avatar'
import { apiCall } from '../utils/api'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
import AvatarFriendAction from '../components/AvatarFriendAction.vue'

const gameStore = useGameStore()
const modalStore = useModalStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

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
const cardThemeStyles = reactive({})
const themedGameKeys = new Set()
const pendingThemeKeys = new Set()
const libraryGameIds = ref(new Set())
const addingLibraryIds = reactive({})
const isLoggedIn = computed(() => authStore.isLoggedIn)

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

const getEngineFilterIcon = () => {
  if (selectedEngine.value === 'all') return ''
  const normalized = normalizeEngine(selectedEngine.value)
  if (normalized === 'other') return ''
  return engineIconMap[normalized] || ''
}

const getCodeFilterIcon = () => {
  if (selectedCodeType.value === 'all') return ''
  const normalized = normalizeCodeType(selectedCodeType.value)
  if (normalized === 'other') return ''
  return codeTypeIconMap[normalized] || ''
}

const getEngineOptionIcon = opt => {
  if (opt === '全部' || opt === '其他') return ''
  const normalized = normalizeEngine(opt)
  return engineIconMap[normalized]
}

const getCodeOptionIcon = opt => {
  if (opt === '全部' || opt === '其他') return ''
  const normalized = normalizeCodeType(opt)
  return codeTypeIconMap[normalized]
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

const loadUserLibrary = async () => {
  if (!isLoggedIn.value) {
    libraryGameIds.value = new Set()
    return
  }

  try {
    const data = await apiCall('/games/library/mine')
    const nextSet = new Set((data?.games || []).map(item => String(item.game_id)))
    libraryGameIds.value = nextSet
  } catch (error) {
    console.error('加载用户游戏库失败:', error)
  }
}

// Media helpers
const getVideoUrl = videoUrl => resolveMediaUrl(videoUrl)
const getGameKey = game => game.game_id || game.id

const isInLibrary = game => {
  const key = getGameKey(game)
  if (!key) return false
  return libraryGameIds.value.has(String(key))
}

const isAddingLibrary = game => {
  const key = getGameKey(game)
  if (!key) return false
  return addingLibraryIds[String(key)] === true
}

const addGameToLibrary = async game => {
  const key = getGameKey(game)
  if (!key) return

  if (!isLoggedIn.value) {
    modalStore.openModal('login')
    notificationStore.info('请先登录', '登录后可将游戏加入个人游戏库')
    return
  }

  if (isInLibrary(game)) return

  const keyText = String(key)
  addingLibraryIds[keyText] = true
  try {
    await apiCall(`/games/${encodeURIComponent(keyText)}/library`, {
      method: 'POST'
    })
    const nextSet = new Set(libraryGameIds.value)
    nextSet.add(keyText)
    libraryGameIds.value = nextSet
    notificationStore.success('加入成功', '游戏已加入你的游戏库')
  } catch (error) {
    notificationStore.error('加入失败', error.message || '请稍后重试')
  } finally {
    addingLibraryIds[keyText] = false
  }
}

const rgbTuple = (r, g, b) =>
  `${Math.max(0, Math.min(255, Math.round(r)))}, ${Math.max(0, Math.min(255, Math.round(g)))}, ${Math.max(0, Math.min(255, Math.round(b)))}`

const mixRgb = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t)
]

const hashString = value => {
  const text = String(value || '')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const hslToRgb = (h, s, l) => {
  const hue = (h % 360) / 360
  const sat = Math.max(0, Math.min(1, s))
  const light = Math.max(0, Math.min(1, l))
  if (sat === 0) {
    const v = Math.round(light * 255)
    return [v, v, v]
  }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q
  const hueToChannel = t => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [
    Math.round(hueToChannel(hue + 1 / 3) * 255),
    Math.round(hueToChannel(hue) * 255),
    Math.round(hueToChannel(hue - 1 / 3) * 255)
  ]
}

const applyThemeFromRgb = (key, rgb) => {
  const main = rgb.map(v => Math.max(0, Math.min(255, Math.round(v))))
  const bright = mixRgb(main, [255, 255, 255], 0.22)
  const deep = mixRgb(main, [0, 0, 0], 0.44)
  const edge = mixRgb(main, [0, 0, 0], 0.62)
  cardThemeStyles[key] = {
    '--card-theme-main': rgbTuple(main[0], main[1], main[2]),
    '--card-theme-bright': rgbTuple(bright[0], bright[1], bright[2]),
    '--card-theme-deep': rgbTuple(deep[0], deep[1], deep[2]),
    '--card-theme-edge': rgbTuple(edge[0], edge[1], edge[2])
  }
}

const applySeedTheme = game => {
  const key = getGameKey(game)
  if (!key || cardThemeStyles[key]) return
  const seed = hashString(`${game?.title || 'game'}-${game?.category || ''}`)
  const hue = seed % 360
  const saturation = 0.48 + ((seed % 17) / 100)
  const lightness = 0.43 + ((seed % 13) / 120)
  applyThemeFromRgb(key, hslToRgb(hue, saturation, lightness))
}

const extractThemeFromElement = (element, key) => {
  if (!element || !key) return false
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 22
    canvas.height = 22
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return false

    context.drawImage(element, 0, 0, canvas.width, canvas.height)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)

    let r = 0
    let g = 0
    let b = 0
    let count = 0

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255
      if (alpha < 0.2) continue
      const pr = data[i]
      const pg = data[i + 1]
      const pb = data[i + 2]
      const luminance = (0.2126 * pr + 0.7152 * pg + 0.0722 * pb) / 255
      if (luminance < 0.05 || luminance > 0.95) continue
      r += pr
      g += pg
      b += pb
      count += 1
    }

    if (!count) return false
    applyThemeFromRgb(key, [r / count, g / count, b / count])
    themedGameKeys.add(key)
    return true
  } catch (error) {
    return false
  }
}

const queueImageThemeExtraction = game => {
  const key = getGameKey(game)
  if (!key || themedGameKeys.has(key) || pendingThemeKeys.has(key)) return
  const coverUrl = resolveMediaUrl(game?.thumbnail_url || '')
  if (!coverUrl) return

  pendingThemeKeys.add(key)
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.referrerPolicy = 'no-referrer'

  image.onload = () => {
    extractThemeFromElement(image, key)
    pendingThemeKeys.delete(key)
  }
  image.onerror = () => {
    pendingThemeKeys.delete(key)
  }
  image.src = coverUrl
}

const bindVideoThemeExtraction = (video, key) => {
  const tryExtract = () => {
    if (!video || themedGameKeys.has(key)) return
    extractThemeFromElement(video, key)
  }
  if (video.readyState >= 2) {
    tryExtract()
  }
  video.addEventListener('loadeddata', tryExtract, { once: true })
  video.addEventListener('canplay', tryExtract, { once: true })
  video.addEventListener('play', tryExtract, { once: true })
}

const getCardThemeStyle = game => {
  const key = getGameKey(game)
  return key ? cardThemeStyles[key] || null : null
}

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
    bindVideoThemeExtraction(el, key)
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
  loadUserLibrary()
})

// React to filter changes
watch([selectedEngine, selectedCodeType, games], () => {
  applyFilters()
})

watch(isLoggedIn, () => {
  loadUserLibrary()
})

watch(filteredGames, currentGames => {
  currentGames.forEach(game => {
    applySeedTheme(game)
    if (!game?.video_url) {
      queueImageThemeExtraction(game)
    }
  })
}, { immediate: true })
</script>

<style scoped>
.games-page {
  /* Distance from topbar; adjust if needed */
  --topbar-gap: 72px;
  --games-bg: #000000;
  --games-text: #f3f4f6;
  --games-text-80: rgba(243, 244, 246, 0.82);
  --games-text-30: rgba(243, 244, 246, 0.34);
  --games-overlay: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.42),
    rgba(0, 0, 0, 0.72)
  );
  --games-card-bg: linear-gradient(150deg, #151517, #101012 58%, #0b0b0c);
  --games-card-hover-bg: linear-gradient(150deg, #1c1c20, #141418 58%, #101013);
  --games-card-border: rgba(255, 255, 255, 0.12);
  --games-ui-bg: #ffffff;
  --games-ui-bg-hover: rgba(255, 255, 255, 0.9);
  --games-ui-text: #1d1d1f;
  --games-ui-border: rgba(0, 0, 0, 0.14);
  --games-control-bg: rgba(0, 0, 0, 0.55);
  --games-scrollbar: rgba(255, 255, 255, 0.2);
  min-height: 100vh;
  height: 100vh;
  position: fixed;
  width: 100%;
  overflow: hidden; 
  font-family: 'Quicksand', sans-serif;
  background-color: var(--games-bg);
  color: var(--games-text);
}

[data-theme='light'] .games-page {
  --games-bg: #ffffff;
  --games-text: #111111;
  --games-text-80: rgba(17, 17, 17, 0.8);
  --games-text-30: rgba(17, 17, 17, 0.34);
  --games-overlay: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.22)
  );
  --games-card-bg: linear-gradient(145deg, #ffffff, #f2f7ff 58%, #fff4e7);
  --games-card-hover-bg: linear-gradient(145deg, #ffffff, #ebf3ff 58%, #ffeccf);
  --games-card-border: rgba(17, 17, 17, 0.12);
  --games-ui-bg: #ffffff;
  --games-ui-bg-hover: #f7f9ff;
  --games-ui-text: #111111;
  --games-ui-border: rgba(17, 17, 17, 0.16);
  --games-control-bg: rgba(255, 255, 255, 0.86);
  --games-scrollbar: rgba(17, 17, 17, 0.24);
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
  background: var(--games-overlay);
  pointer-events: none;
  z-index: 0;
}

.content-wrapper {
  position: relative;
  z-index: 10;
  height: calc(100vh - var(--topbar-gap));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: calc(100vh - var(--topbar-gap));
}

.games-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: hidden;
  max-height: 100%;
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
  padding-bottom: 40px;
}

.games-cards-scroll::-webkit-scrollbar {
  width: 8px;
}

.games-cards-scroll::-webkit-scrollbar-thumb {
  background: var(--games-scrollbar);
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
  background: var(--games-card-bg);
  border: 1px solid var(--games-card-border);
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
  background: var(--games-card-hover-bg);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.games-page .text-white {
  color: var(--games-text) !important;
}

.games-page .text-white\/80 {
  color: var(--games-text-80) !important;
}

.games-page .text-white\/30 {
  color: var(--games-text-30) !important;
}

.games-page :is(.add-game-btn, .filter-btn, .play-game-btn, .add-library-btn, .game-tag-badge, .option-chip, .video-control-panel .control-btn) {
  background: var(--games-ui-bg) !important;
  color: var(--games-ui-text) !important;
  border-color: var(--games-ui-border) !important;
}

.games-page :is(.add-game-btn, .filter-btn, .play-game-btn, .add-library-btn, .option-chip, .video-control-panel .control-btn):hover,
.games-page .game-tag-badge:hover {
  background: var(--games-ui-bg-hover) !important;
}

.games-page .video-control-panel {
  background: var(--games-control-bg) !important;
  border: 1px solid var(--games-ui-border);
}

.card-author-line {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  z-index: 12;
}

.card-author-avatar {
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  object-fit: cover;
  border: 1px solid var(--games-card-border);
  flex-shrink: 0;
}

.card-author-text {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--games-text-80);
  line-height: 1;
}

.game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: visible;
  contain: none;
  transition: transform 0.3s ease;
  z-index: 1;
}

.game-card:hover {
  z-index: 6;
  transform: translateY(-4px);
}

.game-card-body {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  --card-theme-main: 84, 112, 156;
  --card-theme-bright: 132, 162, 210;
  --card-theme-deep: 33, 45, 68;
  --card-theme-edge: 19, 26, 40;
  background:
    linear-gradient(
      155deg,
      rgba(var(--card-theme-main), 0.34) 0%,
      rgba(var(--card-theme-deep), 0.52) 58%,
      rgba(var(--card-theme-edge), 0.82) 100%
    );
}

.game-card-body::before,
.game-card-body::after {
  content: '';
  position: absolute;
  inset: -36%;
  pointer-events: none;
  z-index: 0;
}

.game-card-body::before {
  background:
    radial-gradient(
      circle at 22% 28%,
      rgba(var(--card-theme-bright), 0.34) 0%,
      rgba(var(--card-theme-main), 0.12) 38%,
      transparent 64%
    ),
    radial-gradient(
      circle at 78% 82%,
      rgba(var(--card-theme-main), 0.22) 0%,
      transparent 58%
    );
  animation: cardThemeFlowA 12s ease-in-out infinite alternate;
}

.game-card-body::after {
  background:
    radial-gradient(
      circle at 82% 18%,
      rgba(var(--card-theme-bright), 0.28) 0%,
      rgba(var(--card-theme-main), 0.08) 35%,
      transparent 62%
    ),
    radial-gradient(
      circle at 16% 74%,
      rgba(var(--card-theme-deep), 0.22) 0%,
      transparent 56%
    );
  animation: cardThemeFlowB 15s ease-in-out infinite;
}

.game-card-body > * {
  position: relative;
  z-index: 1;
}

.game-card-actions {
  margin-top: auto;
}

.video-wrapper {
  line-height: 0;
}

.video-wrapper :is(video, img) {
  display: block;
}

.add-library-btn {
  border: 1px solid var(--games-ui-border);
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
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.filter-btn-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  display: inline-flex;
}

.option-chip-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  display: inline-flex;
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

@keyframes cardThemeFlowA {
  0% {
    transform: translate3d(-2%, -1%, 0) scale(0.98) rotate(-3deg);
  }
  100% {
    transform: translate3d(2%, 2%, 0) scale(1.06) rotate(3deg);
  }
}

@keyframes cardThemeFlowB {
  0% {
    transform: translate3d(2%, -2%, 0) scale(1.03) rotate(2deg);
  }
  50% {
    transform: translate3d(-2%, 1%, 0) scale(0.97) rotate(-2deg);
  }
  100% {
    transform: translate3d(1%, 3%, 0) scale(1.04) rotate(2deg);
  }
}
</style>
