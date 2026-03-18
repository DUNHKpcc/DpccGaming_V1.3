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
  border: 1px solid rgba(255, 255, 255, 0.18);
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.08), 0 0 8px rgba(0, 0, 0, 0.26);
  vertical-align: middle;
}

.tier-rookie {
  background: linear-gradient(135deg, rgba(84, 107, 255, 0.48), rgba(122, 73, 255, 0.38));
  border-color: rgba(160, 183, 255, 0.88);
  color: #eef2ff;
  box-shadow: inset 0 0 8px rgba(172, 185, 255, 0.28), 0 0 9px rgba(96, 118, 255, 0.38);
}

.tier-explorer {
  background: linear-gradient(135deg, rgba(0, 209, 224, 0.48), rgba(0, 131, 255, 0.36));
  border-color: rgba(120, 244, 255, 0.86);
  color: #e8fdff;
  box-shadow: inset 0 0 8px rgba(118, 255, 252, 0.26), 0 0 9px rgba(0, 184, 255, 0.4);
}

.tier-builder {
  background: linear-gradient(135deg, rgba(39, 193, 103, 0.48), rgba(21, 148, 82, 0.38));
  border-color: rgba(139, 255, 184, 0.86);
  color: #eaffee;
  box-shadow: inset 0 0 8px rgba(154, 255, 190, 0.26), 0 0 9px rgba(49, 222, 120, 0.42);
}

.tier-master {
  background: linear-gradient(135deg, rgba(234, 172, 53, 0.5), rgba(205, 117, 20, 0.38));
  border-color: rgba(255, 224, 138, 0.9);
  color: #fff6db;
  box-shadow: inset 0 0 8px rgba(255, 234, 162, 0.28), 0 0 10px rgba(238, 165, 62, 0.44);
}

.tier-legend {
  background: linear-gradient(135deg, rgba(224, 80, 214, 0.48), rgba(139, 84, 255, 0.38));
  border-color: rgba(255, 156, 242, 0.9);
  color: #ffe6ff;
  box-shadow: inset 0 0 8px rgba(255, 178, 246, 0.28), 0 0 10px rgba(206, 95, 246, 0.44);
}

[data-theme='light'] .user-level-badge {
  color: #000;
}
</style>
