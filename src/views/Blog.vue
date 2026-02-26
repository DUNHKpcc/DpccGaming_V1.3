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
  image: `/Blog/${p.imageName}`
}))
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
