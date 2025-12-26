<template>
  <div class="coding-mode-page">
    <header class="coding-mode-header">
      <div class="header-left">
        <p class="text-xs uppercase tracking-[0.3em] text-white/60 mb-1">Coding 模式</p>
        <div class="title-row">
          <h1 class="text-2xl font-bold text-white">{{ codingGame?.title || '加载中…' }}</h1>
        </div>
      </div>
      <div class="header-meta">
        <div class="meta-chip">
          <img v-if="engineIcon" :src="engineIcon" alt="游戏引擎" class="meta-icon" />
          <span>游戏引擎: {{ engineLabel }}</span>
        </div>
        <div class="meta-chip">
          <img v-if="codeTypeIcon" :src="codeTypeIcon" alt="游戏代码" class="meta-icon" />
          <span>游戏代码: {{ codeTypeLabel }}</span>
        </div>
      </div>
      <div class="header-actions flex items-center gap-3">
        <button
          class="soft-btn-Chinese"
          @click="reloadCodeBundle"
          :disabled="codeLoading"
        >
          <i :class="codeLoading ? 'fa fa-spinner fa-spin' : 'fa fa-rotate-right'"></i>
          <span>刷新源码</span>
        </button>
        <button class="soft-btn-Chinese" @click="goBack">
          <i class="fa fa-arrow-left"></i>
          <span>返回</span>
        </button>
      </div>
    </header>

    <div class="coding-mode-grid">
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
            <div
              v-else-if="gameLaunchUrl"
              class="game-frame-inner"
            >
              <iframe
                :src="gameLaunchUrl"
                ref="gameFrameRef"
                class="coding-game-frame"
                frameborder="0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
                allowfullscreen
                @load="onGameFrameLoad"
              ></iframe>
            </div>
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
              <i class="fa-solid fa-download"></i>
              <span>Download</span>
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
              <i class="fa-solid fa-copy"></i>
              <span>Copy</span>
            </button>
          </div>
          <pre class="code-view">
            <code
              class="hljs"
              v-html="highlightedCode"
            ></code>
          </pre>
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
            <div class="bubble" :class="{ pending: message.thinking }">
              <div class="bubble-content">
                <i v-if="message.thinking" class="fa fa-spinner fa-spin text-xs"></i>
                <p>{{ message.text }}</p>
              </div>
              <small v-if="!message.thinking">{{ message.timestamp }}</small>
            </div>
          </div>
        </div>
        <form class="chat-input" @submit.prevent="sendMessage">
          <div class="chat-composer">
            <div class="composer-header">
              <div class="context-pill" :class="{ muted: !selectedFile }">
                <i class="fa fa-paperclip"></i>
                <span class="context-name">
                  {{ selectedFile?.path}}
                </span>
              </div>
            </div>
            <textarea
              v-model="userInput"
              rows="3"
              class="chat-textarea"
              placeholder="Describe what to build next"
            ></textarea>
            <div class="composer-footer">
              <div class="footer-left">
                <div class="model-inline" tabindex="0" @blur="modelDropdownOpen = false">
                  <button type="button" class="ghost-pill" @click="modelDropdownOpen = !modelDropdownOpen">
                    <img
                      v-if="selectedModelOption?.image"
                      :src="selectedModelOption.image"
                      alt=""
                      class="model-avatar"
                    />
                    <span>{{ selectedModelOption?.label || '????' }}</span>
                    <i class="fa fa-chevron-down"></i>
                  </button>
                  <div v-if="modelDropdownOpen" class="model-dropdown">
                    <button
                      v-for="option in modelOptions"
                      :key="option.value"
                      type="button"
                      class="model-option"
                      @mousedown.prevent="selectedModel = option.value; modelDropdownOpen = false"
                    >
                      <img v-if="option.image" :src="option.image" alt="" class="model-avatar" />
                      <div class="model-copy">
                        <span class="option-label">{{ option.label }}</span>
                        <small class="option-sub">{{ option.value }}</small>
                      </div>
                      <i v-if="selectedModel === option.value" class="fa fa-check option-check"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div class="footer-right">
                <button
                  class="icon-btn primary"
                  type="submit"
                  :disabled="aiLoading || !userInput.trim()"
                >
                  <i :class="aiLoading ? 'fa fa-spinner fa-spin' : 'fa fa-paper-plane'"></i>
                </button>
              </div>
            </div>
          </div>
        </form>

      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import { useGameStore } from '../stores/game'
