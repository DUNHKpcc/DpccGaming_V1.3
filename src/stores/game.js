import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiCall } from '../utils/api'

const normalizeGame = (game = {}) => {
  const normalizedId = game.game_id || game.id
  return {
    ...game,
    id: game.id || normalizedId,
    game_id: normalizedId,
    engine: game.engine || game.game_engine || null,
    code_type: game.code_type || game.code_category || game.codeType || null,
    video_url: game.video_url || game.videoUrl || null,
    codePackageUrl: game.codePackageUrl || game.code_package_url || game.codeArchiveUrl || null,
    codeEntryPath: game.codeEntryPath || game.code_entry_path || null,
    codeSummary: game.codeSummary || game.code_summary || null
  }
}

export const useGameStore = defineStore('game', () => {
  const games = ref([])
  const currentGame = ref(null)
  const comments = ref([])
  const gamesLoaded = ref(false)

  const gamesMap = computed(() => {
    const map = new Map()
    games.value.forEach(game => {
      if (game?.game_id) {
        map.set(game.game_id, game)
      }
    })
    return map
  })

  const upsertGame = (game) => {
    if (!game?.game_id) return
    const index = games.value.findIndex(item => item.game_id === game.game_id)
    if (index >= 0) {
      games.value.splice(index, 1, game)
    } else {
      games.value.push(game)
    }
  }

  const loadGames = async () => {
    try {
      const response = await apiCall('/games')
      games.value = (response.games || []).map(normalizeGame)
      gamesLoaded.value = true
    } catch (error) {
      console.error('加载游戏失败:', error)
      // 出错时也提供默认的模拟游戏数据
      games.value = [
        {
          id: 1,
          game_id: 1,
          name: '示例游戏1',
          category: '动作',
          thumbnail: '/images/placeholder.png',
          engine: 'Cocos',
          code_type: 'TypeScript'
        },
        {
          id: 2,
          game_id: 2,
          name: '示例游戏2',
          category: '益智',
          thumbnail: '/images/placeholder.png',
          engine: 'Unity',
          code_type: 'C#'
        }
      ]
      gamesLoaded.value = true
    }
  }

  const getGameById = (gameId) => {
    if (!gameId) return null
    return gamesMap.value.get(gameId) || null
  }

  const loadGameById = async (gameId) => {
    if (!gameId) return null
    const existing = getGameById(gameId)
    if (existing) return existing
    try {
      const response = await apiCall(`/games/${gameId}`)
      const target = normalizeGame(response.game || response)
      upsertGame(target)
      return target
    } catch (error) {
      console.error('加载游戏详情失败:', error)
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
    gamesLoaded,
    loadGames,
    loadGameById,
    getGameById,
    recordGamePlay,
    loadComments,
    submitComment,
    submitReply
  }
})
