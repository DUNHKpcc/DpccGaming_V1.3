<template>
  <div class="coding-mode-page">
    <header class="coding-mode-header">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-white/60 mb-1">Coding 模式</p>
        <h1 class="text-2xl font-bold text-white">{{ codingGame?.title || '加载中…' }}</h1>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="soft-btn"
          @click="reloadCodeBundle"
          :disabled="codeLoading"
        >
          <i :class="codeLoading ? 'fa fa-spinner fa-spin' : 'fa fa-rotate-right'"></i>
          <span>刷新源码</span>
        </button>
        <button class="soft-btn" @click="goBack">
          <i class="fa fa-arrow-left"></i>
          <span>返回</span>
        </button>
      </div>
    </header>

    <div class="coding-mode-grid">
      <!-- 左侧：游戏运行 -->
      <section class="coding-panel game-panel">
        <div class="panel-header">
          <div>
            <p class="panel-label">游戏运行</p>
            <h3 class="panel-title">实时体验</h3>
          </div>
          <span class="panel-subtle">竖屏窗口 • 自适应缩放</span>
        </div>
        <div class="game-stage">
          <div class="game-frame-box">
            <div v-if="gameLoading" class="game-placeholder">
              <i class="fa fa-spinner fa-spin text-2xl mb-2"></i>
              <p>正在加载游戏…</p>
            </div>
            <iframe
              v-else-if="gameLaunchUrl"
              :src="gameLaunchUrl"
              class="coding-game-frame"
              frameborder="0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
              allowfullscreen
            ></iframe>
            <div v-else class="game-placeholder">
              <i class="fa fa-exclamation-circle text-2xl mb-2"></i>
              <p>尚未配置游戏运行地址</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 中间：源码浏览 -->
      <section class="coding-panel code-panel">
        <div class="panel-header">
          <div>
            <p class="panel-label">源码浏览</p>
            <h3 class="panel-title">用户上传的游戏代码</h3>
          </div>
          <div class="code-actions">
            <input
              v-model="codeSearch"
              type="text"
              placeholder="搜索文件..."
              class="code-search"
            />
            <select v-model="selectedFilePath" class="code-file-selector">
              <option
                v-for="file in filteredFiles"
                :key="file.path"
                :value="file.path"
              >
                {{ file.path }}
              </option>
            </select>
            <button
              class="soft-btn"
              :disabled="!codingGame?.codePackageUrl"
              @click="downloadFullCode"
            >
              <i class="fa fa-file-zipper"></i>
              <span>下载源码</span>
            </button>
          </div>
        </div>
        <div class="code-content" v-if="codeLoading">
          <div class="code-placeholder">
            <i class="fa fa-spinner fa-spin text-2xl mb-2"></i>
            <p>正在加载源码…</p>
          </div>
        </div>
        <div class="code-content" v-else-if="selectedFile">
          <div class="code-meta">
            <span class="file-name">{{ selectedFile.path }}</span>
            <button class="soft-btn" @click="copyCode">
              <i class="fa fa-copy"></i>
              <span>复制</span>
            </button>
          </div>
          <pre class="code-view"><code>{{ selectedFile.content }}</code></pre>
        </div>
        <div class="code-content" v-else>
          <div class="code-placeholder">
            <i class="fa fa-code text-2xl mb-2"></i>
            <p>暂未找到任何源码文件，请先在“添加游戏”时上传代码包。</p>
          </div>
        </div>
      </section>

      <!-- 右侧：AI 助手 -->
      <section class="coding-panel ai-panel">
        <div class="panel-header">
          <div>
            <p class="panel-label">AI 助手</p>
            <h3 class="panel-title">解读与答疑</h3>
          </div>
          <span class="panel-subtle">可查看源码上下文</span>
        </div>
        <div class="chat-thread" ref="chatThreadRef">
          <div
            v-for="(message, index) in chatMessages"
            :key="index"
            class="chat-message"
            :class="message.role"
          >
            <div class="bubble">
              <p>{{ message.text }}</p>
              <small>{{ message.timestamp }}</small>
            </div>
          </div>
        </div>
        <form class="chat-input" @submit.prevent="sendMessage">
          <textarea
            v-model="userInput"
            rows="3"
            placeholder="向 AI 咨询实现原理、BUG 或优化建议…"
          ></textarea>
          <button class="soft-btn primary" type="submit" :disabled="aiLoading || !userInput.trim()">
            <i :class="aiLoading ? 'fa fa-spinner fa-spin' : 'fa fa-paper-plane'"></i>
            <span>{{ aiLoading ? '思考中...' : '发送' }}</span>
          </button>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useNotificationStore } from '../stores/notification'
