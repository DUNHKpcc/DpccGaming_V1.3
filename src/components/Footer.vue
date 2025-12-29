<template>
  <footer class="bg_footer text-gray-300 pt-16 pb-8">
    <div class="container mx-auto px-4">
      <!-- 顶部 CTA 区域 -->
      <div
        class="flex flex-col md:flex-row md:items-center md:justify-between gap-8 pb-12"
      >
        <div>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-2">
            Get Started with DpccGaming
          </h2>
          <p class="text-lg text-gray-400">
            免费开始收集和分享你的独立游戏
          </p>
        </div>

        <a
          href="/games"
          class="inline-flex items-center justify-center gap-3 bg-white text-black font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <i class="fa-brands fa-windows text-xl"/>
          <span>下载 DpccGaming</span>
          <span class="text-2xl leading-none">→</span>
        </a>
      </div>

      <div class="border-t border-gray-800 pt-10">
        <div
          class="grid grid-cols-1 md:grid-cols-4 gap-10 pb-10 text-sm md:text-base"
        >
          <div>
            <div class="flex items-center mb-4">
              <img
                src="/logo.png"
                alt="DpccGaming Logo"
                class="w-8 h-8 mr-2"
              />
              <span class="text-xl font-semibold text-white">
                DpccGaming
              </span>
            </div>
            <p class="text-gray-500 max-w-xs">
              面向个人开发者的游戏收集与分发平台，在一个地方展示、分享和发现创意作品。
            </p>
          </div>

          <div>
            <h3 class="text-gray-400 font-semibold mb-3">条款</h3>
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
          <div>
            <h3 class="text-gray-400 font-semibold mb-3">资源</h3>
            <ul class="space-y-2">
              <li>
                <router-link to="/docs" class="footer-link flex items-center gap-2">
                  <i class="fa-solid fa-book-open text-sm" />
                  <span>开发文档</span>
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

          <div>
            <h3 class="text-gray-400 font-semibold mb-3">联系我们</h3>
            <ul class="space-y-2">
              <li>
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
          class="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs md:text-sm text-gray-500"
        >
          <div class="space-y-1 text-center md:text-left">
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
            class="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
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
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}
</script>

<style scoped>
.bg_footer {
  background: rgb(29, 29, 31) !important;
  background-color: rgb(29, 29, 31) !important;
}

.footer-link {
  color: rgba(229, 231, 235, 0.8);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: #ffffff;
}

.footer-icon-link {
  color: rgba(229, 231, 235, 0.7);
  transition: color 0.2s ease, transform 0.2s ease;
}

.footer-icon-link:hover {
  color: #ffffff;
  transform: translateY(-1px);
}
</style>
