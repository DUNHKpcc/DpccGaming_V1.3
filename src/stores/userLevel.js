import { defineStore } from 'pinia'
import { ref } from 'vue'

const isValidUserId = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0
}

const normalizeIds = (ids = []) => {
  return [...new Set(
    ids
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isInteger(id) && id > 0)
  )]
}

export const useUserLevelStore = defineStore('userLevel', () => {
  const levelMap = ref({})
  const loadingMap = ref({})

  const queuedIds = new Set()
  let batchPromise = null

  const hasCachedLevel = (userId) => Object.prototype.hasOwnProperty.call(levelMap.value, userId)

  const fetchLevelBatch = async (ids) => {
    if (!ids.length) return []

    const response = await fetch(`/api/user-levels?ids=${ids.join(',')}`, {
      credentials: 'include'
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.error || data.message || '获取用户等级失败')
    }

    return Array.isArray(data.levels) ? data.levels : []
  }

  const flushQueue = async () => {
    const ids = [...queuedIds]
    queuedIds.clear()
    if (!ids.length) return

    try {
      const rows = await fetchLevelBatch(ids)
      const map = rows.reduce((acc, row) => {
        const key = Number.parseInt(row?.user_id, 10)
        if (!Number.isInteger(key) || key <= 0) return acc
        acc[key] = row
        return acc
      }, {})

      ids.forEach((id) => {
        levelMap.value[id] = map[id] || null
      })
    } catch (error) {
      console.error('批量获取用户等级失败:', error)
    } finally {
      ids.forEach((id) => {
        delete loadingMap.value[id]
      })
    }
  }

  const scheduleBatch = () => {
    if (!batchPromise) {
      batchPromise = Promise.resolve()
        .then(flushQueue)
        .finally(() => {
          batchPromise = null
          if (queuedIds.size > 0) {
            scheduleBatch()
          }
        })
    }

    return batchPromise
  }

  const ensureLevels = async (ids = []) => {
    const normalizedIds = normalizeIds(ids)
    const pendingIds = normalizedIds.filter((id) => !hasCachedLevel(id) && !loadingMap.value[id])

    if (!pendingIds.length) {
      return normalizedIds.map((id) => levelMap.value[id]).filter(Boolean)
    }

    pendingIds.forEach((id) => {
      queuedIds.add(id)
      loadingMap.value[id] = true
    })

    await scheduleBatch()

    return normalizedIds.map((id) => levelMap.value[id]).filter(Boolean)
  }

  const getLevel = (userId) => {
    if (!isValidUserId(userId)) return null
    return levelMap.value[Number.parseInt(userId, 10)] || null
  }

  return {
    levelMap,
    loadingMap,
    ensureLevels,
    getLevel
  }
})
