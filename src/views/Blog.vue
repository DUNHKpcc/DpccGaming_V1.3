<template>
  <div class="blog-page">
    <div class="content-wrapper">
      <div class="container mx-auto px-4 py-8 blog-main">
        <div class="blog-header flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold">开发日志</h1>
        </div>

        <!-- Only cards area scrolls -->
        <div class="blog-cards-scroll">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <article
              v-for="post in posts"
              :key="post.cardId"
              class="blog-card glass-card overflow-hidden flex flex-col"
              :style="getPostThemeStyle(post)"
            >
              <div class="blog-image-wrapper">
                <img 
                  :src="post.image" 
                  :alt="post.title" 
                  :class="['blog-image', { loaded: imagesLoaded[post.cardId] }]"
                  loading="lazy"
                  @error="handleImageError($event, post)"
                  @load="handleImageLoad($event, post)"
                />
                <div class="image-loading" v-if="!imagesLoaded[post.cardId]">
                  <div class="loading-spinner"></div>
                </div>
              </div>
              <div class="blog-content p-5 flex-1 flex flex-col">
                <h2 class="text-xl font-bold text-white mb-2">
                  {{ post.title }}
                </h2>
                <div class="post-meta mb-3">
                  <span class="post-date">{{ post.dateLabel }}</span>
                  <span class="post-author">
                    <img src="/Ai/Sun.jpeg" alt="SunJiaHao" class="author-avatar" />
                    <span>{{ post.author }}</span>
                  </span>
                </div>
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
import { reactive, onMounted } from 'vue'
import { blogPosts } from '../data/blogPosts'
import { createSeedCardThemeStyle, extractCardThemeFromElement } from '../utils/imageTheme'


const imagesLoaded = reactive({})
const imageErrors = reactive({})
const cardThemeStyles = reactive({})

const createFallbackTheme = post =>
  createSeedCardThemeStyle(`${post?.imageName || ''}-${post?.title || ''}`)

const applyPostTheme = (source, post) => {
  if (!post?.cardId) return
  cardThemeStyles[post.cardId] = extractCardThemeFromElement(source, {
    fallbackSeed: `${post?.imageName || ''}-${post?.title || ''}`
  }) || createFallbackTheme(post)
}

const handleImageLoad = (event, post) => {
  imagesLoaded[post.cardId] = true
  applyPostTheme(event?.target, post)
}

const handleImageError = (event, post) => {
  imagesLoaded[post.cardId] = true
  imageErrors[post.cardId] = true
  cardThemeStyles[post.cardId] = createFallbackTheme(post)
  console.warn(`Failed to load image for post ${post.cardId}:`, event.target.src)
}

const initializeCards = () => {
  posts.forEach(post => {
    imagesLoaded[post.cardId] = false
    cardThemeStyles[post.cardId] = createFallbackTheme(post)
  })
}

onMounted(() => {
  initializeCards()
})

const posts = blogPosts.map((p, index) => ({
  ...p,
  cardId: `${p.imageName || 'blog'}-${index}`,
  image: `/Blog/${p.imageName}`,
  dateLabel: p.date?.includes(' ')
    ? p.date.slice(0, p.date.lastIndexOf(' '))
    : p.date,
  author: p.date?.includes(' ')
    ? p.date.slice(p.date.lastIndexOf(' ') + 1)
    : 'SunJiaHao'
}))

const getPostThemeStyle = post => cardThemeStyles[post.cardId]
</script>

<style scoped>
.blog-page {
  --blog-page-bg: #000000;
  --blog-page-text: #ffffff;
  --blog-page-muted: rgba(255, 255, 255, 0.72);
  --blog-card-surface: rgba(255, 255, 255, 0.06);
  --blog-card-border: rgba(255, 255, 255, 0.14);
  --blog-card-shadow: rgba(0, 0, 0, 0.42);
  --blog-card-hover-border: rgba(255, 255, 255, 0.2);
  --blog-card-hover-shadow: rgba(0, 0, 0, 0.5);
  --blog-loading-bg: rgba(0, 0, 0, 0.42);
  --blog-spinner-track: rgba(255, 255, 255, 0.26);
  --blog-spinner-head: #ffffff;
  height: 100vh;
  overflow: hidden;
  background: var(--blog-page-bg);
  color: var(--blog-page-text);
}

[data-theme='light'] .blog-page {
  --blog-page-bg: #ffffff;
  --blog-page-text: #0f172a;
  --blog-page-muted: rgba(15, 23, 42, 0.72);
  --blog-card-surface: #ffffff;
  --blog-card-border: rgba(148, 163, 184, 0.24);
  --blog-card-shadow: rgba(148, 163, 184, 0.18);
  --blog-card-hover-border: rgba(94, 123, 160, 0.3);
  --blog-card-hover-shadow: rgba(148, 163, 184, 0.24);
  --blog-loading-bg: rgba(255, 255, 255, 0.78);
  --blog-spinner-track: rgba(100, 116, 139, 0.25);
  --blog-spinner-head: #334155;
}

.content-wrapper {
  padding-top: 0;
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
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.blog-cards-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.blog-card {
  border-radius: 18px;
}

.post-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.65);
}

.post-date {
  flex: 1;
  min-width: 0;
}

.post-author {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: rgba(255, 255, 255, 0.78);
  white-space: nowrap;
}

.author-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.blog-header h1 {
  color: var(--blog-page-text);
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
  background: var(--blog-card-surface);
  border: 1px solid var(--blog-card-border);
  box-shadow: 0 14px 34px var(--blog-card-shadow);
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}

.glass-card:hover {
  transform: translateY(-4px);
  border-color: var(--blog-card-hover-border);
  box-shadow: 0 20px 42px var(--blog-card-hover-shadow);
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

.blog-content {
  gap: 0.9rem;
  color: #ffffff;
  background:
    linear-gradient(
      180deg,
      rgba(var(--blog-card-theme-bright, 120, 150, 187), 0.94) 0%,
      rgba(var(--blog-card-theme-main, 94, 123, 160), 0.95) 45%,
      rgba(var(--blog-card-theme-deep, 45, 59, 77), 0.97) 78%,
      rgba(var(--blog-card-theme-edge, 29, 38, 50), 0.99) 100%
    );
  border-top: 1px solid rgba(255, 255, 255, 0.18);
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
  background: var(--blog-loading-bg);
  backdrop-filter: blur(6px);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--blog-spinner-track);
  border-radius: 50%;
  border-top-color: var(--blog-spinner-head);
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
