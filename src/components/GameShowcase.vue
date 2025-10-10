<template>
  <section class="game-showcase-section relative min-h-[80vh] py-24 overflow-hidden">
    <!-- 背景毛玻璃效果 -->
    <div class="absolute inset-0 bg-gradient-to-b from-dark/90 via-primary/20 to-secondary/20 backdrop-blur-sm"></div>
    
    <!-- 背景装饰元素 -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-xl"></div>
      <div class="absolute bottom-20 right-10 w-48 h-48 bg-secondary/10 rounded-full blur-xl"></div>
      <div class="absolute top-1/2 left-1/4 w-24 h-24 bg-accent/10 rounded-full blur-lg"></div>
    </div>

    <div class="container mx-auto px-4 relative z-10">
      <!-- 标题区域 -->
      <div class="text-center mb-24">
        <h2 ref="sectionTitle" class="fade-in-up text-4xl md:text-6xl font-bold text-white mb-6">
          精选游戏
        </h2>
        <p ref="sectionSubtitle" class="fade-in-up text-xl text-white/80 max-w-2xl mx-auto">
          探索我们的游戏收藏，每一款都经过精心挑选
        </p>
      </div>

          <!-- 叠加卡片容器 -->
          <div 
            ref="cardsContainer"
            class="cards-container relative max-w-6xl mx-auto h-[800px] flex items-center justify-center"
            @mousemove="handleMouseMove"
            @mouseleave="handleMouseLeave">
        
         <!-- 主游戏卡片 - 最后一张，放在最右边 -->
         <div 
           ref="mainCard"
           class="main-game-card absolute cursor-pointer"
           :style="{ 
             zIndex: 100,
             left: `calc(50% - 200px + ${6 * 60}px)`,
             top: `calc(50% - 50px + ${5 * -5}px)`,
             transform: `translate(-50%, -50%) rotateY(${5 * 2}deg) scale(1.0)`
           }"
           @click="openMainGame">
           <div class="card-wrapper">
             <div class="card-content">
               <!-- 游戏图片 -->
               <div class="card-image">
                 <img 
                   src="/GameImg.jpg" 
                   alt="像素逃生" 
                   class="w-full h-full object-cover rounded-t-2xl"
                   loading="lazy">
                 <div class="image-overlay">
                   <div class="play-button">
                     <i class="fa fa-play text-4xl text-white"></i>
                   </div>
                 </div>
               </div>
               
               <!-- 游戏信息 -->
               <div class="card-info bg-white/90 backdrop-blur-md p-6 rounded-b-2xl">
                 <div class="flex items-center justify-between mb-4">
                   <h3 class="text-2xl font-bold text-gray-800">像素逃生</h3>
                   <div class="flex items-center">
                     <i class="fa fa-star text-yellow-500 mr-1"></i>
                     <span class="text-gray-700">1.0
                      
                     </span>
                   </div>
                 </div>
                 <p class="text-gray-600 mb-4">骑士挥舞刺刀击败骷髅的像素风格动作游戏</p>
                 <div class="flex items-center justify-between">
                   <span class="text-sm text-gray-500">
                     <i class="fa fa-gamepad mr-1"></i>
                     动作游戏
                   </span>
                   <button class="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300">
                     立即游玩
                   </button>
                 </div>
               </div>
             </div>
           </div>
         </div>

         <!-- 毛玻璃卡片组 - 依次从左到右排列，主卡片在最右边 -->
         <div 
           v-for="(card, index) in glassCards" 
           :key="card.id"
           :ref="el => cardRefs[index] = el"
           class="glass-card absolute"
           :style="{ 
             zIndex: 50 - index,
             left: `calc(50% - 200px + ${(index + 1) * 60}px)`,
             top: `calc(50% - 50px + ${index * -5}px)`,
             transform: `translate(-50%, -50%) rotateY(${index * 2}deg) scale(${0.8 + index * 0.05})`
           }">
           <div class="card-wrapper">
             <div class="card-content">
               <!-- 毛玻璃装饰 -->
               <div class="glass-decoration">
                 <div class="w-full h-48 bg-gradient-to-br from-white/10 to-white/5 rounded-t-2xl flex items-center justify-center">
                   <div class="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
                     <i class="fa fa-gamepad text-white/60 text-3xl"></i>
                   </div>
                 </div>
               </div>
               
               <!-- 毛玻璃信息 -->
               <div class="card-info bg-white/10 backdrop-blur-md p-6 rounded-b-2xl">
                 <div class="flex items-center justify-between mb-2">
                   <h3 class="text-xl font-bold text-white/90">精选游戏</h3>
                   <div class="flex items-center">
                     <i class="fa fa-star text-yellow-400 mr-1"></i>
                     <span class="text-white/80">{{ games[index]?.average_rating || '0.0' }}</span>
                   </div>
                 </div>
                 <p class="text-white/70 text-sm mb-4">探索更多精彩游戏体验</p>
                 <div class="flex items-center justify-center">
                   <button class="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300">
                     <i class="fa fa-play mr-2"></i>
                     开始游戏
                   </button>
                 </div>
               </div>
             </div>
           </div>
         </div>

      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useModalStore } from '../stores/modal'