import { useNotificationStore } from '../stores/notification'
import { resolveMediaUrl } from '../utils/media'

// 注册常用语言，覆盖当前页面需求
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('vue', xml)


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
const selectedModel = ref('doubao-seed-1-6-251015')
const modelOptions = [
  { label: 'DoubaoSeed 1.6', value: 'doubao-seed-1-6-251015', image: '/Ai/DouBaoSeed1.6.png' },
  { label: 'DeepSeekR1', value: 'doubao-seed-1-8-20241115', image: '/Ai/DeepSeekR1.png' },
  { label: '通用轻量模型', value: 'general-lite', image: '/Ai/DouBaoSeed1.6.png' }
]
const gameFrameRef = ref(null)
let gameFrameMeasureAttempts = 0
let lastGameFrameWidth = 0
let lastGameFrameHeight = 0
const pendingAssistantIndex = ref(null)
const modelDropdownOpen = ref(false)
const selectedModelOption = computed(() =>
  modelOptions.find(item => item.value === selectedModel.value) || modelOptions[0]
)
const getEngine = (game) =>
  (game?.engine || game?.game_engine || game?.gameEngine || '')
    .toString()
    .trim()
const getCodeType = (game) =>
  (game?.code_type || game?.codeType || game?.code_category || '')
    .toString()
    .trim()
const normalizeEngine = (val) => {
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
const normalizeCodeType = (val) => {
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
const engineLabel = computed(() => getEngine(codingGame.value) || '未知')
const codeTypeLabel = computed(() => getCodeType(codingGame.value) || '未知')
const engineIcon = computed(() => {
  const normalized = normalizeEngine(engineLabel.value)
  return normalized ? engineIconMap[normalized] || '' : ''
})
const codeTypeIcon = computed(() => {
  const normalized = normalizeCodeType(codeTypeLabel.value)
  return normalized ? codeTypeIconMap[normalized] || '' : ''
})

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

const highlightedCode = computed(() => {
  if (!selectedFile.value) return ''
  const lang = selectedFile.value.language || detectLanguage(selectedFile.value.path)
  const content = selectedFile.value.content || ''
  try {
    return hljs.highlight(content, { language: lang }).value
  } catch (error) {
    return hljs.highlightAuto(content).value
  }
})

const applyGameFrameScale = (nativeWidth, nativeHeight) => {
  const iframe = gameFrameRef.value
  if (!iframe || !nativeWidth || !nativeHeight) return
  const container = iframe.parentElement
  if (!container) return
  const rect = container.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const scale = Math.min(
    rect.width / nativeWidth,
    rect.height / nativeHeight,
    1
  )

  iframe.style.width = `${nativeWidth}px`
  iframe.style.height = `${nativeHeight}px`
  iframe.style.transformOrigin = 'center center'
  iframe.style.transform = `scale(${scale})`
}

const measureAndScaleGameFrame = () => {
  const iframe = gameFrameRef.value
  if (!iframe || gameFrameMeasureAttempts > 20) return

  gameFrameMeasureAttempts += 1

  try {
    const win = iframe.contentWindow
    const doc = win?.document
    const body = doc?.body
    const html = doc?.documentElement

    const nativeWidth = Math.max(
      win?.innerWidth || 0,
      html?.clientWidth || 0,
      body?.clientWidth || 0,
      body?.scrollWidth || 0,
      body?.offsetWidth || 0
    )

    const nativeHeight = Math.max(
      win?.innerHeight || 0,
      html?.clientHeight || 0,
      body?.clientHeight || 0,
      body?.scrollHeight || 0,
      body?.offsetHeight || 0
    )

    if (nativeWidth && nativeHeight) {
      // 只在尺寸变大时更新缩放，避免放大
      if (
        nativeWidth !== lastGameFrameWidth ||
        nativeHeight !== lastGameFrameHeight
      ) {
        lastGameFrameWidth = nativeWidth
        lastGameFrameHeight = nativeHeight
        applyGameFrameScale(nativeWidth, nativeHeight)
      }
    }
  } catch (error) {
    // 跨域等情况下直接让 iframe 自适应容器
    const iframeEl = gameFrameRef.value
    if (iframeEl) {
      iframeEl.style.width = '100%'
      iframeEl.style.height = '100%'
      iframeEl.style.transform = ''
    }
    return
  }

  // 在游戏初始化阶段连续测量几次，等分辨率稳定
  setTimeout(measureAndScaleGameFrame, 300)
}

const onGameFrameLoad = () => {
  gameFrameMeasureAttempts = 0
  lastGameFrameWidth = 0
  lastGameFrameHeight = 0
  measureAndScaleGameFrame()
}

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

const scrollChatToBottom = () => {
  nextTick(() => {
    const el = chatThreadRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
}

const appendMessage = (payload) => {
  chatMessages.value.push({
    ...payload,
    timestamp: new Date().toLocaleTimeString()
  })
  scrollChatToBottom()
}

const sanitizeAiText = (text = '') => {
  return text
    .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ''))
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[(.*?)\]\([^)]+\)/g, '$1')
    .trim()
}

