<template>
  <div class="docs-page">
    <div class="content-wrapper">
      <div class="docs-shell">
        <aside class="docs-sidebar">
          <div class="docs-sidebar-scroll">
            <div class="docs-sidebar-brand">
              <span class="docs-sidebar-kicker">AiDocs</span>
              <h1 class="docs-sidebar-title">阅读文档</h1>
            </div>

            <label class="docs-search" for="docs-search-input">
              <span class="docs-search-label">搜索文档</span>
              <input
                id="docs-search-input"
                v-model.trim="docSearchQuery"
                type="search"
                class="docs-search-input"
                placeholder="搜索标题、摘要、分类"
                autocomplete="off"
              />
            </label>

            <nav class="docs-nav" aria-label="文档目录">
              <section
                v-for="group in docGroups"
                :key="group.tag"
                class="docs-nav-group"
              >
                <h2 class="docs-nav-group-title">{{ group.tag }}</h2>
                <button
                  v-for="doc in group.items"
                  :key="doc.id"
                  type="button"
                  class="docs-nav-item"
                  :class="{ active: selectedDoc?.id === doc.id }"
                  @click="selectDoc(doc)"
                >
                  <span class="docs-nav-item-title">{{ doc.title }}</span>
                  <span class="docs-nav-item-summary">{{ doc.summary }}</span>
                </button>
              </section>
            </nav>

            <div v-if="!docGroups.length" class="docs-nav-empty">
              没有匹配的文档
            </div>
          </div>
        </aside>

        <main class="docs-reader-panel">
          <div
            ref="readerScrollRef"
            class="docs-reader-scroll"
            @scroll="handleReaderScroll"
          >
            <article class="docs-article">
              <div v-if="selectedDoc?.cover" class="docs-cover-shell">
                <img
                  :src="selectedDoc.cover"
                  :alt="selectedDoc.title"
                  :class="['docs-cover-image', { loaded: imagesLoaded[selectedDoc.id] }]"
                  loading="lazy"
                  @load="handleImageLoad($event, selectedDoc.id)"
                  @error="handleImageError($event, selectedDoc.id)"
                />
                <div class="docs-cover-fade"></div>
                <div class="image-loading docs-cover-loading" v-if="!imagesLoaded[selectedDoc.id]">
                  <div class="loading-spinner"></div>
                </div>
              </div>

              <header class="docs-hero">
                <span class="docs-hero-tag">{{ selectedDoc?.tag }}</span>
                <h1 class="docs-hero-title">{{ heroTitle }}</h1>
                <p class="docs-hero-summary">{{ selectedDoc?.summary }}</p>
              </header>

              <div class="docs-body-shell">
                <div v-if="isLoadingDoc" class="docs-loading">
                  正在加载文档...
                </div>
                <div v-else-if="docError" class="docs-error">
                  {{ docError }}
                </div>
                <div
                  v-else
                  ref="markdownContentRef"
                  class="markdown-content docs-markdown"
                  @click="handleMarkdownContentClick"
                  v-html="renderedMarkdown"
                ></div>
              </div>
            </article>
          </div>
        </main>

        <aside class="docs-outline" v-if="outlineItems.length">
          <div class="docs-outline-scroll">
            <div class="docs-outline-title">在此页面</div>
            <nav class="docs-outline-nav" aria-label="页内目录">
              <a
                v-for="item in outlineItems"
                :key="item.id"
                :href="`#${item.id}`"
                class="docs-outline-item"
                :class="[
                  `level-${item.level}`,
                  { active: activeHeadingId === item.id }
                ]"
                @click.prevent="scrollToHeading(item.id)"
              >
                {{ item.text }}
              </a>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { docsList } from '../data/docsList'
import { useNotificationStore } from '../stores/notification'
import { highlightCodeAsync, warmupCodeHighlighter } from '../utils/asyncCodeHighlighter'
import { buildDocsCatalog } from '../utils/docsCatalog.js'
import { extractMarkdownHeadings } from '../utils/docsNavigation.js'
import { renderMarkdownToHtml } from '../utils/markdownRenderer.mjs'

