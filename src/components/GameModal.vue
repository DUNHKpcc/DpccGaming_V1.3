<template>
  <div v-if="isOpen" 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 opacity-100 pointer-events-auto transition-opacity duration-300"
    @click="handleBackdropClick">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-md"></div>
    <div
      class="relative bg-white/15 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transform scale-100 transition-transform duration-300"
      @click.stop>
      <div class="flex justify-between items-center p-6 border-b border-white/20">
        <h3 class="text-2xl font-bold text-white">{{ currentGame?.title || '游戏标题' }}</h3>
        <div class="flex items-center gap-3">
          <button @click="enterFullscreen" 
                  class="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white px-4 py-2 rounded-xl text-sm transition-all duration-300 flex items-center gap-2"
                  title="全屏游戏">
            <i class="fa fa-expand"></i>
            <span>全屏</span>
          </button>
          <button @click="closeModal" class="text-white/80 hover:text-white text-2xl transition-colors duration-300">
            <i class="fa fa-times"></i>
          </button>
        </div>
      </div>

      <div class="flex flex-col md:flex-row flex-1 overflow-hidden">
        <!-- 游戏区域 -->
        <div class="md:w-2/3 bg-white/10 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden">
          <div class="w-full h-full flex items-center justify-center">
            <div v-if="gameLoading" class="text-center">
              <i class="fa fa-gamepad text-6xl text-white/30 mb-4"></i>
              <p class="text-white/80">正在加载游戏...</p>
            </div>
            <iframe 
              v-else-if="currentGame"
              :src="gameLaunchUrl"
              class="game-modal-iframe"
              frameborder="0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"
              allowfullscreen
              @load="onGameFrameLoad"
              @click="focusGameFrame"
              tabindex="0">
            </iframe>
          </div>
        </div>

        <!-- 评论区域 -->
        <div class="md:w-1/3 border-l border-white/20 overflow-y-auto bg-white/5 backdrop-blur-sm">
          <div class="p-6">
            <h4 class="text-lg font-bold mb-4 text-white">评论&评价</h4>

            <!-- 评论表单 -->
            <div class="mb-6">
              <div v-if="!isLoggedIn" class="text-center py-4 text-white/80">
                请你先<button @click="openLoginModal" class="text-white hover:text-white/80 hover:underline transition-colors duration-300">登录</button>才能评论
              </div>

              <form v-else @submit.prevent="submitComment" class="space-y-3">
                <div>
                  <label class="block text-sm font-medium mb-1 text-white">你的评分</label>
                  <div class="flex text-2xl">
                    <i v-for="star in 5" :key="star"
                      :class="['fa fa-star cursor-pointer rating-star', star <= selectedRating ? 'text-yellow-400' : 'text-white/30']"
                      @click="selectedRating = star"
                      @mouseover="hoverRating = star"
                      @mouseleave="hoverRating = 0">
                    </i>
                  </div>
                </div>
                <div>
                  <textarea v-model="commentText" rows="3"
                    class="w-full px-3 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all duration-300"
                    placeholder="请写下您的评论..."></textarea>
                </div>
                <button type="submit"
                  class="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white py-2 rounded-xl transition-all duration-300">
                  发布评论
                </button>
              </form>
            </div>

            <!-- 评论列表 -->
            <div class="space-y-4">
              <div v-if="commentsLoading" class="text-center py-4 text-white/80">加载评论...</div>
              <div v-else-if="comments.length === 0" class="text-center py-4 text-white/80">暂无评论，成为第一个评论者吧！</div>
              <div v-else v-for="comment in comments" :key="comment.id" :id="`comment-${comment.id}`" class="mb-4 pb-4 border-b border-white/20">
                <div class="flex justify-between items-start mb-1">
                  <div class="font-medium text-white">{{ comment.username }}</div>
                  <div class="text-yellow-400 text-sm">
                    <i v-for="star in comment.rating" :key="star" class="fa fa-star"></i>
                    <i v-for="star in (5 - comment.rating)" :key="star" class="fa fa-star-o"></i>
                  </div>
                </div>
                <div class="text-sm text-white/80 mb-1">
                  <span v-if="!expandedComments.has(comment.id) && comment.comment_text.length > 24">
                    {{ comment.comment_text.substring(0, 24) }}...
                    <button @click="toggleCommentExpansion(comment.id)" class="text-white hover:text-white/80 underline ml-1 transition-colors duration-300">
                      展开
                    </button>
                  </span>
                  <span v-else-if="expandedComments.has(comment.id)">
                    {{ comment.comment_text }}
                    <button v-if="comment.comment_text.length > 24" @click="toggleCommentExpansion(comment.id)" class="text-white hover:text-white/80 underline ml-1 transition-colors duration-300">
                      收起
                    </button>
                  </span>
                  <span v-else>{{ comment.comment_text }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <div class="text-xs text-white/60">{{ getTimeAgo(comment.created_at) }}</div>
                  <div class="flex items-center gap-2">
                    <!-- 折叠/展开回复按钮 -->
                    <button 
                      v-if="comment.replies?.length > 0" 
                      @click="toggleRepliesCollapse(comment.id)" 
                      class="text-xs text-white/80 hover:text-white transition-colors duration-300 flex items-center gap-1">
                      <i :class="collapsedReplies.has(comment.id) ? 'fa fa-chevron-down' : 'fa fa-chevron-up'"></i>
                      {{ collapsedReplies.has(comment.id) ? '展开' : '折叠' }}回复 ({{ comment.replies.length }})
                    </button>
                    <button @click="showReplyForm(comment.id)" class="text-xs text-white/80 hover:text-white transition-colors duration-300">
                      回复
                    </button>
                  </div>
                </div>
                
                <!-- 回复列表 -->
                <div v-if="comment.replies?.length && !collapsedReplies.has(comment.id)" class="mt-3 ml-4 space-y-2">
                  <div v-for="reply in comment.replies" :key="reply.id" :id="`reply-${reply.id}`" class="pb-2 border-l-2 border-white/20 pl-3">
                    <div class="flex justify-between items-start mb-1">
                      <div class="font-medium text-sm text-white">{{ reply.username }}</div>
                      <button @click="showReplyForm(comment.id, reply.user_id, reply.id)" class="text-xs text-white/80 hover:text-white transition-colors duration-300">
                        回复
                      </button>
                    </div>
                    <div class="text-xs text-white/80 mb-1">
                      <span v-if="!expandedReplies.has(reply.id) && reply.comment_text.length > 24">
                        {{ reply.comment_text.substring(0, 24) }}...
                        <button @click="toggleReplyExpansion(reply.id)" class="text-white hover:text-white/80 underline ml-1 transition-colors duration-300">
                          展开
                        </button>
                      </span>
                      <span v-else-if="expandedReplies.has(reply.id)">
                        {{ reply.comment_text }}
                        <button v-if="reply.comment_text.length > 24" @click="toggleReplyExpansion(reply.id)" class="text-white hover:text-white/80 underline ml-1 transition-colors duration-300">
                          收起
                        </button>
                      </span>
                      <span v-else>{{ reply.comment_text }}</span>
                    </div>
                    <div class="text-xs text-white/60">{{ getTimeAgo(reply.created_at) }}</div>
                    
                    <!-- 回复表单 - 显示在具体回复下面 -->
                    <div v-if="activeReplyForm === reply.id" class="mt-3">
                      <div class="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/20">
                        <!-- 显示回复目标 -->
                        <div v-if="replyToUserId" class="mb-2 text-xs text-white/80">
                          回复 <span class="text-white font-medium">{{ reply.username }}</span> 的评论：
                        </div>
                        <textarea v-model="replyText" class="w-full p-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all duration-300" placeholder="写下你的回复..." rows="2"></textarea>
                        <div class="flex justify-end mt-2 space-x-2">
                          <button @click="hideReplyForm" class="px-3 py-1 text-xs bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg hover:bg-white/30 transition-all duration-300">取消</button>
                          <button @click="submitReply(comment.id)" class="px-3 py-1 text-xs bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg hover:bg-white/30 transition-all duration-300">发送</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
            <!-- 回复表单 -->
            <div v-if="activeReplyForm === comment.id" class="mt-3 ml-4">
              <div class="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/20">
                <!-- 显示回复目标 -->
                <div v-if="replyToUserId" class="mb-2 text-xs text-white/80">
                  回复 <span class="text-white font-medium">{{ getReplyTargetName(comment.id, replyToUserId) }}</span> 的评论：
                </div>
                <textarea v-model="replyText" class="w-full p-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all duration-300" placeholder="写下你的回复..." rows="2"></textarea>
                <div class="flex justify-end mt-2 space-x-2">
                  <button @click="hideReplyForm" class="px-3 py-1 text-xs bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg hover:bg-white/30 transition-all duration-300">取消</button>
                  <button @click="submitReply(comment.id)" class="px-3 py-1 text-xs bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg hover:bg-white/30 transition-all duration-300">发送</button>
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
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useModalStore } from '../stores/modal'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import { useNotificationStore } from '../stores/notification'
import { setupGameEventHandling, focusGameIframe } from '../utils/gameEvents'
import { resolveMediaUrl } from '../utils/media'

