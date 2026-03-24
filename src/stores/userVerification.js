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

export const useUserVerificationStore = defineStore('userVerification', () => {
  const verificationMap = ref({})
  const loadingMap = ref({})

  const queuedIds = new Set()
  let batchPromise = null

  const hasCachedVerification = (userId) => Object.prototype.hasOwnProperty.call(verificationMap.value, userId)

  const fetchVerificationBatch = async (ids) => {
    if (!ids.length) return []

    const response = await fetch(`/api/user-verifications?ids=${ids.join(',')}`, {
      credentials: 'include'
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.error || data.message || '获取用户认证信息失败')
    }

    return Array.isArray(data.verifications) ? data.verifications : []
  }

  const flushQueue = async () => {
    const ids = [...queuedIds]
    queuedIds.clear()
    if (!ids.length) return

    try {
      const rows = await fetchVerificationBatch(ids)
      const map = rows.reduce((acc, row) => {
        const key = Number.parseInt(row?.user_id, 10)
        if (!Number.isInteger(key) || key <= 0) return acc
        acc[key] = row
        return acc
      }, {})

      ids.forEach((id) => {
        verificationMap.value[id] = map[id] || null
      })
    } catch (error) {
      console.error('批量获取用户认证信息失败:', error)
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

  const ensureVerifications = async (ids = []) => {
    const normalizedIds = normalizeIds(ids)
    const pendingIds = normalizedIds.filter((id) => !hasCachedVerification(id) && !loadingMap.value[id])

    if (!pendingIds.length) {
      return normalizedIds.map((id) => verificationMap.value[id]).filter(Boolean)
    }

    pendingIds.forEach((id) => {
      queuedIds.add(id)
      loadingMap.value[id] = true
    })

    await scheduleBatch()

    return normalizedIds.map((id) => verificationMap.value[id]).filter(Boolean)
  }

  const getVerification = (userId) => {
    if (!isValidUserId(userId)) return null
    return verificationMap.value[Number.parseInt(userId, 10)] || null
  }

  return {
    verificationMap,
    loadingMap,
    ensureVerifications,
    getVerification
  }
})
