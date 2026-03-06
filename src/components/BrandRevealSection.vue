<template>
  <section ref="sectionRef" class="brand-reveal-section">
    <div class="brand-reveal-sticky" :style="stickyStyle">
      <div class="brand-reveal-bg" :style="backgroundStyle" />

      <div class="footer-blocker" :style="blockerStyle">
        <div class="footer-blocker-line" />
        <p class="footer-blocker-title">SCROLL TO BREAK THROUGH</p>
        <p class="footer-blocker-hint">Footer has ended. Keep scrolling.</p>
      </div>

      <div class="logo-stage" :style="logoStageStyle">
        <div class="brand-logo-shell" aria-hidden="true">
          <p class="brand-logo" :style="logoStyle">DPCC</p>
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

const blockerProgress = computed(() => clamp(progress.value / 0.62))
const revealProgress = computed(() => clamp((progress.value - 0.62) / 0.38))

const easedBlockerProgress = computed(() => {
  const p = blockerProgress.value
  return 1 - Math.pow(1 - p, 3)
})

const easedRevealProgress = computed(() => {
  const p = revealProgress.value
  return 1 - Math.pow(1 - p, 3)
})

const logoStyle = computed(() => {
  const p = easedRevealProgress.value
  const y = prefersReducedMotion.value ? (1 - p) * 6 : (1 - p) * 26
  const scale = prefersReducedMotion.value ? 1 : 0.94 + p * 0.06
  const clipTop = (1 - p) * 100

  return {
    transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
    opacity: (0.1 + p * 0.9).toFixed(3),
    clipPath: `inset(${clipTop}% 0 0 0)`
  }
})

const blockerStyle = computed(() => {
  const p = easedBlockerProgress.value
  const reveal = easedRevealProgress.value
  return {
    opacity: (0.22 + (1 - reveal) * 0.78).toFixed(3),
    transform: `translate3d(0, ${prefersReducedMotion.value ? 0 : -p * 8}px, 0)`
  }
})

const logoStageStyle = computed(() => {
  const p = easedRevealProgress.value
  const y = prefersReducedMotion.value ? (1 - p) * 4 : (1 - p) * 36
  return {
    opacity: (0.06 + p * 0.94).toFixed(3),
    transform: `translate3d(-50%, ${y}px, 0)`
  }
})

const stickyStyle = computed(() => ({
  '--reveal-progress': easedRevealProgress.value.toFixed(3),
  '--blocker-progress': easedBlockerProgress.value.toFixed(3)
}))

const backgroundStyle = computed(() => {
  const p = easedRevealProgress.value
  const subtleLift = prefersReducedMotion.value ? 0 : (1 - p) * 12
  return {
    transform: `translate3d(0, ${subtleLift}px, 0)`,
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
  height: 185vh;
  margin-top: -1px;
}

.brand-reveal-sticky {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  padding: clamp(2rem, 5vw, 4rem) clamp(1rem, 4vw, 2.5rem);
  isolation: isolate;
  background: var(--brand-bg, #000000);
}

.brand-reveal-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  will-change: transform, opacity;
  background:
    radial-gradient(circle at 50% 106%, rgba(255, 255, 255, 0.12), transparent 44%),
    linear-gradient(180deg, rgba(17, 17, 18, 1) 0%, rgba(0, 0, 0, 1) 100%);
}

[data-theme="light"] .brand-reveal-sticky {
  --brand-bg: #ffffff;
}

[data-theme="light"] .brand-reveal-bg {
  background:
    radial-gradient(circle at 50% 106%, rgba(0, 0, 0, 0.06), transparent 44%),
    linear-gradient(180deg, rgba(248, 248, 249, 1) 0%, rgba(255, 255, 255, 1) 100%);
}

.footer-blocker {
  position: absolute;
  inset: auto 0 0;
  height: clamp(8.2rem, 22vh, 12rem);
  z-index: 3;
  padding: clamp(0.9rem, 2vh, 1.25rem) clamp(1rem, 3vw, 1.8rem);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.48) 24%,
      rgba(0, 0, 0, 0.78) 100%
    );
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 -14px 30px rgba(0, 0, 0, 0.34);
  will-change: transform, opacity;
}

[data-theme="light"] .footer-blocker {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(245, 245, 247, 0.72) 24%,
      rgba(255, 255, 255, 0.9) 100%
    );
  border-top-color: rgba(0, 0, 0, 0.12);
  box-shadow: 0 -10px 22px rgba(0, 0, 0, 0.1);
}

.footer-blocker-line {
  width: min(72vw, 920px);
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.9) 50%, transparent 100%);
}

[data-theme="light"] .footer-blocker-line {
  background: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.82) 50%, transparent 100%);
}

.footer-blocker-title {
  margin: clamp(0.62rem, 1.6vh, 0.82rem) 0 0;
  font-size: clamp(0.74rem, 1.4vw, 0.9rem);
  letter-spacing: 0.3em;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.84);
  text-transform: uppercase;
}

[data-theme="light"] .footer-blocker-title {
  color: rgba(0, 0, 0, 0.78);
}

.footer-blocker-hint {
  margin: 0.28rem 0 0;
  font-size: clamp(0.66rem, 1.2vw, 0.82rem);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.56);
}

[data-theme="light"] .footer-blocker-hint {
  color: rgba(0, 0, 0, 0.5);
}

.logo-stage {
  position: absolute;
  left: 50%;
  bottom: clamp(0.35rem, 1.2vh, 0.8rem);
  z-index: 2;
  will-change: transform, opacity;
}

.brand-logo-shell {
  position: relative;
  display: inline-block;
  width: max-content;
  max-width: 96vw;
  overflow: hidden;
  border-radius: 8px;
}

.brand-logo {
  margin: 0;
  line-height: 0.78;
  letter-spacing: 0.08em;
  font-size: clamp(4.2rem, 18vw, 13rem);
  font-weight: 900;
  font-family: 'Bebas Neue', 'Segoe UI', Gadget, Tahoma, Geneva, Arial, sans-serif;
  white-space: nowrap;
  color: #ffffff;
  transform-origin: center bottom;
  will-change: transform, opacity;
  user-select: none;
}

[data-theme="light"] .brand-logo {
  color: #000000;
}

@media (max-width: 768px) {
  .brand-reveal-section {
    height: 168vh;
  }

  .footer-blocker {
    height: clamp(7.2rem, 20vh, 9.2rem);
  }

  .brand-logo {
    letter-spacing: 0.05em;
    font-size: clamp(3.6rem, 24vw, 7.8rem);
  }
}
</style>