const modalStore = useModalStore()
const authStore = useAuthStore()
const gameStore = useGameStore()
const notificationStore = useNotificationStore()

const isOpen = computed(() => modalStore.activeModal === 'game')
const currentGame = computed(() => modalStore.currentGame)
const isLoggedIn = computed(() => authStore.isLoggedIn)
const comments = computed(() => gameStore.comments)
const gameLaunchUrl = computed(() => {
  if (!currentGame.value) return ''
  const rawUrl =
    currentGame.value.launch_url ||
    currentGame.value.game_url ||
    `games/${currentGame.value.game_id || currentGame.value.id}/index.html`
  return resolveMediaUrl(rawUrl)
})

const gameLoading = ref(true)
const commentsLoading = ref(false)
const selectedRating = ref(0)
const commentText = ref('')
const activeReplyForm = ref(null)
const replyText = ref('')
const replyToUserId = ref(null)
const expandedComments = ref(new Set()) // 存储展开的评论ID
const expandedReplies = ref(new Set()) // 存储展开的回复ID
const collapsedReplies = ref(new Set()) // 存储折叠的回复列表ID
const targetCommentId = ref(null) // 目标评论ID，用于锚点定位
const notificationExpandedReplies = ref(new Set()) // 存储因通知而展开的回复列表ID
const gameFrame = ref(null) // 游戏iframe引用

