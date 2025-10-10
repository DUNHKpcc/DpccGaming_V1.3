<template>
  <div class="app-layout">
    <!-- 侧边栏 -->
    <Sidebar ref="sidebarRef" />
    
    <!-- 主内容区域 -->
    <div ref="mainContent" class="main-content">
      <!-- 顶部导航栏 -->
      <TopNavbar />
      
      <!-- 页面内容 -->
      <main class="page-content">
        <router-view />
      </main>
    </div>
    
    <!-- 模态框组件 -->
    <GameModal />
    <AddGameModal />
    <LoginModal />
    <RegisterModal />
    
    <!-- 全屏游戏容器 -->
    <FullscreenGame />
    
    <!-- 通知组件 -->
    <Notification />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import TopNavbar from './components/TopNavbar.vue'
import GameModal from './components/GameModal.vue'
import AddGameModal from './components/AddGameModal.vue'
import LoginModal from './components/LoginModal.vue'
import RegisterModal from './components/RegisterModal.vue'
import FullscreenGame from './components/FullscreenGame.vue'
import Notification from './components/Notification.vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()
const sidebarRef = ref(null)
const mainContent = ref(null)

// 应用启动时检查登录状态
onMounted(async () => {
  await authStore.checkAuthStatus()
  
  // 监听侧边栏切换事件
  window.addEventListener('toggle-sidebar', () => {
    if (sidebarRef.value) {
      sidebarRef.value.toggleSidebar()
    }
  })
  
  // 监听侧边栏显示/隐藏状态变化
  window.addEventListener('sidebar-toggle', (event) => {
    const isHidden = event.detail
    if (mainContent.value) {
      if (isHidden) {
        mainContent.value.style.marginLeft = '0px' // 侧边栏隐藏时无边距
      } else {
        mainContent.value.style.marginLeft = '280px' // 侧边栏显示时添加边距
      }
    }
  })
})
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: #f8f9fa;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 0; /* 默认无边距 */
  transition: margin-left 0.3s ease;
}

.page-content {
  flex: 1;
  min-height: calc(100vh - 4rem);
}

/* 桌面端侧边栏布局 - 默认无边距 */
@media (min-width: 1024px) {
  .main-content {
    margin-left: 0; /* 默认无边距，侧边栏完全隐藏 */
    transition: margin-left 0.3s ease;
  }
}
</style>