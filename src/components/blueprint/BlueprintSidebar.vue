<script setup>
import { computed, ref, watch } from 'vue'
import { categoryToZh } from '../../utils/category'
import { getGameCodeTypeIcon, getGameEngineIcon } from '../../utils/gameMetadata'
import { getGameCoverUrl, getGameVideoUrl, hasPlayableVideo } from '../../utils/gameLibraryPresentation'
import { BP_GAME_DRAG_MIME, serializeBlueprintGameDragData } from '../../utils/blueprintNodes.js'
import {
  clampBlueprintSidebarPage,
  findBlueprintSidebarPageBySeed,
  getBlueprintSidebarPageItems,
  getBlueprintSidebarMaxPage
} from '../../utils/blueprintSidebar.js'

const props = defineProps({
  games: { type: Array, default: () => [] },
  maxVisibleGames: { type: Number, default: 2 },
  maxVisibleModels: { type: Number, default: 4 },
  maxVisibleRecentBlueprints: { type: Number, default: 2 },
  logs: { type: Array, default: () => [] },
  modelOptions: { type: Array, default: () => [] },
  selectedModel: { type: String, default: '' },
  visionModelOptions: { type: Array, default: () => [] },
  selectedVisionModel: { type: String, default: '' },
  seed: { type: String, default: '' },
  recentBlueprints: { type: Array, default: () => [] },
  recentBlueprintsLoading: { type: Boolean, default: false },
  recentBlueprintsError: { type: String, default: '' },
  collapsed: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  activeGameId: { type: [String, Number], default: '' },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits([
  'toggle',
  'create-blueprint',
  'select-game',
  'export-workflow',
  'import-workflow',
  'clear-workflow',
  'select-model',
  'select-vision-model',
  'import-seed',
  'save-seed'
])
const libraryPage = ref(0)
const modelPage = ref(0)
const recentBlueprintPage = ref(0)
const seedInput = ref('')
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
const maxModelPage = computed(() =>
  Math.max(0, Math.ceil(props.modelOptions.length / props.maxVisibleModels) - 1)
)
const visibleModelOptions = computed(() => {
  const start = modelPage.value * props.maxVisibleModels
  return props.modelOptions.slice(start, start + props.maxVisibleModels)
})
const canModelPageBackward = computed(() => modelPage.value > 0)
const canModelPageForward = computed(() => modelPage.value < maxModelPage.value)
const maxRecentBlueprintPage = computed(() =>
  getBlueprintSidebarMaxPage(props.recentBlueprints, props.maxVisibleRecentBlueprints)
)
const visibleRecentBlueprints = computed(() =>
  getBlueprintSidebarPageItems(props.recentBlueprints, recentBlueprintPage.value, props.maxVisibleRecentBlueprints)
)
const canRecentBlueprintPageBackward = computed(() => recentBlueprintPage.value > 0)
const canRecentBlueprintPageForward = computed(() => recentBlueprintPage.value < maxRecentBlueprintPage.value)
const hasSeedInput = computed(() => Boolean(String(seedInput.value || '').trim()))
const loadingPlaceholders = computed(() =>
  Array.from({ length: props.maxVisibleGames }, (_, index) => index)
)
const recentBlueprintPlaceholders = computed(() =>
  Array.from({ length: props.maxVisibleRecentBlueprints }, (_, index) => index)
)

const moveLibraryPage = (direction) => {
  const nextPage = libraryPage.value + direction
  libraryPage.value = Math.min(maxPage.value, Math.max(0, nextPage))
}

const moveModelPage = (direction) => {
  const nextPage = modelPage.value + direction
  modelPage.value = Math.min(maxModelPage.value, Math.max(0, nextPage))
}

const moveRecentBlueprintPage = (direction) => {
  const nextPage = recentBlueprintPage.value + direction
  recentBlueprintPage.value = clampBlueprintSidebarPage(
    nextPage,
    props.recentBlueprints,
    props.maxVisibleRecentBlueprints
  )
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

const emitSeedImport = () => {
  const normalizedSeed = String(seedInput.value || '').trim().toUpperCase()
  if (!normalizedSeed) return
  emit('import-seed', normalizedSeed)
}

const emitSeedSave = () => {
  emit('save-seed')
}

const emitCreateBlueprint = () => {
  emit('create-blueprint')
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

watch(maxModelPage, (value) => {
  if (modelPage.value > value) {
    modelPage.value = value
  }
})

watch(maxRecentBlueprintPage, (value) => {
  if (recentBlueprintPage.value > value) {
    recentBlueprintPage.value = value
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

watch(
  () => props.selectedModel,
  (modelValue) => {
    const targetIndex = props.modelOptions.findIndex((model) => String(model.value) === String(modelValue || ''))
    if (targetIndex < 0) return

    modelPage.value = Math.floor(targetIndex / props.maxVisibleModels)
  },
  { immediate: true }
)

watch(
  () => props.seed,
  (seedValue) => {
    seedInput.value = String(seedValue || '')

    const targetPage = findBlueprintSidebarPageBySeed(
      props.recentBlueprints,
      seedValue,
      props.maxVisibleRecentBlueprints
    )
    if (targetPage >= 0) {
      recentBlueprintPage.value = targetPage
    }
  },
  { immediate: true }
)

watch(
  () => props.recentBlueprints,
  (items) => {
    recentBlueprintPage.value = clampBlueprintSidebarPage(
      recentBlueprintPage.value,
      items,
      props.maxVisibleRecentBlueprints
    )
  },
  { immediate: true }
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
      <button type="button" class="bp-control-button bp-control-button-hover-lift" :aria-label="props.collapsed ? '展开侧栏' : '收起侧栏'" @click="emit('toggle')">
        <i :class="props.collapsed ? 'fa fa-angles-right' : 'fa fa-angles-left'"></i>
      </button>
    </header>

    <button
      v-if="!props.collapsed"
      type="button"
      class="bp-side-action bp-control-surface bp-control-button bp-control-button-hover-lift"
      :disabled="props.busy"
      @click="emit('export-workflow')"
    >
      <i class="fa fa-download"></i>
      <span>导出 JSON</span>
    </button>
    <button
      v-if="!props.collapsed"
      type="button"
      class="bp-side-action bp-control-surface bp-control-button bp-control-button-hover-lift"
      :disabled="props.busy"
      @click="openImportPicker"
    >
      <i class="fa fa-upload"></i>
      <span>导入</span>
    </button>
    <button
      v-if="!props.collapsed"
      type="button"
      class="bp-side-action bp-control-surface bp-control-button bp-control-button-hover-lift"
      :disabled="props.busy"
      @click="emit('clear-workflow')"
    >
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
      <div class="bp-section-head">
        <h3>配置工作流</h3>
        <div class="bp-chevron-pair">
          <button type="button" :disabled="!canModelPageBackward" @click="moveModelPage(-1)">
            <i class="fa fa-angle-left"></i>
          </button>
          <button type="button" :disabled="!canModelPageForward" @click="moveModelPage(1)">
            <i class="fa fa-angle-right"></i>
          </button>
        </div>
      </div>
      <div class="bp-model-grid bp-model-grid-fixed">
        <button
          v-for="model in visibleModelOptions"
          :key="model.value"
          type="button"
          class="bp-model-pill bp-control-surface bp-control-button bp-control-button-hover-lift"
          :class="{ 'is-active': props.selectedModel === model.value }"
          @click="emit('select-model', model.value)"
        >
          <img v-if="model.logoSrc" class="bp-model-logo" :src="model.logoSrc" :alt="model.logoAlt || model.name" />
          <span>{{ model.label || model.name }}</span>
        </button>
      </div>
      <div class="bp-vision-section">
        <h4>视觉理解模型</h4>
        <div class="bp-model-grid">
          <button
            v-for="model in props.visionModelOptions"
            :key="model.value"
            type="button"
            class="bp-model-pill bp-control-surface bp-control-button bp-control-button-hover-lift"
            :class="{ 'is-active': props.selectedVisionModel === model.value }"
            @click="emit('select-vision-model', model.value)"
          >
            <img v-if="model.logoSrc" class="bp-model-logo" :src="model.logoSrc" :alt="model.logoAlt || model.name" />
            <span>{{ model.label || model.name }}</span>
          </button>
        </div>
      </div>
      <button type="button" class="bp-side-wide-btn bp-control-surface bp-control-button bp-control-button-hover-lift">
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

    <section v-if="!props.collapsed" class="bp-sidebar-section bp-sidebar-section-seed">
      <div class="bp-section-head">
        <h3>蓝图种子</h3>
      </div>
      <div class="bp-seed-panel bp-control-surface">
        <div class="bp-seed-current">
          <span class="bp-seed-label">当前种子</span>
          <strong>{{ props.seed || '尚未生成' }}</strong>
        </div>
        <div class="bp-seed-input-row">
          <input
            v-model="seedInput"
            type="text"
            class="bp-seed-input"
            maxlength="32"
            placeholder="输入其他用户种子"
            @keydown.enter.prevent="emitSeedImport"
          />
          <button
            type="button"
            class="bp-seed-action-control bp-seed-open-btn bp-control-surface bp-control-button bp-control-button-hover-lift"
            :disabled="props.busy || !hasSeedInput"
            @click="emitSeedImport"
          >
            打开
          </button>
        </div>
        <div class="bp-seed-actions">
          <button
            type="button"
            class="bp-seed-action-control bp-seed-icon-btn bp-control-surface bp-control-button bp-control-button-hover-lift"
            aria-label="新建蓝图"
            title="新建蓝图"
            :disabled="props.busy"
            @click="emitCreateBlueprint"
          >
            <i class="fa fa-plus"></i>
          </button>
          <button
            type="button"
            class="bp-seed-action-control bp-seed-icon-btn bp-control-surface bp-control-button bp-control-button-hover-lift"
            aria-label="保存"
            title="保存"
            :disabled="props.busy"
            @click="emitSeedSave"
          >
            <i class="fa fa-floppy-disk"></i>
          </button>
        </div>
      </div>

      <div class="bp-section-head">
        <h3>最近蓝图</h3>
        <div class="bp-chevron-pair">
          <button type="button" :disabled="props.recentBlueprintsLoading || !canRecentBlueprintPageBackward" @click="moveRecentBlueprintPage(-1)">
            <i class="fa fa-angle-left"></i>
          </button>
          <button type="button" :disabled="props.recentBlueprintsLoading || !canRecentBlueprintPageForward" @click="moveRecentBlueprintPage(1)">
            <i class="fa fa-angle-right"></i>
          </button>
        </div>
      </div>
      <div class="bp-recent-blueprint-list">
        <div v-if="props.recentBlueprintsLoading" class="bp-recent-blueprint-loading">
          <article
            v-for="item in recentBlueprintPlaceholders"
            :key="`recent-loading-${item}`"
            class="bp-recent-blueprint-card bp-recent-blueprint-card-skeleton"
            aria-hidden="true"
          >
            <strong class="bp-library-skeleton-line bp-library-skeleton-line-title"></strong>
            <small class="bp-library-skeleton-line bp-library-skeleton-line-subtitle"></small>
            <div class="bp-recent-blueprint-meta">
              <span class="bp-library-skeleton-line"></span>
              <span class="bp-library-skeleton-line"></span>
            </div>
          </article>
        </div>
        <div v-else-if="props.recentBlueprintsError" class="bp-library-empty">
          {{ props.recentBlueprintsError }}
        </div>
        <div v-else-if="!visibleRecentBlueprints.length" class="bp-library-empty">
          暂时还没有最近蓝图。
        </div>
        <template v-else>
          <article
            v-for="blueprint in visibleRecentBlueprints"
            :key="blueprint.seed"
            class="bp-recent-blueprint-card bp-control-surface"
            :class="{ 'is-active': String(props.seed || '') === String(blueprint.seed || '') }"
            @click="emit('import-seed', blueprint.seed)"
          >
            <div class="bp-recent-blueprint-copy">
              <div class="bp-recent-blueprint-title-row">
                <strong>{{ blueprint.title || blueprint.seed }}</strong>
                <span>{{ blueprint.seed }}</span>
              </div>
              <p v-if="blueprint.summary">{{ blueprint.summary }}</p>
              <div class="bp-recent-blueprint-meta">
                <span>{{ blueprint.nodeCount || 0 }} 节点</span>
                <span>{{ blueprint.edgeCount || 0 }} 连线</span>
              </div>
              <small>{{ blueprint.updatedAtLabel || '最近保存' }}</small>
            </div>
            <button
              type="button"
              class="bp-seed-action-control bp-recent-blueprint-open bp-control-surface bp-control-button bp-control-button-hover-lift"
              :disabled="props.busy"
              @click.stop="emit('import-seed', blueprint.seed)"
            >
              打开
            </button>
          </article>
        </template>
      </div>
    </section>

  </aside>
</template>

<style scoped>
.bp-sidebar {
  display: flex;
  flex-direction: column;
  gap: clamp(9px, 0.9vw, 11px);
  width: var(--bp-sidebar-width);
  min-width: var(--bp-sidebar-width);
  height: 100dvh;
  padding: clamp(12px, 1vw, 16px) clamp(12px, 0.9vw, 14px) 10px;
  border-right: 1px solid var(--bp-border);
  background: var(--bp-sidebar-bg);
  box-sizing: border-box;
  color: var(--bp-text);
  transition: width 180ms ease, min-width 180ms ease, padding 180ms ease, gap 180ms ease;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
}

.bp-sidebar::-webkit-scrollbar {
  display: none;
}

.bp-sidebar.is-collapsed {
  width: calc(74px * var(--bp-ui-scale));
  min-width: calc(74px * var(--bp-ui-scale));
  padding-inline: calc(10px * var(--bp-ui-scale));
}

.bp-sidebar-brand {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: calc(12px * var(--bp-ui-scale));
  padding: 0 0 calc(8px * var(--bp-ui-scale));
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.bp-sidebar.is-collapsed .bp-sidebar-brand {
  grid-template-columns: 1fr;
  justify-items: center;
  gap: calc(10px * var(--bp-ui-scale));
}

.bp-brand-lockup {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.bp-brand-logo {
  width: calc(30px * var(--bp-ui-scale));
  height: auto;
  object-fit: contain;
  display: block;
}

.bp-sidebar.is-collapsed .bp-brand-logo {
  width: calc(20px * var(--bp-ui-scale));
}

.bp-brand-title {
  font-size: calc(0.88rem * var(--bp-ui-scale));
  font-weight: 700;
  letter-spacing: 0.01em;
}

.bp-brand-subtitle {
  margin-top: calc(2px * var(--bp-ui-scale));
  color: var(--bp-accent);
  font-size: calc(0.69rem * var(--bp-ui-scale));
  font-weight: 600;
}

.bp-brand-square {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(36px * var(--bp-ui-scale));
  height: calc(36px * var(--bp-ui-scale));
  border-radius: calc(10px * var(--bp-ui-scale));
  color: #3a352d;
}

.bp-file-input {
  display: none;
}

.bp-side-action,
.bp-side-wide-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(10px * var(--bp-ui-scale));
  min-height: clamp(calc(34px * var(--bp-ui-scale)), 3.3vw, calc(36px * var(--bp-ui-scale)));
  padding: 0 clamp(calc(12px * var(--bp-ui-scale)), 1.1vw, calc(16px * var(--bp-ui-scale)));
  border-radius: calc(8px * var(--bp-ui-scale));
  color: var(--bp-text);
  font-size: clamp(calc(0.84rem * var(--bp-ui-scale)), calc(0.75rem * var(--bp-ui-scale)) + 0.2vw, calc(0.9rem * var(--bp-ui-scale)));
  font-weight: 600;
  text-align: center;
}

.bp-side-action i,
.bp-side-wide-btn i {
  width: calc(16px * var(--bp-ui-scale));
  text-align: center;
  color: #2a2721;
}

.bp-sidebar-section {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 0.8vw, 10px);
  padding: 0;
  border: 0;
  background: transparent;
}

.bp-sidebar-section + .bp-sidebar-section {
  margin-top: 2px;
}

.bp-sidebar-section-seed {
  margin-top: auto;
  padding-top: clamp(6px, 0.8vw, 8px);
}

.bp-sidebar-section h3 {
  margin: 0;
  font-size: calc(0.78rem * var(--bp-ui-scale));
  font-weight: 600;
  color: var(--bp-muted);
}

.bp-model-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(6px, 0.7vw, 8px);
}

.bp-model-grid-fixed {
  grid-template-rows: repeat(2, clamp(calc(34px * var(--bp-ui-scale)), 3.3vw, calc(36px * var(--bp-ui-scale))));
  align-content: start;
}

.bp-vision-section {
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.7vw, 8px);
}

.bp-vision-section h4 {
  margin: 0;
  color: var(--bp-muted);
  font-size: calc(0.7rem * var(--bp-ui-scale));
  font-weight: 600;
}

.bp-model-pill {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  min-height: clamp(calc(34px * var(--bp-ui-scale)), 3.3vw, calc(36px * var(--bp-ui-scale)));
  min-width: 0;
  padding: 0 clamp(calc(7px * var(--bp-ui-scale)), 0.8vw, calc(8px * var(--bp-ui-scale)));
  border-radius: calc(8px * var(--bp-ui-scale));
  color: var(--bp-text);
  font-size: clamp(calc(0.72rem * var(--bp-ui-scale)), calc(0.68rem * var(--bp-ui-scale)) + 0.13vw, calc(0.75rem * var(--bp-ui-scale)));
  font-weight: 600;
  width: 100%;
}

.bp-model-logo {
  width: calc(16px * var(--bp-ui-scale));
  height: calc(16px * var(--bp-ui-scale));
  margin-right: calc(8px * var(--bp-ui-scale));
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
  gap: calc(12px * var(--bp-ui-scale));
}

.bp-chevron-pair {
  display: inline-flex;
  gap: calc(6px * var(--bp-ui-scale));
}

.bp-chevron-pair button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(18px * var(--bp-ui-scale));
  height: calc(18px * var(--bp-ui-scale));
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

.bp-model-pill.is-active {
  border-color: rgba(17, 17, 17, 0.28);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--bp-shadow-md);
}

.bp-chevron-pair i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: calc(0.72rem * var(--bp-ui-scale));
}

.bp-library-list {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 0.8vw, 10px);
}

.bp-seed-panel {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 0.8vw, 10px);
  padding: clamp(10px, 0.9vw, 12px);
  border-radius: calc(10px * var(--bp-ui-scale));
}

.bp-seed-current {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bp-seed-label {
  color: var(--bp-muted);
  font-size: calc(0.68rem * var(--bp-ui-scale));
  font-weight: 600;
}

.bp-seed-current strong {
  font-size: calc(0.8rem * var(--bp-ui-scale));
  line-height: 1.3;
  word-break: break-all;
}

.bp-seed-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: calc(8px * var(--bp-ui-scale));
}

.bp-seed-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: calc(8px * var(--bp-ui-scale));
}

.bp-seed-input {
  width: 100%;
  min-width: 0;
  min-height: calc(34px * var(--bp-ui-scale));
  padding: 0 calc(10px * var(--bp-ui-scale));
  border: 1px solid var(--bp-border);
  border-radius: calc(8px * var(--bp-ui-scale));
  background: rgba(255, 255, 255, 0.95);
  color: var(--bp-text);
  font-size: calc(0.76rem * var(--bp-ui-scale));
  text-transform: uppercase;
}

.bp-seed-action-control {
  min-height: calc(34px * var(--bp-ui-scale));
  padding: 0 calc(12px * var(--bp-ui-scale));
  border-radius: calc(999px * var(--bp-ui-scale));
  font-size: calc(0.64rem * var(--bp-ui-scale));
  font-weight: 700;
  letter-spacing: 0.01em;
}

.bp-seed-open-btn,
.bp-recent-blueprint-open {
  min-width: calc(72px * var(--bp-ui-scale));
}

.bp-seed-icon-btn {
  width: calc(34px * var(--bp-ui-scale));
  min-width: calc(34px * var(--bp-ui-scale));
  padding: 0;
}

.bp-seed-icon-btn i {
  font-size: calc(0.76rem * var(--bp-ui-scale));
  line-height: 1;
}

.bp-recent-blueprint-list,
.bp-recent-blueprint-loading {
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.65vw, 8px);
}

