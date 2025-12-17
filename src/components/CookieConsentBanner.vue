<template>
  <transition name="cookie-slide">
    <section
      v-if="cookieStore.bannerVisible"
      class="fixed inset-x-0 bottom-4 z-[99999] flex justify-center px-4"
      aria-live="polite"
    >
      <div class="max-w-4xl w-full bg-[#1d1d1f]/95 border border-white/20 rounded-2xl shadow-2xl p-6 text-white">
        <div class="flex items-start gap-4">
          <div class="flex-1 space-y-2">
            <p class="text-sm uppercase tracking-wide text-white/60 font-semibold">Cookie 提示</p>
            <h3 class="text-2xl font-semibold">我们重视您的隐私</h3>
            <p class="text-base text-white/80 leading-relaxed">
              我们会借助必要的 Cookie 保障站点正常运作，并可能使用分析类 Cookie 优化体验。
              您可以随时在
              <RouterLink to="/cookie-policy" class="underline decoration-dotted hover:text-white">
                Cookie 政策
              </RouterLink>
              中了解详情或更改偏好。
            </p>
          </div>
          <button
            class="text-white/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full p-2"
            type="button"
            :disabled="!cookieStore.consentStatus"
            :aria-label="cookieStore.consentStatus ? '关闭弹窗' : '请选择您的 Cookie 偏好'"
            @click="cookieStore.consentStatus ? cookieStore.closeBanner() : cookieStore.openPreferences()"
          >
            <i class="fa-solid fa-xmark text-xl" />
          </button>
        </div>

        <div
          v-if="cookieStore.showPreferences"
          class="mt-6 grid gap-4 bg-white/5 border border-white/10 rounded-xl p-4"
        >
          <div
            v-for="field in preferenceFields"
            :key="field.key"
            class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p class="font-semibold text-white">{{ field.label }}</p>
              <p class="text-sm text-white/70">{{ field.description }}</p>
            </div>
            <label class="inline-flex items-center gap-3 text-sm">
              <span class="text-white/70" v-if="field.locked">始终启用</span>
              <input
                type="checkbox"
                class="toggle-checkbox"
                :disabled="field.locked"
                :checked="localPreferences[field.key]"
                @change="onPreferenceChange(field.key, $event.target.checked)"
              >
            </label>
          </div>
        </div>

        <p v-if="cookieStore.error" class="mt-4 text-sm text-red-300">
          {{ cookieStore.error }}
        </p>

        <div class="mt-6 flex flex-wrap gap-3 justify-end">
          <button
            class="px-4 py-2 rounded-lg border border-white/30 text-sm font-medium hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            @click="cookieStore.openPreferences()"
          >
            管理偏好
          </button>
          <button
            class="px-4 py-2 rounded-lg border border-white/30 text-sm font-medium hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            :disabled="cookieStore.loading"
            @click="handleReject"
          >
            仅保留必要
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-white text-[#1d1d1f] font-semibold hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            :disabled="cookieStore.loading"
            @click="handleAccept"
          >
            接受全部
          </button>
          <button
            v-if="cookieStore.showPreferences"
            class="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            :disabled="cookieStore.loading"
            @click="handleSavePreferences"
          >
            保存偏好
          </button>
        </div>
      </div>
    </section>
  </transition>
</template>

<script setup>
import { onMounted, reactive, watch } from 'vue';
import { useCookieStore } from '../stores/cookie';

const cookieStore = useCookieStore();
const localPreferences = reactive({
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false
});

const preferenceFields = [
  {
    key: 'necessary',
    label: '必要 Cookie',
    description: '用于基础安全、登录状态与上传流程，无法关闭。',
    locked: true
  },
  {
    key: 'functional',
    label: '功能 Cookie',
    description: '记住您的主题、语言等个性化设置。',
    locked: false
  },
  {
    key: 'analytics',
    label: '分析 Cookie',
    description: '帮助我们了解站点访问情况和体验问题。',
    locked: false
  },
  {
    key: 'marketing',
    label: '营销 Cookie',
    description: '用于个性化推荐与推广内容。',
    locked: false
  }
];

const onPreferenceChange = (key, value) => {
  if (key === 'necessary') {
    localPreferences.necessary = true;
    return;
  }
  localPreferences[key] = value;
};

onMounted(() => {
  cookieStore.init();
  Object.assign(localPreferences, cookieStore.preferences);
});

watch(
  () => cookieStore.preferences,
  (value) => {
    Object.assign(localPreferences, value);
  },
  { deep: true }
);

const handleAccept = async () => {
  await cookieStore.acceptAll();
};

const handleReject = async () => {
  await cookieStore.rejectOptional();
};

const handleSavePreferences = async () => {
  await cookieStore.saveCustom({ ...localPreferences });
};
</script>

<style scoped>
.cookie-slide-enter-active,
.cookie-slide-leave-active {
  transition: all 0.4s ease;
}
.cookie-slide-enter-from,
.cookie-slide-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.toggle-checkbox {
  width: 2.75rem;
  height: 1.5rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background-color: rgba(255, 255, 255, 0.15);
  appearance: none;
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.toggle-checkbox::after {
  content: '';
  position: absolute;
  top: 0.1rem;
  left: 0.15rem;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 999px;
  background: white;
  transition: transform 0.2s ease;
}

.toggle-checkbox:checked {
  background-color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.9);
}

.toggle-checkbox:checked::after {
  transform: translateX(1.25rem);
}

.toggle-checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
