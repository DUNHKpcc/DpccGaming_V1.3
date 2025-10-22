<template>
  <div>
    <!-- 移动端遮罩 -->
    <div 
      v-if="isMobile && isOpen" 
      class="sidebar-overlay"
      @click="closeSidebar">
    </div>
    
    <!-- 桌面端悬浮侧边栏 -->
    <aside 
      v-if="!isMobile"
      ref="floatingSidebar"
      class="floating-sidebar"
      :class="{ 'sidebar-expanded': isExpanded }"
      @mouseenter="handleSidebarEnter"
      @mouseleave="handleSidebarLeave">
      
      <!-- 导航图标 -->
      <nav class="floating-nav">
        <ul class="nav-icons">
          <li 
            v-for="(item, index) in navItems" 
            :key="item.name"
            class="nav-icon-item"
            @mouseenter="expandSidebar(item, index)">
            <router-link 
              :to="item.path"
              :class="[
                'nav-icon',
{ 'nav-icon-active': $route.path === item.path }
              ]">
              <i :class="item.icon"></i>
            </router-link>
          </li>
        </ul>
      </nav>

      <!-- 详细信息面板 -->
      <div 
        ref="detailsPanel"
        class="details-panel">
        <div class="details-content">
          <div class="details-icon">
            <i :class="currentDetails.icon"></i>
          </div>
          <div class="details-text">
            <h3 class="details-title">{{ currentDetails.name }}</h3>
            <p class="details-description">{{ currentDetails.description }}</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- 移动端侧边栏 -->
    <aside 
      v-if="isMobile"
      :class="[
        'sidebar',
        { 'sidebar-open': isOpen },
        'sidebar-mobile'
      ]">
      
      <!-- 侧边栏头部 -->
      <div class="sidebar-header">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <img src="/logo.png" alt="DpccGaming Logo" class="w-8 h-8 mr-3">
            <span class="text-lg font-bold text-dark">DpccGaming</span>
          </div>
          <button 
            @click="closeSidebar"
            class="text-neutral hover:text-dark transition-colors">
            <i class="fa fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <ul class="space-y-2">
          <li v-for="item in navItems" :key="item.name">
            <router-link 
              :to="item.path"
              :class="[
                'nav-item',
                { 'nav-item-active': $route.path === item.path }
              ]"
              @click="closeSidebar">
              <i :class="item.icon"></i>
              <span>{{ item.name }}</span>
            </router-link>
          </li>
        </ul>
      </nav>

      <!-- 用户信息/登录区域 -->
      <div class="sidebar-footer">
        <div v-if="isLoggedIn" class="user-info">
          <div class="flex items-center">
            <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3">
              <i class="fa fa-user text-primary text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-dark truncate">{{ currentUser.username }}</div>
              <div class="text-xs text-neutral">已登录</div>
            </div>
          </div>
        </div>
        <div v-else class="login-prompt">
          <button 
            @click="openLoginModal"
            class="w-full bg-primary hover:bg-primary/90 text-white py-2 px-3 rounded-lg text-sm transition-colors">
            登录
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useModalStore } from '../stores/modal'
import { gsap } from 'gsap'

const authStore = useAuthStore()
const modalStore = useModalStore()

const isOpen = ref(false) // 移动端侧边栏状态
const isMobile = ref(false)
const isExpanded = ref(false) // 桌面端侧边栏展开状态
const hoverTimeout = ref(null) // 悬停延迟定时器

// 模板引用
const floatingSidebar = ref(null)
const detailsPanel = ref(null)

// 导航数据
const navItems = ref([
  {
    name: '主页面',
    path: '/',
    icon: 'fa fa-home',
    description: '返回首页，查看平台概览和最新动态'
  },
  {
    name: '游戏库',
    path: '/games',
    icon: 'fa fa-gamepad',
    description: '浏览所有游戏，发现有趣的HTML5游戏'
  },
  {
    name: '账户详情',
    path: '/account',
    icon: 'fa fa-user',
    description: '管理您的账户信息和个人设置'
  }
])

// 详细信息相关
const currentDetails = ref({
  name: '',
  icon: '',
  description: ''
})

const currentUser = computed(() => authStore.currentUser)
const isLoggedIn = computed(() => authStore.isLoggedIn)

// GSAP动画函数
const expandSidebar = (item, index) => {
  currentDetails.value = item
  isExpanded.value = true
  
  if (floatingSidebar.value && detailsPanel.value) {
    // 先设置详细信息面板的初始状态
    gsap.set(detailsPanel.value, {
      opacity: 0,
      x: -20,
      scale: 0.9
    })
    
    // 侧边栏展开动画
    gsap.to(floatingSidebar.value, {
      width: 280,
      duration: 0.25,
      ease: "power2.out"
    })
    
    // 详细信息面板显示动画
    gsap.to(detailsPanel.value, {
      opacity: 1,
      x: 0,
      scale: 1,
      duration: 0.2,
      ease: "back.out(1.7)",
      delay: 0.05
    })
    
    // 图标放大效果
    const iconElement = document.querySelector(`.nav-icon-item:nth-child(${index + 1}) .nav-icon`)
    if (iconElement) {
      gsap.to(iconElement, {
        scale: 1.1,
        duration: 0.15,
        ease: "power2.out"
      })
    }
  }
}

// 处理侧边栏鼠标进入事件
const handleSidebarEnter = () => {
  // 清除任何待执行的收缩定时器
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }
}

// 处理侧边栏鼠标离开事件
const handleSidebarLeave = () => {
  // 延迟收缩，给用户时间移动鼠标
  hoverTimeout.value = setTimeout(() => {
    if (isExpanded.value) {
      collapseSidebar()
    }
    hoverTimeout.value = null
  }, 200) // 增加延迟时间到200ms
}

