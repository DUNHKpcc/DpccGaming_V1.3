<template>
  <span
    v-if="badgeMeta"
    class="verification-badge"
    :class="`verification-${resolvedType}`"
    :title="badgeMeta.label"
  >
    <svg class="verification-badge-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        v-if="resolvedType === 'enterprise'"
        d="M12 3 5 6v5c0 4.5 3 8.7 7 10 4-1.3 7-5.5 7-10V6l-7-3Zm-2 11 2-2 1.8 1.8L16.5 11l1.5 1.4-4.2 4.3L12 15l-.6.6L10 14Z"
      />
      <path
        v-else-if="resolvedType === 'creator'"
        d="m12 3.2 2.5 4.8 5.3.8-3.8 3.7.9 5.3-4.7-2.4-4.7 2.4.9-5.3-3.8-3.7 5.3-.8L12 3.2Z"
      />
      <path
        v-else-if="resolvedType === 'developer'"
        d="M9 8 5 12l4 4 1.4-1.4L7.8 12l2.6-2.6L9 8Zm6 0-1.4 1.4 2.6 2.6-2.6 2.6L15 16l4-4-4-4Z"
      />
      <path
        v-else
        d="M12 3.5A8.5 8.5 0 1 0 20.5 12 8.5 8.5 0 0 0 12 3.5Zm-1.2 12.4-2.8-2.8 1.4-1.4 1.4 1.4 3.8-3.8 1.4 1.4-5.2 5.2Z"
      />
    </svg>
    <span class="verification-badge-text">{{ badgeMeta.label }}</span>
  </span>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useUserVerificationStore } from '../stores/userVerification'

const VERIFICATION_META = {
  enterprise: { label: '企业认证' },
  creator: { label: '创作者认证' },
  beginner: { label: '初学者认证' },
  developer: { label: '开发者认证' }
}

const normalizeType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(VERIFICATION_META, normalized) ? normalized : ''
}

const props = defineProps({
  userId: {
    type: [String, Number],
    default: null
  },
  type: {
    type: String,
    default: ''
  }
})

const userVerificationStore = useUserVerificationStore()

const normalizedUserId = computed(() => {
  const parsed = Number.parseInt(props.userId, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})

const explicitType = computed(() => normalizeType(props.type))

const verificationData = computed(() => {
  if (!normalizedUserId.value) return null
  return userVerificationStore.getVerification(normalizedUserId.value)
})

const resolvedType = computed(() => {
  if (explicitType.value) return explicitType.value
  return normalizeType(verificationData.value?.verification_type)
})

const badgeMeta = computed(() => {
  if (!resolvedType.value) return null
  return VERIFICATION_META[resolvedType.value] || null
})

const loadVerification = async () => {
  if (explicitType.value || !normalizedUserId.value) return
  await userVerificationStore.ensureVerifications([normalizedUserId.value])
}

watch([normalizedUserId, explicitType], loadVerification, { immediate: true })
</script>

<style scoped>
.verification-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid #b8c7df;
  background: #f2f6ff;
  color: #1f3f72;
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  white-space: nowrap;
  vertical-align: middle;
}

.verification-badge-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  fill: currentColor;
}

.verification-badge-text {
  white-space: nowrap;
}

.verification-enterprise {
  background: #edf3ff;
  border-color: #a8c0ea;
  color: #2456a8;
}

.verification-creator {
  background: #fff7e6;
  border-color: #d4a017;
  color: #7a5a00;
}

.verification-creator .verification-badge-icon {
  color: #b8860b;
}

.verification-beginner {
  background: #f4f7fc;
  border-color: #c6d2e3;
  color: #334d73;
}

.verification-developer {
  background: #eaf4ff;
  border-color: #9fbfea;
  color: #275690;
}
</style>
