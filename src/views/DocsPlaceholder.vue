<template>
  <div class="docs-page">
    <div class="content-wrapper">
      <div class="container mx-auto px-4 docs-main">
        <div class="docs-header flex justify-between items-center mb-4">
        </div>

        <div class="docs-layout">
          <section class="docs-cards-panel">
            <div class="docs-cards-scroll">
              <div class="docs-cards-grid">
                <article
                  v-for="(doc, index) in docs"
                  :key="doc.id"
                  class="docs-card"
                  :class="[
                    { active: selectedDoc?.id === doc.id },
                    { 'docs-card-featured': index === 0 }
                  ]"
                  @click="selectDoc(doc)"
                >
                  <div class="docs-card-hero">
                    <img
                      :src="doc.cover"
                      :alt="doc.title"
                      :class="['docs-image', { loaded: imagesLoaded[doc.id] }]"
                      loading="lazy"
                      @error="handleImageError($event, doc.id)"
                      @load="handleImageLoad($event, doc.id)"
                    />
                    <div class="image-loading" v-if="!imagesLoaded[doc.id]">
                      <div class="loading-spinner"></div>
                    </div>

                    <div class="docs-card-title-wrap">
                      <p class="docs-card-breadcrumb">DpccGaming / AiDocs</p>
                      <h2 class="docs-card-title">{{ doc.title }}</h2>
                    </div>
                  </div>

                  <div class="docs-card-body">
                    <p class="docs-card-summary">{{ doc.summary }}</p>

                    <div class="docs-card-meta-row">
                      <div class="docs-card-info">
                        <div class="docs-card-meta">
                          <span>{{ readTimes[index] || 5 }} 分钟</span>
                          <span class="docs-meta-dot">•</span>
                          <span>{{ updateTimes[index] || '近期更新' }}</span>
                        </div>
                        <div class="docs-card-author">
                          <img src="/Ai/Sun.jpeg" alt="SunJiaHao" class="docs-author-avatar" />
                          <span>SunJiaHao</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="docs-card-read-btn"
                        @click.stop="selectDoc(doc)"
                      >
                        阅读
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <article class="docs-reader glass-card">
            <header class="docs-reader-header">
              <h2 class="text-2xl font-bold text-white">{{ selectedDoc?.title }}</h2>
              <p class="text-sm text-white/60 mt-2">{{ selectedDoc?.tag }}</p>
            </header>
            <div class="docs-reader-body">
              <div
                v-if="isLoadingDoc"
                class="docs-loading"
              >
                正在加载文档...
              </div>
              <div
                v-else-if="docError"
                class="docs-error"
              >
                {{ docError }}
              </div>
              <div
                v-else
                class="markdown-content"
                v-html="renderedMarkdown"
              ></div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { docsList } from '../data/docsList'

const docs = docsList
const selectedDoc = ref(docs[0] || null)
const renderedMarkdown = ref('')
const isLoadingDoc = ref(false)
const docError = ref('')
const imagesLoaded = reactive({})
const imageErrors = reactive({})
const readTimes = [8, 5, 4, 6]
const updateTimes = ['今天更新', '2 天前', '3 天前', '1 周前']

const handleImageLoad = (event, imageId) => {
  imagesLoaded[imageId] = true
}

const handleImageError = (event, imageId) => {
  imagesLoaded[imageId] = true
  imageErrors[imageId] = true
}

const preloadImages = () => {
  docs.forEach((doc) => {
    imagesLoaded[doc.id] = false
    const img = new Image()
    img.onload = () => handleImageLoad(img, doc.id)
    img.onerror = () => handleImageError(img, doc.id)
    img.src = doc.cover
  })
}