import { useGameStore } from '../stores/game'

// 注册GSAP插件
gsap.registerPlugin(ScrollTrigger)

const modalStore = useModalStore()
const gameStore = useGameStore()

// 响应式数据
const cardRefs = ref([])

// 获取游戏数据
const games = computed(() => gameStore.games.slice(0, 5)) // 取前5个游戏用于展示

// 模板引用
const sectionTitle = ref(null)
const sectionSubtitle = ref(null)
const mainCard = ref(null)
const cardsContainer = ref(null)

// 毛玻璃卡片数据
const glassCards = ref([
  { id: 1, title: '精选游戏 1' },
  { id: 2, title: '精选游戏 2' },
  { id: 3, title: '精选游戏 3' },
  { id: 4, title: '精选游戏 4' },
  { id: 5, title: '精选游戏 5' }
])

// 打开主游戏
const openMainGame = () => {
  const game = {
    id: 'web-mobile-001',
    game_id: 'web-mobile-001',
    title: '像素逃生',
    description: '骑士挥舞刺刀击败骷髅的像素风格动作游戏',
    average_rating: '4.8',
    play_count: 0,
    category: '动作'
  }
  modalStore.openGameModal(game)
}

// 打开添加游戏模态框
const openAddGameModal = () => {
  modalStore.openModal('addGame')
}


// 鼠标移动处理
const handleMouseMove = (event) => {
  if (!cardsContainer.value) return

  const rect = cardsContainer.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 计算鼠标相对于容器中心的偏移
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const offsetX = (x - centerX) / centerX
  const offsetY = (y - centerY) / centerY

  // 根据鼠标位置移动卡片
  animateCardsOnMouseMove(offsetX, offsetY)
}

// 鼠标离开处理
const handleMouseLeave = () => {
  // 重置所有卡片位置
  resetCardsPosition()
}

// 根据鼠标位置动画卡片
const animateCardsOnMouseMove = (offsetX, offsetY) => {
  const cards = [...cardRefs.value.filter(Boolean), mainCard.value] // 毛玻璃卡片在前，主卡片在最后
  
  cards.forEach((card, index) => {
    if (!card) return
    
    // 计算每张卡片的偏移量
    const intensity = 1 - (index * 0.15) // 后面的卡片移动幅度更小
    const moveX = offsetX * 30 * intensity
    const moveY = offsetY * 20 * intensity
    const rotateY = offsetX * 10 * intensity
    const rotateX = -offsetY * 5 * intensity
    
    if (index === cards.length - 1) {
      // 主卡片 - 最后一张
      gsap.to(card, {
        x: moveX,
        y: moveY + (5 * -5), // 使用您修改的垂直位置
        rotationY: rotateY + (5 * 2),
        rotationX: rotateX,
        scale: 1 + (Math.abs(offsetX) + Math.abs(offsetY)) * 0.05,
        duration: 0.6,
        ease: "power2.out"
      })
    } else {
      // 毛玻璃卡片 - 从左到右排列
      gsap.to(card, {
        x: moveX,
        y: moveY + (index * -5), // 使用您修改的垂直位置
        rotationY: rotateY + (index * 2),
        rotationX: rotateX,
        scale: (0.8 + index * 0.05) + (Math.abs(offsetX) + Math.abs(offsetY)) * 0.02,
        duration: 0.6,
        ease: "power2.out"
      })
    }
  })
}