const loadComments = async () => {
  if (!currentGame.value) {
    return
  }
  
  commentsLoading.value = true
  try {
    await gameStore.loadComments(currentGame.value.game_id || currentGame.value.id)
  } catch (error) {
    console.error('Failed to load comments:', error)
  } finally {
    commentsLoading.value = false
  }
}

const submitComment = async () => {
  if (!currentGame.value || !isLoggedIn.value) return
  
  if (selectedRating.value === 0) {
    notificationStore.warning('请选择评分', '请为游戏选择一个评分')
    return
  }
  
  if (!commentText.value.trim()) {
    notificationStore.warning('请输入评论内容', '评论内容不能为空')
    return
  }

  const result = await gameStore.submitComment(currentGame.value.game_id || currentGame.value.id, selectedRating.value, commentText.value)
  
  if (result.success) {
    commentText.value = ''
    selectedRating.value = 0
    notificationStore.success('评论成功', result.message)
  } else {
    notificationStore.error('评论失败', result.message)
  }
}

const showReplyForm = (commentId, userId = null, replyId = null) => {
  // 如果replyId存在，说明是回复某个具体的回复
  activeReplyForm.value = replyId || commentId
  replyToUserId.value = userId
  replyText.value = ''
}

const hideReplyForm = () => {
  activeReplyForm.value = null
  replyToUserId.value = null
  replyText.value = ''
}

