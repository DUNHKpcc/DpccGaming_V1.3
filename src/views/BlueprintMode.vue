<template>
  <div class="blueprint-shell">
    <header class="blueprint-bar">
      <div class="bar-left">
        <span class="logo-dot"></span>
        <div>
          <div class="bar-title">蓝图模式 · 生成</div>
          <div class="bar-sub">组合现有游戏卡片，经 AI 生成你的新游戏</div>
        </div>
      </div>
      <div class="bar-actions">
        <button class="icon-button" title="保存草稿">
          <i class="fa fa-save"></i>
        </button>
        <button class="icon-button" title="预览蓝图">
          <i class="fa fa-eye"></i>
        </button>
        <button class="icon-button" @click="generateGame" title="运行蓝图">
          <i class="fa fa-play"></i>
        </button>
      </div>
    </header>

    <div class="blueprint-layout">
      <aside class="palette">
        <div class="palette-head">
          <div>
            <p class="eyebrow">Game Library</p>
            <h3>选择要拼接的游戏卡片</h3>
          </div>
          <span class="pill muted">{{ gamesList.length }} 个可用</span>
        </div>
        <div class="game-list">
          <button
            v-for="game in gamesList"
            :key="game.id"
            class="game-card"
            :class="{ active: isSelected(game) }"
            @click="toggleSelect(game)"
          >
            <div class="game-thumb" :style="{ backgroundImage: `url(${game.thumbnail || '/GameImg.jpg'})` }"></div>
            <div class="game-meta">
              <strong class="line-clamp">{{ game.name || game.title }}</strong>
              <small>{{ game.category || game.engine || '未知类型' }}</small>
            </div>
            <span class="select-dot" :class="{ on: isSelected(game) }"></span>
          </button>
        </div>

        <div class="prompt-box">
          <label>正向提示</label>
          <textarea v-model="promptPositive" rows="3"></textarea>
          <label>反向提示</label>
          <textarea v-model="promptNegative" rows="2"></textarea>
          <div class="seed-row">
            <span>ID</span>
            <input v-model="seed" type="text" />
            <button class="ghost-btn tiny" @click="randomizeSeed">随机</button>
          </div>
        </div>
      </aside>

      <section
        class="board-wrapper"
        @mousedown="onBoardMouseDown"
        @mousemove="onBoardMouseMove"
        @mouseup="onBoardMouseUp"
        @mouseleave="onBoardMouseUp"
      >
        <div class="zoom-controls">
          <button class="ghost-btn tiny" @click="zoomOut">-</button>
          <span class="zoom-readout">{{ Math.round(scale * 100) }}%</span>
          <button class="ghost-btn tiny" @click="zoomIn">+</button>
          <button class="ghost-btn tiny" @click="resetZoom">重置</button>
          <span v-if="linkStart" class="pill info">正在连接：{{ linkStart.id }}</span>
          <div class="add-controls">
            <button class="ghost-btn tiny" @click="addBaseNode('checkpoint')">+ 检查点</button>
            <button class="ghost-btn tiny" @click="addBaseNode('promptPositive')">+ 正向提示</button>
            <button class="ghost-btn tiny" @click="addBaseNode('promptNegative')">+ 反向提示</button>
            <button class="ghost-btn tiny" @click="addBaseNode('mixer')">+ Mixer</button>
            <button class="ghost-btn tiny" @click="addBaseNode('sampler')">游戏设定</button>
            <button class="ghost-btn tiny" @click="addBaseNode('decode')">游戏玩法</button>
            <button class="ghost-btn tiny" @click="addBaseNode('save')">游戏音乐</button>
            <button class="ghost-btn tiny" @click="addBaseNode('image')">+ 封面</button>
            <button class="ghost-btn tiny" @click="addSelectedGames">+ 导入选中游戏</button>
          </div>
        </div>
        <div
          ref="boardRef"
          class="board"
          :class="{ panning: pan.active }"
          @wheel.prevent="handleWheel"
          @contextmenu.prevent="onBoardContext($event)"
          :style="boardStyle"
        >
          <svg class="link-layer" :viewBox="`0 0 ${boardWidth} ${boardHeight}`" preserveAspectRatio="xMinYMin meet">
            <defs>
              <linearGradient id="linkPositive" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8" />
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0.5" />
              </linearGradient>
              <linearGradient id="linkGame" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0.6" />
              </linearGradient>
            </defs>
            <g v-for="(link, idx) in connectors" :key="idx" class="link">
              <path
                :d="makeCurvePath(link.start, link.end)"
                :stroke="link.color"
                stroke-width="6"
                stroke-linecap="round"
                fill="none"
                :stroke-opacity="link.opacity || 0.9"
                @contextmenu.prevent="onConnectionContext($event, link.rawId)"
              />
            </g>
            <path
              v-if="linkPreview.active && previewPath"
              :d="previewPath"
              stroke="#ffffff"
              stroke-width="4"
              stroke-dasharray="6 6"
              stroke-linecap="round"
              fill="none"
              opacity="0.7"
            />
          </svg>

          <div
            v-for="node in renderedNodes"
            :key="node.id"
            class="node-card"
            :class="node.type"
            :style="{ left: `${node.pos.x}px`, top: `${node.pos.y}px`, width: `${node.width}px`, height: `${node.height}px` }"
            @mousedown.stop="startDrag(node, $event)"
            @contextmenu.stop.prevent="onNodeContext(node.id)"
          >
            <button
              class="handle handle-left"
              @mousedown.stop.prevent
              @mouseup.stop="finalizeLinkDrag(node.id, 'left')"
              @contextmenu.stop.prevent="onNodeContext($event, node.id)"
            ></button>
            <button
              class="handle handle-right"
              @mousedown.stop="startLinkDrag(node.id, 'right')"
              @contextmenu.stop.prevent="onNodeContext($event, node.id)"
            ></button>
            <div class="node-head">
              <span class="dot" :class="node.type"></span>
              <div class="node-title">{{ node.label }}</div>
              <small class="node-meta">{{ node.meta }}</small>
            </div>

            <div class="node-body" v-if="node.type === 'promptPositive' || node.type === 'promptNegative'">
              <pre>{{ node.content }}</pre>
            </div>

            <div class="node-body" v-else-if="node.type === 'game'">
              <div class="game-node-card">
                <div class="game-node-media">
                  <template v-if="node.videoUrl">
                    <video
                      :src="node.videoUrl"
                      muted
                      autoplay
                      loop
                      playsinline
                      preload="metadata"
                      :poster="node.thumb"
                    ></video>
                  </template>
                  <template v-else>
                    <img :src="node.thumb" alt="" />
                  </template>
                </div>
                <div class="game-node-info">
                  <div class="game-node-title-row">
                    <div>
                      <strong class="line-clamp">{{ node.label }}</strong>
                      <small>{{ node.meta }}</small>
                    </div>
                    <div class="game-node-rating">
                      <i class="fa fa-star"></i>
                      <span>{{ node.rating || '0.0' }}</span>
                    </div>
                  </div>
                  <p class="game-node-description line-clamp-2">
                    {{ node.description || '暂无介绍' }}
                  </p>
                  <div class="game-node-meta-row">
                    <span>
                      <i class="fa fa-cogs"></i>
                      {{ node.engine || '未知' }}
                    </span>
                    <span>
                      <i class="fa fa-code"></i>
                      {{ node.codeType || '未知' }}
                    </span>
                  </div>
                  <div class="game-node-footer">
                    <span>
                      <i class="fa fa-play"></i>
                      {{ node.playCount || 0 }} 玩过
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="node-body" v-else-if="node.type === 'mixer'">
              <p class="small-title">组合的卡片</p>
              <div class="pill-row">
                <span v-for="game in selectedGames" :key="game.id" class="pill info">
                  {{ game.name || game.title }}
                </span>
                <span v-if="!selectedGames.length" class="pill muted">请先选择左侧的游戏卡片</span>
              </div>
            </div>

            <div class="node-body" v-else-if="node.type === 'sampler'">
              <div class="config-grid">
                <div><small>steps</small><strong>20</strong></div>
                <div><small>cfg</small><strong>8.0</strong></div>
                <div><small>scheduler</small><strong>normal</strong></div>
                <div><small>denoise</small><strong>0.87</strong></div>
              </div>
            </div>
             <!-- 节点详情 -->
            <div class="node-body" v-else-if="node.type === 'decode'">
              <p class="small-title">VAE Decode</p>
              <p class="muted-text">LATENT -> IMAGE</p>
            </div>

            <div class="node-body" v-else-if="node.type === 'save'">
              <p class="small-title">输出路径</p>
              <p class="muted-text">filename_prefix: NewGame</p>
            </div>

            <div class="node-body" v-else-if="node.type === 'image'">
              <p class="small-title">示例封面</p>
              <div class="image-preview" :style="{ backgroundImage: `url(${node.thumb})` }"></div>
            </div>
          </div>
        </div>
      </section>

      <aside class="inspector">
        <div class="panel">
          <div class="panel-head">
            <h4>组合预览</h4>
            <span class="pill info">{{ selectedGames.length }} 张</span>
          </div>
          <ul class="selection-list">
            <li v-for="game in selectedGames" :key="game.id">
              <div class="bullet"></div>
              <div>
                <strong>{{ game.name || game.title }}</strong>
                <small>{{ game.category || '玩法' }}</small>
              </div>
            </li>
            <li v-if="!selectedGames.length" class="muted-text">还未选择卡片</li>
          </ul>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h4>连线</h4>
            <button class="ghost-btn tiny" @click="clearConnections">清空连线</button>
          </div>
          <ul class="selection-list">
            <li v-for="conn in connections" :key="conn.id">
              <div class="bullet" :style="{ background: conn.color }"></div>
              <div class="connection-meta">
                <strong>{{ conn.from }} -> {{ conn.to }}</strong>
                <input type="color" v-model="conn.color" />
                <button class="ghost-btn tiny" @click="removeConnection(conn.id)">删除</button>
              </div>
            </li>
            <li v-if="!connections.length" class="muted-text">暂无连线，点击节点连接点开始</li>
          </ul>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h4>生成日志</h4>
            <button class="ghost-btn tiny" @click="logs = []">清空</button>
          </div>
          <div class="log-box">
            <p v-for="(log, index) in logs" :key="index">{{ log }}</p>
            <p v-if="!logs.length" class="muted-text">等待运行...</p>
          </div>
        </div>
      </aside>
    </div>
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <template v-if="contextMenu.type === 'node'">
        <button @click="deleteNode(contextMenu.targetId)">删除节点</button>
      </template>
      <template v-else-if="contextMenu.type === 'connection'">
        <button @click="deleteConnection(contextMenu.targetId)">删除连线</button>
      </template>
      <template v-else-if="contextMenu.type === 'add'">
        <button @click="addNodeAtContext('checkpoint')">添加 检查点</button>
        <button @click="addNodeAtContext('promptPositive')">添加 正向提示</button>
        <button @click="addNodeAtContext('promptNegative')">添加 反向提示</button>
        <button @click="addNodeAtContext('mixer')">添加 Mixer</button>
        <button @click="addNodeAtContext('sampler')">添加 Sampler</button>
        <button @click="addNodeAtContext('decode')">添加 Decode</button>
        <button @click="addNodeAtContext('save')">添加 Save</button>
        <button @click="addNodeAtContext('image')">添加 封面</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { resolveMediaUrl } from '../utils/media'

