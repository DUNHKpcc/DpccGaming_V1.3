<template>
  <span
    v-if="levelData"
    class="user-level-badge"
    :class="`tier-${levelData.tier || 'rookie'}`"
    :title="badgeTitle"
  >
    Lv{{ levelData.level }}
  </span>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useUserLevelStore } from '../stores/userLevel'

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
  border: 1px solid transparent;
}

.tier-rookie {
  background: rgba(141, 152, 171, 0.2);
  border-color: rgba(141, 152, 171, 0.38);
  color: #d7dfef;
}

.tier-explorer {
  background: rgba(99, 167, 255, 0.18);
  border-color: rgba(99, 167, 255, 0.36);
  color: #d9ecff;
}

.tier-builder {
  background: rgba(107, 197, 109, 0.18);
  border-color: rgba(107, 197, 109, 0.34);
  color: #dcf6de;
}

.tier-master {
  background: rgba(227, 179, 79, 0.2);
  border-color: rgba(227, 179, 79, 0.38);
  color: #fff2d2;
}

.tier-legend {
  background: rgba(214, 118, 255, 0.18);
  border-color: rgba(214, 118, 255, 0.34);
  color: #f7ddff;
}

[data-theme='light'] .user-level-badge {
  color: #1d1d1f;
}

[data-theme='light'] .tier-rookie {
  background: rgba(96, 108, 130, 0.12);
  border-color: rgba(96, 108, 130, 0.2);
}

[data-theme='light'] .tier-explorer {
  background: rgba(51, 132, 233, 0.14);
  border-color: rgba(51, 132, 233, 0.22);
}

[data-theme='light'] .tier-builder {
  background: rgba(63, 170, 80, 0.14);
  border-color: rgba(63, 170, 80, 0.22);
}

[data-theme='light'] .tier-master {
  background: rgba(201, 152, 40, 0.16);
  border-color: rgba(201, 152, 40, 0.24);
}

[data-theme='light'] .tier-legend {
  background: rgba(165, 86, 198, 0.14);
  border-color: rgba(165, 86, 198, 0.24);
}
</style>
