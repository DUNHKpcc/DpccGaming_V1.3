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
        <div class="creator-badge">
          <img
            class="creator-avatar"
            :src="creatorAvatarUrl"
            :alt="creatorName"
            @error="onAvatarError"
          />
          <span class="creator-name">
            <span class="creator-name-text">制作人：{{ creatorName }}</span>
            <UserLevelBadge :user-id="creatorUserId" />
          </span>
        </div>
        <div class="meta-chip">
          <img v-if="engineIcon" :src="engineIcon" alt="游戏引擎" class="meta-icon" />
          <span>游戏引擎: {{ engineLabel }}</span>
        </div>
        <div class="meta-chip">
          <img v-if="codeTypeIcon" :src="codeTypeIcon" alt="游戏代码" class="meta-icon" />
          <span>游戏代码: {{ codeTypeLabel }}</span>
        </div>
         <div class="meta-chip">
          <i class="fa-brands fa-github"></i>
          <span>GitHub</span>
        </div>
      </div>
      <div class="header-actions flex items-center gap-3">
        <select v-model="selectedFilePath" class="code-file-selector header-file-selector">
          <option
            v-for="file in filteredFiles"
            :key="file.path"
            :value="file.path"
          >
            {{ file.path }}
          </option>
        </select>
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
          </div>
        </div>
        <div class="code-content">
          <div class="code-content-header">
            <span
              class="file-name"
              :title="selectedFile?.path || '未选择源码文件'"
            >
              {{ selectedFile?.path || '未选择源码文件' }}
            </span>
            <div class="code-actions">
              <button
                class="soft-btn icon-only"
                type="button"
                @click="openSearchPrompt"
                :aria-label="codeSearch.trim() ? `当前搜索：${codeSearch}` : '搜索源码文件'"
                :title="codeSearch.trim() ? `搜索中：${codeSearch}` : '搜索源码文件'"
              >
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
              <button
                class="soft-btn icon-only"
                :disabled="!selectedFile"
                @click="copyCode"
                aria-label="复制当前文件代码"
                title="复制当前文件代码"
              >
                <i class="fa-solid fa-copy"></i>
              </button>
              <button
                class="soft-btn icon-only"
                :disabled="!codingGame?.codePackageUrl"
                @click="downloadFullCode"
                aria-label="下载源码压缩包"
                title="下载源码压缩包"
              >
                <i class="fa-solid fa-download"></i>
              </button>
            </div>
          </div>
          <div class="code-body" v-if="codeLoading">
            <div class="code-placeholder">
              <i class="fa fa-spinner fa-spin text-2xl mb-2"></i>
              <p>正在加载源码…</p>
            </div>
          </div>
          <template v-else-if="selectedFile">
            <pre class="code-view">
              <code
                class="hljs"
                v-html="highlightedCode"
              ></code>
            </pre>
          </template>
          <div class="code-body" v-else>
            <div class="code-placeholder">
              <i class="fa fa-code text-2xl mb-2"></i>
              <p>暂未找到任何源码文件，请先在“添加游戏”时上传代码包。</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧：AI 助手 -->
      <section class="coding-panel ai-panel">
        <div class="panel-header">
          <div>
            <p class="panel-label">AI 助手</p>
          </div>
          <span class="panel-subtle">可查看源码上下文</span>
        </div>
        <div class="chat-thread" ref="chatThreadRef">
          <div
            v-for="(message, index) in chatMessages"
            :key="index"
            class="chat-message-row"
            :class="message.role === 'user' ? 'mine' : 'theirs'"
          >
            <div class="chat-message-thread" :class="message.role === 'user' ? 'mine' : 'theirs'">
              <span class="chat-sender-name">
                <span class="chat-sender-text">{{ message.senderName || (message.role === 'user' ? currentUserName : assistantName) }}</span>
                <UserLevelBadge v-if="message.senderUserId" :user-id="message.senderUserId" />
              </span>
              <div class="chat-message-main">
                <img
                  v-if="message.role !== 'user'"
                  class="chat-avatar"
                  :src="message.avatarUrl || assistantAvatarUrl"
                  :alt="message.senderName || assistantName"
                  @error="onAvatarError"
                />
                <div class="bubble" :class="{ pending: message.thinking }">
                  <div class="bubble-content">
                    <i v-if="message.thinking" class="fa fa-spinner fa-spin text-xs"></i>
                    <p>{{ message.text }}</p>
                  </div>
                  <small v-if="!message.thinking">{{ message.timestamp }}</small>
                </div>
                <img
                  v-if="message.role === 'user'"
                  class="chat-avatar"
                  :src="message.avatarUrl || currentUserAvatarUrl"
                  :alt="message.senderName || currentUserName"
                  @error="onAvatarError"
                />
              </div>
            </div>
          </div>
        </div>
        <form class="chat-input" @submit.prevent="sendMessage">
          <div class="chat-composer">
            <div class="composer-header">
              <div class="context-pill" :class="{ muted: !selectedFile }">
                <i class="fa fa-paperclip"></i>
                <span class="context-name" :title="selectedFile?.path || '未选择源码文件'">
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
import { ref, computed, watch, nextTick, onMounted } from 'vue'
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
import { getAvatarUrl, handleAvatarError } from '../utils/avatar'
import UserLevelBadge from '../components/UserLevelBadge.vue'

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
const DEFAULT_ASSISTANT_AVATAR = '/Ai/DouBaoSeed1.6.png'
const gameFrameRef = ref(null)
let gameFrameMeasureAttempts = 0
let lastGameFrameWidth = 0
let lastGameFrameHeight = 0
const pendingAssistantIndex = ref(null)
const modelDropdownOpen = ref(false)
const currentUserId = ref(null)
const currentUserName = ref('你')
const currentUserAvatarUrl = ref(getAvatarUrl(''))
const selectedModelOption = computed(() =>
  modelOptions.find(item => item.value === selectedModel.value) || modelOptions[0]
)
const assistantAvatarUrl = computed(() => selectedModelOption.value?.image || DEFAULT_ASSISTANT_AVATAR)
const assistantName = computed(() => `AI · ${selectedModelOption.value?.label || '助手'}`)
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
const creatorName = computed(() =>
  (codingGame.value?.uploaded_by_username
    || codingGame.value?.uploadedByUsername
    || '匿名开发者')
    .toString()
    .trim()
)
const creatorUserId = computed(() => {
  const value = codingGame.value?.uploaded_by_id ?? codingGame.value?.uploadedById
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})
const creatorAvatarUrl = computed(() =>
  getAvatarUrl(
    codingGame.value?.uploaded_by_avatar_url
    || codingGame.value?.uploadedByAvatarUrl
    || ''
  )
)

