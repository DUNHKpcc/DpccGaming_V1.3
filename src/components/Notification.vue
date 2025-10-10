<template>
  <div v-if="notifications.length > 0" class="notification-container">
    <TransitionGroup name="notification" tag="div">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="[
          'notification',
          `notification-${notification.type}`,
          { 'notification-visible': notification.visible }
        ]"
        @click="removeNotification(notification.id)"
      >
        <div class="notification-icon">
          <i :class="getIconClass(notification.type)"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">{{ notification.title }}</div>
          <div v-if="notification.message" class="notification-message">{{ notification.message }}</div>
        </div>
        <button @click.stop="removeNotification(notification.id)" class="notification-close">
          <i class="fa fa-times"></i>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useNotificationStore } from '../stores/notification'

const notificationStore = useNotificationStore()
const notifications = computed(() => notificationStore.notifications)

const getIconClass = (type) => {
  const icons = {
    success: 'fa fa-check-circle',
    error: 'fa fa-exclamation-circle',
    warning: 'fa fa-exclamation-triangle',
    info: 'fa fa-info-circle'
  }
  return icons[type] || icons.info
}

const removeNotification = (id) => {
  notificationStore.removeNotification(id)
}
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  max-width: 400px;
  width: 100%;
}

.notification {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.notification:hover {
  transform: translateX(-5px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.notification-success {
  background: linear-gradient(135deg, #0800fc, #ff00ea);
  color: white;
}

.notification-error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.notification-warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.notification-info {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.notification-icon {
  margin-right: 12px;
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  line-height: 1.4;
}

.notification-message {
  font-size: 13px;
  opacity: 0.9;
  line-height: 1.4;
  word-wrap: break-word;
}

.notification-close {
  margin-left: 12px;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
  padding: 4px;
  border-radius: 4px;
}

.notification-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* 动画效果 */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .notification-container {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
  
  .notification {
    padding: 12px;
  }
  
  .notification-title {
    font-size: 13px;
  }
  
  .notification-message {
    font-size: 12px;
  }
}
</style>
