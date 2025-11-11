<template>
  <section ref="heroSection" class="hero-section relative">
    <!-- Waves background -->
    <div class="waves-bg absolute inset-0">
      <a-waves class="block w-full h-full"><svg class="js-svg"></svg></a-waves>
    </div>
    <!-- Banner title pinned to section bottom -->
    <div class="hero-heading">
      <h1 ref="heroTitle" class="hero-title uppercase" aria-label="DPCC GAMING">
        <span class="hero-title-line hero-title-line--small">DPCC</span>
        <span class="hero-title-line hero-title-line--large">GAMING</span>
      </h1>
    </div>
    <!-- Content on top -->
    <div class="relative z-10 w-full h-full flex items-center justify-center">
      <div class="container mx-auto px-6 md:px-10 h-full flex items-center justify-center">
        <div class="hero-content flex flex-col items-center justify-center text-center">
          <!-- banner is pinned at section level -->

          <!-- Removed middle hero-waves container per request -->

          <p v-if="heroSubtitleText" ref="heroSubtitle" class="hero-subtitle text-black/80 uppercase tracking-[0.4em]">
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

  // Smooth intro: title drops from top -> bottom, others rise slightly
  let titleLines = []
  if (titleEl) {
    titleLines = Array.from(titleEl.querySelectorAll('.hero-title-line'))
    if (titleLines.length) gsap.set(titleLines, { opacity: 0, y: -90 })
    else gsap.set(titleEl, { opacity: 0, y: -80 })
  }
  const others = [subtitleEl, actionsEl].filter(Boolean)
  if (others.length) gsap.set(others, { opacity: 0, y: 50 })

  if (imageEl) {
    gsap.set(imageEl, { opacity: 1, y: 0, scale: 1 })
  }

  if (heroTimeline) {
    heroTimeline.kill()
  }

  heroTimeline = gsap.timeline({ delay: 0.15, defaults: { ease: 'power3.out' } })

  if (titleEl) {
    if (titleLines.length) {
      heroTimeline.to(titleLines, { opacity: 1, y: 0, duration: 1.1, ease: 'power4.out', stagger: 0.12 }, 0)
    } else {
      heroTimeline.to(titleEl, { opacity: 1, y: 0, duration: 1.1, ease: 'power4.out' }, 0)
    }
  }

  if (subtitleEl) {
    heroTimeline.to(subtitleEl, { opacity: 1, y: 0, duration: 0.7 }, '-=0.6')
  }

  if (actionsEl) {
    heroTimeline.to(actionsEl, { opacity: 1, y: 0, duration: 0.7 }, '-=0.35')
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


// Waves background implementation (self-contained)
class Noise {
  constructor(seed = Math.random()) {
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    let n = Math.floor(seed * 2147483647) || 1
    for (let i = 255; i > 0; i--) {
      n = (n * 16807) % 2147483647
      const r = n % (i + 1)
      const t = p[i]
      p[i] = p[r]
      p[r] = t
    }
    this.perm = new Uint8Array(512)
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
  lerp(t, a, b) { return a + t * (b - a) }
  grad(hash, x, y) {
    const h = hash & 3
    const u = h < 2 ? x : y
    const v = h < 2 ? y : x
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v)
  }
  perlin2(x, y) {
    let X = Math.floor(x) & 255
    let Y = Math.floor(y) & 255
    x -= Math.floor(x)
    y -= Math.floor(y)
    const u = this.fade(x)
    const v = this.fade(y)
    const A = this.perm[X] + Y
    const B = this.perm[(X + 1) & 255] + Y
    const g1 = this.grad(this.perm[A], x, y)
    const g2 = this.grad(this.perm[B], x - 1, y)
    const g3 = this.grad(this.perm[(A + 1) & 255], x, y - 1)
    const g4 = this.grad(this.perm[(B + 1) & 255], x - 1, y - 1)
    return this.lerp(v, this.lerp(u, g1, g2), this.lerp(u, g3, g4))
  }
}

class AWaves extends HTMLElement {
  constructor() {
    super()
    // RAF + handlers
    this._raf = 0
    this._tick = this.tick.bind(this)
    this._onResize = this.onResize.bind(this)
    this._onMouseMove = this.onMouseMove.bind(this)
    this._onTouchMove = this.onTouchMove.bind(this)
    this._onVisibility = this.onVisibilityChange.bind(this)
    this._onIntersect = this.onIntersect.bind(this)
    this._resizeTimer = null
    this._io = null
    this._visible = true
  }
  connectedCallback() {
    this.svg = this.querySelector('.js-svg')
    if (!this.svg) return
    this.mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false }
    this.lines = []
    this.paths = []
    this.noise = new Noise(Math.random())
    this.prevWidth = 0
    this.prevHeight = 0
    this.setSize()
    this.setLines()
    this.bindEvents()
    // Observe visibility within viewport to pause/resume
    this._io = new IntersectionObserver(this._onIntersect, { root: null, threshold: 0.01 })
    this._io.observe(this)
    this._raf = requestAnimationFrame(this._tick)
  }
  disconnectedCallback() {
    // Cleanup to prevent leaks when leaving page
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('mousemove', this._onMouseMove)
    this.removeEventListener('touchmove', this._onTouchMove)
    document.removeEventListener('visibilitychange', this._onVisibility)
    if (this._io) { this._io.disconnect(); this._io = null }
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = 0
    if (this._resizeTimer) { clearTimeout(this._resizeTimer); this._resizeTimer = null }
  }
  bindEvents() {
    window.addEventListener('resize', this._onResize)
    window.addEventListener('mousemove', this._onMouseMove)
    this.addEventListener('touchmove', this._onTouchMove, { passive: false })
    document.addEventListener('visibilitychange', this._onVisibility)
  }
  onVisibilityChange() {
    if (document.hidden) {
      if (this._raf) cancelAnimationFrame(this._raf)
      this._raf = 0
    } else {
      if (!this._raf && this._visible) this._raf = requestAnimationFrame(this._tick)
    }
  }
  onIntersect(entries) {
    const entry = entries && entries[0]
    if (!entry) return
    this._visible = !!entry.isIntersecting
    if (this._visible) {
      if (!this._raf && !document.hidden) this._raf = requestAnimationFrame(this._tick)
    } else {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0 }
    }
  }
  onResize() {
    // Debounce + only rebuild when size really changed
    if (this._resizeTimer) clearTimeout(this._resizeTimer)
    this._resizeTimer = setTimeout(() => {
      this.setSize()
      if (this.bounding && (this.bounding.width !== this.prevWidth || this.bounding.height !== this.prevHeight)) {
        this.setLines()
      }
    }, 100)
  }
  onMouseMove(e) { this.updateMousePosition(e.pageX, e.pageY) }
  onTouchMove(e) { e.preventDefault(); const t = e.touches[0]; this.updateMousePosition(t.clientX, t.clientY) }
  updateMousePosition(x, y) {
    const m = this.mouse
    // Use cached bounding from setSize (avoid layout thrash on every move)
    if (!this.bounding) this.bounding = this.getBoundingClientRect()
    m.x = x - this.bounding.left
    m.y = y - this.bounding.top + window.scrollY
    if (!m.set) { m.sx = m.x; m.sy = m.y; m.lx = m.x; m.ly = m.y; m.set = true }
  }
  setSize() {
    this.bounding = this.getBoundingClientRect()
    this.svg.style.width = `${this.bounding.width}px`
    this.svg.style.height = `${this.bounding.height}px`
    this.prevWidth = this.bounding.width
    this.prevHeight = this.bounding.height
  }
  setLines() {
    const { width, height } = this.bounding
    this.lines = []
    this.paths.forEach(p => p.remove())
    this.paths = []
    const xGap = 10, yGap = 32
    const oWidth = width + 200, oHeight = height + 30
    const totalLines = Math.ceil(oWidth / xGap)
    const totalPoints = Math.ceil(oHeight / yGap)
    const xStart = (width - xGap * totalLines) / 2
    const yStart = (height - yGap * totalPoints) / 2
    for (let i = 0; i <= totalLines; i++) {
      const points = []
      for (let j = 0; j <= totalPoints; j++) {
        points.push({ x: xStart + xGap * i, y: yStart + yGap * j, wave: { x: 0, y: 0 }, cursor: { x: 0, y: 0, vx: 0, vy: 0 } })
      }
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.classList.add('a__line', 'js-line')
      this.svg.appendChild(path)
      this.paths.push(path)
      this.lines.push(points)
    }
  }
  movePoints(time) {
    const { lines, mouse, noise } = this
    lines.forEach(points => {
      points.forEach(p => {
        const move = noise.perlin2((p.x + time * 0.0125) * 0.002, (p.y + time * 0.005) * 0.0015) * 12
        p.wave.x = Math.cos(move) * 32
        p.wave.y = Math.sin(move) * 16
        const dx = p.x - mouse.sx, dy = p.y - mouse.sy
        const d = Math.hypot(dx, dy)
        const l = Math.max(175, mouse.vs)
        if (d < l) {
          const s = 1 - d / l
          const f = Math.cos(d * 0.001) * s
          p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065
          p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065
        }
        p.cursor.vx += (0 - p.cursor.x) * 0.005
        p.cursor.vy += (0 - p.cursor.y) * 0.005
        p.cursor.vx *= 0.925
        p.cursor.vy *= 0.925
        p.cursor.x += p.cursor.vx * 2
        p.cursor.y += p.cursor.vy * 2
        p.cursor.x = Math.min(100, Math.max(-100, p.cursor.x))
        p.cursor.y = Math.min(100, Math.max(-100, p.cursor.y))
      })
    })
  }
  moved(point, withCursorForce = true) {
    const coords = {
      x: point.x + point.wave.x + (withCursorForce ? point.cursor.x : 0),
      y: point.y + point.wave.y + (withCursorForce ? point.cursor.y : 0)
    }
    coords.x = Math.round(coords.x * 10) / 10
    coords.y = Math.round(coords.y * 10) / 10
    return coords
  }
  drawLines() {
    const { lines, moved, paths } = this
    lines.forEach((points, lIndex) => {
      let p1 = moved(points[0], false)
      let d = `M ${p1.x} ${p1.y}`
      points.forEach((pp, pIndex) => {
        const isLast = pIndex === points.length - 1
        p1 = moved(pp, !isLast)
        const p2 = moved(points[pIndex + 1] || points[points.length - 1], !isLast)
        d += `L ${p1.x} ${p1.y}`
      })
      paths[lIndex].setAttribute('d', d)
    })
  }
  tick(time) {
    const mouse = this.mouse
    mouse.sx += (mouse.x - mouse.sx) * 0.1
    mouse.sy += (mouse.y - mouse.sy) * 0.1
    const dx = mouse.x - mouse.lx
    const dy = mouse.y - mouse.ly
    const d = Math.hypot(dx, dy)
    mouse.v = d
    mouse.vs += (d - mouse.vs) * 0.1
    mouse.vs = Math.min(100, mouse.vs)
    mouse.lx = mouse.x
    mouse.ly = mouse.y
    mouse.a = Math.atan2(dy, dx)
    this.style.setProperty('--x', `${mouse.sx}px`)
    this.style.setProperty('--y', `${mouse.sy}px`)
    this.movePoints(time)
    this.drawLines()
    if (this._visible && !document.hidden) {
      this._raf = requestAnimationFrame(this._tick)
    } else {
      this._raf = 0
    }
  }
}