const gameStore = useGameStore()
const promptPositive = ref('融合已选游戏的核心玩法与节奏，生成一款操作流畅、视觉统一的新作品。')
const promptNegative = ref('水印, 文本, 版权, 抄袭, 低质量')
const seed = ref(Date.now().toString())
const selectedIds = ref([])
const logs = ref([
  '准备蓝图节点...',
  '等待选择游戏卡片并运行生成...'
])
const scale = ref(1)
const minScale = 0.5
const maxScale = 2
const boardWidth = 10000
const boardHeight = 6000
const customNodes = ref([])
const dragState = ref({
  id: null,
  offsetX: 0,
  offsetY: 0,
  dragging: false
})
const connections = ref([])
const linkStart = ref(null)
const boardRef = ref(null)
const pan = ref({
  x: (window.innerWidth - boardWidth) / 2,
  y: (window.innerHeight - boardHeight) / 2,
  active: false,
  startX: 0,
  startY: 0
})
const linkPreview = ref({
  active: false,
  startId: null,
  startSide: 'right',
  endPos: { x: 0, y: 0 },
  snapTarget: null
})
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  type: '',
  targetId: null
})

const gamesList = computed(() =>
  gameStore.games.slice(0, 8).map((game, idx) => ({
    id: game.id || game.game_id || idx,
    game_id: game.game_id || game.id || idx,
    name: game.name || game.title || `游戏 ${idx + 1}`,
    title: game.title,
    category: game.category || game.engine || '玩法',
    thumbnail: game.thumbnail || game.cover || game.cover_url || '/GameImg.jpg',
    engine: game.engine,
    description: game.description || '',
    average_rating: game.average_rating || '0.0',
    play_count: game.play_count || 0,
    video_url: game.video_url || '',
    code_type: game.code_type || game.codeType || ''
  }))
)

