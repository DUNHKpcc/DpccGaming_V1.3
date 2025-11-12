<template>
  <header class="top-navbar">
    <div class="navbar-content">
      <!-- 左侧：移动端菜单和标题 -->
      <div class="navbar-left">
        <!-- 移动端菜单按钮 -->
        <button 
          @click="toggleSidebar"
          class="menu-button"
          aria-label="打开菜单">
          <i class="fa fa-bars"></i>
        </button>
        
        <!-- 网站标题/Logo -->
        <div class="navbar-title">
          <router-link to="/" class="title-link">
            <img src="/logo.png" alt="DpccGaming Logo" class="w-6 h-6 mr-2">
            DpccGaming
          </router-link>
        </div>
      </div>

      <!-- 右侧：用户操作 -->
      <div class="navbar-right">
        <!-- 主题切换按钮 -->
        <button 
          @click="toggleTheme"
          class="theme-toggle-btn"
          :aria-label="isDark ? '切换到亮色模式' : '切换到暗色模式'">
          <i :class="isDark ? 'fa fa-sun' : 'fa fa-moon'"></i>
        </button>
        
        <!-- 登录状态 -->
        <div v-if="!isLoggedIn" class="auth-buttons">
          <button 
            @click="openLoginModal"
            class="btn-secondary">
            登录
          </button>
          <button 
            @click="openRegisterModal"
            class="btn-primary">
            注册
          </button>
        </div>

        <div v-else class="user-menu">
          <div class="user-info">
            <div class="user-avatar">
              <i class="fa fa-user"></i>
            </div>
            <span class="username">{{ currentUser.username }}</span>
          </div>
          <div class="dropdown">
            <button 
              @click="toggleDropdown"
              class="dropdown-toggle">
              <i class="fa fa-chevron-down"></i>
            </button>
            <div v-if="showDropdown" class="dropdown-menu">
              <router-link to="/account" class="dropdown-item" @click="closeDropdown">
                <i class="fa fa-user"></i>
                账户详情
              </router-link>
              <router-link v-if="isAdmin" to="/admin" class="dropdown-item" @click="closeDropdown">
                <i class="fa fa-cog"></i>
                管理后台
              </router-link>
              <button @click="logout" class="dropdown-item">
                <i class="fa fa-sign-out"></i>
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useModalStore } from '../stores/modal'
import { useThemeStore } from '../stores/theme'

const authStore = useAuthStore()
const modalStore = useModalStore()
const themeStore = useThemeStore()

const showDropdown = ref(false)
const isAdmin = ref(false)

const currentUser = computed(() => authStore.currentUser)
const isLoggedIn = computed(() => authStore.isLoggedIn)
const isDark = computed(() => themeStore.isDark)

// 检查管理员权限
const checkAdminPermission = async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    isAdmin.value = false
    return
  }
  
  try {
    const response = await fetch('/api/admin/check-permission', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      isAdmin.value = data.isAdmin && ['admin', 'super_admin'].includes(data.user.role)
    } else {
      isAdmin.value = false
    }
  } catch (error) {
    console.error('检查管理员权限失败:', error)
    isAdmin.value = false
  }
}

const toggleSidebar = () => {
  // 通过事件总线或store来通知侧边栏切换
  window.dispatchEvent(new CustomEvent('toggle-sidebar'))
}

const openLoginModal = () => {
  modalStore.openModal('login')
}

const openRegisterModal = () => {
  modalStore.openModal('register')
}

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const closeDropdown = () => {
  showDropdown.value = false
}

const logout = () => {
  authStore.logout()
  closeDropdown()
}

const toggleTheme = () => {
  themeStore.toggleTheme()
}

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
  if (!event.target.closest('.dropdown')) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // 检查管理员权限
  checkAdminPermission()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.top-navbar {
  position: sticky;
  top: 0;
  z-index: 30;
  /* 暗色模式（默认） */
  background: rgb(29, 29, 31);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 亮色模式下的导航栏 */
[data-theme="light"] .top-navbar {
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.1);
}

.navbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  max-width: 100%;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.menu-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  /* 暗色模式（默认） */
  background: #2e2e30;
  border-radius: 0.5rem;
  color: #f3f4f6;
  cursor: pointer;
  transition: all 0.2s ease;
}

.menu-button:hover {
  /* 暗色模式（默认） */
  background: #3a3a3d;
  color: #ffffff;
}