import { resolveMediaUrl } from '../utils/media'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const notificationStore = useNotificationStore()

const gameId = computed(() => route.params.id?.toString())
const codingGame = ref(null)
const gameLoading = ref(true)
const codeFiles = ref([])
const codeLoading = ref(false)
const codeSearch = ref('')
const selectedFilePath = ref('')
const userInput = ref('')
const aiLoading = ref(false)
const chatThreadRef = ref(null)

const chatMessages = ref([
  {
    role: 'assistant',
    text: '欢迎来到 Coding 模式，我可以结合源码帮助你理解这款游戏的实现方式。',
    timestamp: new Date().toLocaleTimeString()
  }
])

const filteredFiles = computed(() => {
  if (!codeSearch.value.trim()) return codeFiles.value
  const keyword = codeSearch.value.trim().toLowerCase()
  return codeFiles.value.filter(file => file.path.toLowerCase().includes(keyword))
})

const selectedFile = computed(() =>
  codeFiles.value.find(file => file.path === selectedFilePath.value) || null
)

const gameLaunchUrl = computed(() => {
  if (!codingGame.value) return ''
  const rawUrl =
    codingGame.value.launch_url ||
    codingGame.value.game_url ||
    codingGame.value.gameLaunchUrl ||
    `games/${codingGame.value.game_id || codingGame.value.id}/index.html`
  return resolveMediaUrl(rawUrl)
})

const goBack = () => {
  router.back()
}

const detectLanguage = (path = '') => {
  const ext = path.split('.').pop()?.toLowerCase()
  if (['ts', 'tsx'].includes(ext)) return 'typescript'
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript'
  if (['vue'].includes(ext)) return 'vue'
  if (['css', 'scss', 'less'].includes(ext)) return 'css'
  if (['html', 'htm'].includes(ext)) return 'html'
  if (['json'].includes(ext)) return 'json'
  return 'text'
}

const normalizeCodeResponse = (payload) => {
  const files = Array.isArray(payload?.files) ? payload.files : []
  return files.map(file => ({
    path: file.path || file.name,
    language: file.language || detectLanguage(file.path || file.name),
    content: file.content || ''
  }))
}

const loadGame = async () => {
  if (!gameId.value) return
  gameLoading.value = true
  try {
    if (!gameStore.gamesLoaded) {
      await gameStore.loadGames()
    }
    const existing = gameStore.getGameById(gameId.value) || await gameStore.loadGameById(gameId.value)
    codingGame.value = existing
  } catch (error) {
    notificationStore.error('加载游戏失败', error.message || '无法加载游戏')
  } finally {
    gameLoading.value = false
  }
}

