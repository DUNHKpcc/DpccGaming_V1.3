<template>
  <div v-if="isOpen" 
    class="fixed inset-0 z-[9999] flex items-center justify-center p-4 opacity-100 pointer-events-auto transition-opacity duration-300"
    @click="handleBackdropClick">
    <div class="absolute inset-0 bg-black/50"></div>
    <div
      class="relative game-modal-surface rounded-2xl shadow-2xl w-full md:w-[96vw] lg:w-[85vw] max-w-none h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] mt-[90px] mb-[20px] flex flex-col transform scale-100 transition-transform duration-300 overflow-hidden"
      @click.stop>
      <div class="flex justify-between items-center p-6 game-modal-header">
        <div class="min-w-0">
          <h3 class="text-2xl font-bold text-white">{{ currentGame?.title || '游戏标题' }}</h3>
          <div
            v-if="currentGame && (getEngineLogo(currentGame) || getCodeLogo(currentGame))"
            class="flex items-center gap-4 mt-2 text-sm text-white/80"
          >
            <span v-if="getEngineLogo(currentGame)" class="inline-flex items-center gap-2">
              <img :src="getEngineLogo(currentGame)" alt="游戏引擎" class="w-4 h-4 object-contain" />
              <span>{{ currentGame.engine || currentGame.game_engine || '未知引擎' }}</span>
            </span>
            <span v-if="getCodeLogo(currentGame)" class="inline-flex items-center gap-2">
              <img :src="getCodeLogo(currentGame)" alt="游戏代码" class="w-4 h-4 object-contain" />
              <span>{{ currentGame.code_type || currentGame.codeType || '未知代码' }}</span>
            </span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button @click="enterFullscreen" 
                  class="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white px-4 py-2 rounded-xl text-sm transition-all duration-300 flex items-center gap-2"
                  title="全屏游戏">
            <i class="fa fa-expand"></i>
            <span>全屏</span>
          </button>
          <button @click="enterCodingMode" 
                  class="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white px-4 py-2 rounded-xl text-sm transition-all duration-300 flex items-center gap-2"
                  title="进入编程模式">
            <i class="fa fa-code"></i>
            <span>Coding</span>
          </button>
          <button @click="closeModal" class="text-white/80 hover:text-white text-2xl transition-colors duration-300">
            <i class="fa fa-times"></i>
          </button>
        </div>
      </div>

      <div class="flex flex-col md:flex-row flex-1 h-full overflow-y-auto md:overflow-hidden min-h-0">
        <!-- 游戏区域 -->
        <div class="md:flex-[7] game-modal-game-pane flex flex-col items-center justify-center p-4 overflow-hidden rounded-2xl md:rounded-tl-none md:rounded-bl-2xl md:rounded-tr-none md:rounded-br-none h-full min-h-0">
          <div class="game-frame-wrapper">
            <div v-if="gameLoading" class="game-loading-overlay">
              <div class="text-center">
                <i class="fa fa-gamepad text-6xl text-white/30 mb-4"></i>
                <p class="text-white/80">正在加载游戏...</p>
              </div>
            </div>
            <iframe 
              v-else-if="currentGame"
              :src="gameLaunchUrl"
              class="game-modal-iframe"
              frameborder="0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"
              allowfullscreen
              @load="onGameFrameLoad"
              @click="focusGameFrame"
              tabindex="0">
            </iframe>
          </div>
        </div>

        <!-- 评论区域 -->
        <div class="md:flex-[3] game-modal-comments-pane h-full rounded-2xl md:rounded-tl-none md:rounded-bl-none md:rounded-tr-2xl md:rounded-br-2xl mt-4 md:mt-0 min-h-0 flex flex-col overflow-hidden">
          <div class="p-6 flex flex-col h-full min-h-0">
            <CommentSection
              v-if="currentGame"
              target-type="game"
              :target-id="currentGame.game_id || currentGame.id"
              title="评论&评价"
              :enable-rating="true"
              :close-before-login="true"
              :listen-for-scroll-events="true"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useModalStore } from '../stores/modal'
import { setupGameEventHandling, focusGameIframe } from '../utils/gameEvents'
import { resolveMediaUrl } from '../utils/media'
import CommentSection from './CommentSection.vue'

const modalStore = useModalStore()
const router = useRouter()