/* 亮色模式下的菜单按钮 */
[data-theme="light"] .menu-button {
  background: #f3f4f6;
  color: #1f2937;
}

[data-theme="light"] .menu-button:hover {
  background: #e5e7eb;
  color: #111827;
}

.navbar-title {
  font-size: 1.25rem;
  font-weight: bold;
  /* 暗色模式（默认） */
  color: #f9fafb;
  margin: 0;
  transition: color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 亮色模式下的标题 */
[data-theme="light"] .navbar-title {
  color: #000000;
}

.title-link {
  display: flex;
  align-items: center;
  color: inherit;
  text-decoration: none;
  transition: color 0.2s ease;
}

.title-link:hover {
  color: #676767;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* 主题切换按钮样式 */
.theme-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: #2e2e30;
  border-radius: 0.5rem;
  color: #f3f4f6;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.theme-toggle-btn:hover {
  background: #3a3a3d;
  color: #ffffff;
  transform: scale(1.05);
}

.theme-toggle-btn i {
  font-size: 1rem;
  transition: all 0.3s ease;
}

/* 亮色模式下的主题切换按钮 */
[data-theme="light"] .theme-toggle-btn {
  background: #f8f9fa;
  color: #4a5568;
  border: 1px solid #e2e8f0;
}

[data-theme="light"] .theme-toggle-btn:hover {
  background: #e2e8f0;
  color: #2d3748;
}

.auth-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  /* 暗色模式（默认） */
  background: #ffffff;
  color: #000000;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  /* 暗色模式（默认） */
  background: #f3f4f6;
  color: #000000;
}

/* 亮色模式下的主按钮 */
[data-theme="light"] .btn-primary {
  background: #000000;
  color: #ffffff;
}

[data-theme="light"] .btn-primary:hover {
  background: #333333;
  color: #ffffff;
}

.btn-secondary {
  /* 暗色模式（默认） */
  background: #ffffff;
  color: #000000;
  border: 1px solid #ffffff;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  /* 暗色模式（默认） */
  background: #f9fafb;
  color: #374151;
}

/* 亮色模式下的次要按钮 */
[data-theme="light"] .btn-secondary {
  background: #000000;
  color: #ffffff;
  border: 1px solid #000000;
}

[data-theme="light"] .btn-secondary:hover {
  background: #333333;
  color: #ffffff;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-avatar {
  width: 2rem;
  height: 2rem;
  background: #ffffff;
  color: #1d1d1f;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.username {
  font-weight: 500;
  /* 暗色模式（默认） */
  color: #ffffff;
  transition: color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 亮色模式下的用户名 */
[data-theme="light"] .username {
  color: #1f2937;
}

.dropdown {
  position: relative;
}

.dropdown-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
}

.dropdown-toggle:hover {
  background: #f3f4f6;
  color: #374151;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: rgb(29, 29, 31);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  min-width: 12rem;
  z-index: 50;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: #ffffff;
  text-decoration: none;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
}



.dropdown-item i {
  width: 1rem;
  text-align: center;
}

@media (max-width: 768px) {
  .navbar-content {
    padding: 0.75rem 1rem;
  }
  
  .navbar-left {
    gap: 0.75rem;
  }
  
  .menu-button {
    width: 2.25rem;
    height: 2.25rem;
  }
  
  .navbar-title {
    font-size: 1.125rem;
  }
  
  .navbar-right {
    gap: 0.5rem;
  }
  
  .theme-toggle-btn {
    width: 2.25rem;
    height: 2.25rem;
  }
  
  .theme-toggle-btn i {
    font-size: 0.875rem;
  }
  
  .auth-buttons {
    gap: 0.25rem;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
  
  .user-info {
    gap: 0.25rem;
  }
  
  .username {
    font-size: 0.875rem;
  }
  
  .user-avatar {
    width: 1.75rem;
    height: 1.75rem;
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  .navbar-content {
    padding: 0.5rem 0.75rem;
  }
  
  .navbar-title {
    font-size: 1rem;
  }
  
  .title-link i {
    display: none; /* 在小屏幕上隐藏游戏手柄图标 */
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.375rem 0.5rem;
    font-size: 0.8rem;
  }
  
  .username {
    display: none; /* 在很小屏幕上隐藏用户名 */
  }
}
</style>
