<template>
  <div class="discussion-docs-panel">
    <div v-if="!currentChat" class="docs-fallback-shell">
      <h3>文档区</h3>
      <p>请先在左侧选择一个讨论房间。</p>
    </div>
    <div v-else class="right-docs-shell">
      <transition name="docs-view-switch" mode="out-in">
        <div v-if="showDocsUploadLanding" key="docs-upload-landing" class="docs-upload-landing">
          <h3>上传文档</h3>
          <p>选择上传方式</p>
          <button
            type="button"
            class="docs-upload-primary"
            :disabled="uploadingDocument || !currentChat"
            @click="openDocumentUploader({ lockToLibrary: true, source: 'local' })"
          >
            <i class="fa fa-upload"></i>
            <span>{{ uploadingDocument ? '上传中...' : '上传本地文档' }}</span>
          </button>
          <button
            type="button"
            class="docs-upload-secondary"
            :disabled="uploadingDocument || !currentChat"
            @click="openDocumentUploader({ lockToLibrary: true, source: 'official' })"
          >
            <i class="fa fa-folder-open-o"></i>
            <span>选择官方文档上传</span>
          </button>
          <div v-if="docsError" class="docs-upload-error">{{ docsError }}</div>
        </div>

        <div v-else key="docs-library" class="docs-library-layout" :class="{ collapsed: docsSidebarCollapsed }">
          <aside class="docs-sidebar">
            <div class="docs-sidebar-head">
              <strong>文档</strong>
              <button type="button" class="docs-sidebar-toggle" @click="docsSidebarCollapsed = !docsSidebarCollapsed">
                <i :class="docsSidebarCollapsed ? 'fa fa-angle-right' : 'fa fa-angle-left'"></i>
              </button>
            </div>

            <template v-if="!docsSidebarCollapsed">
              <div class="docs-sidebar-section">
                <h4>已上传文档（{{ currentRoomDocuments.length }}）</h4>
                <div v-if="docsLoading && !currentRoomDocuments.length" class="docs-side-empty">文档加载中...</div>
                <div v-else-if="!currentRoomDocuments.length" class="docs-side-empty">还没有上传文档</div>
                <button
                  v-for="doc in currentRoomDocuments"
                  :key="doc.id"
                  type="button"
                  class="docs-item"
                  :class="{ active: currentRoomDocument?.id === doc.id }"
                  @click="selectRoomDocument(doc.id)"
                >
                  <i class="fa fa-file-text-o"></i>
                  <span>{{ doc.name }}</span>
                </button>
              </div>

              <div class="docs-sidebar-actions">
                <button
                  type="button"
                  class="docs-upload-primary side"
                  :disabled="uploadingDocument || !currentChat"
                  @click="openDocumentUploader({ lockToLibrary: true, source: 'local' })"
                >
                  <i class="fa fa-upload"></i>
                  <span>{{ uploadingDocument ? '上传中...' : '上传文档' }}</span>
                </button>
                <button
                  type="button"
                  class="docs-upload-secondary side"
                  :disabled="uploadingDocument || !currentChat"
                  @click="openDocumentUploader({ lockToLibrary: true, source: 'official' })"
                >
                  <i class="fa fa-folder-open-o"></i>
                  <span>官方文档</span>
                </button>
              </div>
            </template>
          </aside>

          <section class="docs-preview-pane">
            <header class="docs-preview-head">
              <strong>{{ currentRoomDocument?.name || '未选择文档' }}</strong>
              <span>{{ currentRoomDocumentPageLabel }}</span>
            </header>
            <div class="docs-preview-body">
              <div v-if="docsError" class="docs-error-state">{{ docsError }}</div>
              <template v-else>
                <h3>Discussion Mode 文档展示</h3>
                <p>该区域为文档直接展示区。点击左侧文档列表可快速切换当前阅读内容，侧边栏支持收起。</p>
                <hr />
                <p>当前文档：{{ currentRoomDocument?.name || '尚未上传文档' }}</p>
                <p>状态：{{ currentRoomDocument ? '已上传，可用于会话上下文。' : '暂未上传，点击左下角上传文档继续。' }}</p>
                <p v-if="currentRoomDocument?.previewText" class="docs-preview-excerpt">{{ currentRoomDocument.previewText }}</p>
              </template>
            </div>
          </section>
        </div>
      </transition>
    </div>

    <input
      ref="documentInputRef"
      type="file"
      class="attachment-input-hidden"
      :accept="documentAccept"
      @change="onDocumentFileChange"
    />
  </div>