.bp-recent-blueprint-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: clamp(6px, 0.65vw, 8px);
  min-height: clamp(64px, 5vw, 70px);
  padding: clamp(8px, 0.75vw, 10px);
  border-radius: calc(8px * var(--bp-ui-scale));
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.bp-recent-blueprint-card.is-active {
  border-color: rgba(17, 17, 17, 0.28);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--bp-shadow-md);
}

.bp-recent-blueprint-copy {
  min-width: 0;
}

.bp-recent-blueprint-title-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.bp-recent-blueprint-title-row strong,
.bp-recent-blueprint-title-row span,
.bp-recent-blueprint-copy p,
.bp-recent-blueprint-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
}

.bp-recent-blueprint-title-row strong {
  font-size: calc(0.74rem * var(--bp-ui-scale));
  line-height: 1.25;
  white-space: nowrap;
}

.bp-recent-blueprint-title-row span,
.bp-recent-blueprint-copy small {
  color: var(--bp-muted);
  font-size: calc(0.66rem * var(--bp-ui-scale));
  line-height: 1.2;
  white-space: nowrap;
}

.bp-recent-blueprint-copy p {
  margin: calc(4px * var(--bp-ui-scale)) 0;
  color: var(--bp-text);
  font-size: calc(0.66rem * var(--bp-ui-scale));
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.bp-recent-blueprint-meta {
  display: flex;
  flex-wrap: wrap;
  gap: calc(6px * var(--bp-ui-scale));
  margin-bottom: calc(2px * var(--bp-ui-scale));
  color: var(--bp-muted);
  font-size: calc(0.66rem * var(--bp-ui-scale));
  line-height: 1.15;
}

.bp-recent-blueprint-open {
  min-height: calc(26px * var(--bp-ui-scale));
  padding: 0 calc(10px * var(--bp-ui-scale));
  font-size: calc(0.64rem * var(--bp-ui-scale));
}

.bp-recent-blueprint-card-skeleton {
  cursor: default;
}

.bp-library-loading {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 0.8vw, 10px);
}