const submitReply = async () => {
  if (!currentGame.value || !isLoggedIn.value) return
  
  if (!replyText.value.trim()) {
    notificationStore.warning('回复内容不能为空', '请输入回复内容')
    return
  }

  // 确定要回复的评论ID
  let targetCommentId = activeReplyForm.value
  
  // 如果activeReplyForm是回复的ID，需要找到对应的主评论ID
  const comments = gameStore.comments
  let parentCommentId = null
  
  for (const comment of comments) {
    if (comment.id === targetCommentId) {
      // 直接回复主评论
      parentCommentId = targetCommentId
      break
    } else if (comment.replies?.some(reply => reply.id === targetCommentId)) {
      // 回复某个回复，需要回复到主评论
      parentCommentId = comment.id
      break
    }
  }

  if (!parentCommentId) {
    console.error('Could not find parent comment for reply')
    return
  }

  const result = await gameStore.submitReply(
    currentGame.value.game_id || currentGame.value.id, 
    parentCommentId, 
    replyText.value, 
    replyToUserId.value
  )
  
  if (result.success) {
    hideReplyForm()
    notificationStore.success('回复成功', result.message)
  } else {
    notificationStore.error('回复失败', result.message)
  }
}

const enterFullscreen = () => {
  if (currentGame.value) {
    modalStore.enterFullscreen(currentGame.value)
  }
}

const closeModal = () => {
  modalStore.closeModal()
}

const openLoginModal = () => {
  modalStore.closeModal()
  setTimeout(() => {
    modalStore.openModal('login')
  }, 300)
}

