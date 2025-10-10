import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiCall } from '../utils/api'

export const useGameStore = defineStore('game', () => {
  const games = ref([])
  const currentGame = ref(null)
  const comments = ref([])

  const loadGames = async () => {
    try {
      const response = await apiCall('/games')
      games.value = response.games || []
    } catch (error) {
      console.error('加载游戏失败:', error)
      throw error
    }
  }

  const recordGamePlay = async (gameId) => {
    try {
      await apiCall(`/games/${gameId}/play`, {
        method: 'POST'
      })
      // 重新加载游戏数据以更新玩过人数
      await loadGames()
    } catch (error) {
      console.error('记录游戏玩过失败:', error)
    }
  }

  const loadComments = async (gameId) => {
    try {
      const commentsData = await apiCall(`/games/${gameId}/comments`)
      comments.value = commentsData
    } catch (error) {
      console.error('加载评论失败:', error)
      comments.value = []
    }
  }

  const submitComment = async (gameId, rating, commentText) => {
    try {
      await apiCall(`/games/${gameId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ rating, commentText })
      })
      // 重新加载评论列表
      await loadComments(gameId)
      return { success: true, message: '评论发布成功！' }
    } catch (error) {
      return { success: false, message: error.message || '评论发布失败' }
    }
  }

  const submitReply = async (gameId, commentId, commentText, replyToUserId = null) => {
    try {
      await apiCall(`/games/${gameId}/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ commentText, replyToUserId })
      })
      // 重新加载评论列表
      await loadComments(gameId)
      return { success: true, message: '回复发布成功！' }
    } catch (error) {
      return { success: false, message: error.message || '回复发布失败' }
    }
  }

  return {
    games,
    currentGame,
    comments,
    loadGames,
    recordGamePlay,
    loadComments,
    submitComment,
    submitReply
  }
})