const buildChatHistory = () =>
  chatMessages.value
    .filter(msg => !msg.thinking)
    .map(msg => ({ role: msg.role, text: msg.text }))

const buildPrompt = (question) => {
  return [
    question,
    '请根据问题自行判断是否需要结合代码回答；若问题与代码无关，请直接回答用户问题，不要强行围绕代码展开。',
    '输出使用简洁中文，不要带 Markdown 标题、列表符号或装饰符号。'
  ].join('\n\n')
}

const showThinkingMessage = () => {
  pendingAssistantIndex.value = chatMessages.value.length
  appendMessage({
    role: 'assistant',
    text: 'AI 正在思考...',
    thinking: true
  })
}

const resolveThinkingMessage = (text) => {
  const cleanText = sanitizeAiText(text || '')
  const index = pendingAssistantIndex.value
  if (index !== null && chatMessages.value[index]) {
    chatMessages.value[index] = {
      ...chatMessages.value[index],
      text: cleanText,
      thinking: false,
      timestamp: new Date().toLocaleTimeString()
    }
  } else {
    appendMessage({ role: 'assistant', text: cleanText })
  }
  pendingAssistantIndex.value = null
  scrollChatToBottom()
}

const sendMessage = async () => {
  const content = userInput.value.trim()
  if (!content) return
  const prompt = buildPrompt(content)
  appendMessage({ role: 'user', text: content })
  userInput.value = ''
  aiLoading.value = true
  showThinkingMessage()
  try {
    const response = await fetch('/api/ai/code-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${import.meta.env.VITE_AI_API_KEY}`
      },
      body: JSON.stringify({
        prompt,
        gameId: gameId.value,
        selectedFile: selectedFile.value?.path,
        fileContent: selectedFile.value?.content,
        files: codeFiles.value.map(file => ({ path: file.path, language: file.language })),
        model: selectedModel.value,
        history: buildChatHistory()
      })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'AI 服务暂不可用')
    }
    resolveThinkingMessage(
      data.answer || data.message || 'AI 已收到请求，但没有返回具体内容。'
    )
  } catch (error) {
    resolveThinkingMessage(
      `抱歉，调用 AI 失败：${error.message || '未知错误'}`
    )
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
  --navbar-height: 72px;
  height: calc(100vh - var(--navbar-height));
  background: black;
  padding: 1rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: hidden;
  box-sizing: border-box;
}

.coding-mode-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  column-gap: 1rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  min-width: 0;
  justify-self: center;
}

.header-actions {
  justify-self: end;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.75rem;
  white-space: nowrap;
}

.meta-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  display: inline-flex;
}

.soft-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: white;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: black;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.2s ease;
  font-family: 'Bebas Neue', cursive;
}

.soft-btn-Chinese {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: white;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: black;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 480;
  white-space: nowrap;
  transition: all 0.2s ease;
  font-weight: 550;
}


.soft-btn:hover:not(:disabled) {
  background: #f7f7f7;
  color: #111;
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
}

.soft-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.soft-btn.primary {
  background:white;
  border: none;
  color: #141414;
  font-weight: 600;
}

.coding-mode-grid {
  display: grid;
  grid-template-columns: 0.8fr 2fr 0.8fr;
  grid-template-rows: 1fr;
  grid-auto-rows: 1fr;
  gap: 1rem;
  flex: 1;
  height: 100%;
  min-height: 0;
}