</template>

<script>
import { apiCall } from '../../utils/api'

export default {
  name: 'DiscussionDocsPanel',
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
      documentAccept: '.pdf,.md,.txt,.doc,.docx',
      roomDocumentsByRoom: {},
      selectedDocumentIdByRoom: {},
      docsPanelLockedByRoom: {},
      docsSidebarCollapsed: false,
      docsLoading: false,
      docsError: '',
      uploadingDocument: false,
      pendingDocumentSource: 'local'
    }
  },
  computed: {
    currentRoomKey() {
      const roomId = Number(this.currentChat?.id || 0)
      return roomId > 0 ? String(roomId) : ''
    },
    currentRoomDocuments() {
      if (!this.currentRoomKey) return []
      return Array.isArray(this.roomDocumentsByRoom[this.currentRoomKey])
        ? this.roomDocumentsByRoom[this.currentRoomKey]
        : []
    },
    currentRoomDocument() {
      if (!this.currentRoomDocuments.length) return null
      const selectedId = String(this.selectedDocumentIdByRoom[this.currentRoomKey] || '')
      return this.currentRoomDocuments.find((item) => String(item.id) === selectedId) || this.currentRoomDocuments[0] || null
    },
    currentRoomDocumentPageLabel() {
      if (this.currentRoomDocument?.pageCount) {
        return `${this.currentRoomDocument.pageCount} 页`
      }
      return this.currentRoomDocument ? '文档' : '--'
    },
    docsPanelLocked() {
      if (!this.currentRoomKey) return false
      return this.docsPanelLockedByRoom[this.currentRoomKey] === true
    },
    showDocsUploadLanding() {
      return !this.docsPanelLocked && !this.currentRoomDocuments.length
    }
  },
  watch: {
    isActive(nextActive) {
      if (!nextActive) return
      this.ensureCurrentRoomDocuments()
    },
    currentRoomKey(nextKey, previousKey) {
      if (nextKey === previousKey) return
      this.docsSidebarCollapsed = false
      this.docsError = ''
      if (this.isActive && nextKey) {
        this.ensureCurrentRoomDocuments()
      }
    }
  },
  methods: {
    normalizeRoomDocument(document = {}) {
      const name = String(document.name || document.file_name || '').trim()
      if (!name) return null

      const fallbackId = `${name}-${document.uploaded_at || document.created_at || Date.now()}`
      const id = String(document.id || document.document_id || fallbackId).trim()
      const pageCount = Number.parseInt(document.page_count, 10)

      return {
        id,
        name,
        url: String(document.url || document.file_url || '').trim(),
        size: Number(document.size || document.file_size || 0),
        mimeType: String(document.mime_type || '').trim(),
        pageCount: Number.isInteger(pageCount) && pageCount > 0 ? pageCount : null,
        status: String(document.status || 'uploaded').trim() || 'uploaded',
        source: String(document.source || 'upload').trim() || 'upload',
        previewText: String(document.preview_text || '').trim(),
        uploadedAt: document.uploaded_at || document.created_at || null
      }
    },
    setCurrentRoomDocuments(roomId, documents = []) {
      const roomKey = String(Number(roomId) || '')
      if (!roomKey) return

      const nextDocuments = Array.isArray(documents) ? documents : []
      this.roomDocumentsByRoom = {
        ...this.roomDocumentsByRoom,
        [roomKey]: nextDocuments
      }

      if (!nextDocuments.length) {
        const nextSelected = { ...this.selectedDocumentIdByRoom }
        delete nextSelected[roomKey]
        this.selectedDocumentIdByRoom = nextSelected
        return
      }

      const activeId = String(this.selectedDocumentIdByRoom[roomKey] || '')
      const exists = nextDocuments.some((doc) => String(doc.id) === activeId)
      if (!exists) {
        this.selectedDocumentIdByRoom = {
          ...this.selectedDocumentIdByRoom,
          [roomKey]: String(nextDocuments[0].id)
        }
      }
    },
    setCurrentRoomSelectedDocument(roomId, documentId) {
      const roomKey = String(Number(roomId) || '')
      if (!roomKey) return
      this.selectedDocumentIdByRoom = {
        ...this.selectedDocumentIdByRoom,
        [roomKey]: String(documentId || '')
      }
    },
    setDocsPanelLocked(roomId, locked = true) {
      const roomKey = String(Number(roomId) || '')
      if (!roomKey) return
      this.docsPanelLockedByRoom = {
        ...this.docsPanelLockedByRoom,
        [roomKey]: locked === true
      }
    },
    async ensureCurrentRoomDocuments(options = {}) {
      const roomId = Number(this.currentChat?.id || 0)
      if (!roomId) return []
      const roomKey = String(roomId)
      const force = options?.force === true

      this.docsError = ''
      if (!force && Array.isArray(this.roomDocumentsByRoom[roomKey])) {
        return this.roomDocumentsByRoom[roomKey]
      }

      this.docsLoading = true
      try {
        const data = await apiCall(`/discussion/rooms/${roomId}/documents`)
        const documents = Array.isArray(data?.documents)
          ? data.documents.map((doc) => this.normalizeRoomDocument(doc)).filter(Boolean)
          : []
        this.setCurrentRoomDocuments(roomId, documents)
        if (documents.length) {
          this.setDocsPanelLocked(roomId, true)
        }
        return documents
      } catch (error) {
        if (!Array.isArray(this.roomDocumentsByRoom[roomKey])) {
          this.setCurrentRoomDocuments(roomId, [])
        }
        this.docsError = error.message || '加载文档失败'
        return []
      } finally {
        this.docsLoading = false
      }
    },
    selectRoomDocument(documentId) {
      if (!this.currentChat || !documentId) return
      this.setCurrentRoomSelectedDocument(this.currentChat.id, documentId)
    },
    openDocumentUploader(options = {}) {
      if (!this.currentChat || this.uploadingDocument) return
      const lockToLibrary = options?.lockToLibrary !== false
      const source = options?.source === 'official' ? 'official' : 'local'
      if (lockToLibrary) {
        this.setDocsPanelLocked(this.currentChat.id, true)
      }
      this.pendingDocumentSource = source
      this.docsError = ''
      this.$nextTick(() => {
        const input = this.$refs.documentInputRef
        if (!input) return
        input.value = ''
        input.click()
      })
    },
    async onDocumentFileChange(event) {
      const file = event?.target?.files?.[0]
      if (!file) {
        this.pendingDocumentSource = 'local'
        return
      }
      if (!this.currentChat) {
        this.docsError = '请先选择一个讨论房间'
        event.target.value = ''
        return
      }

      this.uploadingDocument = true
      this.docsError = ''
      try {
        const data = await this.uploadRoomDocument(file, this.pendingDocumentSource)
        const normalized = this.normalizeRoomDocument(data?.document || null)
        if (!normalized) {
          throw new Error('文档上传成功，但返回数据无效')
        }

        const nextDocuments = [
          normalized,
          ...this.currentRoomDocuments.filter((doc) => String(doc.id) !== String(normalized.id))
        ]
        this.setCurrentRoomDocuments(this.currentChat.id, nextDocuments)
        this.setCurrentRoomSelectedDocument(this.currentChat.id, normalized.id)
        this.setDocsPanelLocked(this.currentChat.id, true)
      } catch (error) {
        this.docsError = error.message || '文档上传失败'
      } finally {
        this.uploadingDocument = false
        this.pendingDocumentSource = 'local'
        if (event?.target) event.target.value = ''
      }
    },
    async uploadRoomDocument(file, source = 'local') {
      const roomId = Number(this.currentChat?.id || 0)
      if (!roomId) {
        throw new Error('当前没有可用房间')
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', source === 'official' ? 'official' : 'upload')
      return apiCall(`/discussion/rooms/${roomId}/documents`, {
        method: 'POST',
        body: formData
      })
    }
  }
}
</script>