const chatMessages = ref([
  {
    role: 'assistant',
    senderName: assistantName.value,
    avatarUrl: assistantAvatarUrl.value,
    text: '欢迎来到 Coding 模式，我可以结合源码帮助你理解这款游戏的实现方式。',
    timestamp: new Date().toLocaleTimeString()
  }
])

const readCurrentUserProfile = () => {
  if (typeof window === 'undefined') return
  try {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null')
    const parsedUserId = Number.parseInt(user?.id, 10)
    currentUserId.value = Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null
    currentUserName.value = String(user?.username || user?.nickname || '你').trim() || '你'
    currentUserAvatarUrl.value = getAvatarUrl(user?.avatar_url || user?.avatar || '')
  } catch (error) {
    currentUserId.value = null
    currentUserName.value = '你'
    currentUserAvatarUrl.value = getAvatarUrl('')
  }
}

const onAvatarError = (event) => {
  handleAvatarError(event)
}

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

const openSearchPrompt = () => {
  if (typeof window === 'undefined') return
  const nextKeyword = window.prompt('输入要筛选的文件名关键词（留空可清除搜索）', codeSearch.value || '')
  if (nextKeyword === null) return
  codeSearch.value = String(nextKeyword || '').trim()
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
  const role = payload?.role === 'user' ? 'user' : 'assistant'
  const defaultSender = role === 'user'
    ? { senderName: currentUserName.value, avatarUrl: currentUserAvatarUrl.value, senderUserId: currentUserId.value }
    : { senderName: assistantName.value, avatarUrl: assistantAvatarUrl.value }

  chatMessages.value.push({
    ...defaultSender,
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

onMounted(() => {
  readCurrentUserProfile()
})
</script>

<style scoped>
.coding-mode-page {
  --coding-bg: #000000;
  --coding-text: #ffffff;
  --coding-text-soft: rgba(255, 255, 255, 0.62);
  --coding-text-subtle: rgba(255, 255, 255, 0.55);
  --coding-chip-bg: rgba(255, 255, 255, 0.1);
  --coding-chip-border: rgba(255, 255, 255, 0.18);
  --coding-chip-text: rgba(255, 255, 255, 0.85);
  --coding-panel-bg: #0b0b0c;
  --coding-panel-border: rgba(255, 255, 255, 0.2);
  --coding-frame-bg: #000000;
  --coding-frame-border: rgba(255, 255, 255, 0.25);
  --coding-control-bg: rgba(255, 255, 255, 0.08);
  --coding-control-border: rgba(255, 255, 255, 0.18);
  --coding-control-text: #f6f8fb;
  --coding-control-placeholder: rgba(255, 255, 255, 0.55);
  --coding-ui-bg: #ffffff;
  --coding-ui-bg-hover: #f5f5f5;
  --coding-ui-text: #111111;
  --coding-ui-border: rgba(255, 255, 255, 0.28);
  --coding-code-bg: #101012;
  --coding-code-border: rgba(255, 255, 255, 0.12);
  --coding-code-text: #e8edf2;
  --coding-chat-assistant-bg: rgba(255, 255, 255, 0.12);
  --coding-chat-assistant-border: rgba(255, 255, 255, 0.15);
  --coding-chat-assistant-text: #ffffff;
  --coding-chat-user-bg: #ffffff;
  --coding-chat-user-text: #161616;
  --coding-dropdown-bg: #0f1116;
  --coding-dropdown-hover: rgba(255, 255, 255, 0.08);
  --coding-option-sub: rgba(255, 255, 255, 0.55);
  --coding-option-check: #8fe3c9;
  --coding-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  height: 100dvh;
  min-height: 100vh;
  background: var(--coding-bg);
  color: var(--coding-text);
  padding: 1rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: hidden;
  box-sizing: border-box;
}

@supports not (height: 100dvh) {
  .coding-mode-page {
    height: 100vh;
  }
}

[data-theme='light'] .coding-mode-page {
  --coding-bg: #ffffff;
  --coding-text: #111111;
  --coding-text-soft: rgba(17, 17, 17, 0.64);
  --coding-text-subtle: rgba(17, 17, 17, 0.55);
  --coding-chip-bg: rgba(17, 17, 17, 0.06);
  --coding-chip-border: rgba(17, 17, 17, 0.15);
  --coding-chip-text: rgba(17, 17, 17, 0.85);
  --coding-panel-bg: #ffffff;
  --coding-panel-border: rgba(17, 17, 17, 0.16);
  --coding-frame-bg: #f7f7f8;
  --coding-frame-border: rgba(17, 17, 17, 0.16);
  --coding-control-bg: rgba(17, 17, 17, 0.04);
  --coding-control-border: rgba(17, 17, 17, 0.16);
  --coding-control-text: #111111;
  --coding-control-placeholder: rgba(17, 17, 17, 0.48);
  --coding-ui-bg: #111111;
  --coding-ui-bg-hover: #262626;
  --coding-ui-text: #ffffff;
  --coding-ui-border: rgba(17, 17, 17, 0.2);
  --coding-code-bg: #f3f4f6;
  --coding-code-border: rgba(17, 17, 17, 0.14);
  --coding-code-text: #111111;
  --coding-chat-assistant-bg: #f3f4f6;
  --coding-chat-assistant-border: rgba(17, 17, 17, 0.14);
  --coding-chat-assistant-text: #111111;
  --coding-chat-user-bg: #111111;
  --coding-chat-user-text: #ffffff;
  --coding-dropdown-bg: #ffffff;
  --coding-dropdown-hover: rgba(17, 17, 17, 0.06);
  --coding-option-sub: rgba(17, 17, 17, 0.55);
  --coding-option-check: #0f766e;
  --coding-shadow: 0 12px 24px rgba(17, 17, 17, 0.12);
}

.coding-mode-page .text-white {
  color: var(--coding-text) !important;
}

.coding-mode-page .text-white\/60 {
  color: var(--coding-text-soft) !important;
}

.coding-mode-header {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
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

.creator-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.2rem 0.45rem 0.2rem 0.2rem;
  border-radius: 999px;
  background: var(--coding-chip-bg);
  border: 1px solid var(--coding-chip-border);
  max-width: 100%;
}

.creator-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--coding-chip-border);
  flex-shrink: 0;
}

.creator-name {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  line-height: 1.1;
  color: var(--coding-chip-text);
  overflow: hidden;
  max-width: 210px;
}

.creator-name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-meta {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.6rem;
  min-width: 0;
  justify-self: start;
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
  background: var(--coding-chip-bg);
  border: 1px solid var(--coding-chip-border);
  color: var(--coding-chip-text);
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
  background: var(--coding-ui-bg);
  border: 1px solid var(--coding-ui-border);
  color: var(--coding-ui-text);
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
  background: var(--coding-ui-bg);
  border: 1px solid var(--coding-ui-border);
  color: var(--coding-ui-text);
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 480;
  white-space: nowrap;
  transition: all 0.2s ease;
  font-weight: 550;
}


.soft-btn:hover:not(:disabled) {
  background: var(--coding-ui-bg-hover);
  color: var(--coding-ui-text);
  border-color: var(--coding-ui-border);
  transform: translateY(-1px);
}

.soft-btn-Chinese:hover:not(:disabled) {
  background: var(--coding-ui-bg-hover);
  color: var(--coding-ui-text);
  border-color: var(--coding-ui-border);
  transform: translateY(-1px);
}

.soft-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.soft-btn.icon-only {
  width: 42px;
  min-width: 42px;
  max-width: 42px;
  height: 42px;
  padding: 0;
  justify-content: center;
}

.soft-btn.primary {
  background: var(--coding-ui-bg);
  border: none;
  color: var(--coding-ui-text);
  font-weight: 600;
}

.coding-mode-grid {
  display: grid;
  grid-template-columns: 1fr 1.85fr 0.8fr;
  grid-template-rows: 1fr;
  grid-auto-rows: 1fr;
  gap: 1rem;
  flex: 1;
  height: 100%;
  min-height: 0;
}

.coding-panel {
  background: var(--coding-panel-bg);
  border: 1px solid var(--coding-panel-border);
  border-radius: 6px;
  padding: 0.5rem;
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
  gap: 0.75rem;
  margin-bottom: 0.25rem;
  min-width: 0;
}

.panel-header > div:first-child {
  min-width: 0;
}

.panel-label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.65rem;
  color: var(--coding-text-soft);
  white-space: nowrap;
}