const getTimeAgo = (dateString) => {
  const now = new Date()
  const date = new Date(dateString)
  const diffInSeconds = Math.floor((now - date) / 1000)
  
  if (diffInSeconds < 60) return '刚刚'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`
  return `${Math.floor(diffInSeconds / 2592000)}个月前`
}

const getReplyTargetName = (commentId, userId) => {
  const comment = comments.value.find(c => c.id === commentId)
  if (!comment) return '未知用户'
  
  // 如果是回复主评论
  if (comment.user_id === userId) {
    return comment.username
  }
  
  // 如果是回复回复
  const reply = comment.replies?.find(r => r.user_id === userId)
  return reply ? reply.username : '未知用户'
}

// 折叠功能方法
const toggleCommentExpansion = (commentId) => {
  if (expandedComments.value.has(commentId)) {
    expandedComments.value.delete(commentId)
  } else {
    expandedComments.value.add(commentId)
  }
}

const toggleReplyExpansion = (replyId) => {
  if (expandedReplies.value.has(replyId)) {
    expandedReplies.value.delete(replyId)
  } else {
    expandedReplies.value.add(replyId)
  }
}

// 折叠/展开回复列表
const toggleRepliesCollapse = (commentId) => {
  if (collapsedReplies.value.has(commentId)) {
    collapsedReplies.value.delete(commentId)
  } else {
    collapsedReplies.value.add(commentId)
  }
}

// 滚动到指定评论
const scrollToComment = (commentId) => {
  nextTick(() => {
    // 首先检查这个ID是否存在于回复中
    const comments = gameStore.comments
    let parentCommentId = null
    let isReply = false
    
    // 检查是否是回复ID
    for (const comment of comments) {
      if (comment.replies?.some(reply => reply.id === commentId)) {
        parentCommentId = comment.id
        isReply = true
        break
      }
    }
    
    // 如果是回复，先展开对应的回复列表
    if (isReply && parentCommentId) {
      collapsedReplies.value.delete(parentCommentId) // 展开回复列表
      notificationExpandedReplies.value.add(parentCommentId) // 记录因通知而展开的回复列表
      
      // 使用nextTick确保DOM更新完成
      nextTick(() => {
        // 再次使用nextTick确保所有响应式更新完成
        nextTick(() => {
          const replyElementId = `reply-${commentId}`
          const targetElement = document.getElementById(replyElementId)
          
          if (targetElement) {
            // 滚动到回复位置
            targetElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            })
            
            // 延迟添加高亮效果
            setTimeout(() => {
              targetElement.classList.add('highlight-comment')
              
              // 添加内联样式确保黄色高亮生效
              targetElement.style.backgroundColor = 'rgba(255, 193, 7, 0.3)'
              targetElement.style.border = '3px solid rgba(255, 193, 7, 0.9)'
              targetElement.style.borderRadius = '8px'
              targetElement.style.padding = '8px'
              targetElement.style.boxShadow = '0 0 25px rgba(255, 193, 7, 0.6)'
              
              // 5秒后移除高亮效果
              setTimeout(() => {
                targetElement.classList.remove('highlight-comment')
                targetElement.style.backgroundColor = ''
                targetElement.style.border = ''
                targetElement.style.borderRadius = ''
                targetElement.style.padding = ''
                targetElement.style.boxShadow = ''
              }, 5000)
            }, 500)
          } else {
            // 如果还是找不到，尝试延迟查找
            setTimeout(() => {
              const retryElement = document.getElementById(replyElementId)
              if (retryElement) {
                retryElement.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center' 
                })
                
                setTimeout(() => {
                  retryElement.classList.add('highlight-comment')
                  retryElement.style.backgroundColor = 'rgba(255, 193, 7, 0.3)'
                  retryElement.style.border = '3px solid rgba(255, 193, 7, 0.9)'
                  retryElement.style.borderRadius = '8px'
                  retryElement.style.padding = '8px'
                  retryElement.style.boxShadow = '0 0 25px rgba(255, 193, 7, 0.6)'
                  
                  setTimeout(() => {
                    retryElement.classList.remove('highlight-comment')
                    retryElement.style.backgroundColor = ''
                    retryElement.style.border = ''
                    retryElement.style.borderRadius = ''
                    retryElement.style.padding = ''
                    retryElement.style.boxShadow = ''
                  }, 5000)
                }, 500)
              }
            }, 300)
          }
        })
      })
    } else {
      // 尝试查找主评论
      const commentElementId = `comment-${commentId}`
      const targetElement = document.getElementById(commentElementId)
      
      if (targetElement) {
        // 滚动到评论位置
        targetElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        })
        
        // 延迟添加高亮效果
        setTimeout(() => {
          targetElement.classList.add('highlight-comment')
          
          // 5秒后移除高亮效果
          setTimeout(() => {
            targetElement.classList.remove('highlight-comment')
          }, 5000)
        }, 500)
      }
    }
  })
}

// 游戏iframe相关方法
const onGameFrameLoad = () => {
  gameLoading.value = false
  if (gameFrame.value) {
    // 设置游戏事件处理
    setupGameEventHandling(gameFrame.value, {
      enableKeyboardEvents: true,
      enableMouseEvents: true,
      enableGamepadEvents: true,
      debugMode: false // 生产环境设为false
    })
    
    // 确保iframe获得焦点
    setTimeout(() => {
      focusGameIframe(gameFrame.value)
    }, 100)
  }
}

// 让游戏iframe获得焦点
const focusGameFrame = () => {
  focusGameIframe(gameFrame.value)
}

// 监听事件
onMounted(() => {
  // 监听滚动到评论事件
  window.addEventListener('scroll-to-comment', (event) => {
    const { commentId } = event.detail
    targetCommentId.value = commentId
    
    // 如果评论已经加载，立即尝试滚动
    if (comments.value.length > 0) {
      scrollToComment(commentId)
    }
  })
})

// 监听评论加载完成，如果有目标评论ID则滚动到该评论
watch(comments, (newComments) => {
  if (newComments.length > 0) {
    // 确保所有有回复的评论默认都是折叠状态
    newComments.forEach(comment => {
      if (comment.replies?.length > 0 && !collapsedReplies.value.has(comment.id)) {
        collapsedReplies.value.add(comment.id)
      }
    })
    
    // 如果有目标评论ID，滚动到该评论
    if (targetCommentId.value) {
      scrollToComment(targetCommentId.value)
      // 不要立即清除targetCommentId，让事件监听器也处理
      setTimeout(() => {
        targetCommentId.value = null
      }, 1000)
    }
  }
}, { deep: true })

watch(isOpen, (newVal) => {
  if (newVal && currentGame.value) {
    // 模拟游戏加载
    setTimeout(() => {
      gameLoading.value = false
    }, 1000)
    
    // 加载评论
    loadComments()
  } else {
    gameLoading.value = true
    // 关闭游戏详情页面时，重置因通知而展开的回复列表为折叠状态
    notificationExpandedReplies.value.forEach(commentId => {
      collapsedReplies.value.add(commentId) // 重新折叠这些回复列表
    })
    notificationExpandedReplies.value.clear() // 清空通知展开记录
  }
})
</script>

<style scoped>
/* 评论高亮样式 */
.highlight-comment {
  background: rgba(108, 92, 231, 0.3) !important;
  border: 3px solid rgba(108, 92, 231, 0.8) !important;
  border-radius: 12px !important;
  padding: 12px !important;
  box-shadow: 0 0 20px rgba(108, 92, 231, 0.5) !important;
  animation: highlight-pulse 2s ease-in-out;
  transition: all 0.3s ease !important;
}

/* 回复高亮样式 - 更明显 */
[id^="reply-"].highlight-comment {
  background: rgba(255, 193, 7, 0.3) !important;
  border: 3px solid rgba(255, 193, 7, 0.9) !important;
  border-radius: 8px !important;
  padding: 8px !important;
  box-shadow: 0 0 25px rgba(255, 193, 7, 0.6) !important;
  animation: highlight-pulse-reply 2s ease-in-out !important;
}

/* 更具体的选择器确保回复高亮生效 */
div[id^="reply-"].highlight-comment {
  background: rgba(255, 193, 7, 0.3) !important;
  border: 3px solid rgba(255, 193, 7, 0.9) !important;
  border-radius: 8px !important;
  padding: 8px !important;
  box-shadow: 0 0 25px rgba(255, 193, 7, 0.6) !important;
  animation: highlight-pulse-reply 2s ease-in-out !important;
}

@keyframes highlight-pulse {
  0% { 
    transform: scale(1);
    box-shadow: 0 0 20px rgba(108, 92, 231, 0.5);
  }
  25% { 
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(108, 92, 231, 0.8);
  }
  50% { 
    transform: scale(1.02);
    box-shadow: 0 0 25px rgba(108, 92, 231, 0.6);
  }
  75% { 
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(108, 92, 231, 0.8);
  }
  100% { 
    transform: scale(1);
    box-shadow: 0 0 20px rgba(108, 92, 231, 0.5);
  }
}

@keyframes highlight-pulse-reply {
  0% { 
    transform: scale(1);
    box-shadow: 0 0 25px rgba(255, 193, 7, 0.6);
  }
  25% { 
    transform: scale(1.08);
    box-shadow: 0 0 35px rgba(255, 193, 7, 0.9);
  }
  50% { 
    transform: scale(1.03);
    box-shadow: 0 0 30px rgba(255, 193, 7, 0.7);
  }
  75% { 
    transform: scale(1.08);
    box-shadow: 0 0 35px rgba(255, 193, 7, 0.9);
  }
  100% { 
    transform: scale(1);
    box-shadow: 0 0 25px rgba(255, 193, 7, 0.6);
  }
}

.game-modal-iframe {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 8px;
  min-height: 400px;
  outline: none;
  /* 确保iframe可以接收焦点和事件 */
  pointer-events: auto;
}
</style>