<style scoped>
.discussion-docs-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.docs-fallback-shell {
  margin: 10px 12px 12px;
  border: 1px solid #bfc4ca;
  border-radius: 14px;
  background: #f1f2f4;
  min-height: 0;
  flex: 1;
  padding: 20px;
}

.docs-fallback-shell h3 {
  margin: 0 0 8px;
  color: #111827;
}

.docs-fallback-shell p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.right-docs-shell {
  margin: 10px 12px 12px;
  border: 1px solid #bfc4ca;
  border-radius: 14px;
  background: #f1f2f4;
  min-height: 0;
  flex: 1;
  display: flex;
  overflow: hidden;
}

.docs-view-switch-enter-active,
.docs-view-switch-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.docs-view-switch-enter-from,
.docs-view-switch-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.995);
}

.docs-view-switch-enter-to,
.docs-view-switch-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.docs-upload-landing {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
}

.docs-upload-landing-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: #111827;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
}

.docs-upload-landing h3 {
  margin: 4px 0 0;
  font-size: 40px;
  line-height: 1.1;
  font-weight: 800;
  color: #111827;
}

.docs-upload-landing p {
  margin: 0 0 6px;
  color: #6b7280;
  font-size: 17px;
}

.docs-upload-primary,
.docs-upload-secondary {
  height: 44px;
  width: min(360px, 88%);
  border-radius: 999px;
  border: 1px solid #111827;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.docs-upload-primary {
  background: #07090d;
  color: #ffffff;
}

