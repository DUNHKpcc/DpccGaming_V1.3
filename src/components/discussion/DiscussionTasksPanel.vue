<template>
  <div class="discussion-tasks-panel">
    <div v-if="!currentChat" class="tasks-fallback-shell">
      <h3>任务区</h3>
      <p>请先在左侧选择一个讨论房间。</p>
    </div>

    <div v-else class="tasks-shell">
      <header class="tasks-header">
        <h2>任务区</h2>
        <button type="button" class="tasks-create-btn" @click="openCreateTask">
          <i class="fa fa-plus"></i>
          <span>新建任务</span>
        </button>
      </header>

      <section class="tasks-stats">
        <article
          v-for="card in statCards"
          :key="card.key"
          class="tasks-stat-card"
          :class="[`tasks-stat-card-${card.key}`, { active: card.key === 'in_progress' }]"
        >
          <span class="tasks-stat-label">{{ card.label }}</span>
          <strong class="tasks-stat-value">{{ card.value }}</strong>
        </article>
      </section>

      <section class="tasks-section">
        <div class="tasks-section-head">
          <strong>今日任务</strong>
        </div>

        <div v-if="tasksLoading" class="tasks-empty">任务加载中...</div>
        <div v-else-if="tasksError" class="tasks-error">{{ tasksError }}</div>
        <div v-else-if="!currentRoomTasks.length" class="tasks-empty">
          当前房间还没有任务，点击右上角新建任务开始协作。
        </div>

        <div v-else class="tasks-list">
          <div
            v-for="task in currentRoomTasks"
            :key="task.id"
            class="task-item"
            role="button"
            tabindex="0"
            @click="openEditTask(task)"
            @keyup.enter.prevent="openEditTask(task)"
            @keyup.space.prevent="openEditTask(task)"
          >
            <div class="task-item-main">
              <strong class="task-item-title">{{ task.title }}</strong>
              <p class="task-item-meta">{{ formatTaskMeta(task) }}</p>
            </div>
            <button
              type="button"
              class="task-status-pill"
              :class="taskBadgeClass(task)"
              :disabled="togglingTaskIds[task.id] === true"
              :title="taskBadgeTitle(task)"
              @click.stop="toggleTaskStatus(task)"
            >
              {{ taskBadgeLabel(task) }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="showEditor" class="tasks-editor-mask" @click="closeEditor">
      <div class="tasks-editor-panel" @click.stop>
        <div class="tasks-editor-head">
          <strong>{{ editorMode === 'create' ? '新建任务' : '编辑任务' }}</strong>
          <button type="button" class="tasks-editor-close" @click="closeEditor">
            <i class="fa fa-times"></i>
          </button>
        </div>

        <div class="tasks-editor-body">
          <label class="tasks-field">
            <span>任务标题</span>
            <input
              v-model.trim="editorForm.title"
              type="text"
              maxlength="160"
              placeholder="例如：完成上传中心交互验收"
            />
          </label>

          <label class="tasks-field">
            <span>任务说明</span>
            <textarea
              v-model.trim="editorForm.description"
              rows="4"
              maxlength="4000"
              placeholder="补充任务背景、交付要求或协作备注"
            ></textarea>
          </label>

          <div class="tasks-field-row">
            <label class="tasks-field">
              <span>状态</span>
              <select v-model="editorForm.status">
                <option value="pending">待办</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
              </select>
            </label>

            <label class="tasks-field">
              <span>优先级</span>
              <select v-model="editorForm.priority">
                <option value="normal">常规</option>
                <option value="urgent">高优先级</option>
              </select>
            </label>
          </div>

          <label class="tasks-field">
            <span>时间说明</span>
            <input
              v-model.trim="editorForm.deadlineLabel"
              type="text"
              maxlength="120"
              placeholder="例如：18:00 / 明日 / 今天 14:20"
            />
          </label>

          <div v-if="submitError" class="tasks-submit-error">{{ submitError }}</div>
        </div>

        <div class="tasks-editor-foot">
          <button
            v-if="editorMode === 'edit'"
            type="button"
            class="tasks-delete-btn"
            :disabled="deletingTask || savingTask"
            @click="deleteCurrentTask"
          >
            {{ deletingTask ? '删除中...' : '删除任务' }}
          </button>
          <div class="tasks-editor-actions">
            <button type="button" class="tasks-secondary-btn" :disabled="savingTask" @click="closeEditor">取消</button>
            <button type="button" class="tasks-primary-btn" :disabled="savingTask" @click="submitTask">
              {{ savingTask ? '保存中...' : editorMode === 'create' ? '创建任务' : '保存修改' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { apiCall } from '../../utils/api'

const STATUS_ORDER = {
  in_progress: 0,
  pending: 1,
  completed: 2
}

const PRIORITY_ORDER = {
  urgent: 0,
  normal: 1
}

const createEmptyForm = () => ({
  id: null,
  title: '',
  description: '',
  status: 'pending',
  priority: 'normal',
  deadlineLabel: ''
})

export default {
  name: 'DiscussionTasksPanel',
  props: {
    currentChat: {
      type: Object,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      tasksByRoom: {},
      loadedByRoom: {},
      loadingByRoom: {},
      errorByRoom: {},
      showEditor: false,
      editorMode: 'create',
      editorForm: createEmptyForm(),
      savingTask: false,
      deletingTask: false,
      togglingTaskIds: {},
      submitError: ''
    }
  },
  computed: {
    currentRoomKey() {
      const roomId = Number(this.currentChat?.id || 0)
      return roomId > 0 ? String(roomId) : ''
    },
    currentRoomTasks() {
      if (!this.currentRoomKey) return []
      return Array.isArray(this.tasksByRoom[this.currentRoomKey]) ? this.tasksByRoom[this.currentRoomKey] : []
    },
    tasksLoading() {
      return this.currentRoomKey ? this.loadingByRoom[this.currentRoomKey] === true : false
    },
    tasksError() {
      return this.currentRoomKey ? this.errorByRoom[this.currentRoomKey] || '' : ''
    },
    statCards() {
      const counts = {
        pending: 0,
        in_progress: 0,
        completed: 0
      }

      this.currentRoomTasks.forEach((task) => {
        if (Object.prototype.hasOwnProperty.call(counts, task.status)) {
          counts[task.status] += 1
        }
      })

      return [
        { key: 'pending', label: '待办', value: String(counts.pending).padStart(2, '0') },
        { key: 'in_progress', label: '进行中', value: String(counts.in_progress).padStart(2, '0') },
        { key: 'completed', label: '已完成', value: String(counts.completed).padStart(2, '0') }
      ]
    }
  },
  watch: {
    isActive(nextActive) {
      if (!nextActive) return
      this.ensureCurrentRoomTasks(true)
    },
    currentRoomKey(nextKey, previousKey) {
      if (nextKey === previousKey) return
      this.showEditor = false
      this.submitError = ''
      if (this.isActive && nextKey) {
        this.ensureCurrentRoomTasks(true)
      }
    }
  },
  mounted() {
    window.addEventListener('discussion-tasks-sync', this.handleTasksSyncEvent)
    if (this.isActive && this.currentRoomKey) {
      this.ensureCurrentRoomTasks(true)
    }
  },
  beforeUnmount() {
    window.removeEventListener('discussion-tasks-sync', this.handleTasksSyncEvent)
  },
  methods: {
    normalizeTask(task = {}) {
      return {
        id: Number(task.id || 0),
        roomId: Number(task.room_id || this.currentChat?.id || 0),
        creatorUserId: Number(task.creator_user_id || 0),
        creatorName: String(task.creator_name || ''),
        title: String(task.title || ''),
        description: String(task.description || ''),
        status: String(task.status || 'pending'),
        priority: String(task.priority || 'normal'),
        deadlineLabel: String(task.deadline_label || task.deadlineLabel || ''),
        completedAt: task.completed_at || null,
        createdAt: task.created_at || null,
        updatedAt: task.updated_at || null
      }
    },
    sortTasks(tasks = []) {
      return [...tasks].sort((left, right) => {
        const statusDelta = (STATUS_ORDER[left.status] ?? 9) - (STATUS_ORDER[right.status] ?? 9)
        if (statusDelta !== 0) return statusDelta

        const priorityDelta = (PRIORITY_ORDER[left.priority] ?? 9) - (PRIORITY_ORDER[right.priority] ?? 9)
        if (priorityDelta !== 0) return priorityDelta

        const leftTime = new Date(left.completedAt || left.updatedAt || left.createdAt || 0).getTime()
        const rightTime = new Date(right.completedAt || right.updatedAt || right.createdAt || 0).getTime()
        if (leftTime !== rightTime) return rightTime - leftTime

        return Number(right.id || 0) - Number(left.id || 0)
      })
    },
    setCurrentRoomTasks(tasks = []) {
      if (!this.currentRoomKey) return
      this.tasksByRoom = {
        ...this.tasksByRoom,
        [this.currentRoomKey]: this.sortTasks(tasks.map(this.normalizeTask))
      }
    },
    upsertTask(task) {
      const normalized = this.normalizeTask(task)
      const currentTasks = this.currentRoomTasks.filter((item) => item.id !== normalized.id)
      this.setCurrentRoomTasks([normalized, ...currentTasks])
    },
    removeTask(taskId) {
      if (!this.currentRoomKey) return
      this.tasksByRoom = {
        ...this.tasksByRoom,
        [this.currentRoomKey]: this.currentRoomTasks.filter((item) => item.id !== Number(taskId))
      }
    },
    removeTaskByRoom(roomId, taskId) {
      const roomKey = String(Number(roomId) || '')
      if (!roomKey) return
      const existing = Array.isArray(this.tasksByRoom[roomKey]) ? this.tasksByRoom[roomKey] : []
      this.tasksByRoom = {
        ...this.tasksByRoom,
        [roomKey]: existing.filter((item) => item.id !== Number(taskId))
      }
    },
    upsertTaskByRoom(roomId, task) {
      const roomKey = String(Number(roomId) || '')
      if (!roomKey || !task) return
      const normalized = this.normalizeTask(task)
      const existing = Array.isArray(this.tasksByRoom[roomKey]) ? this.tasksByRoom[roomKey] : []
      this.tasksByRoom = {
        ...this.tasksByRoom,
        [roomKey]: this.sortTasks([
          normalized,
          ...existing.filter((item) => item.id !== normalized.id)
        ])
      }
    },
    async ensureCurrentRoomTasks(force = false) {
      if (!this.currentRoomKey) return
      if (!force && this.loadedByRoom[this.currentRoomKey]) return
      await this.fetchRoomTasks(this.currentRoomKey)
    },
    async fetchRoomTasks(roomKey) {
      if (!roomKey) return
      this.loadingByRoom = { ...this.loadingByRoom, [roomKey]: true }
      this.errorByRoom = { ...this.errorByRoom, [roomKey]: '' }

      try {
        const data = await apiCall(`/discussion/rooms/${roomKey}/tasks`)
        const tasks = Array.isArray(data?.tasks) ? data.tasks.map(this.normalizeTask) : []
        this.tasksByRoom = {
          ...this.tasksByRoom,
          [roomKey]: this.sortTasks(tasks)
        }
        this.loadedByRoom = {
          ...this.loadedByRoom,
          [roomKey]: true
        }
      } catch (error) {
        this.errorByRoom = {
          ...this.errorByRoom,
          [roomKey]: error?.message || '任务加载失败'
        }
      } finally {
        this.loadingByRoom = { ...this.loadingByRoom, [roomKey]: false }
      }
    },
    openCreateTask() {
      this.editorMode = 'create'
      this.editorForm = createEmptyForm()
      this.submitError = ''
      this.showEditor = true
    },
    openEditTask(task) {
      this.editorMode = 'edit'
      this.editorForm = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        deadlineLabel: task.deadlineLabel
      }
      this.submitError = ''
      this.showEditor = true
    },
    closeEditor() {
      if (this.savingTask || this.deletingTask) return
      this.showEditor = false
      this.submitError = ''
    },
    async submitTask() {
      if (!this.currentRoomKey) return

      const title = String(this.editorForm.title || '').trim()
      if (!title) {
        this.submitError = '请输入任务标题'
        return
      }

      this.savingTask = true
      this.submitError = ''

      const payload = {
        title,
        description: String(this.editorForm.description || '').trim(),
        status: this.editorForm.status,
        priority: this.editorForm.priority,
        deadlineLabel: String(this.editorForm.deadlineLabel || '').trim()
      }

      try {
        let task = null
        if (this.editorMode === 'create') {
          const data = await apiCall(`/discussion/rooms/${this.currentRoomKey}/tasks`, {
            method: 'POST',
            body: JSON.stringify(payload)
          })
          task = data?.task || null
        } else {
          const data = await apiCall(`/discussion/rooms/${this.currentRoomKey}/tasks/${this.editorForm.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
          })
          task = data?.task || null
        }

        if (task) this.upsertTask(task)
        this.showEditor = false
      } catch (error) {
        this.submitError = error?.message || '任务保存失败'
      } finally {
        this.savingTask = false
      }
    },
    async deleteCurrentTask() {
      if (!this.currentRoomKey || !this.editorForm.id) return

      this.deletingTask = true
      this.submitError = ''

      try {
        await apiCall(`/discussion/rooms/${this.currentRoomKey}/tasks/${this.editorForm.id}`, {
          method: 'DELETE'
        })
        this.removeTask(this.editorForm.id)
        this.showEditor = false
      } catch (error) {
        this.submitError = error?.message || '删除任务失败'
      } finally {
        this.deletingTask = false
      }
    },
    nextTaskStatus(status) {
      if (status === 'pending') return 'in_progress'
      if (status === 'in_progress') return 'completed'
      return 'pending'
    },
    async toggleTaskStatus(task) {
      if (!this.currentRoomKey || !task?.id) return
      const taskId = Number(task.id)
      this.togglingTaskIds = { ...this.togglingTaskIds, [taskId]: true }

      try {
        const data = await apiCall(`/discussion/rooms/${this.currentRoomKey}/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: this.nextTaskStatus(task.status)
          })
        })
        if (data?.task) this.upsertTask(data.task)
      } catch (error) {
        this.errorByRoom = {
          ...this.errorByRoom,
          [this.currentRoomKey]: error?.message || '任务状态更新失败'
        }
      } finally {
        const next = { ...this.togglingTaskIds }
        delete next[taskId]
        this.togglingTaskIds = next
      }
    },
    handleTasksSyncEvent(event) {
      const detail = event?.detail || {}
      const roomId = Number(detail.roomId || 0)
      if (!roomId) return

      const action = String(detail.action || '').trim()
      const roomKey = String(roomId)
      if (!this.loadedByRoom[roomKey] && this.currentRoomKey === roomKey) {
        this.ensureCurrentRoomTasks(true)
      }

      if ((action === 'created' || action === 'updated') && detail.task) {
        this.upsertTaskByRoom(roomId, detail.task)
        return
      }

      if (action === 'deleted') {
        this.removeTaskByRoom(roomId, detail.taskId)
      }
    },
    taskBadgeLabel(task) {
      if (this.togglingTaskIds[task.id]) return '...'
      if (task.status === 'completed') return '已完成'
      if (task.priority === 'urgent') return '待办'
      if (task.status === 'in_progress') return '进行中'
      return '待办'
    },
    taskBadgeClass(task) {
      if (task.status === 'completed') return 'completed'
      if (task.priority === 'urgent' && task.status !== 'completed') return 'urgent'
      if (task.status === 'in_progress') return 'in-progress'
      return 'pending'
    },
    taskBadgeTitle(task) {
      return `点击切换为${this.statusLabel(this.nextTaskStatus(task.status))}`
    },
    statusLabel(status) {
      if (status === 'in_progress') return '进行中'
      if (status === 'completed') return '已完成'
      return '待办'
    },
    formatTaskMeta(task) {
      if (task.status === 'completed') {
        return `已完成于 ${this.formatTaskTime(task.completedAt || task.updatedAt || task.createdAt)}`
      }

      const segments = []
      if (task.deadlineLabel) {
        segments.push(`截止 ${task.deadlineLabel}`)
      }
      segments.push(task.priority === 'urgent' ? '高优先级' : '常规优先级')
      return segments.join(' · ')
    },
    formatTaskTime(value) {
      if (!value) return '刚刚'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return '刚刚'

      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(',', '')
    }
  }
}
</script>