const selectedGames = computed(() =>
  gamesList.value.filter(game => selectedIds.value.includes(game.id))
)

const ensureGames = async () => {
  if (!gameStore.gamesLoaded) {
    await gameStore.loadGames()
  }
  if (!selectedIds.value.length && gamesList.value.length) {
    selectedIds.value = gamesList.value.slice(0, 2).map(g => g.id)
  }
  pan.value.x = (window.innerWidth - boardWidth * scale.value) / 2
  pan.value.y = (window.innerHeight - boardHeight * scale.value) / 2
}

const toggleSelect = (game) => {
  if (selectedIds.value.includes(game.id)) {
    selectedIds.value = selectedIds.value.filter(id => id !== game.id)
  } else {
    selectedIds.value = [...selectedIds.value, game.id]
  }
}

const isSelected = (game) => selectedIds.value.includes(game.id)

const nodeWidth = 260
const nodeHeight = 120
const gameNodeWidth = 360
const gameNodeHeight = 320

const nodeTemplates = {
  checkpoint: { label: 'Load Checkpoint', meta: 'MODEL / CLIP / VAE', type: 'checkpoint', width: nodeWidth, height: nodeHeight },
  promptPositive: { label: 'CLIP Text Encode (+)', meta: '正向提示', type: 'promptPositive', width: nodeWidth + 40, height: nodeHeight + 120 },
  promptNegative: { label: 'CLIP Text Encode (-)', meta: '反向提示', type: 'promptNegative', width: nodeWidth + 40, height: nodeHeight + 120 },
  mixer: { label: 'Game Mixer', meta: '组合机制 + 视觉 + 关卡', type: 'mixer', width: nodeWidth + 40, height: nodeHeight + 20 },
  sampler: { label: 'KSampler', meta: '采样', type: 'sampler', width: nodeWidth + 40, height: nodeHeight + 60 },
  decode: { label: 'VAE Decode', meta: 'samples -> image', type: 'decode', width: nodeWidth + 20, height: nodeHeight + 10 },
  save: { label: 'Save Game', meta: 'filename_prefix: NewGame', type: 'save', width: nodeWidth + 60, height: nodeHeight + 40 },
  image: { label: '封面占位', meta: 'Loading images', type: 'image', width: nodeWidth + 60, height: nodeHeight + 100 }
}

