<template>
  <div class="admin-page">
    <div class="content-wrapper">
      <div class="max-w-6xl mx-auto p-6">
        <div class="glass-card p-8">
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold text-white drop-shadow-lg">用户管理</h1>
          <div class="flex space-x-4">
            <router-link to="/admin" 
              class="bg-gray-500/90 hover:bg-gray-500 backdrop-blur-sm border border-gray-400/30 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
              <i class="fa fa-arrow-left mr-2"></i>返回审核
            </router-link>
            <router-link to="/admin/games" 
              class="bg-green-500/90 hover:bg-green-500 backdrop-blur-sm border border-green-400/30 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
              <i class="fa fa-gamepad mr-2"></i>游戏管理
            </router-link>
            <button @click="refreshUsers" 
              class="bg-primary/90 hover:bg-primary backdrop-blur-sm border border-primary/30 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
              <i class="fa fa-refresh mr-2"></i>刷新
            </button>
          </div>
        </div>

        <!-- 用户列表 -->
        <div v-if="users.length === 0" class="text-center py-12">
          <i class="fa fa-users text-6xl text-gray-400 mb-4"></i>
          <p class="text-xl text-white/80 drop-shadow-sm">暂无用户数据</p>
        </div>

        <div v-else class="space-y-4">
          <div v-for="user in users" :key="user.id" 
            class="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all duration-300">
            
            <div class="flex items-center justify-between">
              <!-- 用户信息 -->
              <div class="flex items-center space-x-4">
                <div class="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <i class="fa fa-user text-primary text-xl"></i>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-white drop-shadow-sm">{{ user.username }}</h3>
                  <p class="text-white/70 text-sm">{{ user.email || '未设置邮箱' }}</p>
                  <p class="text-white/60 text-xs">注册时间: {{ formatDate(user.created_at) }}</p>
                </div>
              </div>

              <!-- 角色和状态 -->
              <div class="flex items-center space-x-4">
                <!-- 角色标签 -->
                <span :class="getRoleClass(user.role)" class="px-3 py-1 rounded-full text-sm font-medium">
                  {{ user.role_name }}
                </span>
                
                <!-- 状态标签 -->
                <span :class="getStatusClass(user.status)" class="px-3 py-1 rounded-full text-sm font-medium">
                  {{ user.status_name }}
                </span>

                <!-- 管理操作按钮 -->
                <div class="flex flex-col space-y-2">
                  <!-- 角色管理按钮 -->
                  <div class="flex space-x-2">
                    <button @click="changeUserRole(user, 'user')" 
                      :class="user.role === 'user' ? 'bg-gray-500' : 'bg-blue-500/90 hover:bg-blue-500'"
                      class="px-3 py-1 rounded text-white text-sm transition-colors">
                      普通用户
                    </button>
                    <button @click="changeUserRole(user, 'admin')" 
                      :class="user.role === 'admin' ? 'bg-gray-500' : 'bg-green-500/90 hover:bg-green-500'"
                      class="px-3 py-1 rounded text-white text-sm transition-colors">
                      管理员
                    </button>
                    <button @click="changeUserRole(user, 'super_admin')" 
                      :class="user.role === 'super_admin' ? 'bg-gray-500' : 'bg-purple-500/90 hover:bg-purple-500'"
                      class="px-3 py-1 rounded text-white text-sm transition-colors">
                      超级管理员
                    </button>
                  </div>
                  
                  <!-- 禁言/解禁和删除按钮 -->
                  <div class="flex space-x-2">
                    <button v-if="user.status === 'active'" @click="banUser(user)" 
                      class="bg-orange-500/90 hover:bg-orange-500 backdrop-blur-sm border border-orange-400/30 text-white px-3 py-1 rounded text-sm transition-all duration-300">
                      <i class="fa fa-ban mr-1"></i>禁言
                    </button>
                    <button v-else-if="user.status === 'banned'" @click="unbanUser(user)" 
                      class="bg-green-500/90 hover:bg-green-500 backdrop-blur-sm border border-green-400/30 text-white px-3 py-1 rounded text-sm transition-all duration-300">
                      <i class="fa fa-check mr-1"></i>解禁
                    </button>
                    <button @click="confirmDeleteUser(user)" 
                      class="bg-red-500/90 hover:bg-red-500 backdrop-blur-sm border border-red-400/30 text-white px-3 py-1 rounded text-sm transition-all duration-300">
                      <i class="fa fa-trash mr-1"></i>删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useNotificationStore } from '../stores/notification'