<style scoped>
.discussion-tasks-panel {
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 12px;
  background: transparent;
}

.tasks-fallback-shell,
.tasks-shell {
  flex: 1;
  height: auto;
  min-height: 0;
  background: #ffffff;
  border: 1px solid #dfe4eb;
  border-radius: 18px;
  overflow: hidden;
}

.tasks-fallback-shell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: #5c667a;
}

.tasks-fallback-shell h3 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #121212;
}

.tasks-fallback-shell p {
  margin: 0;
  font-size: 14px;
}

.tasks-shell {
  display: flex;
  flex-direction: column;
  padding: 22px 20px 18px;
  box-sizing: border-box;
}

.tasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18px;
  border-bottom: 1px solid #eceef2;
}

.tasks-header h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1;
  font-weight: 800;
  color: #111111;
}

.tasks-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 10px;
  background: #111111;
  color: #ffffff;
  padding: 0 16px;
  height: 38px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.tasks-create-btn:hover {
  transform: translateY(-1px);
}

.tasks-create-btn:active {
  transform: scale(0.98);
}

.tasks-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 18px 0 20px;
}

.tasks-stat-card {
  min-height: 68px;
  border: 1px solid #d8dde6;
  border-radius: 12px;
  background: #ffffff;
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}

.tasks-stat-card.active {
  background: #111111;
  border-color: #111111;
}

