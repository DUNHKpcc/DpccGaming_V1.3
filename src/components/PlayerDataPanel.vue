<template>
  <div class="player-data-panel">
    <div class="player-hero" :style="heroStyle">
      <div class="player-hero-mask"></div>
      <div class="player-hero-main">
        <img
          :src="avatarUrl"
          alt="用户头像"
          class="player-hero-avatar"
          @error="handleAvatarError"
        />
        <div class="player-hero-meta">
          <div class="player-name-row">
            <h3>{{ username }}</h3>
            <UserLevelBadge :user-id="normalizedUserId" />
          </div>
          <p>注册 {{ registrationDays }} 天</p>
        </div>
      </div>
    </div>

    <div class="player-body">
      <section class="player-section">
        <div class="player-section-title">个人简介</div>
        <p class="player-bio">{{ profileBio }}</p>
      </section>

      <section class="player-section player-prefs">
        <article class="pref-card">
          <span>编程语言</span>
          <strong class="pref-value-row">
            <img
              v-if="preferredLanguageLogo"
              :src="preferredLanguageLogo"
              :alt="`${preferredLanguage} logo`"
              class="pref-logo"
            />
            <span>{{ preferredLanguage }}</span>
          </strong>
        </article>
        <article class="pref-card">
          <span>游戏引擎</span>
          <strong class="pref-value-row">
            <img
              v-if="preferredEngineLogo"
              :src="preferredEngineLogo"
              :alt="`${preferredEngine} logo`"
              class="pref-logo"
            />
            <span>{{ preferredEngine }}</span>
          </strong>
        </article>
      </section>

      <section class="player-section player-activity">
        <div class="player-section-title">最近动态</div>
        <div class="activity-list">
          <div
            v-for="item in recentActivities"
            :key="item.id"
            class="activity-item"
          >
            <span class="activity-dot" :class="`type-${item.type}`"></span>
            <div class="activity-copy">
              <p>{{ item.text }}</p>
              <small>{{ item.time }}</small>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getAvatarUrl, handleAvatarError } from '../utils/avatar'
import { resolveMediaUrl } from '../utils/media'
import UserLevelBadge from './UserLevelBadge.vue'

const props = defineProps({
  user: {
    type: Object,
    default: null
  },
  games: {
    type: Array,
    default: () => []
  },
  libraryGames: {
    type: Array,
    default: () => []
  }
})

const normalizedUserId = computed(() => {
  const parsed = Number.parseInt(props.user?.id, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})

const username = computed(() => {
  return String(props.user?.username || '玩家').trim() || '玩家'
})

const avatarUrl = computed(() => getAvatarUrl(props.user?.avatar_url || ''))

const myGames = computed(() => {
  if (!normalizedUserId.value) return []
  return (props.games || []).filter((game) => {
    const ownerId = Number.parseInt(game?.uploaded_by_id ?? game?.uploaded_by, 10)
    return Number.isInteger(ownerId) && ownerId === normalizedUserId.value
  })
})

const coverUrl = computed(() => {
  const customCover = props.user?.cover_url || props.user?.cover_image_url || props.user?.profile_background_url || ''
  if (String(customCover || '').trim()) {
    return resolveMediaUrl(customCover)
  }

  const gameCover = myGames.value.find((game) => game?.image_url || game?.thumbnail_url)
  if (gameCover) {
    return resolveMediaUrl(gameCover.image_url || gameCover.thumbnail_url)
  }

  return ''
})

const heroStyle = computed(() => {
  if (coverUrl.value) {
    return { backgroundImage: `url(${coverUrl.value})` }
  }

  return {
    backgroundImage: 'linear-gradient(135deg, rgba(67, 98, 228, 0.55), rgba(15, 23, 42, 0.84))'
  }
})

const profileBio = computed(() => {
  const source = props.user || {}
  const bio = source.bio || source.profile_bio || source.intro || source.signature || ''
  if (String(bio || '').trim()) {
    return String(bio).trim()
  }
  return '这个人很神秘，暂时还没有填写个人简介。'
})

const registrationDays = computed(() => {
  const createdAt = props.user?.created_at
  if (!createdAt) return 0
  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) return 0
  const diff = Date.now() - createdDate.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  return Math.max(0, days)
})

const normalizeCode = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return '未知'
  if (['ts', 'typescript'].includes(normalized)) return 'TypeScript'
  if (['js', 'javascript'].includes(normalized)) return 'JavaScript'
  if (['c#', 'csharp', 'cs'].includes(normalized)) return 'C#'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const normalizeEngine = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return '未知'
  if (['cocos', 'cocos creator', 'cocos-creator'].includes(normalized)) return 'Cocos'
  if (['unity'].includes(normalized)) return 'Unity'
  if (['godot'].includes(normalized)) return 'Godot'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const pickTopPreference = (items, getter, normalizer) => {
  if (!items.length) return '未知'

  const statMap = new Map()
  items.forEach((item) => {
    const key = normalizer(getter(item))
    statMap.set(key, (statMap.get(key) || 0) + 1)
  })

  const sorted = [...statMap.entries()].sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || '未知'
}

const languageLogoMap = {
  typescript: '/codeType/typescript.jpg',
  javascript: '/codeType/js.webp',
  'c#': '/codeType/csharp.webp'
}