const collapseSidebar = () => {
  isExpanded.value = false
  
  // 清除定时器
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }
  
  if (floatingSidebar.value && detailsPanel.value) {
    // 详细信息面板隐藏动画
    gsap.to(detailsPanel.value, {
      opacity: 0,
      x: -20,
      scale: 0.9,
      duration: 0.15,
      ease: "power2.out"
    })
    
    // 侧边栏收缩动画
    gsap.to(floatingSidebar.value, {
      width: 80,
      duration: 0.25,
      ease: "power2.out",
      delay: 0.05
    })
    
    // 重置所有图标缩放
    const iconElements = document.querySelectorAll('.nav-icon')
    iconElements.forEach(icon => {
      gsap.to(icon, {
        scale: 1,
        duration: 0.15,
        ease: "power2.out"
      })
    })
  }
}

const closeSidebar = () => {
  if (isMobile.value) {
    isOpen.value = false
  }
}

const openLoginModal = () => {
  modalStore.openModal('login')
  closeSidebar()
}

// 修改checkScreenSize函数，添加特定阈值判断
const checkScreenSize = () => {
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  
  // 判断是否为移动端（保持原逻辑）
  isMobile.value = windowWidth < 1024
  
  // 根据用户指定的尺寸阈值判断是否需要隐藏侧边栏
  if (windowWidth <= 1253 || windowHeight <= 941) {
    // 小于阈值时隐藏左侧悬浮侧边栏
    if (floatingSidebar.value) {
      floatingSidebar.value.style.display = 'none'
    }
  } else {
    // 大于阈值时显示悬浮侧边栏
    if (floatingSidebar.value) {
      floatingSidebar.value.style.display = 'block'
    }
  }
  
  if (!isMobile.value) {
    isOpen.value = false // 桌面端默认隐藏侧边栏
  }
}

// 初始化悬浮侧边栏动画
const initFloatingSidebar = () => {
  if (floatingSidebar.value) {
// 设置初始状态
    gsap.set(floatingSidebar.value, {
      x: -60,
      opacity: 0
    })
// 进入动画
    gsap.to(floatingSidebar.value, {
      x: 0,
      opacity: 1,
      duration: 0.8,
      ease: "power3.out",
      delay: 0.5
    })
  }
}

onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
  
  // 延迟初始化悬浮侧边栏动画
  setTimeout(() => {
    if (!isMobile.value) {
      initFloatingSidebar()
    }
  }, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
  
  // 清理定时器
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }
})

// 暴露方法给父组件
defineExpose({
  toggleSidebar: () => {
    if (isMobile.value) {
      isOpen.value = !isOpen.value
    }
  }
})
</script>

<style scoped>
/* 悬浮侧边栏样式 */
.floating-sidebar {
  position: fixed;
  top: 50%;
  left: 20px;
  transform: translateY(-50%);
  z-index: 1000;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 20px 10px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  width: 80px;
  height: auto;
  min-height: 300px;
  transition: width 0.4s ease;
  overflow: hidden;
}

.floating-sidebar.sidebar-expanded {
  width: 280px;
}

.floating-sidebar.sidebar-expanded .details-panel {
  pointer-events: auto;
}

.floating-nav {
  position: absolute;
  left: 0;
  top: 0;
  width: 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.nav-icons {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 25px;
  align-items: center;
}

.nav-icon-item {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.3s ease;
  cursor: pointer;
}

.nav-icon:hover {
  background: rgba(108, 92, 231, 0.3);
  border: 1px solid rgba(108, 92, 231, 0.5);
  color: white;
}

.nav-icon-active {
  background: rgba(108, 92, 231, 0.4);
  border: 1px solid rgba(108, 92, 231, 0.6);
  color: white;
}

.nav-icon i {
  font-size: 20px;
}

/* 详细信息面板 */
.details-panel {
  position: absolute;
  top: 0;
  left: 80px;
  width: 200px;
  height: 100%;
  padding: 20px 15px;
  opacity: 0;
  transform: translateX(-20px) scale(0.9);
  pointer-events: none;
  display: flex;
  align-items: center;
  z-index: 5;
}

.details-content {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 15px;
  padding: 20px;
  height: calc(100% - 40px);
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.details-icon {
  width: 60px;
  height: 60px;
  border-radius: 15px;
  background: rgba(108, 92, 231, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
  align-self: center;
}

.details-icon i {
  color: white;
  font-size: 24px;
}

.details-text {
  text-align: center;
}

.details-title {
  color: white;
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.details-description {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  margin: 0;
  line-height: 1.4;
}


/* 移动端侧边栏样式 */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  background: white;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.sidebar-mobile {
  width: 280px;
  transform: translateX(-100%);
}

.sidebar-mobile.sidebar-open {
  transform: translateX(0);
}

/* 遮罩层 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* 侧边栏头部 */
.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

/* 导航菜单 */
.sidebar-nav {
  flex: 1;
  padding: 1rem;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  color: #6b7280;
  text-decoration: none;
  transition: all 0.2s ease;
  margin-bottom: 0.25rem;
}

.nav-item:hover {
  background: #f3f4f6;
  color: #374151;
}

.nav-item-active {
  background: #6c5ce7;
  color: white;
}

.nav-item i {
  width: 20px;
  margin-right: 0.75rem;
  text-align: center;
}

/* 侧边栏底部 */
.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
}

.user-info {
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.login-prompt {
  text-align: center;
}

/* 响应式设计 */
@media (max-width: 1023px) {
  .floating-sidebar {
    display: none;
  }
}

@media (min-width: 1024px) {
  .sidebar-mobile {
    display: none;
  }
}
</style>