const renderedNodes = computed(() =>
  customNodes.value.map(node => {
    if (node.type === 'promptPositive') {
      return { ...node, content: promptPositive.value }
    }
    if (node.type === 'promptNegative') {
      return { ...node, content: promptNegative.value }
    }
    if (node.type === 'sampler') {
      return { ...node, meta: `seed ${seed.value}` }
    }
    if (node.type === 'image') {
      return { ...node, thumb: node.thumb || selectedGames.value[0]?.thumbnail || '/GameImg.jpg' }
    }
    if (node.type === 'game') {
      const detail = node.gameId ? gameStore.getGameById?.(node.gameId) : null
      const source = detail || {}
      const mediaThumb = source.thumbnail || source.cover || source.cover_url || node.thumb || '/GameImg.jpg'
      const videoUrl = resolveMediaUrl(source.video_url || node.videoUrl || '')
      return {
        ...node,
        label: source.name || source.title || node.label,
        meta: source.category || node.meta || '玩法',
        thumb: mediaThumb,
        description: source.description || node.description || '',
        rating: source.average_rating || node.rating || '0.0',
        playCount: source.play_count || node.playCount || 0,
        engine: source.engine || node.engine || '未知',
        codeType: source.code_type || source.codeType || '未知',
        videoUrl
      }
    }
    return node
  })
)

