<template>
  <section ref="sectionRef" class="brand-reveal-section">
    <div class="brand-reveal-sticky" :style="stickyStyle">
      <div class="brand-reveal-bg" :style="backgroundStyle" />

      <!-- 中间的大 Logo -->
      <div class="logo-stage" :style="logoStageStyle">
        <div class="brand-logo-shell" aria-hidden="true">
          <p class="brand-logo" :style="logoStyle">DPCC GAMING</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const sectionRef = ref(null)
const progress = ref(0)
const prefersReducedMotion = ref(false)
let rafId = 0
let mediaQuery = null
let onMotionChange = null

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const revealProgress = computed(() => clamp((progress.value - 0.2) / 0.8))

const easedRevealProgress = computed(() => {
  const p = revealProgress.value
  return 1 - Math.pow(1 - p, 3)
})

const logoStyle = computed(() => {
  const p = easedRevealProgress.value
  // 减少位移，使其更稳定地停在中间
  const y = prefersReducedMotion.value ? 0 : (1 - p) * 100 
  // 最终放大倍数
  const scale = prefersReducedMotion.value ? 1 : 0.8 + p * 0.2
  
  return {
    transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
    opacity: (0.2 + p * 0.8).toFixed(3)
  }
})

const logoStageStyle = computed(() => ({
  zIndex: 1
}))

const stickyStyle = computed(() => ({
  '--reveal-progress': easedRevealProgress.value.toFixed(3)
}))

const backgroundStyle = computed(() => {
  const p = easedRevealProgress.value
  return {
    opacity: (0.8 + p * 0.2).toFixed(3)
  }
})

const updateProgress = () => {
  if (!sectionRef.value) return
  const rect = sectionRef.value.getBoundingClientRect()
  const viewport = window.innerHeight || 1
  const totalScrollable = Math.max(rect.height - viewport, 1)
  const raw = (viewport - rect.top) / totalScrollable
  progress.value = clamp(raw)
}

const requestUpdate = () => {
  if (rafId) return
  rafId = window.requestAnimationFrame(() => {
    rafId = 0
    updateProgress()
  })
}

onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = mediaQuery.matches

  onMotionChange = (event) => {
    prefersReducedMotion.value = event.matches
  }

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', onMotionChange)
  } else {
    mediaQuery.addListener(onMotionChange)
  }

  window.addEventListener('scroll', requestUpdate, { passive: true })
  window.addEventListener('resize', requestUpdate)
  requestUpdate()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', requestUpdate)
  window.removeEventListener('resize', requestUpdate)
  if (rafId) {
    window.cancelAnimationFrame(rafId)
  }
  if (!mediaQuery || !onMotionChange) return
  if (mediaQuery.removeEventListener) {
    mediaQuery.removeEventListener('change', onMotionChange)
  } else {
    mediaQuery.removeListener(onMotionChange)
  }
})
</script>

<style scoped>
.brand-reveal-section {
  position: relative;
  height: 50vh;
  min-height: 360px;
  margin-top: 0;
}

.brand-reveal-sticky {
  position: sticky;
  top: 0;
  height: 50vh;
  overflow: hidden;
  padding: 4rem 6vw; /* 调整内边距 */
  isolation: isolate;
  background: var(--brand-bg, #000000);
  color: var(--brand-text, #ffffff);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.brand-reveal-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: #000000;
  transition: background-color 0.3s ease;
}

[data-theme="dark"] .brand-reveal-sticky {
  --brand-bg: #000000;
  --brand-text: #ffffff;
}

[data-theme="dark"] .brand-reveal-bg {
  background: #000000;
}

[data-theme="light"] .brand-reveal-sticky {
  --brand-bg: #ffffff;
  --brand-text: #000000;
}

[data-theme="light"] .brand-reveal-bg {
  background: #ffffff;
}

/* 中间 Logo */
.logo-stage {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
  padding: 0 1vw;
}

.brand-logo-shell {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
}

.brand-logo {
  margin: 0;
  max-width: 100%;
  line-height: 0.82;
  font-size: clamp(4.4rem, 14.5vw, 18rem);
  font-weight: 700;
  font-family: 'Bebas Neue', 'Segoe UI', sans-serif;
  letter-spacing: 0.01em;
  white-space: nowrap;
  color: inherit;
  will-change: transform, opacity;
  text-align: center;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .brand-reveal-section {
    min-height: 320px;
  }
  
  .brand-logo {
    font-size: clamp(3rem, 13.8vw, 8.6rem);
  }
}

@media (max-width: 480px) {
  .brand-logo {
    font-size: clamp(2.4rem, 12.8vw, 5.8rem);
  }
}
</style>