.tasks-stat-label {
  font-size: 12px;
  font-weight: 500;
  color: #70798c;
}

.tasks-stat-card.active .tasks-stat-label,
.tasks-stat-card.active .tasks-stat-value {
  color: #ffffff;
}

.tasks-stat-value {
  font-size: 20px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #111111;
}

.tasks-stat-card-pending .tasks-stat-value {
  color: #f06f2e;
}

.tasks-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tasks-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.tasks-section-head strong {
  font-size: 15px;
  font-weight: 800;
  color: #141414;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 2px;
}

.task-item {
  width: 100%;
  border: 1px solid #dbe0e8;
  border-radius: 12px;
  background: #ffffff;
  padding: 14px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.task-item:hover {
  border-color: #111827;
  box-shadow: 0 0 0 1px rgba(17, 24, 39, 0.08);
}

.task-item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-item-title {
  font-size: 14px;
  line-height: 1.35;
  font-weight: 800;
  color: #101010;
}

.task-item-meta {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: #7b8597;
  font-weight: 500;
}

.task-status-pill {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 0 11px;
  min-width: 64px;
  height: 26px;
  border: none;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.task-status-pill.in-progress {
  background: #101010;
  color: #ffffff;
}

.task-status-pill.urgent {
  background: #dc2c2c;
  color: #ffffff;
}

.task-status-pill.completed {
  border: 1px solid #111111;
  background: #ffffff;
  color: #111111;
}

.task-status-pill.pending {
  background: #eef2f7;
  color: #455166;
}

.tasks-empty,
.tasks-error {
  border: 1px dashed #d8dde6;
  border-radius: 14px;
  padding: 18px 16px;
  font-size: 13px;
  color: #697387;
  background: #fafbfc;
}

.tasks-error {
  color: #c0392b;
  background: #fff6f5;
  border-style: solid;
  border-color: #f0d2cf;
}

.tasks-editor-mask {
  position: fixed;
  inset: 0;
  background: rgba(12, 17, 28, 0.36);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: 24px;
  box-sizing: border-box;
}

.tasks-editor-panel {
  width: min(520px, 100%);
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #e3e7ee;
  box-shadow: 0 24px 80px rgba(14, 19, 28, 0.16);
  overflow: hidden;
}

.tasks-editor-head,
.tasks-editor-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
}

.tasks-editor-head {
  border-bottom: 1px solid #edf0f4;
}

.tasks-editor-head strong {
  font-size: 16px;
  font-weight: 800;
  color: #121212;
}

.tasks-editor-close {
  width: 32px;
  height: 32px;
  border: 1px solid #d8dde6;
  border-radius: 10px;
  background: #ffffff;
  color: #344054;
  cursor: pointer;
}

.tasks-editor-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tasks-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tasks-field span {
  font-size: 13px;
  font-weight: 700;
  color: #22262d;
}

.tasks-field input,
.tasks-field textarea,
.tasks-field select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d7dce5;
  border-radius: 12px;
  background: #f8fafc;
  padding: 12px 13px;
  font-size: 14px;
  color: #141414;
  outline: none;
}