const nodeMap = computed(() => {
  const map = {}
  renderedNodes.value.forEach(node => {
    map[node.id] = node
  })
  return map
})
// 获取节点锚点位置
const getAnchor = (id, side = 'right') => {
  const node = nodeMap.value[id]
  if (!node) return null
  const width = node.width || nodeWidth
  const height = node.height || nodeHeight
  const x = side === 'right' ? node.pos.x + width : node.pos.x
  const y = node.pos.y + height * 0.1
  return { x, y }
}

const allAnchors = computed(() =>
  renderedNodes.value.flatMap(node => {
    const left = getAnchor(node.id, 'left')
    const right = getAnchor(node.id, 'right')
    return [
      left ? { nodeId: node.id, side: 'left', point: left } : null,
      right ? { nodeId: node.id, side: 'right', point: right } : null
    ].filter(Boolean)
  })
)

const connectors = computed(() =>
  connections.value
    .map(conn => ({
      start: getAnchor(conn.from, conn.fromSide || 'right'),
      end: getAnchor(conn.to, conn.toSide || 'left'),
      color: conn.color || '#ffffff',
      opacity: conn.opacity || 0.9,
      rawId: conn.id
    }))
    .filter(conn => conn.start && conn.end)
)

const clampScale = (value) => Math.min(maxScale, Math.max(minScale, value))

const zoomIn = () => {
  scale.value = clampScale(scale.value + 0.1)
}

const zoomOut = () => {
  scale.value = clampScale(scale.value - 0.1)
}

const resetZoom = () => {
  scale.value = 1
}

const handleWheel = (event) => {
  const delta = event.deltaY > 0 ? -0.05 : 0.05
  scale.value = clampScale(scale.value + delta)
}

