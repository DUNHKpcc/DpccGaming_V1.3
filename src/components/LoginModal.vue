<template>
  <div v-if="isOpen" 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 opacity-100 pointer-events-auto transition-opacity duration-300"
    @click="handleBackdropClick">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-md"></div>
    <div
      class="relative bg-white/15 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl w-full max-w-md p-8 transform scale-100 transition-transform duration-300"
      @click.stop>
      <div class="text-center mb-6">
        <div class="flex items-center justify-center mb-4">
          <i class="fa fa-gamepad text-white text-3xl mr-2"></i>
          <span class="text-2xl font-bold text-white">DpccGaming</span>
        </div>
        <h3 class="text-2xl font-bold text-white">登录</h3>
        <p class="text-white/80 mt-2">访问您的账户以评价和评论游戏</p>
      </div>

      <form @submit.prevent="handleLogin">
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1 text-white">用户名</label>
          <input v-model="username" type="text"
            class="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all duration-300"
            placeholder="请输入用户名" required>
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium mb-1 text-white">密码</label>
          <input v-model="password" type="password"
            class="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all duration-300"
            placeholder="••••••••" required>
        </div>
        <button type="submit"
          class="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white py-3 rounded-xl transition-all duration-300 mb-4 font-medium">
          登录
        </button>
        <div class="text-center text-sm text-white/80">
          还没有账户？ <button type="button" @click="switchToRegister" class="text-white hover:text-white/80 hover:underline transition-colors duration-300">注册</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useModalStore } from '../stores/modal'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'

const modalStore = useModalStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const isOpen = computed(() => modalStore.activeModal === 'login')
const username = ref('')
const password = ref('')

const handleLogin = async () => {
  const result = await authStore.login(username.value, password.value)
  
  if (result.success) {
    modalStore.closeModal()
    notificationStore.success('登录成功', result.message)
  } else {
    notificationStore.error('登录失败', result.message)
  }
}

const switchToRegister = () => {
  modalStore.closeModal()
  setTimeout(() => {
    modalStore.openModal('register')
  }, 300)
}

const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    modalStore.closeModal()
  }
}
</script>
