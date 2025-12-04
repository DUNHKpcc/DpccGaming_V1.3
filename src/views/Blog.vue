<template>
  <div class="blog-page">
    <div class="content-wrapper">
      <div class="container mx-auto px-4 py-8 blog-main">
        <div class="blog-header flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold text-white">开发日志</h1>
        </div>

        <!-- Only cards area scrolls -->
        <div class="blog-cards-scroll">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <article
              v-for="post in posts"
              :key="post.id"
              class="blog-card glass-card overflow-hidden flex flex-col"
            >
              <div class="blog-image-wrapper">
                <img 
                  :src="post.image" 
                  :alt="post.title" 
                  :class="['blog-image', { loaded: imagesLoaded[post.id] }]"
                  loading="lazy"
                  @error="handleImageError($event, post.id)"
                  @load="handleImageLoad($event, post.id)"
                />
                <div class="image-loading" v-if="!imagesLoaded[post.id]">
                  <div class="loading-spinner"></div>
                </div>
              </div>
              <div class="blog-content p-5 flex-1 flex flex-col">
                <h2 class="text-xl font-bold text-white mb-2">
                  {{ post.title }}
                </h2>
                <p class="text-sm text-white/60 mb-3">
                  {{ post.date }}
                </p>
                <p class="text-sm text-white/80 leading-relaxed flex-1">
                  {{ post.summary }}
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const BLOG_BASE_URL = '/Blog'


const imagesLoaded = reactive({})
const imageErrors = reactive({})

const handleImageLoad = (event, imageId) => {
  imagesLoaded[imageId] = true
  console.log(`Image ${imageId} loaded successfully`)
}

const handleImageError = (event, imageId) => {
  imagesLoaded[imageId] = true 
  imageErrors[imageId] = true
  console.warn(`Failed to load image for post ${imageId}:`, event.target.src)
}

const preloadImages = () => {
  posts.forEach(post => {
    const img = new Image()
    img.onload = () => handleImageLoad(img, post.id)
    img.onerror = () => handleImageError(img, post.id)
    img.src = post.image
    imagesLoaded[post.id] = false 
  })
}

onMounted(() => {
  preloadImages()
})

const posts = [
  {
    id: 1,
    title: '蓝图模式优化',
    date: '2025-11-29 SunJiaHao',
    image: `${BLOG_BASE_URL}/BluePrint.webp`,
    summary:
      '让游戏像搭积木一样简单'
  },
  {
    id: 1,
    title: 'Coding模式优化',
    date: '2025-11-25 SunJiaHao',
    image: `${BLOG_BASE_URL}/CodingPanelNew1.webp`,
    summary:
      '优化游戏界面'
  },
  {
    id: 2,
    title: '全新的主界面',
    date: '2025-11-23 SunJiaHao',
    image: `${BLOG_BASE_URL}/GameModal.webp`,
    summary:
      '优化游戏界面'
  },
  {
    id: 3,
    title: '全新的主界面',
    date: '2025-11-22 SunJiaHao',
    image: `${BLOG_BASE_URL}/HeroSection.webp`,
    summary:
      '完成首页重构、游戏聚合展示和账号系统集成，DpccGaming 平台正式对外开放测试。'
  },
  {
    id: 4,
    title: '页脚更新',
    date: '2025-11-21 SunJiaHao',
    image: `${BLOG_BASE_URL}/Footer.webp`,
    summary:
      '新增更多连接方式，Discord 服务器、GitHub 代码库和更新日志入口一应俱全。'
  },
  {
    id: 5,
    title: '引入 Coding 模式与嵌入式编辑器',
    date: '2025-11-15 SunJiaHao',
    image: `${BLOG_BASE_URL}/Coding.webp`,
    summary:
      '为部分游戏开放代码查看和 Coding 模式，让学习和二次创作变得更加简单。'
  },
   {
    id: 6,
    title: '新增 Light/Dark 主题切换',
    date: '2025-11-11 SunJiaHao', 
    image: `${BLOG_BASE_URL}/LightSwitch.webp`,
    summary:
      '用户现在可以在 Light 和 Dark 主题之间切换，提升使用体验。'
  },
  {
    id: 7,
    title: '更流畅的GSAP动画效果',
    date: '2025-11-09 SunJiaHao', 
    image: `${BLOG_BASE_URL}/GSAP.webp`,
    summary:
      '优化GSAP动画，提升界面交互的流畅度和视觉效果。'
  }

]
</script>

<style scoped>
.blog-page {
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle at top, rgba(255, 255, 255, 0.1), transparent 55%),
    radial-gradient(circle at bottom, rgba(0, 0, 0, 0.7), #050509);
}

.content-wrapper {
  padding-top: 5rem;
  height: 100%;
}

.blog-main {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.blog-cards-scroll {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 2rem;
}

@media (min-width: 1024px) {
  .blog-page .content-wrapper {
    padding-left: 96px;
  }
}

@media (min-width: 1536px) {
  .blog-page .content-wrapper {
    padding-left: 120px;
  }
}

.glass-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
}

.glass-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
}

.blog-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  overflow: hidden;
}

.blog-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.blog-image.loaded {
  opacity: 1;
}

.image-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
