import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref([])
  let nextId = 1

  const addNotification = (notification) => {
    const id = nextId++
    const newNotification = {
      id,
      type: notification.type || 'info',
      title: notification.title || '通知',
      message: notification.message || '',
      duration: notification.duration || 5000,
      visible: true,
      ...notification
    }

    notifications.value.push(newNotification)

    // 自动移除通知
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }

    return id
  }

  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const clearAll = () => {
    notifications.value = []
  }

  // 便捷方法
  const success = (title, message = '', options = {}) => {
    return addNotification({
      type: 'success',
      title,
      message,
      ...options
    })
  }

  const error = (title, message = '', options = {}) => {
    return addNotification({
      type: 'error',
      title,
      message,
      duration: 7000, // 错误通知显示更长时间
      ...options
    })
  }

  const warning = (title, message = '', options = {}) => {
    return addNotification({
      type: 'warning',
      title,
      message,
      duration: 6000,
      ...options
    })
  }

  const info = (title, message = '', options = {}) => {
    return addNotification({
      type: 'info',
      title,
      message,
      ...options
    })
  }

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info
  }
})