.coding-panel {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0;
  padding: 0.5rem;
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.panel-label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.panel-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-subtle {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
}

.game-stage {
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

.game-frame-box {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  margin: 0 auto;
  border-radius: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.45);
  position: relative;
}

.game-frame-inner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.coding-game-frame {
  border: none;
  background: #000;
  display: block;
  width: 100%;
  height: 100%;
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
  flex-wrap: wrap;
  margin-left: auto;
}

.code-search,
.code-file-selector {
  background: #fff;
  border: 1px solid #ccc;
  color: #111;
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 42px;
  display: inline-flex;
  align-items: center;
}

.code-actions .soft-btn {
  background: #fff;
  color: #111;
  border: 1px solid #ccc;
  border-radius: 999px;
  height: 42px;
  padding: 0 1.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.code-actions .soft-btn:hover:not(:disabled) {
  background: #f5f5f5;
  transform: none;
}

.code-content {
  flex: 1;
  min-height: 0;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.5rem;
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
  margin-bottom: 0.25rem;
}

.file-name {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}

.code-view {
  flex: 1;
  overflow: auto;
  margin: 0;
  white-space: pre;
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 0;
}

:deep(.hljs) {
  display: block;
  padding: 0.75rem;
  line-height: 1.5;
  background: transparent;
  color: #e8edf2;
}

:deep(.hljs-comment),
:deep(.hljs-quote) {
  color: #6a9955;
}

:deep(.hljs-keyword),
:deep(.hljs-selector-tag),
:deep(.hljs-literal),
:deep(.hljs-name) {
  color: #c586c0;
}

:deep(.hljs-string),
:deep(.hljs-doctag),
:deep(.hljs-template-variable),
:deep(.hljs-meta .hljs-string) {
  color: #ce9178;
}

:deep(.hljs-title),
:deep(.hljs-section),
:deep(.hljs-type) {
  color: #4ec9b0;
}

:deep(.hljs-number),
:deep(.hljs-attr) {
  color: #b5cea8;
}

:deep(.hljs-attribute) {
  color: #9cdcfe;
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
  border-radius: 0;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 0.9rem;
}

.chat-message .bubble-content {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.chat-message .bubble.pending {
  opacity: 0.9;
  font-style: italic;
}

.chat-message .bubble p {
  margin: 0;
}

.chat-message.user .bubble {
  background: white;
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
}

.chat-composer {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.35));
  border-radius: 12px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}

.composer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.context-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.65rem;
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
  color: #e7edf5;
  min-width: 0;
  flex: 1;
}

.context-pill.muted {
  opacity: 0.65;
}

.context-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-tag {
  font-size: 0.75rem;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.context-add {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e7edf5;
  cursor: pointer;
  transition: all 0.2s ease;
}

.context-add:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.3);
}

.chat-textarea {
  width: 100%;
  border: none;
  padding: 0.5rem 0.15rem;
  background: transparent;
  color: #f6f8fb;
  resize: none;
  font-size: 1rem;
  line-height: 1.6;
  min-height: 68px;
}

.chat-textarea:focus {
  outline: none;
}

.chat-textarea::placeholder {
  color: rgba(255, 255, 255, 0.55);
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.ghost-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: #e7edf5;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost-pill:hover {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.12);
}

.model-inline {
  position: relative;
}

.model-avatar {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: cover;
}

.model-dropdown {
  position: absolute;
  bottom: calc(100% + 0.4rem);
  left: 0;
  background: #0f1116;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  min-width: 230px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  padding: 0.35rem;
  z-index: 10;
}

.model-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.55rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #e9efff;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-option:hover {
  background: rgba(255, 255, 255, 0.08);
}

.model-copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.option-label {
  font-weight: 600;
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-sub {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.55);
}

.option-check {
  margin-left: auto;
  color: #8fe3c9;
}

.ghost-icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e7edf5;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost-icon:hover {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.12);
}

.icon-btn {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #e7edf5;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn.primary {
  background:white;
  border: none;
  color: #0b0c10;
  box-shadow: 0 8px 20px rgba(38, 193, 242, 0.35);
}

.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.icon-btn:not(:disabled):hover {
  transform: translateY(-1px);
}

@media (max-width: 1280px) {
  .coding-mode-page {
    height: calc(100vh - var(--navbar-height));
    margin-top: var(--navbar-height);
    overflow: hidden;
  }

  .coding-mode-grid {
    flex: none;
  }

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

