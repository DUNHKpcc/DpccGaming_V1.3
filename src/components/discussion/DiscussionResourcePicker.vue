<template>
  <div v-if="visible" class="code-picker-mask" @click="$emit('close')">
    <div class="code-picker-panel" @click.stop>
      <div class="code-picker-head">
        <strong>{{ title }}</strong>
        <button type="button" class="icon-btn" @click="$emit('close')">✕</button>
      </div>
      <div class="code-picker-search">
        <input
          :value="searchKeyword"
          type="text"
          :placeholder="placeholder"
          @input="$emit('update:searchKeyword', $event.target.value)"
        />
      </div>
      <div class="code-picker-body">
        <div v-if="loading" class="chat-empty">{{ loadingText }}</div>
        <div v-else-if="!items.length" class="chat-empty">{{ emptyText }}</div>
        <button
          v-for="item in items"
          :key="getItemKey(item)"
          type="button"
          class="code-picker-item"
          :disabled="disabled"
          @click="$emit('select', item)"
        >
          <span class="code-picker-item-path">{{ getPrimaryText(item) }}</span>
          <span class="code-picker-item-lang">{{ getSecondaryText(item) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DiscussionResourcePicker',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: ''
    },
    searchKeyword: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: '搜索...'
    },
    loading: {
      type: Boolean,
      default: false
    },
    loadingText: {
      type: String,
      default: '加载中...'
    },
    emptyText: {
      type: String,
      default: '暂无可选项'
    },
    items: {
      type: Array,
      default: () => []
    },
    disabled: {
      type: Boolean,
      default: false
    },
    itemKeyField: {
      type: String,
      default: 'id'
    },
    itemPrimaryField: {
      type: String,
      default: 'name'
    },
    itemSecondaryField: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'update:searchKeyword', 'select'],
  methods: {
    getItemKey(item = {}) {
      return item?.[this.itemKeyField] ?? ''
    },
    getPrimaryText(item = {}) {
      return String(item?.[this.itemPrimaryField] || '').trim()
    },
    getSecondaryText(item = {}) {
      return String(item?.[this.itemSecondaryField] || '').trim()
    }
  }
}
</script>
