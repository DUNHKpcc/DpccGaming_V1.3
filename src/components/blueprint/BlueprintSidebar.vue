<script setup>
import { categoryToZh } from '../../utils/category'
import { getGameCodeTypeIcon, getGameEngineIcon } from '../../utils/gameMetadata'
import { getGameCoverUrl } from '../../utils/gameLibraryPresentation'

defineProps({
  games: { type: Array, default: () => [] },
  seed: { type: String, default: '' },
  logs: { type: Array, default: () => [] },
  modelOptions: { type: Array, default: () => [] }
})
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
        <button v-for="model in modelOptions" :key="model.name" type="button" class="bp-model-pill">
          <span>{{ model.name }}</span>
        </button>
      </div>
      <button type="button" class="bp-side-wide-btn">导入自己的模型</button>
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
          v-for="game in games.slice(0, 2)"
          :key="game.game_id || game.id"
          class="bp-library-card"
        >
          <img
            class="bp-library-thumb"
            :src="getGameCoverUrl(game) || '/GameImg.jpg'"
            :alt="game.title || game.name"
          />
          <div class="bp-library-copy">
            <strong>{{ game.title || game.name || '像素逃生' }}</strong>
            <small>{{ categoryToZh(game.category || 'action') }}</small>
          </div>
          <div class="bp-library-icons">
            <img v-if="getGameCodeTypeIcon(game)" :src="getGameCodeTypeIcon(game)" alt="" />
            <img v-if="getGameEngineIcon(game)" :src="getGameEngineIcon(game)" alt="" />
          </div>
        </article>
      </div>
    </section>

    <section class="bp-sidebar-section">
      <h3>种子</h3>
      <div class="bp-seed-box">{{ seed }}</div>
    </section>

    <section class="bp-sidebar-section bp-log-section">
      <h3>生成日志</h3>
      <div class="bp-log-box">
        <p v-for="(line, index) in logs" :key="index">{{ line }}</p>
      </div>
    </section>

    <button type="button" class="bp-side-wide-btn bp-share-btn">分享</button>
  </aside>
</template>

<style scoped>
.bp-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(320px, 100%);
  min-height: 100vh;
  padding: 22px 18px 18px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top left, rgba(84, 139, 255, 0.18), transparent 36%),
    linear-gradient(180deg, #121b27 0%, #09111b 100%);
  box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.03);
  color: #f2f7ff;
}

.bp-sidebar-brand,
.bp-side-action,
.bp-side-wide-btn,
.bp-model-pill,
.bp-library-card,
.bp-brand-square {
  border: 1px solid rgba(207, 224, 250, 0.12);
  background: rgba(10, 18, 29, 0.82);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(14px);
}

.bp-sidebar-brand {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 22px;
}

.bp-brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(114, 197, 255, 0.95), rgba(49, 112, 255, 0.7)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.35), transparent);
  position: relative;
}

.bp-brand-mark::after {
  content: '';
  position: absolute;
  inset: 10px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 10px;
}

.bp-brand-title {
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.bp-brand-subtitle {
  margin-top: 3px;
  color: rgba(213, 225, 245, 0.62);
  font-size: 0.7rem;
  letter-spacing: 0.12em;
}

.bp-brand-square {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  color: #dce8ff;
}

.bp-sidebar button {
  appearance: none;
  cursor: pointer;
}

.bp-side-action,
.bp-side-wide-btn {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 0 16px;
  border-radius: 16px;
  color: #edf4ff;
  font-size: 0.95rem;
  text-align: left;
}

.bp-side-action i,
.bp-side-wide-btn i {
  width: 18px;
  text-align: center;
  color: #8eb8ff;
}

.bp-sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(207, 224, 250, 0.08);
  border-radius: 20px;
  background: rgba(6, 11, 20, 0.58);
}

.bp-sidebar-section h3 {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.bp-model-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.bp-model-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  border-radius: 14px;
  color: rgba(238, 244, 255, 0.88);
  font-size: 0.84rem;
}

.bp-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.bp-chevron-pair {
  display: inline-flex;
  gap: 8px;
  color: rgba(206, 222, 245, 0.62);
}

.bp-library-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bp-library-card {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 18px;
}

.bp-library-thumb {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  object-fit: cover;
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
  font-size: 0.92rem;
}

.bp-library-copy small {
  margin-top: 4px;
  color: rgba(212, 224, 244, 0.62);
  font-size: 0.77rem;
}

.bp-library-icons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bp-library-icons img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 6px;
}

.bp-seed-box,
.bp-log-box {
  padding: 12px 14px;
  border: 1px solid rgba(207, 224, 250, 0.08);
  border-radius: 16px;
  background: rgba(4, 10, 17, 0.72);
  color: rgba(236, 243, 255, 0.84);
}

.bp-seed-box {
  min-height: 64px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  word-break: break-all;
}

.bp-log-section {
  flex: 1;
  min-height: 0;
}

.bp-log-box {
  flex: 1;
  min-height: 140px;
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
  min-height: 52px;
  margin-top: auto;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(98, 169, 255, 0.22), rgba(16, 31, 50, 0.92));
}

@media (max-width: 960px) {
  .bp-sidebar {
    width: 100%;
    min-height: auto;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>
