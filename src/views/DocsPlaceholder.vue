<template>
  <div class="docs-page">
    <div class="content-wrapper">
      <div class="container mx-auto px-4 docs-main">
        <div class="docs-header flex justify-between items-center mb-4">
        </div>

        <div class="docs-layout">
          <section class="docs-cards-panel">
            <div class="docs-cards-scroll">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <article
                  v-for="doc in docs"
                  :key="doc.id"
                  class="docs-card glass-card overflow-hidden flex flex-col"
                  :class="{ active: selectedDoc?.id === doc.id }"
                  @click="selectDoc(doc)"
                >
                  <div class="docs-image-wrapper">
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
                  </div>

                  <div class="p-5 flex-1 flex flex-col">
                    <h2 class="text-xl font-bold text-white mb-2">{{ doc.title }}</h2>
                    <p class="text-sm text-white/60 mb-3">{{ doc.tag }}</p>
                    <p class="text-sm text-white/80 leading-relaxed flex-1">{{ doc.summary }}</p>
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
}

.docs-cards-scroll {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 1.25rem;
}

.docs-card {
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.16);
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}

.docs-card.active {
  border-color: rgba(255, 255, 255, 0.35);
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.6);
}

.docs-card:hover {
  transform: translateY(-4px);
}

.docs-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  overflow: hidden;
}

.docs-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.docs-image.loaded {
  opacity: 1;
}

.docs-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
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
    padding-left: 96px;
  }
}

@media (min-width: 1536px) {
  .docs-page .content-wrapper {
    padding-left: 120px;
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
