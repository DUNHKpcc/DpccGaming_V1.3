<template>
  <div class="admin-page">
    <div class="content-wrapper">
      <div class="max-w-6xl mx-auto p-6">
        <div class="glass-card p-8">
          <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold text-white drop-shadow-lg">游戏审核管理</h1>
            <div class="flex space-x-4">
              <router-link to="/admin/users" 
                class="bg-blue-500/90 hover:bg-blue-500 backdrop-blur-sm border border-blue-400/30 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                <i class="fa fa-users mr-2"></i>用户管理
              </router-link>
              <router-link to="/admin/games" 
                class="bg-green-500/90 hover:bg-green-500 backdrop-blur-sm border border-green-400/30 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                <i class="fa fa-gamepad mr-2"></i>游戏管理
              </router-link>
              <button @click="refreshPendingGames" 
                class="bg-primary/90 hover:bg-primary backdrop-blur-sm border border-primary/30 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                <i class="fa fa-refresh mr-2"></i>刷新
              </button>
            </div>
          </div>

          <!-- 待审核游戏列表 -->
          <div v-if="pendingGames.length === 0" class="text-center py-12">
            <i class="fa fa-check-circle text-6xl text-green-400 mb-4"></i>
            <p class="text-xl text-white/80 drop-shadow-sm">暂无待审核游戏</p>
          </div>

          <div v-else class="space-y-6">
            <div v-for="game in pendingGames" :key="game.id" 
              class="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all duration-300">
              
              <!-- 游戏信息 -->
              <div class="flex items-start space-x-6">
                <!-- 缩略图 -->
                <div class="flex-shrink-0">
                  <img v-if="game.thumbnail_url" 
                    :src="game.thumbnail_url" 
                    :alt="game.title"
                    class="w-24 h-24 object-cover rounded-lg shadow-lg">
                  <div v-else class="w-24 h-24 bg-gray-300 rounded-lg flex items-center justify-center">
                    <i class="fa fa-gamepad text-2xl text-gray-500"></i>
                  </div>
                </div>

                <!-- 游戏详情 -->
                <div class="flex-1">
                  <h3 class="text-xl font-bold text-white drop-shadow-sm mb-2">{{ game.title }}</h3>
                  <p class="text-white/80 mb-2">{{ game.description }}</p>
                  
                  <div class="flex flex-wrap gap-4 text-sm text-white/70 mb-4">
                    <span><i class="fa fa-tag mr-1"></i>{{ game.category }}</span>
                    <span><i class="fa fa-user mr-1"></i>上传者: {{ game.uploaded_by_username }}</span>
                    <span><i class="fa fa-clock mr-1"></i>{{ formatDate(game.uploaded_at) }}</span>
                  </div>

                  <!-- 游戏链接预览 -->
                  <div class="mb-4">
                    <a :href="game.game_url" target="_blank" 
                      class="inline-flex items-center text-primary hover:text-primary/80 transition-colors">
                      <i class="fa fa-external-link mr-2"></i>
                      预览游戏
                    </a>
                  </div>
                </div>
              </div>

              <!-- 审核操作 -->
              <div class="flex justify-end space-x-4 pt-4 border-t border-white/20">
                <button @click="rejectGame(game)" 
                  class="bg-red-500/90 hover:bg-red-500 backdrop-blur-sm border border-red-400/30 text-white px-6 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                  <i class="fa fa-times mr-2"></i>拒绝
                </button>
                <button @click="approveGame(game)" 
                  class="bg-green-500/90 hover:bg-green-500 backdrop-blur-sm border border-green-400/30 text-white px-6 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                  <i class="fa fa-check mr-2"></i>通过
                </button>
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
const pendingGames = ref([])

// 获取待审核游戏列表
const fetchPendingGames = async () => {
  try {
    const token = localStorage.getItem('token')
    if (!token) {
      notificationStore.error('未登录', '请先登录管理员账户')
      return
    }

    const response = await fetch('/api/admin/games/pending', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      pendingGames.value = data.games
    } else {
      const error = await response.json()
      notificationStore.error('获取失败', error.error || '获取待审核游戏失败')
    }
  } catch (error) {
    console.error('获取待审核游戏错误:', error)
    notificationStore.error('网络错误', '请检查网络连接')
  }
}

// 审核游戏
const reviewGame = async (gameId, status, reviewNotes = '') => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/admin/games/${gameId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status, reviewNotes })
    })

    const result = await response.json()

    if (response.ok) {
      notificationStore.success(
        `游戏${status === 'approved' ? '审核通过' : '审核拒绝'}`, 
        result.message
      )
      // 从列表中移除已审核的游戏
      pendingGames.value = pendingGames.value.filter(g => g.game_id !== gameId)
    } else {
      notificationStore.error('审核失败', result.error || '审核过程中出现错误')
    }
  } catch (error) {
    console.error('审核游戏错误:', error)
    notificationStore.error('网络错误', '请检查网络连接')
  }
}

// 通过游戏
const approveGame = (game) => {
  if (confirm(`确定要通过游戏"${game.title}"吗？`)) {
    reviewGame(game.game_id, 'approved')
  }
}

// 拒绝游戏
const rejectGame = (game) => {
  const reason = prompt(`请输入拒绝游戏"${game.title}"的原因：`)
  if (reason !== null) {
    reviewGame(game.game_id, 'rejected', reason)
  }
}

// 刷新列表
const refreshPendingGames = () => {
  fetchPendingGames()
}

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

onMounted(async () => {
  // 检查管理员权限
  const token = localStorage.getItem('token')
  if (!token) {
    notificationStore.error('未登录', '请先登录管理员账户')
    window.location.href = '/'
    return
  }
  
  try {
    // 验证管理员权限
    const response = await fetch('/api/admin/check-permission', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      notificationStore.error('权限不足', error.message || '只有管理员才能访问此页面')
      // 清除token并重定向
      localStorage.removeItem('token')
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
      return
    }
    
    // 验证用户角色
    const data = await response.json()
    if (!['admin', 'super_admin'].includes(data.user.role)) {
      notificationStore.error('权限不足', '您的账户没有管理员权限')
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
      return
    }
    
    // 权限验证通过，加载数据
    fetchPendingGames()
  } catch (error) {
    console.error('权限检查失败:', error)
    notificationStore.error('权限检查失败', '网络错误，请检查网络连接')
    setTimeout(() => {
      window.location.href = '/'
    }, 2000)
  }
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