.tasks-field textarea {
  resize: vertical;
  min-height: 98px;
}

.tasks-field input:focus,
.tasks-field textarea:focus,
.tasks-field select:focus {
  border-color: #1f2937;
  background: #ffffff;
}

.tasks-field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.tasks-submit-error {
  border-radius: 12px;
  background: #fff4f2;
  color: #cc3d2f;
  padding: 12px 13px;
  font-size: 13px;
}

.tasks-editor-foot {
  border-top: 1px solid #edf0f4;
  gap: 12px;
}

.tasks-editor-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tasks-primary-btn,
.tasks-secondary-btn,
.tasks-delete-btn {
  height: 40px;
  border-radius: 12px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.tasks-primary-btn {
  border: none;
  background: #111111;
  color: #ffffff;
}

.tasks-secondary-btn {
  border: 1px solid #d6dbe5;
  background: #ffffff;
  color: #111111;
}

.tasks-delete-btn {
  border: none;
  background: #fff1f0;
  color: #d03b31;
}

.tasks-primary-btn:disabled,
.tasks-secondary-btn:disabled,
.tasks-delete-btn:disabled,
.task-status-pill:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .tasks-shell {
    padding: 18px 16px 16px;
  }

  .tasks-stats {
    grid-template-columns: 1fr;
  }

  .task-item {
    align-items: flex-start;
    flex-direction: column;
  }

  .tasks-field-row {
    grid-template-columns: 1fr;
  }

  .tasks-editor-foot {
    flex-direction: column;
    align-items: stretch;
  }

  .tasks-editor-actions {
    width: 100%;
    margin-left: 0;
  }

  .tasks-primary-btn,
  .tasks-secondary-btn,
  .tasks-delete-btn {
    flex: 1;
  }
}
</style>
