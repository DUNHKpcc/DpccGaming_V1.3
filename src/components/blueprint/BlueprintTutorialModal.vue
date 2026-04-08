<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  step: { type: Object, default: null },
  stepIndex: { type: Number, default: 0 },
  totalSteps: { type: Number, default: 0 },
  currentStepLoaded: { type: Boolean, default: false },
  currentStepErrored: { type: Boolean, default: false },
  dontShowAgain: { type: Boolean, default: false }
})

const emit = defineEmits([
  'previous',
  'next',
  'complete',
  'update:dont-show-again'
])

const videoElement = ref(null)

const updateDontShowAgain = (event) => {
  emit('update:dont-show-again', Boolean(event?.target?.checked))
}

const playCurrentStepVideo = async () => {
  await nextTick()
  const video = videoElement.value
  if (!video) return

  const playPromise = video.play()
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {})
  }
}

watch(
  () => [props.visible, props.step?.id],
  ([visible]) => {
    if (!visible) return
    void playCurrentStepVideo()
  },
  { immediate: true }
)
</script>

<template>
  <transition name="bp-tutorial-fade">
    <div v-if="props.visible && props.step" class="bp-tutorial" role="dialog" aria-modal="true" aria-labelledby="bp-tutorial-title">
      <div class="bp-tutorial__backdrop"></div>
      <div class="bp-tutorial__panel">
        <div class="bp-tutorial__header">
          <span class="bp-tutorial__eyebrow">BluePrint 教学 {{ props.stepIndex + 1 }}/{{ props.totalSteps }}</span>
          <h2 id="bp-tutorial-title">{{ props.step.title }}</h2>
        </div>

        <div class="bp-tutorial__media-row">
          <button
            type="button"
            class="bp-tutorial__nav bp-tutorial__nav--left"
            :disabled="props.stepIndex <= 0"
            aria-label="上一张教学图"
            @click="emit('previous')"
          >
            <i class="fa fa-angle-left" aria-hidden="true"></i>
          </button>

          <div class="bp-tutorial__media-shell">
            <video
              v-if="props.step"
              ref="videoElement"
              :key="props.step.id"
              class="bp-tutorial__media"
              :poster="props.step.posterSrc"
              autoplay
              muted
              loop
              playsinline
              preload="metadata"
            >
              <source
                v-for="source in props.step.videoSources"
                :key="source.src"
                :src="source.src"
                :type="source.type"
              />
            </video>
            <div v-if="!props.currentStepLoaded && !props.currentStepErrored" class="bp-tutorial__media-placeholder">
              <span>教学动图加载中...</span>
            </div>
            <div v-else-if="props.currentStepErrored" class="bp-tutorial__media-placeholder is-error">
              <span>教学动图加载失败，请稍后重试。</span>
            </div>
          </div>

          <button
            type="button"
            class="bp-tutorial__nav bp-tutorial__nav--right"
            :disabled="props.stepIndex >= props.totalSteps - 1"
            aria-label="下一张教学图"
            @click="emit('next')"
          >
            <i class="fa fa-angle-right" aria-hidden="true"></i>
          </button>
        </div>

        <div class="bp-tutorial__content">
          <p>{{ props.step.description }}</p>
        </div>

        <label class="bp-tutorial__checkbox">
          <input
            type="checkbox"
            :checked="props.dontShowAgain"
            @change="updateDontShowAgain"
          />
          <span>下次进入不再进入此教学页面</span>
        </label>

        <div class="bp-tutorial__actions">
          <button
            v-if="props.stepIndex >= props.totalSteps - 1"
            type="button"
            class="bp-tutorial__button"
            @click="emit('complete')"
          >
            学会了！
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.bp-tutorial {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: clamp(15px, 2.55vw, 31px);
}

.bp-tutorial__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.bp-tutorial__panel {
  position: relative;
  width: min(782px, 100%);
  max-height: min(92dvh, 816px);
  display: grid;
  gap: 15px;
  padding: clamp(15px, 2vw, 24px);
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 20px 56px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.bp-tutorial__header {
  display: grid;
  gap: 7px;
}

.bp-tutorial__eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #555;
  text-transform: uppercase;
}

.bp-tutorial__header h2 {
  margin: 0;
  font-size: clamp(1.02rem, 0.85rem + 0.64vw, 1.45rem);
  line-height: 1.2;
  color: #000;
}

.bp-tutorial__media-shell {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #f2f2f2;
  border: 1px solid #d0d0d0;
}

.bp-tutorial__media-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 12px;
}

.bp-tutorial__nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid #000;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: #000;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}

.bp-tutorial__nav:hover:not(:disabled) {
  background: #000;
  color: #fff;
}

.bp-tutorial__nav:disabled {
  opacity: 0.28;
  cursor: not-allowed;
}

.bp-tutorial__nav i {
  font-size: 1.3rem;
  line-height: 1;
}

.bp-tutorial__media,
.bp-tutorial__media-placeholder {
  width: 100%;
  height: 100%;
}

.bp-tutorial__media {
  display: block;
  object-fit: contain;
  object-position: center;
  background: #fff;
}

.bp-tutorial__media-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.68);
  color: #444;
  font-size: 0.92rem;
  text-align: center;
}

.bp-tutorial__media-placeholder.is-error {
  color: #111;
}

.bp-tutorial__content p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.7;
  color: #111;
}

.bp-tutorial__checkbox {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 0.86rem;
  color: #111;
  cursor: pointer;
}

.bp-tutorial__checkbox input {
  width: 16px;
  height: 16px;
  accent-color: #000;
}

.bp-tutorial__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  min-height: 37px;
}

.bp-tutorial__button {
  min-width: 95px;
  height: 37px;
  padding: 0 15px;
  border: 1px solid #000;
  border-radius: 8px;
  background: #000;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
  box-shadow: none;
}

.bp-tutorial__button:hover:not(:disabled) {
  background: #1f1f1f;
}

.bp-tutorial__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  box-shadow: none;
}

.bp-tutorial__button.is-secondary {
  background: #fff;
  color: #000;
  border-color: #b8b8b8;
  box-shadow: none;
}

.bp-tutorial-fade-enter-active,
.bp-tutorial-fade-leave-active {
  transition: opacity 0.22s ease;
}

.bp-tutorial-fade-enter-from,
.bp-tutorial-fade-leave-to {
  opacity: 0;
}

@media (max-width: 960px) {
  .bp-tutorial {
    padding: 12px;
  }

  .bp-tutorial__panel {
    border-radius: 8px;
    max-height: min(94dvh, 816px);
  }

  .bp-tutorial__media-shell {
    aspect-ratio: 16 / 9;
  }

  .bp-tutorial__media-row {
    grid-template-columns: 34px minmax(0, 1fr) 34px;
    gap: 8px;
  }

  .bp-tutorial__nav {
    width: 34px;
    height: 34px;
  }
}

@media (max-width: 640px) {
  .bp-tutorial__actions {
    justify-content: stretch;
  }

  .bp-tutorial__button {
    flex: 1;
    min-width: 0;
  }
}
</style>