.docs-upload-secondary {
  background: #f5f5f5;
  color: #111827;
}

.docs-upload-primary:hover,
.docs-upload-secondary:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
}

.docs-upload-primary:disabled,
.docs-upload-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.docs-upload-error {
  margin-top: 2px;
  font-size: 13px;
  color: #7f1d1d;
}

.docs-library-layout {
  width: 100%;
  min-height: 0;
  display: flex;
}

.docs-sidebar {
  width: 240px;
  border-right: 1px solid #d1d5db;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition: width 0.22s ease;
}

.docs-library-layout.collapsed .docs-sidebar {
  width: 54px;
}

.docs-sidebar-head {
  height: 44px;
  border-bottom: 1px solid #d1d5db;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.docs-sidebar-toggle {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.docs-sidebar-section {
  padding: 10px 10px 4px;
  overflow: auto;
}

.docs-sidebar-section h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #6b7280;
  font-weight: 700;
}

.docs-side-empty {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
}

.docs-item {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  min-height: 34px;
  background: #ececec;
  color: #111827;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  font-size: 14px;
  margin-bottom: 6px;
  text-align: left;
  cursor: pointer;
}

.docs-item span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.docs-item.active {
  background: #07090d;
  color: #ffffff;
  border-color: #07090d;
}

.docs-sidebar-actions {
  margin-top: auto;
  padding: 10px;
  border-top: 1px solid #d1d5db;
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.docs-upload-primary.side,
.docs-upload-secondary.side {
  width: 100%;
  height: 34px;
  font-size: 14px;
  font-weight: 600;
}

.docs-preview-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f4f5f6;
}

.docs-preview-head {
  height: 44px;
  border-bottom: 1px solid #d1d5db;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 14px;
}

.docs-preview-head strong {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.docs-preview-head span {
  color: #6b7280;
  font-size: 12px;
  flex-shrink: 0;
}

.docs-preview-body {
  padding: 18px 18px 20px;
  overflow: auto;
}

.docs-preview-body h3 {
  margin: 0 0 10px;
  font-size: 36px;
  line-height: 1.18;
  color: #111827;
}

.docs-preview-body p {
  margin: 0 0 10px;
  font-size: 20px;
  line-height: 1.6;
  color: #1f2937;
}

.docs-preview-body hr {
  border: none;
  border-top: 1px solid #d1d5db;
  margin: 10px 0 14px;
}

.docs-preview-excerpt {
  margin-top: 12px !important;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 15px !important;
}

.docs-error-state {
  margin: 0;
  color: #7f1d1d;
  font-size: 13px;
}

.attachment-input-hidden {
  display: none;
}

@media (max-width: 1400px) {
  .docs-upload-landing h3 {
    font-size: 32px;
  }

  .docs-preview-body h3 {
    font-size: 28px;
  }

  .docs-preview-body p {
    font-size: 17px;
  }
}

@media (max-width: 900px) {
  .docs-upload-landing {
    padding: 18px 14px;
  }

  .docs-upload-landing h3 {
    font-size: 28px;
  }

  .docs-upload-landing p {
    font-size: 15px;
  }

  .docs-upload-primary,
  .docs-upload-secondary {
    width: 100%;
    font-size: 15px;
    height: 40px;
  }

  .docs-library-layout {
    flex-direction: column;
  }

  .docs-sidebar,
  .docs-library-layout.collapsed .docs-sidebar {
    width: 100%;
  }

  .docs-sidebar {
    border-right: none;
    border-bottom: 1px solid #d1d5db;
    max-height: 230px;
  }

  .docs-preview-head {
    padding: 0 12px;
  }

  .docs-preview-body {
    padding: 14px 12px 16px;
  }

  .docs-preview-body h3 {
    font-size: 23px;
  }

  .docs-preview-body p {
    font-size: 14px;
  }

  .docs-preview-excerpt {
    font-size: 13px !important;
  }
}
</style>