const fetchCodeBundle = async () => {
  if (!gameId.value) return
  codeLoading.value = true
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/games/${gameId.value}/code`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : undefined
      }
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || '无法加载源码')
    }
    codeFiles.value = normalizeCodeResponse(data)
    selectedFilePath.value = codeFiles.value[0]?.path || ''
  } catch (error) {
    codeFiles.value = []
    selectedFilePath.value = ''
    notificationStore.warning('源码获取失败', error.message || '暂时无法加载源码文件')
  } finally {
    codeLoading.value = false
  }
}

const reloadCodeBundle = async () => {
  await fetchCodeBundle()
}

const downloadFullCode = () => {
  if (!codingGame.value?.codePackageUrl) {
    notificationStore.info('暂无压缩包', '该游戏尚未上传源码压缩文件')
    return
  }
  window.open(resolveMediaUrl(codingGame.value.codePackageUrl), '_blank')
}

const copyCode = async () => {
  if (!selectedFile.value) return
  try {
    await navigator.clipboard.writeText(selectedFile.value.content)
    notificationStore.success('已复制', '源码内容已复制到剪贴板')
  } catch (error) {
    notificationStore.error('复制失败', error.message || '请检查浏览器权限')
  }
}

const appendMessage = (payload) => {
  chatMessages.value.push({
    ...payload,
    timestamp: new Date().toLocaleTimeString()
  })
  nextTick(() => {
    const el = chatThreadRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
}

const sendMessage = async () => {
  const content = userInput.value.trim()
  if (!content) return
  appendMessage({ role: 'user', text: content })
  userInput.value = ''
  aiLoading.value = true
  try {
    // TODO: 将下面的占位符替换为实际的 AI 服务端点与鉴权信息
    const response = await fetch('/api/ai/code-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${import.meta.env.VITE_AI_API_KEY}`
      },
      body: JSON.stringify({
        prompt: content,
        gameId: gameId.value,
        selectedFile: selectedFile.value?.path,
        fileContent: selectedFile.value?.content,
        files: codeFiles.value.map(file => ({ path: file.path, language: file.language }))
      })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'AI 服务暂不可用')
    }
    appendMessage({
      role: 'assistant',
      text: data.answer || data.message || 'AI 已收到请求，但没有返回具体内容。'
    })
  } catch (error) {
    appendMessage({
      role: 'assistant',
      text: `抱歉，调用 AI 失败：${error.message || '未知错误'}`
    })
  } finally {
    aiLoading.value = false
  }
}

watch(gameId, async () => {
  await loadGame()
  await fetchCodeBundle()
}, { immediate: true })
</script>

<style scoped>
.coding-mode-page {
  min-height: 100vh;
  background: radial-gradient(circle at top, rgba(108, 92, 231, 0.25), transparent 45%) #0f0f13;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.coding-mode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.soft-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.soft-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.soft-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.soft-btn.primary {
  background: linear-gradient(120deg, #8a7dff, #5dd8ff);
  border: none;
  color: #141414;
  font-weight: 600;
}

.coding-mode-grid {
  display: grid;
  grid-template-columns: 1.1fr 1.5fr 1fr;
  gap: 1.5rem;
}

.coding-panel {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  padding: 1.5rem;
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.panel-label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.6);
}

.panel-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
}

.panel-subtle {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
}

.game-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-frame-box {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  aspect-ratio: 9 / 16;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.45);
  position: relative;
}

.coding-game-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #000;
}

.game-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
  gap: 0.5rem;
}

.code-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.code-search,
.code-file-selector {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.9rem;
}

.code-content {
  flex: 1;
  min-height: 0;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  color: #f8f8f2;
  font-family: 'Fira Code', Consolas, monospace;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.code-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.file-name {
  font-weight: 600;
}

.code-view {
  flex: 1;
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
}

.code-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  gap: 0.5rem;
}

.chat-thread {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.5rem;
}

.chat-message {
  display: flex;
}

.chat-message.user {
  justify-content: flex-end;
}

.chat-message.assistant {
  justify-content: flex-start;
}

.chat-message .bubble {
  max-width: 90%;
  padding: 0.75rem 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 0.9rem;
}

.chat-message.user .bubble {
  background: linear-gradient(120deg, rgba(138, 125, 255, 0.9), rgba(93, 216, 255, 0.9));
  color: #161616;
  font-weight: 600;
}

.chat-message small {
  display: block;
  font-size: 0.7rem;
  opacity: 0.6;
  margin-top: 0.35rem;
}

.chat-input {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chat-input textarea {
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.8rem;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  resize: none;
}

@media (max-width: 1280px) {
  .coding-mode-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .coding-mode-page {
    padding: 1.25rem;
  }

  .coding-mode-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>