const docs = docsList
const notificationStore = useNotificationStore()
const selectedDoc = ref(docs[0] || null)
const renderedMarkdown = ref('')
const isLoadingDoc = ref(false)
const docError = ref('')
const imagesLoaded = reactive({})
const imageErrors = reactive({})
const readerScrollRef = ref(null)
const markdownContentRef = ref(null)
const headings = ref([])
const activeHeadingId = ref('')
const docSearchQuery = ref('')
let headingElements = []
let scrollRaf = 0

const docGroups = computed(() => buildDocsCatalog(docs, docSearchQuery.value))

const outlineItems = computed(() => {
  const nested = headings.value.filter(item => item.level >= 2)
  return nested.length ? nested : headings.value
})

const heroTitle = computed(() => {
  const primaryHeading = headings.value[0]?.level === 1 ? headings.value[0].text : ''
  return primaryHeading || selectedDoc.value?.title || ''
})

const handleImageLoad = (event, imageId) => {
  imagesLoaded[imageId] = true
}

const handleImageError = (event, imageId) => {
  imagesLoaded[imageId] = true
  imageErrors[imageId] = true
}

const decodeMarkdownCode = (encoded = '') => {
  try {
    return decodeURIComponent(String(encoded || ''))
  } catch {
    return String(encoded || '')
  }
}

const handleMarkdownContentClick = async (event) => {
  const button = event.target?.closest?.('[data-action="copy-code"]')
  if (!button) return

  const block = button.closest('.markdown-code-block')
  const code = decodeMarkdownCode(block?.dataset?.code || '')
  if (!code) return

  try {
    await navigator.clipboard.writeText(code)
    notificationStore.success('已复制', '代码块内容已复制到剪贴板')
  } catch (error) {
    notificationStore.error('复制失败', error?.message || '请检查浏览器权限')
  }
}

const getHeadingSelector = id => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return `#${CSS.escape(id)}`
  }
  return `#${String(id).replace(/"/g, '\\"')}`
}

const updateActiveHeading = () => {
  const container = readerScrollRef.value
  if (!container || !headingElements.length) {
    activeHeadingId.value = ''
    return
  }

  const containerTop = container.getBoundingClientRect().top
  let nextActive = headingElements[0]?.id || ''

  headingElements.forEach((heading) => {
    const relativeTop = heading.getBoundingClientRect().top - containerTop
    if (relativeTop <= 140) {
      nextActive = heading.id
    }
  })

  activeHeadingId.value = nextActive
}

const syncHeadingElements = () => {
  const content = markdownContentRef.value
  headingElements = content
    ? Array.from(content.querySelectorAll('h1[id], h2[id], h3[id], h4[id]'))
    : []
  updateActiveHeading()
}

const scheduleHeadingSync = () => {
  nextTick(() => {
    syncHeadingElements()
  })
}

const stripLeadingHeadingFromHtml = (html = '', firstHeading = null) => {
  if (!firstHeading || firstHeading.level !== 1) return html
  return String(html).replace(/^<h1 id="[^"]+">.*?<\/h1>/, '')
}

const loadDocContent = async (doc) => {
  if (!doc) return
  isLoadingDoc.value = true
  docError.value = ''
  activeHeadingId.value = ''

  try {
    const response = await fetch(doc.file)
    if (!response.ok) {
      throw new Error(`无法加载文档：${doc.file}`)
    }

    const markdown = await response.text()
    const nextHeadings = extractMarkdownHeadings(markdown)
    headings.value = nextHeadings

    const html = await renderMarkdownToHtml(markdown, {
      baseUrl: doc.file,
      renderCodeBlock: async ({ code, language }) => {
        const highlighted = await highlightCodeAsync(code, { language })
        return highlighted
      }
    })

    renderedMarkdown.value = stripLeadingHeadingFromHtml(html, nextHeadings[0])

    await nextTick()
    const container = readerScrollRef.value
    if (container) {
      container.scrollTo({ top: 0, behavior: 'auto' })
    }
    scheduleHeadingSync()
  } catch (error) {
    renderedMarkdown.value = ''
    headings.value = []
    docError.value = error instanceof Error ? error.message : '文档加载失败'
  } finally {
    isLoadingDoc.value = false
  }
}

