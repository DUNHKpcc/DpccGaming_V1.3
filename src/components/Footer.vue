<template>
  <footer class="bg_footer pt-16 pb-8 transition-colors duration-300">
    <div class="container mx-auto px-4">
      <div
        class="flex flex-col md:flex-row md:items-center md:justify-between gap-8 pb-12"
      >
        <div class="footer-text-offset footer-cta-copy">
          <h2 class="footer-cta-title text-3xl md:text-4xl font-bold section-title">
            Get Started with DpccGaming
          </h2>
          <p class="text-lg section-text">
            免费开始收集和分享你的独立游戏
          </p>
        </div>

        <button
          type="button"
          class="cta-button inline-flex items-center justify-center gap-3 font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          @click="openDownloadPicker"
        >
          <span>下载DPCC SWITCH</span>
          <span class="text-2xl leading-none">→</span>
        </button>
      </div>

      <div class="border-t border-gray-800/20 pt-10">
        <div
          class="grid grid-cols-1 md:grid-cols-4 gap-10 pb-10 text-sm md:text-base"
        >
          <div class="footer-text-offset">
            <div class="flex items-center">
              <img
                :src="currentLogo"
                alt="DpccGaming Logo"
                class="w-8 h-8 mr-2"
              />
              <span class="footer-brand-title text-xl font-semibold section-title">
                DpccGaming
              </span>
            </div>
            <p class="footer-brand-description section-text max-w-xs">
              面向个人开发者的游戏收集与分发平台，在一个地方展示、分享和发现创意作品。
            </p>
          </div>

          <div class="footer-text-offset">
            <h3 class="font-semibold mb-3 section-subtitle">条款</h3>
            <ul class="space-y-2">
              <li>
                <a href="#" class="footer-link">服务条款</a>
              </li>
              <li>
                <a href="#" class="footer-link">隐私政策</a>
              </li>
              <li>
                <router-link to="/cookie-policy" class="footer-link">
                  <span>Cookie 政策</span>
                </router-link>
              </li>
            </ul>
          </div>

          <div class="footer-text-offset">
            <h3 class="font-semibold mb-3 section-subtitle">资源</h3>
            <ul class="space-y-2">
              <li>
                <router-link to="/aidocs" class="footer-link flex items-center gap-2">
                  <i class="fa-solid fa-book-open text-sm" />
                  <span>AiDocs 文档</span>
                </router-link>
              </li>
              <li>
                <router-link to="/blog" class="footer-link flex items-center gap-2">
                  <i class="fa-solid fa-timeline text-sm" />
                  <span>更新日志</span>
                </router-link>
              </li>
              <li>
                <a
                  href="https://github.com/DUNHKpcc/DpccGaming_V1.3"
                  class="footer-link flex items-center gap-2"
                >
                  <i class="fa-brands fa-github text-sm" />
                  <span>GitHub</span>
                </a>
              </li>
            </ul>
          </div>

          <div class="footer-text-offset">
            <h3 class="font-semibold mb-3 section-subtitle">联系我们</h3>
            <ul class="space-y-2">
              <li class="section-text">
                <i class="fa-regular fa-message text-sm mr-2" />
                <span>反馈与建议 邮箱：sjh2329952249@163.com</span>
              </li>
              <li>
                <a href="#" class="footer-link flex items-center gap-2">
                  <i class="fa-brands fa-discord text-sm" />
                  <span>Discord</span>
                </a>
              </li>
              <li>
                <a
                  href="https://space.bilibili.com/397853169?spm_id_from=333.788.upinfo.head.click"
                  class="footer-link flex items-center gap-2"
                >
                  <img src="/SocialMediaLogo/bilibili.png" alt="Bilibili Logo" class="w-10 h-5" />
                  <span>哔哩哔哩</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="footer-bottom-row border-t border-gray-800/20 pt-6 flex flex-col items-center gap-4 text-xs md:text-sm section-text"
        >
          <div class="footer-copy space-y-1 text-center">
            <p>&copy; 2025 SunJiaHao. All rights reserved.</p>
            <p>
              <a
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                class="footer-link inline-block"
              >
                闽ICP备2025115401号
              </a>
            </p>
          </div>

          <button
            type="button"
            class="footer-back-top footer-text-offset inline-flex items-center gap-2 section-text hover:opacity-80 transition-opacity duration-200"
            @click="scrollToTop"
          >
            <span>Back to top</span>
            <span class="text-base">↑</span>
          </button>
        </div>
      </div>
    </div>
  </footer>

  <transition name="download-modal-fade">
    <div
      v-if="isDownloadPickerOpen"
      class="download-modal-backdrop"
      @click.self="closeDownloadPicker"
    >
      <div
        class="download-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-picker-title"
      >
        <button
          type="button"
          class="download-modal-close"
          aria-label="关闭下载选择弹窗"
          @click="closeDownloadPicker"
        >
          ×
        </button>

        <div class="download-modal-copy">
          <p class="download-modal-eyebrow">Download DPCC SWITCH</p>
          <h3 id="download-picker-title" class="download-modal-title">
            选择你的系统版本
          </h3>
        </div>

        <div class="download-option-grid">
          <button
            type="button"
            class="download-option-card download-option-card-disabled"
            disabled
          >
            <span class="download-option-icon">
              <i class="fa-brands fa-windows" />
            </span>
            <span class="download-option-system">Windows</span>
            <span class="download-option-caption">Windows 版本即将提供</span>
          </button>

          <a
            :href="downloadTargets.macos"
            class="download-option-card"
            @click="closeDownloadPicker"
          >
            <span class="download-option-icon">
              <i class="fa-brands fa-apple" />
            </span>
            <span class="download-option-system">macOS ARM版本（M1以上芯片）</span>
            <span class="download-option-caption">下载 DPCC SWITCH for macOS</span>
          </a>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useThemeStore } from '../stores/theme'