const boardStyle = computed(() => ({
  width: `${boardWidth}px`,
  height: `${boardHeight}px`,
  minWidth: '100%',
  minHeight: '100%',
  transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${scale.value})`,
  transformOrigin: '0 0'
}))

const nextPosition = () => {
  const perRow = 4
  const count = customNodes.value.length
  const col = count % perRow
  const row = Math.floor(count / perRow)
  const offsetX = (col - (perRow - 1) / 2) * 220
  const offsetY = row * 180
  return {
    x: boardWidth / 2 + offsetX,
    y: boardHeight / 2 + offsetY
  }
}

const addBaseNode = (type) => {
  const tpl = nodeTemplates[type]
  if (!tpl) return
  const pos = nextPosition()
  customNodes.value.push({
    ...tpl,
    id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    pos
  })
}

const addSelectedGames = () => {
  selectedGames.value.forEach(game => {
    const normalizedId = game.game_id || game.id
    if (!normalizedId) return
    const exists = customNodes.value.some(n => n.type === 'game' && n.gameId === normalizedId)
    if (exists) return
    const pos = nextPosition()
    customNodes.value.push({
      id: `game-${normalizedId}`,
      type: 'game',
      gameId: normalizedId,
      label: game.name || game.title,
      meta: game.category || '玩法',
      thumb: game.thumbnail || '/GameImg.jpg',
      description: game.description || '',
      rating: game.average_rating || '0.0',
      playCount: game.play_count || 0,
      engine: game.engine || '未知',
      codeType: game.code_type || game.codeType || '未知',
      videoUrl: game.video_url || '',
      width: gameNodeWidth,
      height: gameNodeHeight,
      pos
    })
  })
}

const screenToWorld = (event) => {
  const rect = boardRef.value?.getBoundingClientRect()
  const left = rect?.left || 0
  const top = rect?.top || 0
  const sx = event.clientX - left
  const sy = event.clientY - top
  return {
    x: sx / scale.value,
    y: sy / scale.value
  }
}

const startDrag = (node, event) => {
  const world = screenToWorld(event)
  dragState.value = {
    id: node.id,
    offsetX: world.x - node.pos.x,
    offsetY: world.y - node.pos.y,
    dragging: true
  }
}

const onBoardMouseMove = (event) => {
if (pan.value.active) {
    const dx = event.clientX - pan.value.startX
    const dy = event.clientY - pan.value.startY
    pan.value.x += dx
    pan.value.y += dy
    pan.value.startX = event.clientX
    pan.value.startY = event.clientY
    return
  }

  if (dragState.value.dragging && dragState.value.id) {
    const node = customNodes.value.find(n => n.id === dragState.value.id)
    if (!node) return
    const world = screenToWorld(event)
    const newX = world.x - dragState.value.offsetX
    const newY = world.y - dragState.value.offsetY
    node.pos = {
      x: newX,
      y: newY
    }
  }

  if (linkPreview.value.active) {
    const cursor = screenToWorld(event)
    let snap = null
    let minDist = 9999
    const threshold = 24
    allAnchors.value.forEach(anchor => {
      if (anchor.nodeId === linkPreview.value.startId && anchor.side === linkPreview.value.startSide) return
      if (anchor.side === linkPreview.value.startSide) return
      const dx = anchor.point.x - cursor.x
      const dy = anchor.point.y - cursor.y
      const dist = Math.hypot(dx, dy)
      if (dist < minDist && dist <= threshold) {
        minDist = dist
        snap = anchor
      }
    })
    if (snap) {
      linkPreview.value.endPos = { ...snap.point }
      linkPreview.value.snapTarget = snap
    } else {
      linkPreview.value.endPos = cursor
      linkPreview.value.snapTarget = null
    }
  }
}

const onBoardMouseUp = () => {
  dragState.value.dragging = false
  dragState.value.id = null
  pan.value.active = false
  if (linkPreview.value.active) {
    finalizeLinkDrag()
  }
}

const onBoardMouseDown = (event) => {
  if (event.button === 1) {
    pan.value.active = true
    pan.value.startX = event.clientX
    pan.value.startY = event.clientY
    event.preventDefault()
    return
  }
  onBoardMouseUp()
}

const startLinkDrag = (nodeId, side = 'right') => {
  if (side !== 'right') return
  const anchor = getAnchor(nodeId, side)
  if (!anchor) return
  linkStart.value = { id: nodeId }
  linkPreview.value = {
    active: true,
    startId: nodeId,
    startSide: side,
    endPos: { ...anchor },
    snapTarget: null
  }
}

const finalizeLinkDrag = (targetId = null, targetSide = 'left') => {
  if (!linkPreview.value.active) return
  if (targetId) {
    addConnection(linkPreview.value.startId, linkPreview.value.startSide, targetId, targetSide)
    resetLinkPreview()
    return
  }
  const snap = linkPreview.value.snapTarget
  if (snap && snap.side !== linkPreview.value.startSide) {
    addConnection(linkPreview.value.startId, linkPreview.value.startSide, snap.nodeId, snap.side)
  }
  resetLinkPreview()
}

const resetLinkPreview = () => {
  linkPreview.value = { active: false, startId: null, startSide: 'right', endPos: { x: 0, y: 0 }, snapTarget: null }
  linkStart.value = null
}

const addConnection = (fromId, fromSide, toId, toSide) => {
  if (!fromId || !toId || fromId === toId) return
  const dup = connections.value.some(conn => conn.from === fromId && conn.to === toId && conn.fromSide === fromSide && conn.toSide === toSide)
  if (dup) return
  connections.value.push({
    id: `conn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    from: fromId,
    to: toId,
    fromSide: fromSide || 'right',
    toSide: toSide || 'left',
    color: '#ffffff'
  })
}

const removeConnection = (id) => {
  connections.value = connections.value.filter(conn => conn.id !== id)
}

const clearConnections = () => {
  connections.value = []
}

