<template>
  <div class="account-modal-mask" @click.self="$emit('close')">
    <div :class="['account-modal-shell', modalClass]">
      <div class="account-modal-header">
        <h3>{{ title }}</h3>
        <button type="button" class="account-modal-close" @click="$emit('close')">
          <i class="fa fa-times"></i>
        </button>
      </div>

      <div :class="['account-modal-body', bodyClass]">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  modalClass: {
    type: String,
    default: ''
  },
  bodyClass: {
    type: String,
    default: ''
  }
})

defineEmits(['close'])
</script>

<style>
.account-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.account-modal-shell {
  width: min(860px, 96vw);
  max-height: min(88vh, 860px);
  border-radius: 18px;
  border: 1px solid var(--account-card-border);
  background: var(--account-card-bg);
  box-shadow: var(--account-card-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.account-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--account-card-border);
}

.account-modal-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--account-text);
}

.account-modal-close {
  border: 1px solid var(--account-upload-border);
  background: var(--account-upload-bg);
  color: var(--account-upload-text);
  width: 32px;
  height: 32px;
  border-radius: 5px;
}

.account-modal-body {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 0.9rem;
  min-height: 0;
  overflow: auto;
}

.account-modal-shell.group-invite-modal {
  width: min(520px, 94vw);
}

.account-modal-body.group-invite-modal-body {
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
}

.account-modal-shell.group-modal {
  width: min(760px, 96vw);
}

.account-modal-body.group-modal-body {
  grid-template-columns: 0.92fr 1.4fr;
  align-items: start;
}

@media (max-width: 1280px) {
  .account-modal-body {
    grid-template-columns: 1fr 1fr;
  }

  .account-modal-body.group-modal-body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .account-modal-shell {
    width: min(96vw, 640px);
    max-height: 92vh;
  }

  .account-modal-body {
    grid-template-columns: 1fr;
  }
}
</style>