const selectDoc = async (doc) => {
  if (!doc || doc.id === selectedDoc.value?.id) return
  selectedDoc.value = doc
  if (!(doc.id in imagesLoaded)) {
    imagesLoaded[doc.id] = false
  }
  await loadDocContent(doc)
}

const scrollToHeading = (id) => {
  const container = readerScrollRef.value
  const content = markdownContentRef.value
  if (!container || !content || !id) return

  const heading = content.querySelector(getHeadingSelector(id))
  if (!heading) return

  container.scrollTo({
    top: heading.offsetTop - 32,
    behavior: 'smooth'
  })
  activeHeadingId.value = id
}

const handleReaderScroll = () => {
  if (scrollRaf) return
  scrollRaf = window.requestAnimationFrame(() => {
    updateActiveHeading()
    scrollRaf = 0
  })
}

onMounted(async () => {
  docs.forEach((doc) => {
    imagesLoaded[doc.id] = false
  })
  warmupCodeHighlighter()
  await loadDocContent(selectedDoc.value)
})

onBeforeUnmount(() => {
  if (scrollRaf) {
    window.cancelAnimationFrame(scrollRaf)
  }
})
</script>

<style scoped>
.docs-page {
  --docs-bg: #ffffff;
  --docs-text: #000000;
  --docs-muted: rgba(0, 0, 0, 0.62);
  --docs-soft: rgba(0, 0, 0, 0.08);
  --docs-soft-strong: rgba(0, 0, 0, 0.14);
  --docs-panel: rgba(255, 255, 255, 0.92);
  --docs-panel-muted: rgba(255, 255, 255, 0.7);
  --docs-code-bg: rgba(0, 0, 0, 0.05);
  --docs-code-panel: rgba(0, 0, 0, 0.04);
  --docs-link: #000000;
  --docs-hl-comment: #6b7280;
  --docs-hl-keyword: #7c3aed;
  --docs-hl-string: #0f766e;
  --docs-hl-title: #1d4ed8;
  --docs-hl-number: #b45309;
  --docs-hl-type: #2563eb;
  --docs-hl-attr: #be185d;
  --docs-hl-meta: #475569;
  height: calc(100vh - 4rem);
  max-height: calc(100vh - 4rem);
  min-height: 0;
  overflow: hidden;
  background: var(--docs-bg);
  color: var(--docs-text);
}

[data-theme='dark'] .docs-page {
  --docs-bg: #000000;
  --docs-text: #ffffff;
  --docs-muted: rgba(255, 255, 255, 0.68);
  --docs-soft: rgba(255, 255, 255, 0.08);
  --docs-soft-strong: rgba(255, 255, 255, 0.14);
  --docs-panel: rgba(0, 0, 0, 0.92);
  --docs-panel-muted: rgba(0, 0, 0, 0.7);
  --docs-code-bg: rgba(255, 255, 255, 0.09);
  --docs-code-panel: rgba(255, 255, 255, 0.06);
  --docs-link: #ffffff;
  --docs-hl-comment: #94a3b8;
  --docs-hl-keyword: #c084fc;
  --docs-hl-string: #67e8f9;
  --docs-hl-title: #93c5fd;
  --docs-hl-number: #fbbf24;
  --docs-hl-type: #60a5fa;
  --docs-hl-attr: #f9a8d4;
  --docs-hl-meta: #cbd5e1;
}

.content-wrapper {
  height: 100%;
  overflow: hidden;
}

