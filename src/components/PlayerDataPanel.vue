<template>
  <div class="player-data-panel">
    <div
      class="player-hero player-editable-surface"
      :class="{ 'is-disabled': coverUploading }"
      :style="heroStyle"
      role="button"
      tabindex="0"
      aria-label="更换背景图"
      @click="requestCoverUpload"
      @keyup.enter.prevent="requestCoverUpload"
      @keyup.space.prevent="requestCoverUpload"
    >
      <div class="player-hero-mask"></div>
      <button
        type="button"
        class="player-hero-edit-btn"
        :disabled="coverUploading"
        @click.stop="requestCoverUpload"
      >
        <i class="fa fa-image"></i>
        <span>{{ coverUploading ? '上传中...' : '更换背景图' }}</span>
      </button>
    </div>

    <div class="player-body">
      <section class="player-section">
        <div class="player-section-head">
          <div class="player-section-title">个人简介</div>
          <span class="player-edit-hint">点击编辑 · 自动保存</span>
        </div>
        <textarea
          v-if="editingBio"
          ref="bioTextareaRef"
          v-model="bioDraft"
          class="player-bio-editor"
          rows="4"
          maxlength="1200"
          placeholder="输入个人简介..."
          @blur="commitBioEdit"
          @keydown.esc.prevent="cancelBioEdit"
          @keydown.ctrl.enter.prevent="commitBioEdit"
          @keydown.meta.enter.prevent="commitBioEdit"
        ></textarea>
        <p
          v-else
          class="player-bio player-editable-surface"
          :class="{ 'is-disabled': profileSaving }"
          @click="startBioEdit"
        >
          {{ profileBio }}
        </p>
      </section>

      <section class="player-section player-prefs">
        <article
          class="pref-card pref-card-editable player-editable-surface"
          :class="{ 'is-disabled': profileSaving }"
          @click="startLanguageEdit"
        >
          <span>编程语言</span>
          <select
            v-if="editingLanguage"
            v-model="languageDraft"
            class="pref-inline-select"
            @click.stop
            @change="commitLanguageEdit"
            @blur="commitLanguageEdit"
          >
            <option value="">未设置</option>
            <option v-for="option in languageOptions" :key="`lang-${option}`" :value="option">
              {{ option }}
            </option>
          </select>
          <strong v-else class="pref-value-row">
            <img
              v-if="preferredLanguageLogo"
              :src="preferredLanguageLogo"
              :alt="`${preferredLanguage} logo`"
              class="pref-logo"
            />
            <span>{{ preferredLanguage }}</span>
          </strong>
        </article>
        <article
          class="pref-card pref-card-editable player-editable-surface"
          :class="{ 'is-disabled': profileSaving }"
          @click="startEngineEdit"
        >
          <span>游戏引擎</span>
          <select
            v-if="editingEngine"
            v-model="engineDraft"
            class="pref-inline-select"
            @click.stop
            @change="commitEngineEdit"
            @blur="commitEngineEdit"
          >
            <option value="">未设置</option>
            <option v-for="option in engineOptions" :key="`engine-${option}`" :value="option">
              {{ option }}
            </option>
          </select>
          <strong v-else class="pref-value-row">
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
import { computed, nextTick, ref, watch } from 'vue'
import { resolveMediaUrl } from '../utils/media'

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
  },
  coverUploading: {
    type: Boolean,
    default: false
  },
  profileSaving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['request-cover-upload', 'auto-save-profile'])

const languageOptions = ['TypeScript', 'JavaScript', 'C#', 'Python', '其他']
const engineOptions = ['Cocos', 'Unity', 'Godot', 'Unreal', '其他']
const coverUploading = computed(() => Boolean(props.coverUploading))
const profileSaving = computed(() => Boolean(props.profileSaving))

const editingBio = ref(false)
const editingLanguage = ref(false)
const editingEngine = ref(false)
const bioDraft = ref('')
const languageDraft = ref('')
const engineDraft = ref('')
const bioTextareaRef = ref(null)

