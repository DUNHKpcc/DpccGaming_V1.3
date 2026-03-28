<script setup>
import { computed } from 'vue'
import { categoryToZh } from '../../utils/category'
import { getGameCodeTypeIcon, getGameEngineIcon } from '../../utils/gameMetadata'
import { getGameCoverUrl } from '../../utils/gameLibraryPresentation'

const props = defineProps({
  games: { type: Array, default: () => [] },
  maxVisibleGames: { type: Number, default: 2 },
  seed: { type: String, default: '' },
  logs: { type: Array, default: () => [] },
  modelOptions: { type: Array, default: () => [] }
})

const libraryGames = computed(() =>
  props.games.map((game, index) => ({
    id: game?.game_id || game?.id || `game-${index}`,
    title: game?.title || game?.name || '像素逃生',
    categoryLabel: categoryToZh(game?.category || 'action'),
    coverUrl: getGameCoverUrl(game) || '/GameImg.jpg',
    codeTypeIcon: getGameCodeTypeIcon(game),
    engineIcon: getGameEngineIcon(game)
  }))
)

const visibleLibraryGames = computed(() => libraryGames.value.slice(0, props.maxVisibleGames))
</script>

<template>
  <aside class="bp-sidebar">
    <header class="bp-sidebar-brand">
      <div class="bp-brand-mark"></div>
      <div>
        <div class="bp-brand-title">DPCC GAMING</div>
        <div class="bp-brand-subtitle">BluePrint&amp;WorkFlow</div>
      </div>
      <button type="button" class="bp-brand-square">
        <i class="fa-regular fa-window-restore"></i>
      </button>
    </header>

    <button type="button" class="bp-side-action">
      <i class="fa fa-download"></i>
      <span>导出 JSON</span>
    </button>
    <button type="button" class="bp-side-action">
      <i class="fa fa-upload"></i>
      <span>导入</span>
    </button>
    <button type="button" class="bp-side-action">
      <i class="fa fa-trash"></i>
      <span>清空工作流</span>
    </button>

    <section class="bp-sidebar-section">
      <h3>配置工作流</h3>
      <div class="bp-model-grid">
        <button
          v-for="model in modelOptions"
          :key="model.name"
          type="button"
          class="bp-model-pill"
        >
          <span>{{ model.name }}</span>
        </button>
      </div>
      <button type="button" class="bp-side-wide-btn">
        导入自己的模型
      </button>
    </section>

    <section class="bp-sidebar-section">
      <div class="bp-section-head">
        <h3>游戏库</h3>
        <div class="bp-chevron-pair">
          <i class="fa fa-angle-left"></i>
          <i class="fa fa-angle-right"></i>
        </div>
      </div>
      <div class="bp-library-list">
        <article
          v-for="game in visibleLibraryGames"
          :key="game.id"
          class="bp-library-card"
        >
          <img
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
      </div>
    </section>

    <section class="bp-sidebar-section">
      <h3>种子</h3>
      <div class="bp-seed-box">{{ props.seed }}</div>
    </section>

    <section class="bp-sidebar-section bp-log-section">
      <h3>生成日志</h3>
      <div class="bp-log-box">
        <p v-for="(line, index) in props.logs" :key="index">{{ line }}</p>
      </div>
    </section>

    <button type="button" class="bp-side-wide-btn bp-share-btn">
      分享
    </button>
  </aside>
</template>

<style scoped>
.bp-sidebar {
  display: flex;
  flex-direction: column;
  gap: 11px;
  width: min(308px, 100%);
  min-height: 100vh;
  padding: 16px 14px 10px;
  border-right: 1px solid var(--bp-border);
  background: var(--bp-sidebar-bg);
  box-sizing: border-box;
  color: var(--bp-text);
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

.bp-brand-mark {
  width: 28px;
  height: 28px;
  background:
    linear-gradient(#101010 0 0) left 1px top 0 / 10px 28px no-repeat,
    radial-gradient(circle at 72% 22%, #101010 0 4px, transparent 4.2px),
    radial-gradient(circle at 73% 86%, #101010 0 11px, transparent 11.2px);
  position: relative;
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
  padding: 0 10px;
  border-radius: 8px;
  color: var(--bp-text);
  font-size: 0.8rem;
  font-weight: 600;
}

.bp-model-pill::before {
  content: '';
  width: 10px;
  height: 10px;
  margin-right: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff9b5c 0%, #f05d59 100%);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55);
}

.bp-model-pill:nth-child(2)::before {
  background: linear-gradient(135deg, #49e8ff 0%, #7f64ff 100%);
}

.bp-model-pill:nth-child(3)::before {
  background: linear-gradient(135deg, #ff9150 0%, #ff6b5f 100%);
}

.bp-model-pill:nth-child(4)::before {
  background: linear-gradient(135deg, #5d74ff 0%, #3b49ff 100%);
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
  color: var(--bp-muted);
}

.bp-chevron-pair i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--bp-border);
  border-radius: 999px;
  background: var(--bp-surface);
  box-shadow: var(--bp-shadow-sm);
  font-size: 0.72rem;
}

.bp-library-list {
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