// 重置卡片位置
const resetCardsPosition = () => {
  const cards = [...cardRefs.value.filter(Boolean), mainCard.value] // 毛玻璃卡片在前，主卡片在最后

  cards.forEach((card, index) => {
    if (!card) return

    if (index === cards.length - 1) {
      // 主卡片重置到最后位置
      gsap.to(card, {
        x: 0,
        y: 5 * -5, // 使用您修改的垂直位置
        rotationY: 5 * 2,
        rotationX: 0,
        scale: 1,
        duration: 0.8,
        ease: "power3.out"
      })
    } else {
      // 毛玻璃卡片重置到从左到右位置
      gsap.to(card, {
        x: 0,
        y: index * -5, // 使用您修改的垂直位置
        rotationY: index * 2,
        rotationX: 0,
        scale: 0.8 + (index * 0.05),
        duration: 0.8,
        ease: "power3.out"
      })
    }
  })
}

// 执行卡片动画的函数
const executeCardAnimation = (cards) => {
  // 创建新的时间线用于动画
  const animationTl = gsap.timeline()
  
  // 标题动画
  animationTl.to(sectionTitle.value, {
    opacity: 1,
    y: 0,
    duration: 0.6,
    ease: "power2.out"
  })
  .to(sectionSubtitle.value, {
    opacity: 1,
    y: 0,
    duration: 0.6,
    ease: "power2.out"
  }, "-=0.3")

  // 卡片渐入动画
  animationTl.to(cards, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.5,
    ease: "power2.out",
    stagger: 0.1
  })
  
  // 移动到最终位置
  cards.forEach((card, index) => {
    if (!card) return
    
    const isMainCard = card.classList.contains('main-game-card')
    const finalY = isMainCard ? 5 * -5 : index * -5
    const finalScale = isMainCard ? 1 : 0.8 + (index * 0.05)
    const finalRotation = isMainCard ? 5 * 2 : index * 2
    
    animationTl.to(card, {
      y: finalY,
      scale: finalScale,
      rotationY: finalRotation,
      duration: 0.4,
      ease: "power2.out"
    }, "-=0.2")
  })
}

// 防抖变量
let animationInProgress = false

// 初始化动画
const initAnimations = () => {
  // 首先设置卡片的初始隐藏状态
  const cards = [...cardRefs.value.filter(Boolean), mainCard.value]
  
  cards.forEach((card, index) => {
    if (!card) return
    
    // 设置初始隐藏状态 - 简化版本
    gsap.set(card, {
      opacity: 0,
      y: 30,
      scale: 0.9,
      rotationY: 0,
      rotationX: 0
    })
  })

  // 设置标题初始状态
  gsap.set([sectionTitle.value, sectionSubtitle.value], {
    opacity: 0,
    y: 20
  })

  // 创建时间线动画，使用ScrollTrigger
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.game-showcase-section',
      start: 'top 85%',
      end: 'bottom 15%',
      toggleActions: 'play none none reverse',
      refreshPriority: -1, // 降低刷新优先级
      onEnter: () => {
        if (animationInProgress) return // 防止重复触发
        animationInProgress = true
        
        // 延迟执行，确保DOM完全渲染
        setTimeout(() => {
          // 重新获取所有卡片元素
          const glassCards = document.querySelectorAll('.glass-card')
          const mainCardElement = document.querySelector('.main-game-card')
          
          const allCards = [...glassCards, mainCardElement].filter(Boolean)
          
          if (allCards.length === 0) {
            animationInProgress = false
            return
          }
          
          // 设置所有卡片的初始状态
          allCards.forEach((card, index) => {
            if (!card) return
            gsap.set(card, {
              opacity: 0,
              y: 30,
              scale: 0.9,
              rotationY: 0,
              rotationX: 0
            })
          })
          
          // 重新设置标题状态
          if (sectionTitle.value) {
            gsap.set(sectionTitle.value, { opacity: 0, y: 20 })
          }
          if (sectionSubtitle.value) {
            gsap.set(sectionSubtitle.value, { opacity: 0, y: 20 })
          }
          
          // 执行动画
          executeCardAnimation(allCards)
          
          // 延迟重置标志
          setTimeout(() => {
            animationInProgress = false
          }, 2000)
        }, 100) // 100ms延迟确保DOM渲染完成
      },
      onLeave: () => {
        // 简化重置逻辑
        const currentCards = [...cardRefs.value.filter(Boolean), mainCard.value]
        currentCards.forEach((card, index) => {
          if (!card) return
          gsap.set(card, {
            opacity: 0,
            y: 30,
            scale: 0.9,
            rotationY: 0,
            rotationX: 0
          })
        })
      },
      onEnterBack: () => {
        // ScrollTrigger 返回
      },
      onLeaveBack: () => {
        // ScrollTrigger 离开返回
      }
    }
  })

  // 主卡片悬停效果
  if (mainCard.value) {
    mainCard.value.addEventListener('mouseenter', () => {
      gsap.to(mainCard.value, {
        scale: 1.05,
        y: -10,
        duration: 0.3,
        ease: "power2.out"
      })
    })

    mainCard.value.addEventListener('mouseleave', () => {
      gsap.to(mainCard.value, {
        scale: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out"
      })
    })
  }

  // 添加游戏卡片悬停效果
  cardRefs.value.forEach((card, index) => {
    if (card) {
      card.addEventListener('mouseenter', () => {
        gsap.to(card, {
          scale: 1.02,
          y: -5,
          duration: 0.3,
          ease: "power2.out"
        })
      })

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          scale: 0.8 + (index * 0.05),
          y: index * -5, // 使用您修改的垂直位置
          duration: 0.3,
          ease: "power2.out"
        })
      })
    }
  })
}

