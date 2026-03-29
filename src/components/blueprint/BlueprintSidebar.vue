<script setup>
import { computed, ref, watch } from 'vue'
import { categoryToZh } from '../../utils/category'
import { getGameCodeTypeIcon, getGameEngineIcon } from '../../utils/gameMetadata'
import { getGameCoverUrl, getGameVideoUrl, hasPlayableVideo } from '../../utils/gameLibraryPresentation'
import { BP_GAME_DRAG_MIME, serializeBlueprintGameDragData } from '../../utils/blueprintNodes.js'

const props = defineProps({
  games: { type: Array, default: () => [] },
  maxVisibleGames: { type: Number, default: 2 },
  seed: { type: String, default: '' },
  logs: { type: Array, default: () => [] },
  modelOptions: { type: Array, default: () => [] },
  collapsed: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  activeGameId: { type: [String, Number], default: '' }
})

const emit = defineEmits(['toggle', 'select-game', 'export-workflow', 'import-workflow', 'clear-workflow'])
const libraryPage = ref(0)
const importInputRef = ref(null)
let activeDragPreview = null

const libraryGames = computed(() =>
  props.games.map((game, index) => ({
    id: game?.game_id || game?.id || `game-${index}`,
    title: game?.title || game?.name || '像素逃生',
    categoryLabel: categoryToZh(game?.category || 'action'),
    coverUrl: getGameCoverUrl(game) || '/GameImg.jpg',
    videoUrl: getGameVideoUrl(game),
    hasVideo: hasPlayableVideo(game),
    codeTypeIcon: getGameCodeTypeIcon(game),
    engineIcon: getGameEngineIcon(game)
  }))
)

const maxPage = computed(() =>
  Math.max(0, Math.ceil(libraryGames.value.length / props.maxVisibleGames) - 1)
)

const visibleLibraryGames = computed(() => {
  const start = libraryPage.value * props.maxVisibleGames
  return libraryGames.value.slice(start, start + props.maxVisibleGames)
})

const canPageBackward = computed(() => libraryPage.value > 0)
const canPageForward = computed(() => libraryPage.value < maxPage.value)
const loadingPlaceholders = computed(() =>
  Array.from({ length: props.maxVisibleGames }, (_, index) => index)
)

const moveLibraryPage = (direction) => {
  const nextPage = libraryPage.value + direction
  libraryPage.value = Math.min(maxPage.value, Math.max(0, nextPage))
}

const removeDragPreview = () => {
  if (!activeDragPreview) return
  activeDragPreview.remove()
  activeDragPreview = null
}

const drawRoundedRectPath = (context, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

const drawPreviewMedia = (context, mediaElement, width, height) => {
  if (!mediaElement) return false

  try {
    if (mediaElement instanceof HTMLImageElement && mediaElement.complete) {
      context.drawImage(mediaElement, 0, 0, width, height)
      return true
    }

    if (mediaElement instanceof HTMLVideoElement && mediaElement.readyState >= 2) {
      context.drawImage(mediaElement, 0, 0, width, height)
      return true
    }
  } catch {
    return false
  }

  return false
}

const createCanvasDragPreview = (game, sourceElement) => {
  const width = 180
  const height = 160
  const mediaHeight = 96
  const radius = 18
  const canvas = document.createElement('canvas')
  canvas.className = 'bp-drag-preview-canvas'
  canvas.width = width * 2
  canvas.height = height * 2
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const context = canvas.getContext('2d')
  if (!context) return null

  context.scale(2, 2)
  context.clearRect(0, 0, width, height)

  drawRoundedRectPath(context, 0.5, 0.5, width - 1, height - 1, radius)
  context.save()
  context.clip()

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)

  const mediaElement = sourceElement?.querySelector('.bp-library-thumb') || null
  if (!drawPreviewMedia(context, mediaElement, width, mediaHeight)) {
    const gradient = context.createLinearGradient(0, 0, width, mediaHeight)
    gradient.addColorStop(0, '#f1ece3')
    gradient.addColorStop(1, '#ffffff')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, mediaHeight)
  }

  context.fillStyle = 'rgba(24, 24, 24, 0.82)'
  const badgeX = 8
  const badgeY = 8
  const badgeWidth = 56
  const badgeHeight = 22
  drawRoundedRectPath(context, badgeX, badgeY, badgeWidth, badgeHeight, 11)
  context.fill()

  context.fillStyle = '#ffffff'
  context.font = '600 11px "Inter", "PingFang SC", sans-serif'
  context.textBaseline = 'middle'
  context.textAlign = 'center'
  context.fillText('游戏节点', badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 0.5)
  context.textAlign = 'start'

  context.fillStyle = '#171513'
  context.font = '600 13px "Inter", "PingFang SC", sans-serif'
  context.textBaseline = 'top'
  context.fillText(game.title.slice(0, 14), 12, 108)

  context.fillStyle = '#9a9388'
  context.font = '12px "Inter", "PingFang SC", sans-serif'
  context.fillText(game.categoryLabel, 12, 132)

  context.restore()

  document.body.appendChild(canvas)
  activeDragPreview = canvas
  return canvas
}