const isOpen = computed(() => modalStore.activeModal === 'game')
const currentGame = computed(() => modalStore.currentGame)
const getEngineLogo = (game) => {
  const engine = String(game?.engine || game?.game_engine || '').trim().toLowerCase()
  if (engine.includes('cocos')) return '/engineType/cocos.webp'
  if (engine.includes('unity')) return '/engineType/unity.webp'
  if (engine.includes('godot')) return '/engineType/godot.webp'
  return ''
}

const getCodeLogo = (game) => {
  const codeType = String(game?.code_type || game?.codeType || '').trim().toLowerCase()
  if (codeType === 'typescript' || codeType === 'ts') return '/codeType/typescript.jpg'
  if (codeType === 'javascript' || codeType === 'js') return '/codeType/js.webp'
  if (codeType === 'c#' || codeType === 'csharp' || codeType === 'cs') return '/codeType/csharp.webp'
  return ''
}

const gameLaunchUrl = computed(() => {
  if (!currentGame.value) return ''
  const rawUrl =
    currentGame.value.launch_url ||
    currentGame.value.game_url ||
    `games/${currentGame.value.game_id || currentGame.value.id}/index.html`
  return resolveMediaUrl(rawUrl)
})

const gameLoading = ref(true)
const gameFrame = ref(null) // 游戏iframe引用

const enterFullscreen = () => {
  if (currentGame.value) {
    modalStore.enterFullscreen(currentGame.value)
  }
}

const closeModal = () => {
  modalStore.closeModal()
}

// 进入编程模式
  const enterCodingMode = () => {
    if (currentGame.value) {
      closeModal()
      // 导航到CodingMode页面，传递游戏ID
      router.push({ name: 'CodingMode', params: { id: currentGame.value.game_id || currentGame.value.id } })
    }
  }

// 游戏iframe相关方法
const onGameFrameLoad = () => {
  gameLoading.value = false
  if (gameFrame.value) {
    // 设置游戏事件处理
    setupGameEventHandling(gameFrame.value, {
      enableKeyboardEvents: true,
      enableMouseEvents: true,
      enableGamepadEvents: true,
      debugMode: false // 生产环境设为false
    })
    
    // 确保iframe获得焦点
    setTimeout(() => {
      focusGameIframe(gameFrame.value)
    }, 100)
  }
}

// 让游戏iframe获得焦点
const focusGameFrame = () => {
  focusGameIframe(gameFrame.value)
}

watch(isOpen, (newVal) => {
  if (newVal && currentGame.value) {
    // 模拟游戏加载
    setTimeout(() => {
      gameLoading.value = false
    }, 1000)
  } else {
    gameLoading.value = true
  }
})
</script>

<style scoped>
.game-modal-surface {
  --gm-bg: #ffffff;
  --gm-pane: #f4f4f5;
  --gm-pane-strong: #ebebee;
  --gm-border: rgba(0, 0, 0, 0.16);
  --gm-text: #111111;
  --gm-text-80: rgba(17, 17, 17, 0.8);
  --gm-text-60: rgba(17, 17, 17, 0.6);
  --gm-text-30: rgba(17, 17, 17, 0.32);
  --gm-focus: rgba(0, 0, 0, 0.18);
  background: var(--gm-bg);
  color: var(--gm-text);
  border: 1px solid var(--gm-border);
}

html[data-theme="dark"] .game-modal-surface {
  --gm-bg: #0b0b0c;
  --gm-pane: #151517;
  --gm-pane-strong: #1d1d20;
  --gm-border: rgba(255, 255, 255, 0.18);
  --gm-text: #f5f5f5;
  --gm-text-80: rgba(245, 245, 245, 0.82);
  --gm-text-60: rgba(245, 245, 245, 0.62);
  --gm-text-30: rgba(245, 245, 245, 0.35);
  --gm-focus: rgba(255, 255, 255, 0.25);
}

.game-modal-header {
  border-bottom: 1px solid var(--gm-border);
}

.game-modal-game-pane {
  background: var(--gm-pane);
}

.game-modal-comments-pane {
  border-left: 1px solid var(--gm-border);
  background: var(--gm-pane);
}

.game-modal-surface .bg-white\/5,
.game-modal-surface .bg-white\/10,
.game-modal-surface .bg-white\/20 {
  background: var(--gm-pane-strong) !important;
}

.game-modal-surface .hover\:bg-white\/30:hover {
  background: var(--gm-pane) !important;
}

