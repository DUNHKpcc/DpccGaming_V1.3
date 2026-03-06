<template>
  <section ref="sectionRef" class="brand-reveal-section" aria-label="Brand reveal section">
    <div class="brand-reveal-sticky" :style="stickyStyle">
      <div class="brand-reveal-bg" :style="backgroundStyle" />

      <div class="brand-logo-shell" aria-hidden="true">
        <div class="brand-logo-mask" :style="maskStyle" />
        <p class="brand-logo" :style="logoStyle">DPCC</p>
      </div>

      <p class="brand-caption" :style="captionStyle">
        Built for AI-native indie game creators.
      </p>
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

const easedProgress = computed(() => {
  const p = clamp(progress.value)
  return 1 - Math.pow(1 - p, 3)
})

const logoStyle = computed(() => {
  const p = easedProgress.value
  const y = prefersReducedMotion.value ? (1 - p) * 8 : (1 - p) * 34
  const scale = prefersReducedMotion.value ? 1 : 0.93 + p * 0.07

  return {
    transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
    opacity: (0.15 + p * 0.85).toFixed(3)
  }
})

const maskStyle = computed(() => {
  const p = easedProgress.value
  const y = prefersReducedMotion.value ? -102 : -clamp(p * 115, 0, 115)
  return {
    transform: `translate3d(0, ${y}%, 0)`
  }
})

const captionStyle = computed(() => {
  const p = easedProgress.value
  return {
    opacity: (0.08 + p * 0.92).toFixed(3),
    transform: `translate3d(0, ${(1 - p) * 12}px, 0)`
  }
})

const stickyStyle = computed(() => ({
  '--reveal-progress': easedProgress.value.toFixed(3)
}))

const backgroundStyle = computed(() => {
  const p = easedProgress.value
  const subtleLift = prefersReducedMotion.value ? 0 : (1 - p) * 14
  return {
    transform: `translate3d(0, ${subtleLift}px, 0)`,
    opacity: (0.72 + p * 0.28).toFixed(3)
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
  height: 180vh;
  margin-top: -1px;
}

.brand-reveal-sticky {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: clamp(2.5rem, 5vw, 5rem) clamp(1rem, 4vw, 2.5rem);
  isolation: isolate;
  background: var(--brand-bg, #000000);
}

.brand-reveal-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  will-change: transform, opacity;
  background:
    radial-gradient(circle at 50% 110%, rgba(255, 255, 255, 0.18), transparent 44%),
    linear-gradient(180deg, rgba(29, 29, 31, 1) 0%, rgba(0, 0, 0, 1) 42%, rgba(0, 0, 0, 1) 100%);
}

[data-theme="light"] .brand-reveal-sticky {
  --brand-bg: #ffffff;
}

[data-theme="light"] .brand-reveal-bg {
  background:
    radial-gradient(circle at 50% 110%, rgba(0, 0, 0, 0.08), transparent 44%),
    linear-gradient(180deg, rgba(245, 245, 247, 1) 0%, rgba(255, 255, 255, 1) 42%, rgba(255, 255, 255, 1) 100%);
}

.brand-logo-shell {
  position: relative;
  width: 100%;
  max-width: min(1800px, 96vw);
  display: grid;
  place-items: end center;
  overflow: hidden;
}

.brand-logo {
  margin: 0;
  line-height: 0.78;
  letter-spacing: 0.08em;
  font-size: clamp(5rem, 27vw, 24rem);
  font-weight: 900;
  font-family: 'Bebas Neue', 'Segoe UI', Gadget, Tahoma, Geneva, Arial, sans-serif;
  color: #ffffff;
  transform-origin: center bottom;
  will-change: transform, opacity;
  user-select: none;
}

[data-theme="light"] .brand-logo {
  color: #000000;
}

.brand-logo-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 0%, var(--brand-bg, #000000) 20%);
  will-change: transform;
  pointer-events: none;
}

.brand-caption {
  margin: clamp(0.8rem, 2vh, 1.25rem) 0 0;
  text-transform: uppercase;
  letter-spacing: 0.4em;
  font-size: clamp(0.72rem, 1.5vw, 0.9rem);
  color: rgba(255, 255, 255, 0.64);
  will-change: transform, opacity;
}

[data-theme="light"] .brand-caption {
  color: rgba(0, 0, 0, 0.56);
}

@media (max-width: 768px) {
  .brand-reveal-section {
    height: 135vh;
  }

  .brand-reveal-sticky {
    justify-content: center;
  }

  .brand-logo {
    letter-spacing: 0.05em;
    font-size: clamp(4.2rem, 31vw, 9.6rem);
  }

  .brand-caption {
    letter-spacing: 0.22em;
    text-align: center;
  }
}
</style>