.panel-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--coding-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-subtle {
  font-size: 0.8rem;
  color: var(--coding-text-subtle);
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
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--coding-frame-border);
  background: var(--coding-frame-bg);
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
  background: var(--coding-frame-bg);
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
  color: var(--coding-text);
  gap: 0.5rem;
}

.code-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-left: auto;
  min-width: 0;
  width: auto;
}

.code-panel .panel-header {
  justify-content: flex-start;
}

.code-file-selector {
  background: var(--coding-ui-bg);
  border: 1px solid var(--coding-ui-border);
  color: var(--coding-ui-text);
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 42px;
  display: block;
  align-items: center;
  width: 100%;
  min-width: 160px;
  max-width: 420px;
  flex: 0 1 420px;
}

.header-file-selector {
  min-width: 220px;
  max-width: 360px;
  flex: 0 1 320px;
}

.code-actions .soft-btn {
  background: var(--coding-ui-bg);
  color: var(--coding-ui-text);
  border: 1px solid var(--coding-ui-border);
  border-radius: 999px;
  height: 42px;
  width: 42px;
  min-width: 42px;
  max-width: 42px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.code-actions .soft-btn:hover:not(:disabled) {
  background: var(--coding-ui-bg-hover);
  transform: none;
}

.code-content {
  flex: 1;
  min-height: 0;
  background: var(--coding-code-bg);
  border-radius: 6px;
  border: 1px solid var(--coding-code-border);
  padding: 0.5rem;
  color: var(--coding-code-text);
  font-family: 'Fira Code', Consolas, monospace;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.code-content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  min-height: 42px;
  min-width: 0;
}

.code-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.file-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
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
  color: var(--coding-code-text);
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
  color: var(--coding-text-soft);
  gap: 0.5rem;
}

