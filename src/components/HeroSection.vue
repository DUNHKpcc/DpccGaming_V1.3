<template>
  <section ref="heroSection" class="hero-section relative min-h-screen flex items-center justify-center overflow-hidden">
    <!-- 视频背景 -->
    <div class="absolute inset-0 z-0">
      <div v-if="videoLoading" class="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
        <div class="text-center text-white/80">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p class="text-lg">正在加载视频背景...</p>
        </div>
      </div>
      
      <video 
        ref="backgroundVideo"
        autoplay 
        muted 
        loop 
        playsinline 
        preload="metadata"
        class="w-full h-full object-cover"
        :class="{ 'opacity-0': videoLoading, 'opacity-100': !videoLoading }"
        @loadstart="showVideoLoading"
        @canplay="hideVideoLoading"
        @error="showVideoError">
        <source src="/BGV.mp4" type="video/mp4">
        您的浏览器不支持视频播放
      </video>
      
      <!-- 渐变遮罩 -->
      <div class="absolute inset-0 bg-gradient-to-b from-dark/60 to-dark/80"></div>
    </div>

    <!-- 主要内容区域 -->
    <div class="container mx-auto px-4 z-10 relative">
      <div class="flex flex-col lg:flex-row gap-8 items-center justify-center">
        <!-- 主要内容卡片 -->
        <div ref="glassCard" class="glass-card backdrop-blur-md bg-white/10 border border-white/20 rounded-3xl p-8 md:p-12 max-w-4xl mx-auto text-center flex-1">
          <!-- Logo和标题 -->
        <div ref="heroLogo" class="hero-logo mb-8">
          <div class="w-20 h-20 bg-primary/30 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <img src="/logo.png" alt="DpccGaming Logo" class="w-12 h-12">
          </div>
          <h1 ref="heroTitle" class="hero-title text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
            DpccGaming
          </h1>
          <div ref="heroSubtitle" class="hero-subtitle text-xl md:text-2xl text-white/90 font-light">
            个人开发者游戏平台
          </div>
        </div>

        <!-- 描述文字 -->
        <div ref="heroDescription" class="hero-description mb-10">
          <p class="text-lg md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto">
            专为个人开发者打造的游戏收集平台，提供HTML5游戏在线体验和分享功能
          </p>
        </div>

        <!-- 功能特色 -->
        <div ref="featuresGrid" class="features-grid grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div class="feature-item text-center">
            <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <img src="/logo.png" alt="DpccGaming Logo" class="w-8 h-8">
            </div>
            <h3 class="text-white font-semibold mb-2">丰富游戏库</h3>
            <p class="text-white/70 text-sm">精选HTML5游戏，即点即玩</p>
          </div>
          <div class="feature-item text-center">
            <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i class="fa fa-share-alt text-white text-2xl"></i>
            </div>
            <h3 class="text-white font-semibold mb-2">学习</h3>
            <p class="text-white/70 text-sm">学习如何制作游戏</p>
          </div>
          <div class="feature-item text-center">
            <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i class="fa fa-users text-white text-2xl"></i>
            </div>
            <h3 class="text-white font-semibold mb-2">社区互动</h3>
            <p class="text-white/70 text-sm">与开发者交流心得</p>
          </div>
        </div>

        <!-- 行动按钮 -->
        <div ref="heroActions" class="hero-actions">
          <button 
            @click="scrollToGames"
            class="btn-primary bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-2xl mr-4">
            <i class="fa fa-play mr-2"></i>
            立即开始
          </button>
          <button 
            @click="scrollToFeatures"
            class="btn-secondary bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 backdrop-blur-sm border border-white/30">
            <i class="fa fa-info-circle mr-2"></i>
            了解更多
          </button>
        </div>
        </div>
        
        <!-- 更新日志框 -->
        <div class="update-log-card backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 w-full lg:w-80 lg:max-w-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-white flex items-center">
              <i class="fa fa-history mr-2 text-primary"></i>
              更新日志
            </h3>
            <div class="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
              v2.1.1
            </div>
          </div>
          
          <div class="space-y-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            <div class="update-item">
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="text-sm text-white font-medium">游戏类别扩展</div>
                  <div class="text-xs text-white/70 mt-1">新增游戏引擎，代码分类</div>
                  <div class="text-xs text-white/50 mt-1">2025-10-29</div>
                </div>
              </div>
            </div>
            <div class="update-item">
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="text-sm text-white font-medium">游戏分类升级</div>
                  <div class="text-xs text-white/70 mt-1">更方便学习如何制作游戏</div>
                  <div class="text-xs text-white/50 mt-1">2025-10-20</div>
                </div>
              </div>
            </div>
            <div class="update-item">
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="text-sm text-white font-medium">网站安全维护</div>
                  <div class="text-xs text-white/70 mt-1">修复了多个安全漏洞</div>
                  <div class="text-xs text-white/50 mt-1">2025-10-19</div>
                </div>
              </div>
            </div>
            
            <div class="update-item">
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 bg-pink-400 rounded-full mt-2 flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="text-sm text-white font-medium">通知系统优化</div>
                  <div class="text-xs text-white/70 mt-1">评论回复通知支持直接跳转和高亮显示</div>
                  <div class="text-xs text-white/50 mt-1">2025-10-01</div>
                </div>
              </div>
            </div>
            
            <div class="update-item">
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="text-sm text-white font-medium">评论系统升级</div>
                  <div class="text-xs text-white/70 mt-1">新增回复折叠功能，优化评论展示体验</div>
                  <div class="text-xs text-white/50 mt-1">2025-10-01</div>
                </div>
              </div>
            </div>
            
            <div class="update-item">
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="text-sm text-white font-medium">用户界面优化</div>
                  <div class="text-xs text-white/70 mt-1">改进游戏详情页面布局和交互体验</div>
                  <div class="text-xs text-white/50 mt-1">2025-10-01</div>
                </div>
              </div>
            </div>
            
            <div class="update-item">
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="text-sm text-white font-medium">性能提升</div>
                  <div class="text-xs text-white/70 mt-1">优化页面加载速度和响应性能</div>
                  <div class="text-xs text-white/50 mt-1">2025-9-29</div>
                </div>
              </div>
            </div>
            
    
          
          <div class="mt-4 pt-3 border-t border-white/20">
            <button class="w-full text-xs text-white/80 hover:text-white transition-colors duration-300 flex items-center justify-center gap-1">
              <i class="fa fa-external-link"></i>
              查看完整更新日志
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- 滚动指示器 -->
    <div ref="scrollIndicator" class="scroll-indicator absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
      <div class="scroll-arrow animate-bounce">
        <i class="fa fa-chevron-down text-white text-2xl"></i>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// 注册GSAP插件