const startGameDrag = (event, game) => {
  const payload = serializeBlueprintGameDragData(game)
  event.dataTransfer?.setData(BP_GAME_DRAG_MIME, payload)
  event.dataTransfer?.setData('text/plain', payload)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    const preview = createCanvasDragPreview(game, event.currentTarget)
    if (preview) {
      event.dataTransfer.setDragImage(preview, 28, 28)
    }
  }

  emit('select-game', game.id)
}

const endGameDrag = () => {
  window.setTimeout(removeDragPreview, 0)
}

const openImportPicker = () => {
  importInputRef.value?.click()
}

const onImportFileChange = async (event) => {
  const [file] = Array.from(event.target?.files || [])
  event.target.value = ''

  if (!file) return

  const rawValue = await file.text()
  emit('import-workflow', rawValue)
}

watch(maxPage, (value) => {
  if (libraryPage.value > value) {
    libraryPage.value = value
  }
})

watch(
  () => props.activeGameId,
  (gameId) => {
    const targetIndex = libraryGames.value.findIndex((game) => String(game.id) === String(gameId || ''))
    if (targetIndex < 0) return

    libraryPage.value = Math.floor(targetIndex / props.maxVisibleGames)
  }
)
</script>

<template>
  <aside class="bp-sidebar" :class="{ 'is-collapsed': props.collapsed }">
    <header class="bp-sidebar-brand">
      <div class="bp-brand-lockup">
        <img class="bp-brand-logo" src="/logo_light.png" alt="DPCC Gaming" />
      </div>
      <div v-if="!props.collapsed">
        <div class="bp-brand-title">DPCC GAMING</div>
        <div class="bp-brand-subtitle">BluePrint&amp;WorkFlow</div>
      </div>
      <button type="button" class="bp-brand-square" :aria-label="props.collapsed ? '展开侧栏' : '收起侧栏'" @click="emit('toggle')">
        <i :class="props.collapsed ? 'fa fa-angles-right' : 'fa fa-angles-left'"></i>
      </button>
    </header>

    <button v-if="!props.collapsed" type="button" class="bp-side-action" @click="emit('export-workflow')">
      <i class="fa fa-download"></i>
      <span>导出 JSON</span>
    </button>
    <button v-if="!props.collapsed" type="button" class="bp-side-action" @click="openImportPicker">
      <i class="fa fa-upload"></i>
      <span>导入</span>
    </button>
    <button v-if="!props.collapsed" type="button" class="bp-side-action" @click="emit('clear-workflow')">
      <i class="fa fa-trash"></i>
      <span>清空工作流</span>
    </button>
    <input
      ref="importInputRef"
      class="bp-file-input"
      type="file"
      accept="application/json,.json"
      @change="onImportFileChange"
    />

    <section v-if="!props.collapsed" class="bp-sidebar-section">
      <h3>配置工作流</h3>
      <div class="bp-model-grid">
        <button
          v-for="model in modelOptions"
          :key="model.name"
          type="button"
          class="bp-model-pill"
        >
          <img v-if="model.logoSrc" class="bp-model-logo" :src="model.logoSrc" :alt="model.logoAlt || model.name" />
          <span>{{ model.name }}</span>
        </button>
      </div>
      <button type="button" class="bp-side-wide-btn">
        导入自己的模型
      </button>
    </section>

    <section v-if="!props.collapsed" class="bp-sidebar-section">
      <div class="bp-section-head">
        <h3>游戏库</h3>
        <div class="bp-chevron-pair">
          <button type="button" :disabled="props.loading || !canPageBackward" @click="moveLibraryPage(-1)">
            <i class="fa fa-angle-left"></i>
          </button>
          <button type="button" :disabled="props.loading || !canPageForward" @click="moveLibraryPage(1)">
            <i class="fa fa-angle-right"></i>
          </button>
        </div>
      </div>
      <div class="bp-library-list">
        <div v-if="props.loading" class="bp-library-loading">
          <article
            v-for="item in loadingPlaceholders"
            :key="`loading-${item}`"
            class="bp-library-card bp-library-card-skeleton"
            aria-hidden="true"
          >
            <span class="bp-library-thumb bp-library-skeleton-block"></span>
            <div class="bp-library-copy">
              <strong class="bp-library-skeleton-line bp-library-skeleton-line-title"></strong>
              <small class="bp-library-skeleton-line bp-library-skeleton-line-subtitle"></small>
            </div>
            <div class="bp-library-icons">
              <span class="bp-library-skeleton-dot"></span>
              <span class="bp-library-skeleton-dot"></span>
            </div>
          </article>
        </div>
        <div v-else-if="!visibleLibraryGames.length" class="bp-library-empty">
          游戏库正在等待数据，可稍后再试。
        </div>
        <template v-else>
          <article
            v-for="game in visibleLibraryGames"
            :key="game.id"
            class="bp-library-card"
            :class="{ 'is-active': String(props.activeGameId) === String(game.id) }"
            draggable="true"
            @click="emit('select-game', game.id)"
            @dragstart="startGameDrag($event, game)"
            @dragend="endGameDrag"
          >
            <video
              v-if="game.hasVideo && game.videoUrl"
              class="bp-library-thumb"
              :src="game.videoUrl"
              :poster="game.coverUrl"
              muted
              loop
              autoplay
              playsinline
              preload="metadata"
            ></video>
            <img
              v-else
              class="bp-library-thumb"
              :src="game.coverUrl"
              :alt="game.title"
            />
            <div class="bp-library-copy">
              <strong>{{ game.title }}</strong>
              <small>{{ game.categoryLabel }}</small>
            </div>
            <div class="bp-library-icons">
              <img v-if="game.codeTypeIcon" :src="game.codeTypeIcon" alt="" />
              <img v-if="game.engineIcon" :src="game.engineIcon" alt="" />
            </div>
          </article>
        </template>
      </div>
    </section>

    <section v-if="!props.collapsed" class="bp-sidebar-section">
      <h3>种子</h3>
      <div class="bp-seed-box">{{ props.seed }}</div>
    </section>

    <section v-if="!props.collapsed" class="bp-sidebar-section bp-log-section">
      <h3>生成日志</h3>
      <div class="bp-log-box">
        <p v-for="(line, index) in props.logs" :key="index">{{ line }}</p>
      </div>
    </section>

    <button v-if="!props.collapsed" type="button" class="bp-side-wide-btn bp-share-btn">
      分享
    </button>
  </aside>