if (!customElements.get('a-waves')) {
  customElements.define('a-waves', AWaves)
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
    /* Light background to match line work */
    background-color: #f4ece7;
    padding: 0;
    height: 94vh;
    width: 100%;
    overflow-x: clip;
    overflow-y: visible;
  }
  

.hero-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  overflow: visible;
  padding: clamp(1.5rem, 5vh, 3rem) 0 0;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(1rem, 3vh, 2.5rem);
}

.hero-heading {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 1rem clamp(1.25rem, 3vh, 2.5rem);
  z-index: 20;
  pointer-events: none;
}

.hero-title {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: flex-start;
  gap: clamp(1rem, 2vw, 2rem);
  width: 100%;
  white-space: nowrap;
  will-change: transform;
  margin-bottom: 15px;
}

  .hero-title-line {
    display: block;
    line-height: 0.8;
    letter-spacing: 0.04em;
    transform: scaleY(1.3);
    transform-origin: bottom center;
  }
  @media (max-width: 640px) {
    .hero-title-line--small,
    .hero-title-line--large {
      font-size: clamp(48px, 18vw, 150px);
      transform: scaleY(1.3);
    }
  }

.hero-title-line--small,
.hero-title-line--large {
  font-size: clamp(110px, min(12vw, 26vh), 280px);
  font-weight: 900;
  letter-spacing: 0.04em;
  color: #000;
}
/* Remove gradient; use solid black text */

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