const notificationStore = useNotificationStore()
const users = ref([])

// 获取用户列表
const fetchUsers = async () => {
  try {
    const token = localStorage.getItem('token')
    if (!token) {
      notificationStore.error('未登录', '请先登录管理员账户')
      return
    }

    const response = await fetch('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      users.value = data.users
    } else {
      const error = await response.json()
      notificationStore.error('获取失败', error.error || '获取用户列表失败')
    }
  } catch (error) {
    console.error('获取用户列表错误:', error)
    notificationStore.error('网络错误', '请检查网络连接')
  }
}

// 更改用户角色
const changeUserRole = async (user, newRole) => {
  if (user.role === newRole) {
    return
  }

  if (!confirm(`确定要将用户 "${user.username}" 的角色更改为 "${getRoleName(newRole)}" 吗？`)) {
    return
  }

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/admin/users/${user.id}/role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: newRole })
    })

    const result = await response.json()

    if (response.ok) {
      notificationStore.success('角色更新成功', result.message)
      // 更新本地数据
      user.role = newRole
      user.role_name = getRoleName(newRole)
    } else {
      notificationStore.error('更新失败', result.error || '更新用户角色失败')
    }
  } catch (error) {
    console.error('更新用户角色错误:', error)
    notificationStore.error('网络错误', '请检查网络连接')
  }
}

// 获取角色名称
const getRoleName = (role) => {
  const roleNames = {
    'user': '普通用户',
    'admin': '管理员',
    'super_admin': '超级管理员'
  }
  return roleNames[role] || role
}

// 获取角色样式类
const getRoleClass = (role) => {
  const classes = {
    'user': 'bg-gray-500/20 text-gray-300',
    'admin': 'bg-green-500/20 text-green-300',
    'super_admin': 'bg-purple-500/20 text-purple-300'
  }
  return classes[role] || classes['user']
}

// 获取状态样式类
const getStatusClass = (status) => {
  const classes = {
    'active': 'bg-green-500/20 text-green-300',
    'inactive': 'bg-yellow-500/20 text-yellow-300',
    'banned': 'bg-red-500/20 text-red-300'
  }
  return classes[status] || classes['active']
}

// 刷新用户列表
const refreshUsers = () => {
  fetchUsers()
}

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// 禁言用户
const banUser = async (user) => {
  if (!confirm(`确定要禁言用户 "${user.username}" 吗？\n\n禁言后用户将无法：\n- 发表评论\n- 上传游戏\n- 进行其他操作`)) {
    return
  }

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/admin/users/${user.id}/ban`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'ban' })
    })

    const result = await response.json()

    if (response.ok) {
      notificationStore.success('禁言成功', result.message)
      // 更新本地数据
      user.status = 'banned'
      user.status_name = '已禁用'
    } else {
      notificationStore.error('禁言失败', result.error || '禁言用户失败')
    }
  } catch (error) {
    console.error('禁言用户错误:', error)
    notificationStore.error('网络错误', '请检查网络连接')
  }
}

// 解禁用户
const unbanUser = async (user) => {
  if (!confirm(`确定要解禁用户 "${user.username}" 吗？`)) {
    return
  }

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/admin/users/${user.id}/ban`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'unban' })
    })

    const result = await response.json()

    if (response.ok) {
      notificationStore.success('解禁成功', result.message)
      // 更新本地数据
      user.status = 'active'
      user.status_name = '正常'
    } else {
      notificationStore.error('解禁失败', result.error || '解禁用户失败')
    }
  } catch (error) {
    console.error('解禁用户错误:', error)
    notificationStore.error('网络错误', '请检查网络连接')
  }
}