.game-modal-surface .border-white\/20,
.game-modal-surface .border-white\/30 {
  border-color: var(--gm-border) !important;
}

.game-modal-surface .backdrop-blur-sm,
.game-modal-surface .backdrop-blur-xl {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}

.game-modal-surface .text-white {
  color: var(--gm-text) !important;
}

.game-modal-surface .text-white\/80 {
  color: var(--gm-text-80) !important;
}

.game-modal-surface .text-white\/60 {
  color: var(--gm-text-60) !important;
}

.game-modal-surface .text-white\/30 {
  color: var(--gm-text-30) !important;
}

.game-modal-surface .hover\:text-white:hover {
  color: var(--gm-text) !important;
}

.game-modal-surface .hover\:text-white\/80:hover {
  color: var(--gm-text-80) !important;
}

.game-modal-surface .placeholder-white\/60::placeholder {
  color: var(--gm-text-60) !important;
}

.game-modal-surface textarea:focus {
  border-color: var(--gm-border) !important;
  box-shadow: 0 0 0 2px var(--gm-focus) !important;
}

.comment-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.comment-user {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.comment-user-main {
  flex: 1;
}

.comment-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-width: 0;
}

.comment-username {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-rating {
  flex-shrink: 0;
  white-space: nowrap;
}

.comment-avatar,
.reply-avatar {
  border-radius: 9999px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--gm-border);
}

.comment-avatar {
  width: 28px;
  height: 28px;
}

.reply-avatar {
  width: 22px;
  height: 22px;
}

/* 评论高亮样式 */
.highlight-comment {
  background: rgba(108, 92, 231, 0.3) !important;
  border: 3px solid rgba(108, 92, 231, 0.8) !important;
  border-radius: 12px !important;
  padding: 12px !important;
  box-shadow: 0 0 20px rgba(108, 92, 231, 0.5) !important;
  animation: highlight-pulse 2s ease-in-out;
  transition: all 0.3s ease !important;
}

/* 回复高亮样式 - 更明显 */
[id^="reply-"].highlight-comment {
  background: rgba(255, 193, 7, 0.3) !important;
  border: 3px solid rgba(255, 193, 7, 0.9) !important;
  border-radius: 8px !important;
  padding: 8px !important;
  box-shadow: 0 0 25px rgba(255, 193, 7, 0.6) !important;
  animation: highlight-pulse-reply 2s ease-in-out !important;
}

/* 更具体的选择器确保回复高亮生效 */
div[id^="reply-"].highlight-comment {
  background: rgba(255, 193, 7, 0.3) !important;
  border: 3px solid rgba(255, 193, 7, 0.9) !important;
  border-radius: 8px !important;
  padding: 8px !important;
  box-shadow: 0 0 25px rgba(255, 193, 7, 0.6) !important;
  animation: highlight-pulse-reply 2s ease-in-out !important;
}

@keyframes highlight-pulse {
  0% { 
    transform: scale(1);
    box-shadow: 0 0 20px rgba(108, 92, 231, 0.5);
  }
  25% { 
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(108, 92, 231, 0.8);
  }
  50% { 
    transform: scale(1.02);
    box-shadow: 0 0 25px rgba(108, 92, 231, 0.6);
  }
  75% { 
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(108, 92, 231, 0.8);
  }
  100% { 
    transform: scale(1);
    box-shadow: 0 0 20px rgba(108, 92, 231, 0.5);
  }
}

@keyframes highlight-pulse-reply {
  0% { 
    transform: scale(1);
    box-shadow: 0 0 25px rgba(255, 193, 7, 0.6);
  }
  25% { 
    transform: scale(1.08);
    box-shadow: 0 0 35px rgba(255, 193, 7, 0.9);
  }
  50% { 
    transform: scale(1.03);
    box-shadow: 0 0 30px rgba(255, 193, 7, 0.7);
  }
  75% { 
    transform: scale(1.08);
    box-shadow: 0 0 35px rgba(255, 193, 7, 0.9);
  }
  100% { 
    transform: scale(1);
    box-shadow: 0 0 25px rgba(255, 193, 7, 0.6);
  }
}

.game-frame-wrapper {
  position: relative;
  width: 100%;
  max-width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.game-modal-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 16px;
  min-height: 0;
  outline: none;
  /* 确保iframe可以接收焦点和事件 */
  pointer-events: auto;
}
</style>