// 滚动浮现动画
const initScrollAnimations = () => {
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

onMounted(async () => {
  // 确保游戏数据已加载
  await gameStore.loadGames()

  setTimeout(() => {
    initAnimations()
    initScrollAnimations()
  }, 500) // 增加延迟时间
})

onUnmounted(() => {
  // 清理所有ScrollTrigger
  ScrollTrigger.getAll().forEach(trigger => trigger.kill())
  
  // 清理所有GSAP动画
  gsap.killTweensOf("*")
})
</script>

<style scoped>
/* 主容器样式 */
.game-showcase-section {
  background: linear-gradient(135deg, #2D3436 0%, #6C5CE7 50%, #00B894 100%);
  position: relative;
}

/* 叠加卡片容器 */
.cards-container {
  position: relative;
  perspective: 1000px;
  transform-style: preserve-3d;
  display: flex;
  align-items: center;
  justify-content: center;
}

    /* 卡片包装器 */
    .card-wrapper {
      width: 350px;
      height: 500px;
      transform-style: preserve-3d;
      transition: all 0.3s ease;
      outline: none; /* 去除虚线框 */
    }

/* 主游戏卡片 - 与其他卡片一致 */
.main-game-card {
  z-index: 100 !important;
}

.main-game-card .card-wrapper {
  width: 450px;
  height: 600px;
}

/* 毛玻璃卡片 - 基础尺寸，通过scale缩放，无点击效果 */
.glass-card {
  z-index: 50 !important;
  cursor: default;
  pointer-events: none;
}

.glass-card .card-wrapper {
  width: 450px;
  height: 600px;
}

/* 卡片内容 - 毛玻璃效果 */
.card-content {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1.5rem;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  overflow: hidden;
  transition: all 0.3s ease;
  position: relative;
}

.card-content:hover {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transform: translateY(-5px);
}

/* 主游戏卡片 - 保持白色背景 */
.main-game-card .card-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.main-game-card .card-content:hover {
  background: rgba(255, 255, 255, 1);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transform: translateY(-5px);
}

/* 卡片图片 */
.card-image {
  position: relative;
  width: 100%;
  height: 60%;
  overflow: hidden;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.card-content:hover .card-image img {
  transform: scale(1.05);
}

/* 图片遮罩 */
.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.card-content:hover .image-overlay {
  opacity: 1;
}

/* 播放按钮 */
.play-button {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.play-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

/* 卡片信息 */
.card-info {
  padding: 1.5rem;
  height: 40%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* 毛玻璃装饰 */
.glass-decoration {
  width: 100%;
  height: 60%;
  display: flex;
  align-items: center;
  justify-content: center;
}



    /* 滚动浮现动画的初始状态 */
    .fade-in-up {
      opacity: 0;
      transform: translateY(50px);
    }

    /* 去除所有卡片的虚线框 - 超强制性规则 */
    .main-game-card,
    .add-game-card,
    .card-wrapper,
    .card-content,
    .main-game-card *,
    .add-game-card *,
    .card-wrapper *,
    .card-content * {
      outline: none !important;
      outline-width: 0 !important;
      outline-style: none !important;
      outline-color: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }

    .main-game-card:focus,
    .add-game-card:focus,
    .card-wrapper:focus,
    .card-content:focus,
    .main-game-card:focus-visible,
    .add-game-card:focus-visible,
    .card-wrapper:focus-visible,
    .card-content:focus-visible,
    .main-game-card:active,
    .add-game-card:active,
    .card-wrapper:active,
    .card-content:active,
    .main-game-card:hover,
    .add-game-card:hover,
    .card-wrapper:hover,
    .card-content:hover {
      outline: none !important;
      outline-width: 0 !important;
      outline-style: none !important;
      outline-color: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }

    /* 特别针对所有可能的焦点和交互状态 */
    .main-game-card:focus-within,
    .add-game-card:focus-within,
    .card-wrapper:focus-within,
    .card-content:focus-within {
      outline: none !important;
      outline-width: 0 !important;
      outline-style: none !important;
      outline-color: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }

    /* 确保所有可点击元素都没有虚线框 */
    .main-game-card,
    .add-game-card {
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }

    /* 特别针对按钮元素 */
    .main-game-card button,
    .add-game-card button,
    .play-button {
      outline: none !important;
      outline-width: 0 !important;
      outline-style: none !important;
      outline-color: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }

    .main-game-card button:focus,
    .add-game-card button:focus,
    .play-button:focus,
    .main-game-card button:focus-visible,
    .add-game-card button:focus-visible,
    .play-button:focus-visible,
    .main-game-card button:active,
    .add-game-card button:active,
    .play-button:active,
    .main-game-card button:hover,
    .add-game-card button:hover,
    .play-button:hover {
      outline: none !important;
      outline-width: 0 !important;
      outline-style: none !important;
      outline-color: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }

    /* 终极解决方案 - 覆盖所有可能的浏览器默认样式 */
    .main-game-card,
    .add-game-card,
    .card-wrapper,
    .card-content {
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      appearance: none !important;
      outline: none !important;
      outline-width: 0 !important;
      outline-style: none !important;
      outline-color: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }

    /* 强制去除所有可能的焦点样式 */
    .main-game-card:focus,
    .add-game-card:focus,
    .card-wrapper:focus,
    .card-content:focus,
    .main-game-card:focus-visible,
    .add-game-card:focus-visible,
    .card-wrapper:focus-visible,
    .card-content:focus-visible,
    .main-game-card:active,
    .add-game-card:active,
    .card-wrapper:active,
    .card-content:active,
    .main-game-card:hover,
    .add-game-card:hover,
    .card-wrapper:hover,
    .card-content:hover {
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      appearance: none !important;
      outline: none !important;
      outline-width: 0 !important;
      outline-style: none !important;
      outline-color: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }

/* 响应式设计 */
@media (max-width: 768px) {
  .cards-container {
    height: 500px;
  }
  
  .card-wrapper {
    width: 280px;
    height: 400px;
  }
  
  .main-game-card .card-wrapper {
    width: 320px;
    height: 450px;
  }
  
  .glass-card .card-wrapper {
    width: 260px;
    height: 380px;
  }
  
  .section-title {
    font-size: 2.5rem;
  }
  
  .section-subtitle {
    font-size: 1.125rem;
  }
}

@media (max-width: 480px) {
  .cards-container {
    height: 450px;
  }
  
  .card-wrapper {
    width: 250px;
    height: 350px;
  }
  
  .main-game-card .card-wrapper {
    width: 280px;
    height: 400px;
  }
  
  .glass-card .card-wrapper {
    width: 230px;
    height: 330px;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .cards-wrapper {
    gap: 1rem;
    padding: 0.5rem 0;
  }
  
  .card-wrapper {
    width: 280px;
    height: 400px;
  }
  
  .main-game-card .card-wrapper {
    width: 350px;
    height: 500px;
  }
  
  .glass-card .card-wrapper {
    width: 280px;
    height: 400px;
  }
}

@media (max-width: 480px) {
  .cards-wrapper {
    gap: 0.75rem;
  }
  
  .card-wrapper {
    width: 250px;
    height: 350px;
  }
  
  .main-game-card .card-wrapper {
    width: 280px;
    height: 400px;
  }
  
  .glass-card .card-wrapper {
    width: 250px;
    height: 350px;
  }
}
</style>