.chat-thread {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.35rem;
  min-width: 0;
}

.chat-message-row {
  display: flex;
  min-width: 0;
}

.chat-message-row.theirs {
  justify-content: flex-start;
}

.chat-message-row.mine {
  justify-content: flex-end;
}

.chat-message-thread {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-width: 90%;
  min-width: 0;
}

.chat-message-thread.theirs {
  align-items: flex-start;
}

.chat-message-thread.mine {
  align-items: flex-end;
}

.chat-sender-name {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  line-height: 1.2;
  color: var(--coding-text-subtle);
  max-width: 100%;
  padding: 0;
}

.chat-sender-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-message-main {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  min-width: 0;
  max-width: 100%;
}

.chat-message-row.theirs .chat-sender-name {
  margin-left: calc(28px + 0.45rem);
}

.chat-message-row.mine .chat-sender-name {
  margin-right: calc(28px + 0.45rem);
}

.chat-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--coding-control-border);
  object-fit: cover;
  background: var(--coding-control-bg);
  flex-shrink: 0;
}

.chat-message-thread .bubble {
  max-width: 100%;
  padding: 0.65rem 0.8rem;
  border-radius: 14px;
  background: var(--coding-chat-assistant-bg);
  border: 1px solid var(--coding-chat-assistant-border);
  color: var(--coding-chat-assistant-text);
  font-size: 0.9rem;
  min-width: 0;
}