// 删除用户
const deleteUser = async (user) => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/admin/users/${user.id}/delete`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const result = await response.json()

    if (response.ok) {
      notificationStore.success('删除成功', result.message)
      // 从列表中移除已删除的用户
      users.value = users.value.filter(u => u.id !== user.id)
    } else {
      notificationStore.error('删除失败', result.error || '删除用户失败')
    }
  } catch (error) {
    console.error('删除用户错误:', error)
    notificationStore.error('网络错误', '请检查网络连接')
  }
}

// 确认删除用户
const confirmDeleteUser = (user) => {
  if (confirm(`确定要彻底删除用户 "${user.username}" 吗？\n\n此操作将：\n- 删除用户账户\n- 删除用户的所有评论\n- 删除用户上传的所有游戏\n- 删除用户相关的所有通知\n\n此操作不可撤销！`)) {
    deleteUser(user)
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  font-family: 'Quicksand', sans-serif;
  background-color: #e493d0;
  background-image: 
    radial-gradient(closest-side, rgb(42, 8, 233), rgba(235, 105, 78, 0)),
    radial-gradient(closest-side, rgb(189, 6, 239), rgba(243, 11, 164, 0)),
    radial-gradient(closest-side, rgb(183, 0, 255), rgba(254, 234, 131, 0)),
    radial-gradient(closest-side, rgba(170, 142, 245, 1), rgba(170, 142, 245, 0)),
    radial-gradient(closest-side, rgb(237, 164, 255), rgba(55, 0, 119, 0));
  background-size: 
    130vmax 130vmax,
    80vmax 80vmax,
    90vmax 90vmax,
    110vmax 110vmax,
    90vmax 90vmax;
  background-position:
    -80vmax -80vmax,
    60vmax -30vmax,
    10vmax 10vmax,
    -30vmax -10vmax,
    50vmax 50vmax;
  background-repeat: no-repeat;
  animation: 10s movement linear infinite;
}

.admin-page::after {
  content: '';
  display: block;
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 0;
}

.content-wrapper {
  position: relative;
  z-index: 10;
}

.glass-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

@keyframes movement {
  0%, 100% {
    background-size: 
      130vmax 130vmax,
      80vmax 80vmax,
      90vmax 90vmax,
      110vmax 110vmax,
      90vmax 90vmax;
    background-position:
      -80vmax -80vmax,
      60vmax -30vmax,
      10vmax 10vmax,
      -30vmax -10vmax,
      50vmax 50vmax;
  }
  25% {
    background-size: 
      100vmax 100vmax,
      90vmax 90vmax,
      100vmax 100vmax,
      90vmax 90vmax,
      60vmax 60vmax;
    background-position:
      -60vmax -90vmax,
      50vmax -40vmax,
      0vmax -20vmax,
      -40vmax -20vmax,
      40vmax 60vmax;
  }
  50% {
    background-size: 
      80vmax 80vmax,
      120vmax 120vmax,
      80vmax 80vmax,
      100vmax 100vmax,
      100vmax 100vmax;
    background-position:
      -40vmax -100vmax,
      40vmax -50vmax,
      -10vmax -30vmax,
      -50vmax -30vmax,
      30vmax 70vmax;
  }
  75% {
    background-size: 
      120vmax 120vmax,
      70vmax 70vmax,
      110vmax 110vmax,
      80vmax 80vmax,
      80vmax 80vmax;
    background-position:
      -20vmax -110vmax,
      30vmax -60vmax,
      -20vmax -40vmax,
      -60vmax -40vmax,
      20vmax 80vmax;
  }
}
</style>