const escapeHtml = (text = '') =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderInline = (text = '') => {
  const escaped = escapeHtml(text)
  return escaped
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

const markdownToHtml = (markdown = '') => {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  let html = ''
  let paragraph = []
  let inCode = false
  let codeLang = ''
  let codeLines = []
  let inUnorderedList = false
  let inOrderedList = false

  const flushParagraph = () => {
    if (!paragraph.length) return
    html += `<p>${renderInline(paragraph.join(' '))}</p>`
    paragraph = []
  }

  const closeLists = () => {
    if (inUnorderedList) {
      html += '</ul>'
      inUnorderedList = false
    }
    if (inOrderedList) {
      html += '</ol>'
      inOrderedList = false
    }
  }

  for (const line of lines) {
    const codeFenceMatch = line.match(/^```(\w+)?/)
    if (codeFenceMatch) {
      if (!inCode) {
        flushParagraph()
        closeLists()
        inCode = true
        codeLang = codeFenceMatch[1] || ''
        codeLines = []
      } else {
        const langClass = codeLang ? ` class="language-${codeLang}"` : ''
        html += `<pre><code${langClass}>${escapeHtml(codeLines.join('\n'))}</code></pre>`
        inCode = false
        codeLang = ''
        codeLines = []
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      closeLists()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      closeLists()
      const level = headingMatch[1].length
      html += `<h${level}>${renderInline(headingMatch[2])}</h${level}>`
      continue
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (inOrderedList) {
        html += '</ol>'
        inOrderedList = false
      }
      if (!inUnorderedList) {
        html += '<ul>'
        inUnorderedList = true
      }
      html += `<li>${renderInline(unorderedMatch[1])}</li>`
      continue
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      if (inUnorderedList) {
        html += '</ul>'
        inUnorderedList = false
      }
      if (!inOrderedList) {
        html += '<ol>'
        inOrderedList = true
      }
      html += `<li>${renderInline(orderedMatch[1])}</li>`
      continue
    }

    const blockquoteMatch = line.match(/^>\s?(.+)$/)
    if (blockquoteMatch) {
      flushParagraph()
      closeLists()
      html += `<blockquote>${renderInline(blockquoteMatch[1])}</blockquote>`
      continue
    }

    paragraph.push(line.trim())
  }

  if (inCode) {
    const langClass = codeLang ? ` class="language-${codeLang}"` : ''
    html += `<pre><code${langClass}>${escapeHtml(codeLines.join('\n'))}</code></pre>`
  }
  flushParagraph()
  closeLists()
  return html
}

const loadDocContent = async (doc) => {
  if (!doc) return
  isLoadingDoc.value = true
  docError.value = ''
  try {
    const response = await fetch(doc.file)
    if (!response.ok) {
      throw new Error(`无法加载文档：${doc.file}`)
    }
    const markdown = await response.text()
    renderedMarkdown.value = markdownToHtml(markdown)
  } catch (error) {
    renderedMarkdown.value = ''
    docError.value = error instanceof Error ? error.message : '文档加载失败'
  } finally {
    isLoadingDoc.value = false
  }
}

const selectDoc = async (doc) => {
  selectedDoc.value = doc
  await loadDocContent(doc)
}

onMounted(async () => {
  preloadImages()
  await loadDocContent(selectedDoc.value)
})
</script>

<style scoped>
.docs-page {
  height: calc(100vh - 4rem);
  max-height: calc(100vh - 4rem);
  min-height: 0;
  overflow: hidden;
  background: radial-gradient(circle at top, rgba(255, 255, 255, 0.1), transparent 55%),
    radial-gradient(circle at bottom, rgba(0, 0, 0, 0.7), #050509);
}

.content-wrapper {
  padding-top: 0;
  height: 100%;
  overflow: hidden;
}

.docs-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding-top: 1rem;
  padding-bottom: 1rem;
  overflow: hidden;
}

.docs-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  min-height: 0;
  overflow: hidden;
}

.docs-cards-panel {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  container-type: inline-size;
}

.docs-cards-scroll {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 1.25rem;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.docs-cards-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.docs-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.15rem;
}

.docs-cards-grid > .docs-card:not(.docs-card-featured) {
  grid-column: span 1;
}

.docs-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 340px;
  cursor: pointer;
  border: 1px solid rgba(177, 193, 255, 0.25);
  border-radius: 12px;
  overflow: hidden;
  background: #040912;
  isolation: isolate;
  transition: box-shadow 0.24s ease, border-color 0.24s ease, filter 0.24s ease;
}

.docs-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.22),
    0 0 0 1px rgba(126, 174, 255, 0.16),
    0 16px 38px rgba(6, 22, 52, 0.38);
  transition: opacity 0.24s ease;
}

.docs-card-featured {
  grid-column: 1 / -1;
  min-height: 430px;
}

.docs-card:not(.docs-card-featured) {
  min-height: 380px;
}

.docs-card-hero {
  position: relative;
  min-height: 215px;
  flex: 0 0 62%;
  overflow: hidden;
}

.docs-card-featured .docs-card-hero {
  min-height: 290px;
}

.docs-card:not(.docs-card-featured) .docs-card-hero {
  min-height: 206px;
  flex-basis: 56%;
}

.docs-card-tint {
  display: none;
}

.docs-card-head {
  display: none;
}

.docs-card-chip {
  display: none;
}

.docs-card-title-wrap {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 26px;
  z-index: 3;
}

.docs-card-breadcrumb {
  margin: 0 0 12px;
  color: rgba(203, 209, 224, 0.66);
  font-size: 0.95rem;
  letter-spacing: 0.01em;
}

.docs-card-title {
  margin: 0;
  color: #f4f8ff;
  font-size: clamp(2.05rem, 2.9vw, 3.2rem);
  line-height: 1.08;
  font-weight: 700;
  letter-spacing: 0.01em;
  word-break: break-word;
}

.docs-card:not(.docs-card-featured) .docs-card-title {
  font-size: clamp(1.55rem, 1.9vw, 2.2rem);
  line-height: 1.14;
}

.docs-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1.4rem 1.15rem;
  background: rgb(29, 29, 31);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.docs-card:not(.docs-card-featured) .docs-card-body {
  gap: 0.85rem;
  padding: 1.3rem 1.65rem 0.78rem 1.45rem;
}

.docs-card-summary {
  margin: 0;
  flex: 1;
  color: rgba(207, 215, 229, 0.8);
  font-size: 1rem;
  line-height: 1.75;
  letter-spacing: 0.02em;
}

.docs-card:not(.docs-card-featured) .docs-card-summary {
  line-height: 1.68;
}

.docs-card-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
}

.docs-card:not(.docs-card-featured) .docs-card-meta-row {
  margin-top: auto;
  align-items: flex-end;
}

.docs-card-info {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.32rem;
  min-width: 0;
}

.docs-card-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: rgba(171, 181, 202, 0.84);
  font-size: 0.88rem;
  white-space: nowrap;
}

.docs-meta-dot {
  color: rgba(138, 149, 172, 0.65);
}

.docs-card-author {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  color: rgba(226, 233, 245, 0.86);
  font-size: 0.84rem;
  white-space: nowrap;
}

.docs-author-avatar {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.docs-card-read-btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(214, 219, 231, 0.08);
  color: rgba(231, 235, 245, 0.92);
  border-radius: 18px;
  padding: 0 1.05rem;
  min-width: 80px;
  height: 44px;
  font-size: 1rem;
  transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}

.docs-card-featured .docs-card-read-btn {
  background: rgba(243, 246, 251, 0.95);
  color: #111827;
  border-color: transparent;
}

.docs-card:not(.docs-card-featured) .docs-card-read-btn {
  margin-right: 0;
  margin-bottom: 0.02rem;
}

.docs-card-read-btn:hover {
  transform: translateY(-1px);
}

.docs-card.active {
  border-color: rgba(248, 252, 255, 0.55);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
}

.docs-card:hover {
  border-color: rgba(206, 224, 255, 0.42);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
  filter: brightness(1.02);
}

.docs-card:hover::after {
  opacity: 1;
}

[data-theme="light"] .docs-page {
  background:rgb(223, 222, 222);
}

[data-theme="light"] .docs-card {
  border-color: rgba(124, 143, 176, 0.34);
  background: #f7faff;
}

[data-theme="light"] .docs-card::after {
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.85),
    0 0 0 1px rgba(92, 136, 221, 0.2),
    0 14px 34px rgba(115, 140, 190, 0.22);
}

[data-theme="light"] .docs-card-tint {
  background:
    radial-gradient(130% 110% at 8% 0%, rgba(243, 182, 167, 0.3) 0%, rgba(124, 113, 197, 0.26) 26%, rgba(63, 95, 194, 0.2) 50%, rgba(13, 30, 78, 0.76) 100%),
    linear-gradient(180deg, rgba(7, 10, 25, 0.03) 32%, rgba(5, 16, 40, 0.8) 100%);
}

[data-theme="light"] .docs-card-chip {
  border-color: rgba(122, 138, 166, 0.35);
  background: rgba(244, 247, 255, 0.78);
  color: rgba(30, 41, 59, 0.92);
}

[data-theme="light"] .docs-card-breadcrumb {
  color: rgba(198, 209, 235, 0.82);
}

[data-theme="light"] .docs-card-body {
  background: #ffffff;
  border-top: 1px solid rgba(148, 163, 184, 0.28);
}

[data-theme="light"] .docs-card-summary {
  color: rgba(30, 41, 59, 0.88);
}

[data-theme="light"] .docs-card-meta {
  color: rgba(71, 85, 105, 0.9);
}

[data-theme="light"] .docs-meta-dot {
  color: rgba(100, 116, 139, 0.68);
}

[data-theme="light"] .docs-card-author {
  color: rgba(30, 41, 59, 0.9);
}

[data-theme="light"] .docs-author-avatar {
  border-color: rgba(100, 116, 139, 0.35);
}

[data-theme="light"] .docs-card-read-btn {
  border-color: rgba(89, 110, 145, 0.28);
  background: rgba(15, 23, 42, 0.05);
  color: rgba(15, 23, 42, 0.9);
}

[data-theme="light"] .docs-card-featured .docs-card-read-btn {
  background: #0f172a;
  color: #ffffff;
  border-color: transparent;
}

[data-theme="light"] .docs-card.active {
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 16px 34px rgba(107, 137, 190, 0.24);
}

[data-theme="light"] .docs-card:hover {
  border-color: rgba(74, 118, 203, 0.44);
  box-shadow: 0 10px 26px rgba(121, 151, 206, 0.24);
  filter: none;
}

[data-theme="light"] .docs-reader {
  background: #f8fbff;
  border-color: rgba(148, 163, 184, 0.33);
}

[data-theme="light"] .docs-reader-header {
  border-bottom: 1px solid rgba(148, 163, 184, 0.33);
}

[data-theme="light"] .docs-reader-header h2 {
  color: #0f172a !important;
}

[data-theme="light"] .docs-reader-header p {
  color: rgba(51, 65, 85, 0.74) !important;
}

[data-theme="light"] .docs-loading,
[data-theme="light"] .docs-error {
  color: rgba(51, 65, 85, 0.86);
}

[data-theme="light"] .docs-error {
  color: #dc2626;
}

[data-theme="light"] .glass-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: 0 8px 22px rgba(148, 163, 184, 0.2);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

[data-theme="light"] .image-loading {
  background: rgba(242, 247, 255, 0.75);
}

[data-theme="light"] .loading-spinner {
  border: 3px solid rgba(100, 116, 139, 0.28);
  border-top-color: #334155;
}

[data-theme="light"] .markdown-content :deep(h1),
[data-theme="light"] .markdown-content :deep(h2),
[data-theme="light"] .markdown-content :deep(h3),
[data-theme="light"] .markdown-content :deep(h4),
[data-theme="light"] .markdown-content :deep(h5),
[data-theme="light"] .markdown-content :deep(h6) {
  color: #0f172a;
}

[data-theme="light"] .markdown-content :deep(p),
[data-theme="light"] .markdown-content :deep(li) {
  color: rgba(30, 41, 59, 0.9);
}

[data-theme="light"] .markdown-content :deep(code) {
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
}

[data-theme="light"] .markdown-content :deep(pre) {
  background: #f1f5fb;
  border: 1px solid rgba(148, 163, 184, 0.35);
}

[data-theme="light"] .markdown-content :deep(blockquote) {
  border-left: 3px solid rgba(59, 130, 246, 0.44);
  color: rgba(51, 65, 85, 0.86);
}

[data-theme="light"] .markdown-content :deep(a) {
  color: #1d4ed8;
}

[data-theme="light"] .markdown-content :deep(img) {
  border: 1px solid rgba(148, 163, 184, 0.36);
}

.docs-card-featured .docs-card-breadcrumb {
  color: #000;
}

.docs-card-featured .docs-card-title {
  color: #000;
}

@container (max-width: 560px) {
  .docs-cards-grid {
    grid-template-columns: 1fr;
  }

  .docs-card-featured {
    grid-column: auto;
    min-height: 360px;
  }

  .docs-card-featured .docs-card-hero {
    min-height: 250px;
  }

  .docs-card-title {
    font-size: clamp(1.65rem, 5.2vw, 2.4rem);
    line-height: 1.12;
  }

  .docs-card:not(.docs-card-featured) .docs-card-title {
    font-size: clamp(1.45rem, 4.8vw, 2rem);
  }
}

.docs-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.04);
  transition: opacity 0.34s ease, transform 0.6s ease;
}

.docs-image.loaded {
  opacity: 1;
  transform: scale(1);
}

.docs-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #0f1218;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.docs-reader-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  padding: 1.2rem 1.25rem 1rem;
}

.docs-reader-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
}

.docs-loading,
.docs-error {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.95rem;
}

.docs-error {
  color: #fca5a5;
}

.glass-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.image-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 10, 22, 0.66);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  color: #fff;
  margin-top: 1.25rem;
  margin-bottom: 0.7rem;
  font-weight: 700;
}

.markdown-content :deep(p),
.markdown-content :deep(li) {
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.75;
  margin: 0.55rem 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.5rem 0 0.9rem;
  padding-left: 1.2rem;
}

.markdown-content :deep(code) {
  background: rgba(255, 255, 255, 0.14);
  color: #f8fafc;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
}

.markdown-content :deep(pre) {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.55rem;
  padding: 0.9rem;
  overflow-x: auto;
  margin: 0.8rem 0 1rem;
}

.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  margin: 0.75rem 0;
  border-left: 3px solid rgba(255, 255, 255, 0.35);
  padding-left: 0.8rem;
  color: rgba(255, 255, 255, 0.78);
}

.markdown-content :deep(a) {
  color: #93c5fd;
  text-decoration: underline;
}

.markdown-content :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0.75rem 0 1rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

@media (min-width: 1280px) {
  .docs-layout {
    grid-template-columns: minmax(440px, 1fr) minmax(560px, 1.1fr);
  }
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

@media (max-width: 768px) {
  .docs-page {
    height: calc(100vh - 3.5rem);
    max-height: calc(100vh - 3.5rem);
  }
}

@media (max-width: 480px) {
  .docs-page {
    height: calc(100vh - 3rem);
    max-height: calc(100vh - 3rem);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