</template>

<style scoped>
.bp-sidebar {
  display: flex;
  flex-direction: column;
  gap: 11px;
  width: 304px;
  min-width: 304px;
  height: 100dvh;
  padding: 16px 14px 10px;
  border-right: 1px solid var(--bp-border);
  background: var(--bp-sidebar-bg);
  box-sizing: border-box;
  color: var(--bp-text);
  transition: width 180ms ease, min-width 180ms ease, padding 180ms ease;
  overflow: hidden;
}

.bp-sidebar.is-collapsed {
  width: 74px;
  min-width: 74px;
  padding-inline: 10px;
}

.bp-sidebar-brand,
.bp-side-action,
.bp-side-wide-btn,
.bp-model-pill,
.bp-library-card,
.bp-brand-square {
  border: 1px solid var(--bp-border);
  background: var(--bp-surface);
  box-shadow: var(--bp-shadow-sm);
}

.bp-sidebar-brand {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 0 0 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.bp-sidebar.is-collapsed .bp-sidebar-brand {
  grid-template-columns: 1fr;
  justify-items: center;
  gap: 10px;
}

.bp-brand-lockup {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.bp-brand-logo {
  width: 30px;
  height: auto;
  object-fit: contain;
  display: block;
}

.bp-sidebar.is-collapsed .bp-brand-logo {
  width: 20px;
}

.bp-brand-title {
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.bp-brand-subtitle {
  margin-top: 2px;
  color: var(--bp-accent);
  font-size: 0.69rem;
  font-weight: 600;
}

.bp-brand-square {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: #3a352d;
}

.bp-sidebar button {
  appearance: none;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease;
}

.bp-sidebar button:hover {
  transform: translateY(-1px);
  box-shadow: var(--bp-shadow-md);
}

.bp-file-input {
  display: none;
}

.bp-side-action,
.bp-side-wide-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  color: var(--bp-text);
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
}

.bp-side-action i,
.bp-side-wide-btn i {
  width: 16px;
  text-align: center;
  color: #2a2721;
}

.bp-sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
}

.bp-sidebar-section + .bp-sidebar-section {
  margin-top: 2px;
}

.bp-sidebar-section h3 {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--bp-muted);
}

