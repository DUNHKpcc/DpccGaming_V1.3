import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Games from '../views/Games.vue'
import Account from '../views/Account.vue'
import AdminPanel from '../components/AdminPanel.vue'
import UserManagement from '../components/UserManagement.vue'
import GameManagement from '../components/GameManagement.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/games',
    name: 'Games',
    component: Games
  },
  {
    path: '/account',
    name: 'Account',
    component: Account
  },
  {
    path: '/admin',
    name: 'Admin',
    component: AdminPanel,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/users',
    name: 'UserManagement',
    component: UserManagement,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/games',
    name: 'GameManagement',
    component: GameManagement,
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token')
  
  // 检查是否需要认证
  if (to.meta.requiresAuth && !token) {
    next('/')
    return
  }
  
  // 检查管理员权限
  if (to.meta.requiresAdmin) {
    if (!token) {
      next('/')
      return
    }
    
    try {
      // 调用API检查管理员权限
      const response = await fetch('/api/admin/check-permission', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        // 权限不足，重定向到首页
        localStorage.removeItem('token')
        next('/')
        return
      }
      
      // 权限验证通过，继续访问
      next()
    } catch (error) {
      console.error('权限检查失败:', error)
      next('/')
    }
  } else {
    next()
  }
})

export default router