const generateGame = () => {
  const names = selectedGames.value.map(g => g.name || g.title).join(' + ') || '未选择'
  logs.value.push(`运行蓝图：组合 [${names}]，seed=${seed.value}`)
  if (logs.value.length > 8) {
    logs.value.shift()
  }
}

const randomizeSeed = () => {
  seed.value = Math.floor(Math.random() * 10 ** 12).toString()
}

const makeCurvePath = (start, end) => {
  const offset = Math.max(60, Math.abs(end.x - start.x) * 0.3)
  return `M ${start.x} ${start.y} C ${start.x + offset} ${start.y}, ${end.x - offset} ${end.y}, ${end.x} ${end.y}`
}

const previewPath = computed(() => {
  if (!linkPreview.value.active || !linkPreview.value.endPos || !linkPreview.value.startId) return ''
  const start = getAnchor(linkPreview.value.startId, linkPreview.value.startSide || 'right')
  const end = linkPreview.value.snapTarget?.point || linkPreview.value.endPos
  if (!start || !end) return ''
  return makeCurvePath(start, end)
})

const closeContextMenu = () => {
  contextMenu.value = { visible: false, x: 0, y: 0, type: '', targetId: null }
}

const openContextMenu = (event, type, targetId = null) => {
  event.preventDefault()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    type,
    targetId
  }
}

const onNodeContext = (event, id) => {
  openContextMenu(event, 'node', id)
}

const onConnectionContext = (event, id) => openContextMenu(event, 'connection', id)

const onBoardContext = (event) => {
  // avoid triggering when panning
  if (pan.value.active) return
  openContextMenu(event, 'add')
}

const deleteNode = (id) => {
  customNodes.value = customNodes.value.filter(n => n.id !== id)
  connections.value = connections.value.filter(conn => conn.from !== id && conn.to !== id)
  closeContextMenu()
}

const deleteConnection = (id) => {
  connections.value = connections.value.filter(conn => conn.id !== id)
  closeContextMenu()
}

const addNodeAtContext = (type) => {
  const tpl = nodeTemplates[type]
  if (!tpl) return
  const rect = boardRef.value?.getBoundingClientRect()
  const offsetLeft = rect?.left || 0
  const offsetTop = rect?.top || 0
  const boardX = (contextMenu.value.x - offsetLeft) / scale.value - pan.value.x
  const boardY = (contextMenu.value.y - offsetTop) / scale.value - pan.value.y
  customNodes.value.push({
    ...tpl,
    id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    pos: { x: boardX, y: boardY }
  })
  closeContextMenu()
}

onMounted(async () => {
  await ensureGames()
  window.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  window.removeEventListener('click', closeContextMenu)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 999;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 160px;
}

.context-menu button {
  width: 100%;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border-radius: 6px;
  padding: 0.4rem 0.5rem;
  text-align: left;
  cursor: pointer;
}

.context-menu button:hover {
  background: rgba(255, 255, 255, 0.15);
}

.blueprint-shell {
  min-height: 100vh;
  height: 100vh;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.blueprint-bar {
  display: flex;
  margin-top: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: #000;
  overflow: hidden;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
}

.bar-title {
  font-weight: 700;
}

.bar-sub {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.bar-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.blueprint-layout {
  display: grid;
  grid-template-columns: 320px 1fr 320px;
  min-height: calc(100vh - 72px);
}

.palette {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  background: #000;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.palette-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  font-size: 0.85rem;
}

.pill.muted {
  color: rgba(255, 255, 255, 0.7);
}

.pill.info {
  color: #000;
  background: #fff;
}

.connection-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.game-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.game-card {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 0.5rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease;
  color: inherit;
}

.game-card.active {
  border-color: #fff;
  box-shadow: 0 8px 18px rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.game-thumb {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}

.game-meta small {
  display: block;
  color: rgba(255, 255, 255, 0.7);
}

.select-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.6);
  position: absolute;
  right: 8px;
  top: 8px;
  background: transparent;
}

.select-dot.on {
  background: #fff;
  border-color: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.6);
}

.prompt-box {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.prompt-box label {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
}

.prompt-box textarea {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 0.5rem;
  resize: vertical;
}

.seed-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.5rem;
  align-items: center;
}

.seed-row input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 0.35rem 0.5rem;
}

