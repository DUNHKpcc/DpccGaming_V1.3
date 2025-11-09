<template>
  <div class="admin-page">
    <div class="content-wrapper">
      <div class="max-w-6xl mx-auto p-6">
        <div class="glass-card p-8">
          <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold text-white drop-shadow-lg">游戏库管理</h1>
            <div class="flex space-x-4">
              <router-link to="/admin" 
                class="bg-gray-500/90 hover:bg-gray-500 backdrop-blur-sm border border-gray-400/30 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                <i class="fa fa-arrow-left mr-2"></i>返回审核
              </router-link>
              <router-link to="/admin/users" 
                class="bg-blue-500/90 hover:bg-blue-500 backdrop-blur-sm border border-blue-400/30 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                <i class="fa fa-users mr-2"></i>用户管理
              </router-link>
              <button @click="refreshGames" 
                class="bg-primary/90 hover:bg-primary backdrop-blur-sm border border-primary/30 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                <i class="fa fa-refresh mr-2"></i>刷新
              </button>
            </div>
          </div>

          <!-- 搜索和筛选 -->
          <div class="mb-6 flex flex-wrap gap-4">
            <div class="flex-1 min-w-64">
              <input v-model="searchQuery" type="text" placeholder="搜索游戏标题..."
                class="w-full px-4 py-2 bg-white/90 backdrop-blur-sm border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-gray-800 placeholder-gray-500">
            </div>
            <select v-model="selectedCategory" 
              class="px-4 py-2 bg-white/90 backdrop-blur-sm border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-gray-800">
              <option value="">所有类型</option>
              <option value="action">动作</option>
              <option value="adventure">冒险</option>
              <option value="puzzle">谜题</option>
              <option value="racing">赛车</option>
              <option value="simulation">模拟</option>
              <option value="strategy">策略</option>
            </select>
          </div>

          <!-- 游戏列表 -->
          <div v-if="filteredGames.length === 0" class="text-center py-12">
            <i class="fa fa-gamepad text-6xl text-gray-400 mb-4"></i>
            <p class="text-xl text-white/80 drop-shadow-sm">暂无游戏数据</p>
          </div>

          <div v-else class="space-y-6">
            <div v-for="game in filteredGames" :key="game.id" 
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
                    <span><i class="fa fa-tag mr-1"></i>{{ categoryToZh(game.category) }}</span>
                    <span><i class="fa fa-star mr-1"></i>评分: {{ game.average_rating || '0.0' }}</span>
                    <span><i class="fa fa-play mr-1"></i>玩过: {{ game.play_count || 0 }}次</span>
                    <span><i class="fa fa-comment mr-1"></i>评论: {{ game.comment_count || 0 }}条</span>
                    <span><i class="fa fa-clock mr-1"></i>{{ formatDate(game.created_at) }}</span>
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

              <!-- 管理操作 -->
              <div class="flex justify-end space-x-4 pt-4 border-t border-white/20">
                <button @click="confirmDeleteGame(game)" 
                  class="bg-red-500/90 hover:bg-red-500 backdrop-blur-sm border border-red-400/30 text-white px-6 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
                  <i class="fa fa-trash mr-2"></i>删除游戏
                </button>
              </div>
            </div>
          </div>

          <!-- 分页 -->
          <div v-if="totalPages > 1" class="flex justify-center mt-8">
            <div class="flex space-x-2">
              <button v-for="page in totalPages" :key="page" 
                @click="currentPage = page"
                :class="currentPage === page ? 'bg-primary text-white' : 'bg-white/20 text-white/80 hover:bg-white/30'"
                class="px-4 py-2 rounded-lg transition-colors">
                {{ page }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useNotificationStore } from '../stores/notification'
import { categoryToZh, categoryToCode } from '../utils/category'

const notificationStore = useNotificationStore()
const games = ref([])
const searchQuery = ref('')
const selectedCategory = ref('')
const currentPage = ref(1)
const pageSize = 10

// 计算过滤后的游戏列表
const filteredGames = computed(() => {
  let filtered = games.value

  // 按搜索关键词过滤
  if (searchQuery.value) {
    filtered = filtered.filter(game => 
      game.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  // 按类型过滤
  if (selectedCategory.value) {
    filtered = filtered.filter(game => categoryToCode(game.category) === selectedCategory.value)
  }

  // 分页
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filtered.slice(start, end)
})

// 计算总页数
const totalPages = computed(() => {
  let filtered = games.value

  if (searchQuery.value) {
    filtered = filtered.filter(game => 
      game.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  if (selectedCategory.value) {
    filtered = filtered.filter(game => categoryToCode(game.category) === selectedCategory.value)
  }

  return Math.ceil(filtered.length / pageSize)
})

// 获取所有已审核的游戏列表
const fetchGames = async () => {
  try {
    const token = localStorage.getItem('token')
    if (!token) {
      notificationStore.error('未登录', '请先登录管理员账户')
      return
    }

    const response = await fetch('/api/admin/games/all', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      games.value = data.games
    } else {
      const error = await response.json()
      notificationStore.error('获取失败', error.error || '获取游戏列表失败')
    }
  } catch (error) {
    console.error('获取游戏列表错误:', error)
    notificationStore.error('网络错误', '请检查网络连接')
  }
}

// 删除游戏
const deleteGame = async (game) => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/admin/games/${game.game_id}/delete`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const result = await response.json()

    if (response.ok) {
      notificationStore.success('删除成功', result.message)
      // 从列表中移除已删除的游戏
      games.value = games.value.filter(g => g.game_id !== game.game_id)
    } else {
      notificationStore.error('删除失败', result.error || '删除游戏失败')
    }
  } catch (error) {
    console.error('删除游戏错误:', error)
    notificationStore.error('网络错误', '请检查网络连接')
  }
}

// 确认删除游戏
const confirmDeleteGame = (game) => {
  if (confirm(`确定要删除游戏"${game.title}"吗？\n\n此操作将：\n- 删除游戏文件\n- 删除所有相关评论\n- 删除所有相关通知\n\n此操作不可撤销！`)) {
    deleteGame(game)
  }
}

// 刷新列表
const refreshGames = () => {
  fetchGames()
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
      localStorage.removeItem('token')
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
      return
    }
    
    // 权限验证通过，加载数据
    fetchGames()
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
