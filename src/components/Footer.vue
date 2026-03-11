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

        <a
          href="/games"
          class="cta-button inline-flex items-center justify-center gap-3 font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <i class="fa-brands fa-windows text-xl"/>
          <span>下载 DpccGaming</span>
          <span class="text-2xl leading-none">→</span>
        </a>
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

          <!-- Resources -->
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
                <a href="https://github.com/DUNHKpcc/DpccGaming_V1.3" class="footer-link flex items-center gap-2">
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
                <a href="https://space.bilibili.com/397853169?spm_id_from=333.788.upinfo.head.click" class="footer-link flex items-center gap-2">
                  <img src="/SocialMediaLogo/bilibili.png" alt="Bilibili Logo" class="w-10 h-5"/>
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
                皖ICP备025115401号
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
</template>

<script setup>
import { computed } from 'vue'
import { useThemeStore } from '../stores/theme'

const themeStore = useThemeStore()
const currentLogo = computed(() => (themeStore.isDark ? '/logo.png' : '/logo_light.png'))

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}
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
</style>