.board-wrapper {
  position: relative;
  background: #000;
  overflow: auto;
}

.board {
  position: relative;
  background-image:
    linear-gradient(rgb(29, 29, 31) 1px, transparent 1px),
    linear-gradient(90deg, rgb(29, 29, 31) 1px, transparent 1px);
  background-size: 40px 40px, 40px 40px;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  user-select: none;
  cursor: grab;
}

.link-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.2));
}

.node-card {
  position: absolute;
  background: rgb(29, 29, 31);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 9px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
  padding: 0.65rem;
  color: rgb(211,211,211);
  box-sizing: border-box;
  overflow: visible;
}

.handle {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #000;
  border: 2px solid #fff;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
  z-index: 5;
}

.handle:hover {
  background: #fff;
}

.handle-left {
  background-color: red;
  left: 8px;
  top: 10%;
  transform: translateY(-50%);
}

.handle-right {
  background-color:green;
  right: 8px;
  top: 10%;
  transform: translateY(-50%);
}

.node-card.game .handle-left,
.node-card.game .handle-right {
  top: 16px;
}

.node-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
  margin-left: 0.4rem;
}

.node-title {
  font-weight: 700;
}

.node-meta {
  color: rgba(255, 255, 255, 0.7);
}

.node-body pre {
  margin: 0;
  white-space: pre-wrap;
  color: rgb(211, 211, 211);
  font-weight: 400;
}

.node-body {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.5rem;
  height: calc(100% - 40px);
  box-sizing: border-box;
}

.node-card.model,
.node-card.mixer {
  background: rgb(29, 29, 31);
}

.node-card.game .node-body {
  padding: 0;
  background: transparent;
  height: 100%;
}

.node-card.game .node-head {
  display: none;
}

.node-card.game {
  border: none;
  background: transparent;
  padding: 0.3rem;
}

.game-node-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
}

.game-node-media {
  position: relative;
  height: 55%;
  background: #050505;
}

.game-node-media video,
.game-node-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.game-node-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.65);
}

.game-node-title-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.game-node-title-row strong {
  font-size: 1rem;
}

.game-node-title-row small {
  color: rgba(255, 255, 255, 0.7);
}

.game-node-rating {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.game-node-rating i {
  color: #f5c452;
}

.game-node-description {
  margin: 0;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.85rem;
  line-height: 1.4;
}

.game-node-meta-row {
  display: flex;
  justify-content: space-between;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.7);
}

.game-node-meta-row span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.game-node-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  margin-top: auto;
}

.game-node-footer span {
  color: rgba(255, 255, 255, 0.7);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.pill.info {
  background: #fff;
  color: #000;
}

.small-title {
  margin: 0 0 0.4rem;
  color: #fff;
}

.muted-text {
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
}

.config-grid strong {
  display: block;
}

.image-preview {
  width: 100%;
  height: 120px;
  border-radius: 10px;
  background-size: cover;
  background-position: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.inspector {
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  background: #000;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 0.75rem;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.selection-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.selection-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bullet {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
}

.log-box {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.6rem;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.line-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ghost-btn {
  border: 1px solid rgba(255, 255, 255, 0.6);
  color: #fff;
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost-btn:hover {
  background: #111;
}

.ghost-btn.tiny {
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  font-size: 0.85rem;
}

.icon-button {
  border: none;
  background: transparent;
  color: #fff;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-button:hover {
  color: #ddd;
}

.primary-btn {
  border: 1px solid #fff;
  background: #fff;
  color: #000;
  border-radius: 10px;
  padding: 0.5rem 1rem;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.zoom-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  z-index: 10;
}

.zoom-readout {
  min-width: 48px;
  text-align: center;
}

.add-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-left: 0.75rem;
}

.board.panning {
  cursor: grabbing;
}

@media (max-width: 1200px) {
  .blueprint-layout {
    grid-template-columns: 1fr;
  }

  .palette,
  .inspector {
    grid-column: 1 / -1;
    order: 1;
  }

  .board-wrapper {
    order: 0;
  }
}
</style>
