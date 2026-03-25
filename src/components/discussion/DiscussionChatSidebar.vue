<template>
  <aside class="chat-list">
    <div class="chat-list-search">
      <div class="search-box">
        <input
          :value="searchKeyword"
          type="text"
          placeholder="Search rooms"
          @input="handleSearchInput"
        />
      </div>
    </div>

    <div
      v-for="item in filteredChats"
      :key="item.id"
      class="chat-item"
      :class="{ active: currentChatId === item.id }"
      @click="$emit('select-chat', item.id)"
    >
      <div class="avatar" :style="{ background: item.avatarColor }">
        <img
          v-if="item.avatarUrl"
          :src="item.avatarUrl"
          :alt="item.name"
          class="avatar-image"
          @error="$emit('room-avatar-error', item)"
        />
        <span v-else>{{ item.avatar }}</span>
      </div>

      <div class="chat-item-main">
        <div class="chat-item-top">
          <div class="name-row">
            <span class="name">{{ item.name }}</span>
            <span v-if="item.verified" class="verified">✔</span>
          </div>
          <span class="time">{{ item.time }}</span>
        </div>

        <div class="chat-item-bottom">
          <p class="preview">{{ item.preview }}</p>
          <span v-if="item.unread > 0" class="unread">{{ item.unread }}</span>
        </div>
      </div>
    </div>

    <div v-if="loadingRooms" class="chat-list-empty">正在加载讨论房间...</div>
    <div v-else-if="!filteredChats.length" class="chat-list-empty">
      {{ chatsLength ? '没有匹配的房间' : '你还没有加入任何讨论房间' }}
    </div>
  </aside>
</template>

<script>
export default {
  name: 'DiscussionChatSidebar',
  props: {
    searchKeyword: {
      type: String,
      default: ''
    },
    filteredChats: {
      type: Array,
      default: () => []
    },
    currentChatId: {
      type: [String, Number],
      default: null
    },
    loadingRooms: {
      type: Boolean,
      default: false
    },
    chatsLength: {
      type: Number,
      default: 0
    }
  },
  emits: ['update:search-keyword', 'select-chat', 'room-avatar-error'],
  methods: {
    handleSearchInput(event) {
      this.$emit('update:search-keyword', event.target.value)
    }
  }
}
</script>

<style scoped>
.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 14px;
  border-radius: 24px;
  background: #f3f4f6;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
}

.chat-list {
  width: 100%;
  max-width: 100%;
  min-width: 270px;
  border-right: 1px solid #d1d5db;
  overflow-y: auto;
  background: #ffffff;
}

.chat-list-search {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  background: #ffffff;
  border-bottom: 1px solid #d1d5db;
}

.chat-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-bottom: 1px solid #e5e7eb;
}

.chat-item:hover {
  background: #f3f4f6;
}

.chat-item.active {
  background: #e5e7eb;
}

.chat-list-empty {
  padding: 16px 14px;
  font-size: 13px;
  color: #6b7280;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  font-size: 22px;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.chat-item-main {
  flex: 1;
  min-width: 0;
}

.chat-item-top,
.chat-item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chat-item-top {
  margin-bottom: 6px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.name {
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.verified {
  color: #111827;
  font-size: 13px;
}

.time {
  font-size: 13px;
  color: #7b8794;
  white-space: nowrap;
}

.preview {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: #ff0000;
  color: #fff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 900px) {
  .chat-list {
    width: 100%;
    min-width: 0;
    max-height: 240px;
  }
}
</style>