.docs-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 220px;
  height: 100%;
  min-height: 0;
}

.docs-sidebar,
.docs-outline {
  min-height: 0;
  background: var(--docs-panel-muted);
}

.docs-sidebar {
  border-right: 1px solid var(--docs-soft);
}

.docs-outline {
  border-left: 1px solid var(--docs-soft);
}

.docs-sidebar-scroll,
.docs-outline-scroll,
.docs-reader-scroll {
  height: 100%;
  overflow-y: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.docs-sidebar-scroll::-webkit-scrollbar,
.docs-outline-scroll::-webkit-scrollbar,
.docs-reader-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.docs-sidebar-scroll,
.docs-outline-scroll {
  padding: 2rem 1.2rem;
}

.docs-sidebar-brand {
  margin-bottom: 1.75rem;
}

.docs-sidebar-kicker,
.docs-outline-title {
  display: block;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--docs-muted);
}

.docs-sidebar-title {
  margin: 0.5rem 0 0;
  font-size: 2rem;
  line-height: 1;
  font-weight: 700;
  color: var(--docs-text);
}

.docs-nav {
  display: grid;
  gap: 1.1rem;
}

.docs-search {
  display: grid;
  gap: 0.45rem;
  margin-bottom: 1.1rem;
}

.docs-search-label {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--docs-muted);
}

.docs-search-input {
  width: 100%;
  height: 2.6rem;
  padding: 0 0.9rem;
  border-radius: 14px;
  border: 1px solid var(--docs-soft);
  background: transparent;
  color: var(--docs-text);
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.docs-search-input::placeholder {
  color: var(--docs-muted);
}

.docs-search-input:focus {
  border-color: var(--docs-soft-strong);
  background: var(--docs-soft);
}

.docs-nav-group {
  display: grid;
  gap: 0.3rem;
}

.docs-nav-group-title {
  margin: 0 0 0.05rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--docs-text);
}

.docs-nav-item {
  display: grid;
  gap: 0.14rem;
  width: 100%;
  padding: 0.62rem 0.75rem;
  text-align: left;
  border-radius: 16px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.docs-nav-item:hover {
  background: var(--docs-soft);
}

.docs-nav-item.active {
  background: var(--docs-soft);
  border-color: var(--docs-soft-strong);
}

.docs-nav-item-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--docs-text);
}

.docs-nav-item-summary {
  font-size: 0.84rem;
  line-height: 1.45;
  color: var(--docs-muted);
}

.docs-nav-empty {
  padding: 0.5rem 0.15rem 0;
  color: var(--docs-muted);
  font-size: 0.92rem;
}

.docs-reader-panel {
  min-width: 0;
  min-height: 0;
  background: var(--docs-bg);
}

.docs-reader-scroll {
  padding: 0 2.5rem 4rem;
}

.docs-article {
  max-width: 860px;
  margin: 0 auto;
}

.docs-cover-shell {
  position: relative;
  height: 320px;
  margin: 0 -2.5rem 0.5rem;
  overflow: hidden;
}

.docs-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transform: scale(1.02);
  transition: opacity 0.35s ease, transform 0.45s ease;
}

.docs-cover-image.loaded {
  opacity: 1;
  transform: scale(1);
}

.docs-cover-fade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.02) 0%,
      rgba(0, 0, 0, 0.08) 40%,
      rgba(255, 255, 255, 0) 70%,
      var(--docs-bg) 100%
    );
  pointer-events: none;
}

[data-theme='dark'] .docs-cover-fade {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.02) 0%,
      rgba(255, 255, 255, 0.08) 40%,
      rgba(0, 0, 0, 0) 70%,
      var(--docs-bg) 100%
    );
}

.docs-cover-loading {
  background: rgba(255, 255, 255, 0.7);
}

[data-theme='dark'] .docs-cover-loading {
  background: rgba(0, 0, 0, 0.6);
}

