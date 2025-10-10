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

        <!-- 已登录状态 -->
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

const authStore = useAuthStore()
const modalStore = useModalStore()

const showDropdown = ref(false)
const isAdmin = ref(false)

const currentUser = computed(() => authStore.currentUser)
const isLoggedIn = computed(() => authStore.isLoggedIn)

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
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
  background: #f3f4f6;
  border-radius: 0.5rem;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.menu-button:hover {
  background: #e5e7eb;
  color: #111827;
}

.navbar-title {
  font-size: 1.25rem;
  font-weight: bold;
  color: #111827;
  margin: 0;
}

.title-link {
  display: flex;
  align-items: center;
  color: inherit;
  text-decoration: none;
  transition: color 0.2s ease;
}

.title-link:hover {
  color: #6c5ce7;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.auth-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  background: #6c5ce7;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: #5a4fcf;
}

.btn-secondary {
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #f9fafb;
  color: #374151;
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
  background: #6c5ce7;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.username {
  font-weight: 500;
  color: #374151;
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
  background: white;
  border: 1px solid #e5e7eb;
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
  color: #374151;
  text-decoration: none;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dropdown-item:hover {
  background: #f9fafb;
}

.dropdown-item i {
  width: 1rem;
  text-align: center;
}

/* 响应式设计 */
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