.bp-library-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(8px, 0.8vw, 10px);
  min-height: clamp(58px, 5vw, 62px);
  padding: clamp(9px, 0.9vw, 11px) clamp(10px, 0.9vw, 12px);
  border: 1px solid var(--bp-border);
  border-radius: calc(8px * var(--bp-ui-scale));
  background: var(--bp-surface);
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
  width: calc(38px * var(--bp-ui-scale));
  height: calc(38px * var(--bp-ui-scale));
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
  font-size: calc(0.86rem * var(--bp-ui-scale));
  color: var(--bp-text);
  font-weight: 600;
}

.bp-library-copy small {
  margin-top: calc(5px * var(--bp-ui-scale));
  color: #6f685d;
  font-size: calc(0.72rem * var(--bp-ui-scale));
}

.bp-library-icons {
  display: flex;
  align-items: center;
  gap: calc(6px * var(--bp-ui-scale));
}

.bp-library-icons img {
  width: calc(16px * var(--bp-ui-scale));
  height: calc(16px * var(--bp-ui-scale));
  object-fit: contain;
}

.bp-library-empty {
  padding: calc(12px * var(--bp-ui-scale)) calc(14px * var(--bp-ui-scale));
  border: 1px dashed rgba(94, 80, 48, 0.18);
  border-radius: calc(8px * var(--bp-ui-scale));
  color: var(--bp-muted);
  font-size: calc(0.78rem * var(--bp-ui-scale));
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
  height: calc(12px * var(--bp-ui-scale));
}

.bp-library-skeleton-line-subtitle {
  width: 44%;
  height: calc(10px * var(--bp-ui-scale));
  margin-top: calc(8px * var(--bp-ui-scale));
}

.bp-library-skeleton-dot {
  width: calc(16px * var(--bp-ui-scale));
  height: calc(16px * var(--bp-ui-scale));
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

@media (max-width: 1200px) {
  .bp-brand-title {
    font-size: 0.82rem;
  }

  .bp-brand-subtitle {
    font-size: 0.66rem;
  }

  .bp-library-copy strong {
    font-size: 0.82rem;
  }

  .bp-library-copy small,
  .bp-library-empty {
    font-size: 0.74rem;
  }
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