const engineLogoMap = {
  cocos: '/engineType/cocos.webp',
  unity: '/engineType/unity.webp',
  godot: '/engineType/godot.webp'
}

const preferredLanguage = computed(() => {
  const fromUser = String(props.user?.preferred_language || '').trim()
  if (fromUser) return normalizeCode(fromUser)
  return pickTopPreference(
    myGames.value,
    (game) => game?.code_type || game?.codeType || game?.code_category,
    normalizeCode
  )
})

const preferredEngine = computed(() => {
  const fromUser = String(props.user?.preferred_engine || '').trim()
  if (fromUser) return normalizeEngine(fromUser)
  return pickTopPreference(
    myGames.value,
    (game) => game?.engine || game?.game_engine || game?.gameEngine,
    normalizeEngine
  )
})

const preferredLanguageLogo = computed(() => {
  const key = normalizeCode(preferredLanguage.value).toLowerCase()
  return languageLogoMap[key] || ''
})

const preferredEngineLogo = computed(() => {
  const key = normalizeEngine(preferredEngine.value).toLowerCase()
  return engineLogoMap[key] || ''
})

const formatShortTime = (rawTime) => {
  if (!rawTime) return '刚刚'
  const date = new Date(rawTime)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const recentActivities = computed(() => {
  const activities = []

  myGames.value
    .slice()
    .sort((a, b) => new Date(b?.created_at || b?.uploaded_at || 0).getTime() - new Date(a?.created_at || a?.uploaded_at || 0).getTime())
    .slice(0, 4)
    .forEach((game) => {
      activities.push({
        id: `publish-${game.game_id || game.id}`,
        type: 'publish',
        text: `发布了游戏《${game.title || '未命名游戏'}》`,
        time: formatShortTime(game.created_at || game.uploaded_at)
      })
    })

  ;(props.libraryGames || []).slice(0, 2).forEach((game) => {
    activities.push({
      id: `library-${game.game_id || game.id}`,
      type: 'library',
      text: `将《${game.title || '未命名游戏'}》加入了游戏库`,
      time: formatShortTime(game.saved_at || game.created_at)
    })
  })

  if (!activities.length) {
    activities.push({
      id: 'placeholder',
      type: 'status',
      text: '刚来到平台，正在完善自己的开发者主页。',
      time: '现在'
    })
  }

  return activities.slice(0, 6)
})
</script>

<style scoped>
.player-data-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: auto;
  background: var(--account-card-bg);
}

.player-hero {
  position: relative;
  min-height: 180px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.player-hero-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.26), rgba(0, 0, 0, 0.72));
}

.player-hero-main {
  position: relative;
  z-index: 1;
  min-height: 180px;
  padding: 1rem 1.1rem;
  display: flex;
  align-items: flex-end;
  gap: 0.85rem;
}

.player-hero-avatar {
  width: 74px;
  height: 74px;
  border-radius: 999px;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.88);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25);
}

.player-hero-meta {
  min-width: 0;
}

.player-name-row {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: 100%;
}

.player-name-row h3 {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-hero-meta p {
  margin: 0.3rem 0 0;
  font-size: 0.76rem;
  color: rgba(255, 255, 255, 0.88);
}

.player-body {
  flex: 1;
  min-height: 0;
  padding: 0.95rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: auto;
}

.player-section {
  border: 1px solid var(--account-recent-border);
  background: var(--account-recent-bg);
  border-radius: 12px;
  padding: 0.7rem 0.75rem;
}

.player-section-title {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--account-text-soft);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin-bottom: 0.45rem;
}

.player-bio {
  margin: 0;
  font-size: 0.85rem;
  color: var(--account-text);
  line-height: 1.45;
}

.player-prefs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.pref-card {
  border: 1px solid var(--account-upload-border);
  border-radius: 10px;
  background: var(--account-card-bg);
  padding: 0.62rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.pref-card span {
  font-size: 0.72rem;
  color: var(--account-text-soft);
}

.pref-card strong {
  font-size: 0.95rem;
  color: var(--account-text);
  font-weight: 700;
}

.pref-value-row {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.pref-value-row span {
  font-size: 0.95rem;
  color: var(--account-text);
  font-weight: 700;
  line-height: 1.2;
}

.pref-logo {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  object-fit: cover;
  border: 1px solid var(--account-upload-border);
  flex-shrink: 0;
}

.player-activity {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.52rem;
  overflow: auto;
  min-height: 0;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 0.52rem;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  margin-top: 0.4rem;
  flex-shrink: 0;
  background: #9ca3af;
}

.activity-dot.type-publish {
  background: #34d399;
}

.activity-dot.type-library {
  background: #60a5fa;
}

.activity-dot.type-status {
  background: #f59e0b;
}

.activity-copy {
  min-width: 0;
}

.activity-copy p {
  margin: 0;
  color: var(--account-text);
  font-size: 0.82rem;
  line-height: 1.42;
}

.activity-copy small {
  color: var(--account-text-soft);
  font-size: 0.7rem;
}

@media (max-width: 768px) {
  .player-hero,
  .player-hero-main {
    min-height: 156px;
  }

  .player-prefs {
    grid-template-columns: 1fr;
  }
}
</style>
