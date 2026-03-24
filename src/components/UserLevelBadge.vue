<template>
  <span v-if="levelData" class="user-level-badge-row">
    <span
      class="user-level-badge"
      :class="`tier-${levelData.tier || 'rookie'}`"
      :title="badgeTitle"
    >
      Lv{{ levelData.level }}
    </span>
    <VerificationBadge :user-id="normalizedUserId" />
  </span>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useUserLevelStore } from '../stores/userLevel'
import VerificationBadge from './VerificationBadge.vue'

const props = defineProps({
  userId: {
    type: [String, Number],
    default: null
  }
})

const userLevelStore = useUserLevelStore()

const normalizedUserId = computed(() => {
  const parsed = Number.parseInt(props.userId, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})

const levelData = computed(() => {
  if (!normalizedUserId.value) return null
  return userLevelStore.getLevel(normalizedUserId.value)
})

const badgeTitle = computed(() => {
  if (!levelData.value) return ''
  const tierLabel = levelData.value.tier_label || levelData.value.tier || 'Level'
  const days = Number(levelData.value.registration_days || 0)
  const games = Number(levelData.value.published_games || 0)
  return `${tierLabel} · 注册 ${days} 天 · 发布 ${games} 款游戏`
})

const loadLevel = () => {
  if (!normalizedUserId.value) return
  userLevelStore.ensureLevels([normalizedUserId.value])
}

onMounted(loadLevel)
watch(normalizedUserId, loadLevel)
</script>

<style scoped>
.user-level-badge-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.user-level-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  color: #f5f8ff;
  border: 1px solid #8ea2d8;
  text-shadow: none;
  box-shadow: none;
  vertical-align: middle;
}

.tier-rookie {
  background: linear-gradient(135deg, #4f6dff, #6d44ff);
  border-color: #9ab0ff;
  color: #eef2ff;
  box-shadow: none;
}

.tier-explorer {
  background: linear-gradient(135deg, #00c7d9, #0d78ff);
  border-color: #84e9ff;
  color: #e8fdff;
  box-shadow: none;
}

.tier-builder {
  background: linear-gradient(135deg, #22b565, #0f8a4e);
  border-color: #97f0c0;
  color: #eaffee;
  box-shadow: none;
}

.tier-master {
  background: linear-gradient(135deg, #e4a235, #c77716);
  border-color: #ffd88f;
  color: #fff6db;
  box-shadow: none;
}

.tier-legend {
  background: linear-gradient(135deg, #d84fd0, #7e4dff);
  border-color: #ffb0f4;
  color: #ffe6ff;
  box-shadow: none;
}

[data-theme='light'] .user-level-badge {
  color: #000;
}
</style>
