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
        <!-- 筛选菜单部分：改为浮动滑块 -->
    <div 
      class="filter-menu flex gap-3 mb-4 bg-white/15 backdrop-blur-md rounded-xl p-3 inline-block"
    >
      <div class="filter-group">
        <button 
          class="filter-btn bg-primary/90 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:bg-primary"
          @click="openEngineSlider"
        >
          <i class="fa fa-cogs mr-2"></i>游戏引擎分类
        </button>
      </div>
      <div class="filter-group">
        <button 
          class="filter-btn bg-secondary/90 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:bg-secondary"
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
        @mouseleave="hideOverlay"
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
          :class="{
            'active': (currentSliderType === 'engine' && (selectedEngine === opt || (selectedEngine === 'all' && opt === '全部')))
                   || (currentSliderType === 'code' && (selectedCodeType === opt || (selectedCodeType === 'all' && opt === '全部')))
          }"
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
            class="game-card glass-card overflow-hidden hover:shadow-xl transition-all duration-300">
            <div class="relative group">
  
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
                <i class="fa fa-cogs mr-2"></i>
                <span>游戏引擎: {{ game.engine || game.gameEngine || 'Cocos' }}</span>
                <i class="fa fa-code mr-2"></i>
                <span>游戏代码: {{ game.codeType || 'TypeScript' }}</span>
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
const engines = ['全部', 'UE5', 'Unity', 'Cocos', '其他']
const codeTypes = ['全部', 'TypeScript', 'JavaScript', 'HTML5', '其他']
const selectedEngine = ref('all')
const selectedCodeType = ref('all')
const filteredGames = ref([])

// 滑块/选项条状态
const sliderVisible = ref(false)
const currentSliderType = ref('engine') // 'engine' | 'code'
const currentOptions = ref([])
const overlay = ref({ x: 0, y: 0, w: 0, h: 0, visible: false })

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

// 应用所有筛选条件
const applyFilters = () => {
  filteredGames.value = games.value.filter(game => {
    const engineMatch = selectedEngine.value === 'all' || 
                       game.engine === selectedEngine.value || 
                       game.gameEngine === selectedEngine.value
    const codeMatch = selectedCodeType.value === 'all' || 
                      game.codeType === selectedCodeType.value || 
                      game.code_category === selectedCodeType.value
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
    return
  }
  const chipRect = chip.getBoundingClientRect()
  overlay.value = {
    x: chipRect.left - containerRect.left,
    y: chipRect.top - containerRect.top,
    w: chipRect.width,
    h: chipRect.height,
    visible: true
  }
}

const hideOverlay = () => {
  overlay.value.visible = false
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
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.35);
  overflow: hidden;
}

.options-bar.is-engine { background: rgba(59,130,246,0.18); }
.options-bar.is-code { background: rgba(16,185,129,0.18); }

.option-chip {
  position: relative;
  white-space: nowrap;
  padding: 10px 16px;
  border-radius: 9999px;
  background: rgba(255,255,255,0.25);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  border: 1px solid rgba(255,255,255,0.35);
  transition: transform 160ms ease, background 160ms ease, box-shadow 160ms ease;
}

.option-chip:hover { 
  transform: translateY(-1px);
  background: rgba(255,255,255,0.35);
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
}

.option-chip.active {
  background: rgba(255,255,255,0.5);
  color: #111827;
}

.glass-overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  border-radius: 9999px;
  background: rgba(255,255,255,0.22);
  backdrop-filter: blur(18px) saturate(120%);
  -webkit-backdrop-filter: blur(18px) saturate(120%);
  border: 1px solid rgba(255,255,255,0.4);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  transition: transform 140ms ease, width 140ms ease, height 140ms ease, opacity 160ms ease;
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