gsap.registerPlugin(ScrollTrigger)

// 路由
const router = useRouter()

const backgroundVideo = ref(null)
const videoLoading = ref(true)

// 模板引用
const heroSection = ref(null)
const glassCard = ref(null)
const heroLogo = ref(null)
const heroTitle = ref(null)
const heroSubtitle = ref(null)
const heroDescription = ref(null)
const featuresGrid = ref(null)
const heroActions = ref(null)
const scrollIndicator = ref(null)

const showVideoLoading = () => {
  videoLoading.value = true
}

const hideVideoLoading = () => {
  videoLoading.value = false
}

const showVideoError = () => {
  videoLoading.value = false
  console.error('视频加载失败')
}

const scrollToGames = () => {
  // 跳转到游戏库页面
  router.push('/games')
}

const scrollToFeatures = () => {
  const gameShowcaseSection = document.querySelector('.game-showcase-section')
  if (gameShowcaseSection) {
    gameShowcaseSection.scrollIntoView({ behavior: 'smooth' })
  }
}

// 初始化动画
const initAnimations = () => {
  // 设置初始状态
  gsap.set([heroLogo.value, heroTitle.value, heroSubtitle.value, heroDescription.value, featuresGrid.value, heroActions.value], {
    opacity: 0,
    y: 50
  })

  // 创建时间线动画
  const tl = gsap.timeline({ delay: 0.5 })

  // 依次显示元素
  tl.to(heroLogo.value, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power3.out"
  })
  .to(heroTitle.value, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power3.out"
  }, "-=0.5")
  .to(heroSubtitle.value, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power3.out"
  }, "-=0.5")
  .to(heroDescription.value, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power3.out"
  }, "-=0.5")
  .to(featuresGrid.value, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power3.out"
  }, "-=0.5")
  .to(heroActions.value, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power3.out"
  }, "-=0.5")

  // 滚动指示器动画
  gsap.to(scrollIndicator.value, {
    y: 10,
    duration: 1.5,
    repeat: -1,
    yoyo: true,
    ease: "power2.inOut"
  })

  // 毛玻璃卡片悬停效果
  if (glassCard.value) {
    glassCard.value.addEventListener('mouseenter', () => {
      gsap.to(glassCard.value, {
        scale: 1.02,
        duration: 0.3,
        ease: "power2.out"
      })
    })

    glassCard.value.addEventListener('mouseleave', () => {
      gsap.to(glassCard.value, {
        scale: 1,
        duration: 0.3,
        ease: "power2.out"
      })
    })
  }

  // 功能特色项悬停效果
  const featureItems = document.querySelectorAll('.feature-item')
  featureItems.forEach((item, index) => {
    item.addEventListener('mouseenter', () => {
      gsap.to(item, {
        scale: 1.05,
        y: -5,
        duration: 0.3,
        ease: "power2.out"
      })
    })

    item.addEventListener('mouseleave', () => {
      gsap.to(item, {
        scale: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out"
      })
    })
  })
}