.docs-hero {
  margin-bottom: 1.3rem;
}

.docs-hero-tag {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0 0.85rem;
  border-radius: 999px;
  background: var(--docs-soft);
  color: var(--docs-text);
  font-size: 0.82rem;
  font-weight: 700;
}

.docs-hero-title {
  margin: 0.55rem 0 0.85rem;
  font-size: clamp(2.5rem, 4vw, 4rem);
  line-height: 0.98;
  letter-spacing: -0.04em;
  color: var(--docs-text);
}

.docs-hero-summary {
  margin: 0;
  max-width: 760px;
  font-size: 1.15rem;
  line-height: 1.8;
  color: var(--docs-muted);
}

.docs-body-shell {
  min-height: 320px;
}

.docs-loading,
.docs-error {
  padding: 1.5rem 0;
  color: var(--docs-muted);
  font-size: 0.95rem;
}

.docs-error {
  color: #dc2626;
}

.docs-outline-title {
  margin-bottom: 1rem;
}

.docs-outline-nav {
  display: grid;
  gap: 0.35rem;
}

.docs-outline-item {
  display: block;
  padding: 0.35rem 0;
  color: var(--docs-muted);
  text-decoration: none;
  transition: color 0.2s ease, transform 0.2s ease;
}

.docs-outline-item.level-3,
.docs-outline-item.level-4 {
  padding-left: 0.85rem;
  font-size: 0.92rem;
}

.docs-outline-item.active {
  color: var(--docs-text);
  transform: translateX(4px);
}

.image-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(100, 116, 139, 0.25);
  border-radius: 50%;
  border-top-color: #334155;
  animation: spin 1s ease-in-out infinite;
}

[data-theme='dark'] .loading-spinner {
  border-color: rgba(255, 255, 255, 0.22);
  border-top-color: #ffffff;
}

.docs-markdown :deep(h1),
.docs-markdown :deep(h2),
.docs-markdown :deep(h3),
.docs-markdown :deep(h4),
.docs-markdown :deep(h5),
.docs-markdown :deep(h6) {
  margin-top: 2.4rem;
  margin-bottom: 0.85rem;
  line-height: 1.15;
  font-weight: 700;
  color: var(--docs-text);
  scroll-margin-top: 2rem;
}

.docs-markdown :deep(h1) {
  font-size: 2.4rem;
}

.docs-markdown :deep(h2) {
  font-size: 2rem;
}

.docs-markdown :deep(h3) {
  font-size: 1.5rem;
}

.docs-markdown :deep(p),
.docs-markdown :deep(li) {
  color: var(--docs-text);
  opacity: 0.9;
  line-height: 1.9;
  font-size: 1.04rem;
}

.docs-markdown :deep(ul),
.docs-markdown :deep(ol) {
  margin: 0.8rem 0 1.25rem;
  padding-left: 1.4rem;
}

.docs-markdown :deep(code) {
  background: var(--docs-code-bg);
  color: var(--docs-text);
  padding: 0.1rem 0.36rem;
  border-radius: 0.35rem;
}

.docs-markdown :deep(pre) {
  margin: 0;
  background: transparent;
  overflow-x: auto;
}

.docs-markdown :deep(pre code) {
  background: transparent;
  padding: 0;
}

.docs-markdown :deep(.markdown-code-block) {
  margin: 1rem 0 1.4rem;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid var(--docs-soft);
  background: var(--docs-code-panel);
}

.docs-markdown :deep(.markdown-code-toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--docs-soft);
}

.docs-markdown :deep(.markdown-code-language) {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--docs-muted);
}

.docs-markdown :deep(.markdown-code-copy-btn) {
  border: 1px solid var(--docs-soft);
  border-radius: 999px;
  background: transparent;
  color: var(--docs-text);
  font-size: 0.74rem;
  font-weight: 600;
  padding: 0.34rem 0.75rem;
  cursor: pointer;
}