.chat-message-thread.theirs .bubble {
  border-top-left-radius: 6px;
}

.chat-message-thread.mine .bubble {
  border-top-right-radius: 6px;
}

.chat-message-thread .bubble-content {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
}

.chat-message-thread .bubble.pending {
  opacity: 0.9;
  font-style: italic;
}

.chat-message-thread .bubble p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.52;
}

.chat-message-row.mine .bubble {
  background: var(--coding-chat-user-bg);
  color: var(--coding-chat-user-text);
  border-color: transparent;
}

.chat-message-thread .bubble small {
  display: block;
  font-size: 0.7rem;
  opacity: 0.6;
  margin-top: 0.35rem;
}

.chat-input {
  margin-top: 1rem;
}

.chat-composer {
  border: 1px solid var(--coding-control-border);
  background: var(--coding-control-bg);
  border-radius: 6px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: var(--coding-shadow);
}

.composer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}

.context-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.65rem;
  border-radius: 10px;
  border: 1px dashed var(--coding-control-border);
  background: var(--coding-control-bg);
  color: var(--coding-control-text);
  min-width: 0;
  flex: 1;
  max-width: 100%;
}

.context-pill i {
  flex-shrink: 0;
}

.context-pill.muted {
  opacity: 0.65;
}

.context-name {
  display: block;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-tag {
  font-size: 0.75rem;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: var(--coding-control-bg);
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
  background: var(--coding-control-bg);
  border: 1px solid var(--coding-control-border);
  color: var(--coding-control-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.context-add:hover {
  background: var(--coding-control-bg);
  border-color: var(--coding-control-border);
}

.chat-textarea {
  width: 100%;
  border: none;
  padding: 0.5rem 0.15rem;
  background: transparent;
  color: var(--coding-control-text);
  resize: none;
  font-size: 1rem;
  line-height: 1.6;
  min-height: 68px;
}

.chat-textarea:focus {
  outline: none;
}

.chat-textarea::placeholder {
  color: var(--coding-control-placeholder);
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
  background: var(--coding-control-bg);
  border: 1px solid var(--coding-control-border);
  border-radius: 10px;
  color: var(--coding-control-text);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost-pill:hover {
  border-color: var(--coding-control-border);
  background: var(--coding-control-bg);
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
  background: var(--coding-dropdown-bg);
  border: 1px solid var(--coding-control-border);
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
  color: var(--coding-control-text);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-option:hover {
  background: var(--coding-dropdown-hover);
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
  color: var(--coding-option-sub);
}

.option-check {
  margin-left: auto;
  color: var(--coding-option-check);
}

.ghost-icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--coding-control-bg);
  border: 1px solid var(--coding-control-border);
  color: var(--coding-control-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost-icon:hover {
  border-color: var(--coding-control-border);
  background: var(--coding-control-bg);
}

.icon-btn {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid var(--coding-control-border);
  background: var(--coding-control-bg);
  color: var(--coding-control-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn.primary {
  background: var(--coding-ui-bg);
  border: none;
  color: var(--coding-ui-text);
  box-shadow: none;
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
    height: 100dvh;
    min-height: 100vh;
    overflow: hidden;
  }

  .coding-mode-grid {
    flex: none;
  }

  .coding-mode-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .header-meta {
    flex-wrap: wrap;
  }
}

@media (max-width: 1460px) {
  .header-file-selector {
    max-width: 320px;
    flex-basis: 320px;
  }
}

@media (max-width: 1100px) {
  .code-actions {
    margin-left: auto;
  }

  .header-file-selector {
    flex: 1 1 100%;
    max-width: none;
  }
}

@media (max-width: 768px) {
  .coding-mode-page {
    padding: 1.25rem;
  }

  .coding-mode-header {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
    gap: 1rem;
  }

  .chat-message-thread {
    max-width: 100%;
  }
}
</style>