// 滚动浮现动画
const initScrollAnimations = () => {
  // 为页面中的其他元素添加滚动浮现效果
  const elements = document.querySelectorAll('.fade-in-up')
  
  elements.forEach((element) => {
    gsap.fromTo(element, {
      opacity: 0,
      y: 50
    }, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: element,
        start: "top 80%",
        end: "bottom 20%",
        toggleActions: "play none none reverse"
      }
    })
  })
}

onMounted(() => {
  if (backgroundVideo.value) {
    backgroundVideo.value.preload = 'auto'
    backgroundVideo.value.load()
  }
  
  // 等待DOM渲染完成后初始化动画
  setTimeout(() => {
    initAnimations()
    initScrollAnimations()
  }, 100)
})

onUnmounted(() => {
  // 清理ScrollTrigger实例
  ScrollTrigger.getAll().forEach(trigger => trigger.kill())
})
</script>

<style scoped>
/* 毛玻璃效果增强 */
.glass-card {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* 功能特色项样式 */
.feature-item {
  transition: all 0.3s ease;
  cursor: pointer;
}

.feature-item:hover {
  transform: translateY(-5px);
}

/* 按钮样式增强 */
.btn-primary {
  background: linear-gradient(135deg, #6C5CE7 0%, #5A4ACB 100%);
  box-shadow: 0 4px 15px rgba(108, 92, 231, 0.4);
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #5A4ACB 0%, #4A3AB8 100%);
  box-shadow: 0 6px 20px rgba(108, 92, 231, 0.6);
  transform: translateY(-2px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}

/* 滚动指示器样式 */
.scroll-indicator {
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .container {
    flex-direction: column;
  }
  
  .update-log-card {
    width: 100%;
    max-width: 500px;
    margin-top: 2rem;
  }
}

@media (max-width: 768px) {
  .glass-card {
    padding: 1.5rem;
    margin: 1rem;
  }
  
  .hero-title {
    font-size: 3rem;
  }
  
  .hero-subtitle {
    font-size: 1.25rem;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .hero-actions {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .btn-primary,
  .btn-secondary {
    width: 100%;
    margin-right: 0;
  }
  
  .update-log-card {
    margin: 1rem;
    padding: 1rem;
  }
}

/* 更新日志框样式 */
.update-log-card {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  animation: slideInRight 1s ease-out 0.8s both;
}

.update-log-card:hover {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.update-item {
  transition: all 0.3s ease;
  padding: 0.5rem;
  border-radius: 0.5rem;
}

.update-item:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateX(4px);
}

/* 滚动条样式 */
.scrollbar-thin {
  scrollbar-width: thin;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 从右侧滑入动画 */
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 滚动浮现动画的初始状态 */
.fade-in-up {
  opacity: 0;
  transform: translateY(50px);
}

/* 确保视频背景覆盖整个区域 */
.hero-section video {
  min-width: 100%;
  min-height: 100%;
  width: auto;
  height: auto;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
