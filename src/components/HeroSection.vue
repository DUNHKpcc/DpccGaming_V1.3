<template>
  <section ref="heroSection" class="hero-section relative flex items-center justify-center">
    <div class="absolute inset-0 bg-black"></div>
    <div class="relative z-10 w-full">
      <div class="container mx-auto px-6 md:px-10">
        <div class="hero-content flex flex-col items-center text-center gap-12">
          <div class="hero-heading flex flex-col items-center gap-6">
            <h1 ref="heroTitle" class="hero-title uppercase">
              <span class="hero-title-line hero-title-line--small gradient-text">
                DPCC
              </span>
              <span class="hero-title-line hero-title-line--large gradient-text">
                GAMING
              </span>
            </h1>
            <p v-if="heroSubtitleText" ref="heroSubtitle" class="hero-subtitle text-white uppercase tracking-[0.4em]">
              {{ heroSubtitleText }}
            </p>
            <div ref="heroActions" class="hero-actions flex flex-col sm:flex-row items-center gap-4">
              <button @click="scrollToGames" class="hero-button">
                立即开始
              </button>
              <button @click="scrollToFeatures" class="hero-button">
                了解更多
              </button>
            </div>
          </div>
          <div class="hero-image-wrapper" :style="heroImageWrapperStyle">
            <div ref="heroImage" class="hero-spline">
               <iframe src='https://my.spline.design/nintendoswitchcopy-IVP00AdsHDXPUiPtmMtHq6sY/' frameborder='0' width='100%' height='100%'></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const router = useRouter()

const heroSection = ref(null)
const heroTitle = ref(null)
const heroSubtitle = ref(null)
const heroImage = ref(null)
const heroActions = ref(null)

const heroSubtitleText = '为个人开发者打造的游戏聚合平台'

let heroTimeline = null

const heroImageOffset = ref('2rem')
const heroImageTabletOffset = ref('1.5rem')
const heroImageMobileOffset = ref('1rem')

const heroImageWrapperStyle = computed(() => ({
  '--hero-image-offset': heroImageOffset.value,
  '--hero-image-tablet-offset': heroImageTabletOffset.value,
  '--hero-image-mobile-offset': heroImageMobileOffset.value
}))

const scrollToGames = () => {
  router.push('/games')
}

const scrollToFeatures = () => {
  const gameShowcaseSection = document.querySelector('.game-showcase-section')
  if (gameShowcaseSection) {
    gameShowcaseSection.scrollIntoView({ behavior: 'smooth' })
  }
}

const initAnimations = () => {
  const titleEl = heroTitle.value
  const subtitleEl = heroSubtitle.value
  const imageEl = heroImage.value
  const actionsEl = heroActions.value

  const headlineElements = [titleEl, subtitleEl, actionsEl].filter(Boolean)
  gsap.set(headlineElements, { opacity: 0, y: 50 })

  if (imageEl) {
    gsap.set(imageEl, { opacity: 1, y: 0, scale: 1 })
  }

  if (heroTimeline) {
    heroTimeline.kill()
  }

  heroTimeline = gsap.timeline({ delay: 0.25, defaults: { ease: 'power3.out' } })

  if (titleEl) {
    heroTimeline.to(titleEl, { opacity: 1, y: 0, duration: 1 })
  }

  if (subtitleEl) {
    heroTimeline.to(subtitleEl, { opacity: 1, y: 0, duration: 1 }, '-=0.6')
  }

  if (actionsEl) {
    heroTimeline.to(actionsEl, { opacity: 1, y: 0, duration: 1 }, '-=0.3')
  }
}

const initScrollAnimations = () => {
  const elements = document.querySelectorAll('.fade-in-up')

  elements.forEach((element) => {
    gsap.fromTo(
      element,
      {
        opacity: 0,
        y: 50
      },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 80%',
          end: 'bottom 20%',
          toggleActions: 'play none none reverse'
        }
      }
    )
  })
}

onMounted(() => {
  requestAnimationFrame(() => {
    initAnimations()
    initScrollAnimations()
  })
})

onUnmounted(() => {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill())

  if (heroTimeline) {
    heroTimeline.kill()
    heroTimeline = null
  }
})
</script>

<style scoped>
.hero-section {
  background-color: #000;
  padding: 6rem 0 5rem;
  min-height: 62.5rem; /* 1000px */
}

.hero-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  overflow: visible;
}

.hero-heading {
  position: relative;
  z-index: 2;
}

.hero-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.6rem, 2vw, 1rem);
}

.hero-title-line {
  display: block;
  letter-spacing: 0.3em;
  line-height: 0.9;
}

.hero-title-line--small {
  font-size: clamp(2.8rem, 6.8vw, 5.2rem);
  font-weight: 800;
}

.hero-title-line--large {
  font-size: clamp(4.2rem, 11vw, 9rem);
  font-weight: 900;
  letter-spacing: 0.15em;
}

.gradient-text {
  background: linear-gradient(to left, rgb(29, 29, 31) 0%, #ffffff 75%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-subtitle {
  font-size: clamp(1rem, 2vw, 1.35rem);
}

.hero-image-wrapper {
  position: relative;
  width: min(100%, 1520px);
  margin: 30px auto 0;
  z-index: 1;
  display: flex;
  justify-content: center;
  transform: translateY(var(--hero-image-offset, 0));
}

.hero-spline {
  position: relative;
  display: block;
  width: 100%;
  max-width: 1520px;
  margin: -250px auto 20px;
  height: clamp(770px, 68vh, 1000px);
  box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);
  transition: transform 0.6s ease;
  background: transparent;
}

.hero-spline iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.hero-actions {
  display: flex;
  justify-content: center;
}

.hero-button {
  background-color: #fff;
  color: #000;
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.9rem 2.75rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease, color 0.3s ease;
  border: none;
  cursor: pointer;
}

.hero-button:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 20px 35px rgba(255, 255, 255, 0.18);
}

.hero-button:active {
  transform: translateY(0);
  box-shadow: 0 12px 24px rgba(255, 255, 255, 0.12);
}

@media (max-width: 768px) {
  .hero-section {
    padding: 4.5rem 0 3.5rem;
    min-height: 90vh;
  }

  .hero-content {
    gap: 8rem;
  }

  .hero-heading {
    gap: 2rem;
  }

  .hero-image-wrapper {
    width: min(100%, 860px);
    transform: translateY(var(--hero-image-tablet-offset, 0));
  }

  .hero-spline {
    width: 100%;
    max-width: 960px;
    height: 520px;
    border-radius: 1rem;
    margin: 0 auto;
  }

  .hero-title-line--large {
    letter-spacing: 0.12em;
  }
}

@media (max-width: 640px) {
  .hero-title {
    letter-spacing: 0.08em;
  }

  .hero-subtitle {
    letter-spacing: 0.3em;
  }

  .hero-actions {
    width: 100%;
  }

  .hero-button {
    width: 100%;
  }

  .hero-image-wrapper {
    width: 100%;
    transform: translateY(var(--hero-image-mobile-offset, 0));
  }

  .hero-spline {
    width: 100%;
    max-width: 720px;
    height: 420px;
    margin: 0 auto;
  }
}

.fade-in-up {
  opacity: 0;
  transform: translateY(40px);
}
</style>






