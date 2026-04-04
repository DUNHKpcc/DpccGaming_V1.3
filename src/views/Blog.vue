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
import { ref, reactive, onMounted } from 'vue'
import { blogPosts } from '../data/blogPosts'


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

const posts = blogPosts.map(p => ({
  ...p,
  image: `/Blog/${p.imageName}`,
  dateLabel: p.date?.includes(' ')
    ? p.date.slice(0, p.date.lastIndexOf(' '))
    : p.date,
  author: p.date?.includes(' ')
    ? p.date.slice(p.date.lastIndexOf(' ') + 1)
    : 'SunJiaHao'
}))
</script>

<style scoped>
.blog-page {
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle at top, rgba(255, 255, 255, 0.1), transparent 55%),
    radial-gradient(circle at bottom, rgba(0, 0, 0, 0.7), #050509);
}

[data-theme="light"] .blog-page {
  background:rgb(223, 222, 222);
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
}

.blog-card {
  border-radius: 12px;
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

[data-theme="light"] .blog-header h1 {
  color: #0f172a;
}

[data-theme="light"] .blog-content h2 {
  color: #0f172a;
}

[data-theme="light"] .blog-content p {
  color: rgba(30, 41, 59, 0.86);
}

[data-theme="light"] .post-meta {
  color: rgba(71, 85, 105, 0.86);
}

[data-theme="light"] .post-author {
  color: rgba(30, 41, 59, 0.86);
}

[data-theme="light"] .author-avatar {
  border-color: rgba(100, 116, 139, 0.35);
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

[data-theme="light"] .glass-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.32);
  box-shadow: 0 8px 24px rgba(148, 163, 184, 0.22);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

[data-theme="light"] .glass-card:hover {
  background: #ffffff;
  box-shadow: 0 14px 32px rgba(148, 163, 184, 0.3);
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

[data-theme="light"] .image-loading {
  background: rgba(243, 247, 255, 0.72);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
}

[data-theme="light"] .loading-spinner {
  border: 3px solid rgba(100, 116, 139, 0.3);
  border-top-color: #334155;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