.hero-waves {
  position: relative;
  display: block;
  width: 100%;
  max-width: 1520px;
  margin: -250px auto 20px;
  height: clamp(770px, 68vh, 1000px);
  box-shadow: 0 40px 80px rgba(0, 0, 0, 0.06);
  transition: transform 0.6s ease;
  background: transparent;
}

/* Waves background element fills wrapper */
.waves-bg { background: transparent; }

/* Scoped deep selectors for custom element */
:deep(a-waves) {
  --x: -0.5rem;
  --y: 50%;
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

:deep(a-waves)::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 0.5rem;
  height: 0.5rem;
  background: #160000;
  border-radius: 50%;
  transform: translate3d(calc(var(--x) - 50%), calc(var(--y) - 50%), 0);
  will-change: transform;
  content: "";
}

:deep(a-waves) svg { display: block; width: 100%; height: 100%; }
:deep(a-waves) path { fill: none; stroke: #160000; stroke-width: 1px; }

.hero-actions {
  display: flex;
  justify-content: center;
}

.hero-button {
  background-color: rgb(0, 0, 0);
  color: #ffffff;
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
    padding: 0;
    height: auto;
    min-height: 100vh;
  }

  .hero-content {
    padding: clamp(1rem, 6vw, 2.5rem) 0 0;
    gap: clamp(1rem, 4vw, 2.5rem);
  }

  .hero-heading {
    padding: 0 1rem clamp(1rem, 4vw, 2rem);
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
}

.fade-in-up {
  opacity: 0;
  transform: translateY(40px);
}
</style>