const normalizedUserId = computed(() => {
  const parsed = Number.parseInt(props.user?.id, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})

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

const profileBioRaw = computed(() => {
  const source = props.user || {}
  return String(source.bio || source.profile_bio || '').trim()
})

const profileBio = computed(() => {
  if (profileBioRaw.value) return profileBioRaw.value
  return '这个人很神秘，暂时还没有填写个人简介。'
})

const normalizeCode = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return '未知'
  if (['ts', 'typescript'].includes(normalized)) return 'TypeScript'
  if (['js', 'javascript'].includes(normalized)) return 'JavaScript'
  if (['c#', 'csharp', 'cs'].includes(normalized)) return 'C#'
  if (['python', 'py'].includes(normalized)) return 'Python'
  if (['other', 'others', '其他'].includes(normalized)) return '其他'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const normalizeEngine = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return '未知'
  if (['cocos', 'cocos creator', 'cocos-creator'].includes(normalized)) return 'Cocos'
  if (['unity'].includes(normalized)) return 'Unity'
  if (['godot'].includes(normalized)) return 'Godot'
  if (['unreal', 'ue', 'ue4', 'ue5'].includes(normalized)) return 'Unreal'
  if (['other', 'others', '其他'].includes(normalized)) return '其他'
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

const userPreferredLanguageRaw = computed(() => String(props.user?.preferred_language || '').trim())
const userPreferredEngineRaw = computed(() => String(props.user?.preferred_engine || '').trim())

const preferredLanguage = computed(() => {
  if (userPreferredLanguageRaw.value) return normalizeCode(userPreferredLanguageRaw.value)
  return pickTopPreference(
    myGames.value,
    (game) => game?.code_type || game?.codeType || game?.code_category,
    normalizeCode
  )
})

const preferredEngine = computed(() => {
  if (userPreferredEngineRaw.value) return normalizeEngine(userPreferredEngineRaw.value)
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

const toLanguageOption = (value = '') => {
  const normalized = normalizeCode(value)
  return languageOptions.includes(normalized) ? normalized : ''
}

const toEngineOption = (value = '') => {
  const normalized = normalizeEngine(value)
  return engineOptions.includes(normalized) ? normalized : ''
}

watch(
  () => [
    profileBioRaw.value,
    userPreferredLanguageRaw.value,
    preferredLanguage.value,
    userPreferredEngineRaw.value,
    preferredEngine.value
  ],
  () => {
    if (!editingBio.value) {
      bioDraft.value = profileBioRaw.value
    }
    if (!editingLanguage.value) {
      languageDraft.value = toLanguageOption(userPreferredLanguageRaw.value || preferredLanguage.value)
    }
    if (!editingEngine.value) {
      engineDraft.value = toEngineOption(userPreferredEngineRaw.value || preferredEngine.value)
    }
  },
  { immediate: true }
)

const requestCoverUpload = () => {
  if (coverUploading.value) return
  emit('request-cover-upload')
}

const startBioEdit = async () => {
  if (profileSaving.value) return
  editingBio.value = true
  bioDraft.value = profileBioRaw.value
  await nextTick()
  bioTextareaRef.value?.focus()
}

const cancelBioEdit = () => {
  editingBio.value = false
  bioDraft.value = profileBioRaw.value
}

const commitBioEdit = () => {
  if (!editingBio.value) return
  editingBio.value = false
  const next = String(bioDraft.value || '').trim()
  if (next === profileBioRaw.value) return
  emit('auto-save-profile', { bio: next })
}

const startLanguageEdit = () => {
  if (profileSaving.value) return
  editingLanguage.value = true
  languageDraft.value = toLanguageOption(userPreferredLanguageRaw.value || preferredLanguage.value)
}

const commitLanguageEdit = () => {
  if (!editingLanguage.value) return
  editingLanguage.value = false
  const next = toLanguageOption(languageDraft.value)
  const current = toLanguageOption(userPreferredLanguageRaw.value)
  if (next === current) return
  emit('auto-save-profile', { preferred_language: next })
}

const startEngineEdit = () => {
  if (profileSaving.value) return
  editingEngine.value = true
  engineDraft.value = toEngineOption(userPreferredEngineRaw.value || preferredEngine.value)
}

const commitEngineEdit = () => {
  if (!editingEngine.value) return
  editingEngine.value = false
  const next = toEngineOption(engineDraft.value)
  const current = toEngineOption(userPreferredEngineRaw.value)
  if (next === current) return
  emit('auto-save-profile', { preferred_engine: next })
}

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

.player-editable-surface {
  cursor: pointer;
  transition: filter 0.2s ease, opacity 0.2s ease;
}

.player-editable-surface:hover {
  filter: brightness(1.04);
}

.player-editable-surface.is-disabled {
  cursor: not-allowed;
  opacity: 0.72;
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

.player-hero-edit-btn {
  position: absolute;
  top: 0.7rem;
  right: 0.8rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(17, 24, 39, 0.45);
  color: #ffffff;
  padding: 0.28rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
}

.player-hero-edit-btn:disabled {
  opacity: 0.72;
  cursor: not-allowed;
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
  border-radius: 9px;
  padding: 0.7rem 0.75rem;
}

.player-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.45rem;
}

.player-section-title {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--account-text-soft);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.player-edit-hint {
  font-size: 0.68rem;
  color: var(--account-text-soft);
}

.player-bio {
  margin: 0;
  font-size: 0.85rem;
  color: var(--account-text);
  line-height: 1.45;
}

.player-bio-editor {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  border-radius: 9px;
  border: 1px solid var(--account-upload-border);
  background: var(--account-card-bg);
  color: var(--account-text);
  padding: 0.55rem 0.62rem;
  font-size: 0.82rem;
  line-height: 1.45;
  outline: none;
}

.player-prefs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.pref-card {
  border: 1px solid var(--account-upload-border);
  border-radius: 9px;
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

.pref-card-editable.is-disabled {
  pointer-events: none;
}

.pref-inline-select {
  width: 100%;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--account-upload-border);
  background: var(--account-recent-bg);
  color: var(--account-text);
  padding: 0 0.5rem;
  font-size: 0.8rem;
  outline: none;
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
  .player-hero {
    min-height: 156px;
  }

  .player-prefs {
    grid-template-columns: 1fr;
  }
}
</style>