.bp-model-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.bp-model-pill {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 36px;
  min-width: 0;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--bp-text);
  font-size: 0.75rem;
  font-weight: 600;
}

.bp-model-logo {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  object-fit: contain;
  flex-shrink: 0;
}

.bp-model-pill span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bp-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.bp-chevron-pair {
  display: inline-flex;
  gap: 6px;
}

.bp-chevron-pair button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--bp-border);
  border-radius: 999px;
  background: var(--bp-surface);
  box-shadow: var(--bp-shadow-sm);
  color: var(--bp-muted);
}

.bp-chevron-pair button:disabled {
  opacity: 0.4;
  cursor: default;
  transform: none;
  box-shadow: var(--bp-shadow-sm);
}

.bp-chevron-pair i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
}

.bp-library-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bp-library-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bp-library-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 62px;
  padding: 11px 12px;
  border-radius: 8px;
  cursor: grab;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.bp-library-card-skeleton {
  cursor: default;
}

.bp-library-card-skeleton:hover {
  transform: none;
  box-shadow: var(--bp-shadow-sm);
}

.bp-library-card.is-active {
  border-color: rgba(210, 160, 43, 0.72);
  box-shadow: 0 0 0 2px rgba(210, 160, 43, 0.12), var(--bp-shadow-md);
}

.bp-library-card:active {
  cursor: grabbing;
}

.bp-library-thumb {
  width: 38px;
  height: 38px;
  border-radius: 0;
  object-fit: cover;
  background: #d1d1d1;
}

.bp-library-copy {
  min-width: 0;
}

.bp-library-copy strong,
.bp-library-copy small {
  display: block;
}

.bp-library-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.86rem;
  color: var(--bp-text);
  font-weight: 600;
}

.bp-library-copy small {
  margin-top: 5px;
  color: #6f685d;
  font-size: 0.72rem;
}

.bp-library-icons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bp-library-icons img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.bp-library-empty {
  padding: 12px 14px;
  border: 1px dashed rgba(94, 80, 48, 0.18);
  border-radius: 8px;
  color: var(--bp-muted);
  font-size: 0.78rem;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.72);
}

.bp-library-skeleton-block,
.bp-library-skeleton-line,
.bp-library-skeleton-dot {
  background: linear-gradient(90deg, rgba(241, 237, 230, 0.98), rgba(255, 255, 255, 1), rgba(241, 237, 230, 0.98));
  background-size: 200% 100%;
  animation: bp-library-skeleton 1.5s linear infinite;
}

.bp-library-skeleton-block {
  display: block;
}

.bp-library-skeleton-line {
  display: block;
  border-radius: 999px;
}

.bp-library-skeleton-line-title {
  width: 72%;
  height: 12px;
}

.bp-library-skeleton-line-subtitle {
  width: 44%;
  height: 10px;
  margin-top: 8px;
}

.bp-library-skeleton-dot {
  width: 16px;
  height: 16px;
  border-radius: 999px;
}

@keyframes bp-library-skeleton {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

.bp-seed-box,
.bp-log-box {
  padding: 12px 14px;
  border: 1px solid var(--bp-border);
  border-radius: 8px;
  background: var(--bp-surface);
  color: var(--bp-muted);
  box-shadow: var(--bp-shadow-sm);
}

.bp-seed-box {
  min-height: 34px;
  justify-content: center;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--bp-text);
  font-weight: 600;
  letter-spacing: 0.01em;
  word-break: break-all;
  text-align: center;
}

.bp-log-section {
  flex: 1;
  min-height: 0;
}

.bp-log-box {
  flex: 1;
  min-height: 190px;
  overflow: auto;
}

.bp-log-box p {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.7;
}

.bp-log-box p + p {
  margin-top: 8px;
}

.bp-share-btn {
  justify-content: center;
  min-height: 34px;
  margin-top: auto;
  border-radius: 8px;
}
</style>
<style>
.bp-drag-preview-shell,
.bp-drag-preview-canvas {
  position: fixed;
  top: -9999px;
  left: -9999px;
  padding: 0;
  background: transparent;
  pointer-events: none;
  z-index: -1;
}
</style>