.docs-markdown :deep(.hljs) {
  display: block;
  padding: 1rem;
  background: transparent;
  color: var(--docs-text);
  white-space: pre;
}

.docs-markdown :deep(.hljs-comment),
.docs-markdown :deep(.hljs-quote) {
  color: var(--docs-hl-comment);
  font-style: italic;
}

.docs-markdown :deep(.hljs-keyword),
.docs-markdown :deep(.hljs-selector-tag),
.docs-markdown :deep(.hljs-subst) {
  color: var(--docs-hl-keyword);
}

.docs-markdown :deep(.hljs-string),
.docs-markdown :deep(.hljs-doctag),
.docs-markdown :deep(.hljs-regexp),
.docs-markdown :deep(.hljs-template-tag),
.docs-markdown :deep(.hljs-template-variable) {
  color: var(--docs-hl-string);
}

.docs-markdown :deep(.hljs-title),
.docs-markdown :deep(.hljs-title.function_),
.docs-markdown :deep(.hljs-title.class_),
.docs-markdown :deep(.hljs-function .hljs-title) {
  color: var(--docs-hl-title);
}

.docs-markdown :deep(.hljs-number),
.docs-markdown :deep(.hljs-literal),
.docs-markdown :deep(.hljs-symbol),
.docs-markdown :deep(.hljs-bullet) {
  color: var(--docs-hl-number);
}

.docs-markdown :deep(.hljs-type),
.docs-markdown :deep(.hljs-built_in),
.docs-markdown :deep(.hljs-class .hljs-title) {
  color: var(--docs-hl-type);
}

.docs-markdown :deep(.hljs-attr),
.docs-markdown :deep(.hljs-attribute),
.docs-markdown :deep(.hljs-variable),
.docs-markdown :deep(.hljs-property) {
  color: var(--docs-hl-attr);
}

.docs-markdown :deep(.hljs-operator),
.docs-markdown :deep(.hljs-punctuation),
.docs-markdown :deep(.hljs-meta) {
  color: var(--docs-hl-meta);
}

.docs-markdown :deep(blockquote) {
  margin: 1rem 0;
  padding-left: 1rem;
  border-left: 3px solid var(--docs-soft-strong);
  color: var(--docs-muted);
}

.docs-markdown :deep(a) {
  color: var(--docs-link);
  text-underline-offset: 0.16em;
}

.docs-markdown :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1rem 0 1.25rem;
}

@media (min-width: 1024px) {
  .docs-page .content-wrapper {
    padding-left: 80px;
  }
}

@media (min-width: 1536px) {
  .docs-page .content-wrapper {
    padding-left: 100px;
  }
}

@media (max-width: 1279px) {
  .docs-shell {
    grid-template-columns: 250px minmax(0, 1fr);
  }

  .docs-outline {
    display: none;
  }
}

@media (max-width: 1023px) {
  .docs-page {
    height: calc(100vh - 3.5rem);
    max-height: calc(100vh - 3.5rem);
  }

  .docs-shell {
    grid-template-columns: 1fr;
  }

  .docs-sidebar {
    border-right: none;
    border-bottom: 1px solid var(--docs-soft);
  }

  .docs-sidebar-scroll {
    padding: 1rem 1rem 0.75rem;
  }

  .docs-sidebar-brand {
    margin-bottom: 1rem;
  }

  .docs-nav {
    grid-auto-flow: column;
    grid-auto-columns: minmax(220px, 1fr);
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .docs-nav-group {
    min-width: 220px;
  }

  .docs-reader-scroll {
    padding: 0 1.2rem 3rem;
  }

  .docs-cover-shell {
    height: 220px;
    margin: 0 -1.2rem 1.25rem;
  }
}

@media (max-width: 640px) {
  .docs-hero-title {
    font-size: 2.35rem;
  }

  .docs-hero-summary,
  .docs-markdown :deep(p),
  .docs-markdown :deep(li) {
    font-size: 1rem;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
