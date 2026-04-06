<script setup>
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

const updateDontShowAgain = (event) => {
  emit('update:dont-show-again', Boolean(event?.target?.checked))
}
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

        <div class="bp-tutorial__media-shell">
          <div v-if="!props.currentStepLoaded && !props.currentStepErrored" class="bp-tutorial__media-placeholder">
            <span>教学动图加载中...</span>
          </div>
          <div v-else-if="props.currentStepErrored" class="bp-tutorial__media-placeholder is-error">
            <span>教学动图加载失败，请稍后重试。</span>
          </div>
          <img
            v-else
            class="bp-tutorial__media"
            :src="props.step.gifSrc"
            :alt="props.step.title"
            loading="eager"
            decoding="async"
          />
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
            type="button"
            class="bp-tutorial__button is-secondary"
            :disabled="props.stepIndex <= 0"
            @click="emit('previous')"
          >
            上一步
          </button>
          <button
            v-if="props.stepIndex < props.totalSteps - 1"
            type="button"
            class="bp-tutorial__button"
            @click="emit('next')"
          >
            下一步
          </button>
          <button
            v-else
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
  padding: clamp(18px, 3vw, 36px);
}

.bp-tutorial__backdrop {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(18, 15, 10, 0.28), rgba(18, 15, 10, 0.42)),
    rgba(255, 252, 247, 0.16);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.bp-tutorial__panel {
  position: relative;
  width: min(920px, 100%);
  max-height: min(92dvh, 960px);
  display: grid;
  gap: 18px;
  padding: clamp(18px, 2.4vw, 28px);
  border: 1px solid rgba(232, 227, 219, 0.9);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 28px 80px rgba(26, 19, 9, 0.18);
  overflow: hidden;
}

.bp-tutorial__header {
  display: grid;
  gap: 8px;
}

.bp-tutorial__eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #a07b22;
  text-transform: uppercase;
}

.bp-tutorial__header h2 {
  margin: 0;
  font-size: clamp(1.2rem, 1rem + 0.75vw, 1.7rem);
  line-height: 1.2;
  color: #181511;
}

.bp-tutorial__media-shell {
  position: relative;
  min-height: min(46dvh, 460px);
  border-radius: 22px;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(210, 160, 43, 0.16), transparent 38%),
    linear-gradient(160deg, rgba(249, 245, 237, 0.95), rgba(242, 238, 231, 0.92));
  border: 1px solid rgba(228, 221, 209, 0.88);
}

.bp-tutorial__media,
.bp-tutorial__media-placeholder {
  width: 100%;
  height: 100%;
}

.bp-tutorial__media {
  display: block;
  object-fit: cover;
  object-position: top center;
}

.bp-tutorial__media-placeholder {
  display: grid;
  place-items: center;
  padding: 24px;
  color: #736b61;
  font-size: 0.96rem;
  text-align: center;
}

.bp-tutorial__media-placeholder.is-error {
  color: #9a3c34;
}

.bp-tutorial__content p {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.7;
  color: #2a251f;
}

.bp-tutorial__checkbox {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.92rem;
  color: #4a4338;
  cursor: pointer;
}

.bp-tutorial__checkbox input {
  width: 18px;
  height: 18px;
  accent-color: #d2a02b;
}

.bp-tutorial__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.bp-tutorial__button {
  min-width: 112px;
  height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #d7a530, #b78310);
  color: #fffdf8;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 12px 24px rgba(171, 125, 19, 0.24);
}

.bp-tutorial__button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.bp-tutorial__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  box-shadow: none;
}

.bp-tutorial__button.is-secondary {
  background: rgba(238, 233, 225, 0.95);
  color: #2a251f;
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
    padding: 14px;
  }

  .bp-tutorial__panel {
    border-radius: 22px;
    max-height: min(94dvh, 960px);
  }

  .bp-tutorial__media-shell {
    min-height: 280px;
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
