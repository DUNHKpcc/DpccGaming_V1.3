import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useModalStore = defineStore('modal', () => {
  const activeModal = ref(null)
  const currentGame = ref(null)
  const isFullscreen = ref(false)

  const openModal = (modalType) => {
    activeModal.value = modalType
    document.body.style.overflow = 'hidden'
  }

  const closeModal = () => {
    activeModal.value = null
    document.body.style.overflow = ''
  }

  const openGameModal = (game) => {
    currentGame.value = game
    activeModal.value = 'game'
    document.body.style.overflow = 'hidden'
  }

  const enterFullscreen = (game) => {
    currentGame.value = game
    isFullscreen.value = true
    document.body.style.overflow = 'hidden'
  }

  const exitFullscreen = () => {
    isFullscreen.value = false
    document.body.style.overflow = ''
  }

  return {
    activeModal,
    currentGame,
    isFullscreen,
    openModal,
    closeModal,
    openGameModal,
    enterFullscreen,
    exitFullscreen
  }
})