const themeStore = useThemeStore()
const currentLogo = computed(() => (themeStore.isDark ? '/logo.png' : '/logo_light.png'))
const isDownloadPickerOpen = ref(false)
const downloadTargets = {
  macos: '/dpcc-app/DPCC-SWITCH_3.13.0_aarch64.dmg'
}

const closeDownloadPicker = () => {
  isDownloadPickerOpen.value = false
}

const handleEscapeKey = (event) => {
  if (event.key === 'Escape') {
    closeDownloadPicker()
  }
}

const openDownloadPicker = () => {
  isDownloadPickerOpen.value = true
}

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

watch(isDownloadPickerOpen, (isOpen) => {
  if (typeof document === 'undefined') return

  document.body.style.overflow = isOpen ? 'hidden' : ''

  if (isOpen) {
    window.addEventListener('keydown', handleEscapeKey)
    return
  }

  window.removeEventListener('keydown', handleEscapeKey)
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }

  window.removeEventListener('keydown', handleEscapeKey)
})
</script>

<style scoped>
.bg_footer {
  background-color: #000000;
  color: #ffffff;
}

.footer-text-offset {
  transform: translateX(25px);
}

.footer-cta-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.footer-cta-title {
  margin: 0;
  padding: 0;
}

.footer-cta-copy .section-text {
  margin: 0;
}

.footer-bottom-row {
  position: relative;
}

.footer-copy {
  text-align: center;
}

.footer-brand-title {
  display: inline-block;
  margin: 0;
  margin-bottom: 0;
  padding: 0;
  line-height: 1;
}

.footer-brand-description {
  margin: 0;
  margin-top: 7px;
}

.section-title {
  color: #ffffff;
}

.section-subtitle {
  color: rgba(255, 255, 255, 0.9);
}

.section-text {
  color: rgba(255, 255, 255, 0.7);
}

.footer-link {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: #ffffff;
}

.cta-button {
  background-color: #ffffff;
  color: #000000;
}

.cta-button:hover {
  background-color: rgba(255, 255, 255, 0.9);
}

.download-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(10px);
}

.download-modal-panel {
  position: relative;
  width: min(100%, 720px);
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 40%),
    linear-gradient(180deg, #131313 0%, #060606 100%);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
}

.download-modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  font-size: 1.25rem;
  line-height: 1;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.download-modal-close:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.24);
  transform: translateY(-1px);
}

.download-modal-copy {
  max-width: 30rem;
  margin-bottom: 1.75rem;
}

.download-modal-eyebrow {
  margin: 0 0 0.625rem;
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.download-modal-title {
  margin: 0;
  color: #ffffff;
  font-size: clamp(1.85rem, 4vw, 2.6rem);
  line-height: 1.05;
}

.download-modal-description {
  margin: 0.85rem 0 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
  line-height: 1.65;
}

.download-option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.download-option-card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-height: 220px;
  padding: 1.4rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  color: #ffffff;
  text-decoration: none;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.download-option-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.28);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.04));
}

.download-option-card-disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.download-option-card-disabled:hover {
  transform: none;
  border-color: rgba(255, 255, 255, 0.12);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
}

.download-option-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.6rem;
  height: 3.6rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 1.6rem;
}

.download-option-system {
  color: #ffffff;
  font-size: 1.45rem;
  font-weight: 700;
}

.download-option-caption {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.95rem;
  line-height: 1.6;
}

.download-modal-fade-enter-active,
.download-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.download-modal-fade-enter-from,
.download-modal-fade-leave-to {
  opacity: 0;
}

@media (min-width: 768px) {
  .footer-bottom-row {
    min-height: 2.5rem;
  }

  .footer-back-top {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%) translateX(25px);
  }
}

@media (max-width: 767px) {
  .download-modal-panel {
    padding: 1.5rem;
    border-radius: 24px;
  }

  .download-option-grid {
    grid-template-columns: 1fr;
  }

  .download-option-card {
    min-height: auto;
  }
}

[data-theme="light"] .bg_footer {
  background-color: #ffffff;
  color: #000000;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

[data-theme="light"] .section-title {
  color: #000000;
}

[data-theme="light"] .section-subtitle {
  color: rgba(0, 0, 0, 0.8);
}

[data-theme="light"] .section-text {
  color: rgba(0, 0, 0, 0.6);
}

[data-theme="light"] .footer-link {
  color: rgba(0, 0, 0, 0.6);
}

[data-theme="light"] .footer-link:hover {
  color: #000000;
}

[data-theme="light"] .cta-button {
  background-color: #000000;
  color: #ffffff;
}

[data-theme="light"] .cta-button:hover {
  background-color: rgba(0, 0, 0, 0.85);
}

[data-theme="light"] .download-modal-panel {
  border-color: rgba(0, 0, 0, 0.1);
  background:
    radial-gradient(circle at top left, rgba(0, 0, 0, 0.03), transparent 42%),
    linear-gradient(180deg, #ffffff 0%, #f3f3f3 100%);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.15);
}

[data-theme="light"] .download-modal-close,
[data-theme="light"] .download-option-icon {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.04);
  color: #000000;
}

[data-theme="light"] .download-modal-close:hover {
  background: rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.18);
}

[data-theme="light"] .download-modal-eyebrow,
[data-theme="light"] .download-modal-description,
[data-theme="light"] .download-option-caption {
  color: rgba(0, 0, 0, 0.62);
}

[data-theme="light"] .download-modal-title,
[data-theme="light"] .download-option-system,
[data-theme="light"] .download-option-card {
  color: #000000;
}

[data-theme="light"] .download-option-card {
  border-color: rgba(0, 0, 0, 0.1);
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.015));
}

[data-theme="light"] .download-option-card:hover {
  border-color: rgba(0, 0, 0, 0.18);
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.02));
}

[data-theme="light"] .download-option-card-disabled:hover {
  border-color: rgba(0, 0, 0, 0.1);
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.015));
}
</style>
