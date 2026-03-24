const escapeHtml = (source = '') => {
  return String(source || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const HIGHLIGHT_LANGUAGE_LOADERS = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  json: () => import('highlight.js/lib/languages/json'),
  xml: () => import('highlight.js/lib/languages/xml'),
  css: () => import('highlight.js/lib/languages/css'),
  python: () => import('highlight.js/lib/languages/python'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp')
}

const HIGHLIGHT_LANGUAGE_ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
  html: 'xml',
  vue: 'xml',
  xml: 'xml',
  css: 'css',
  scss: 'css',
  less: 'css',
  json: 'json',
  py: 'python',
  python: 'python',
  cs: 'csharp',
  'c#': 'csharp',
  csharp: 'csharp',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp'
}

let highlighterPromise = null

export const escapeCodeHtml = escapeHtml

export const inferHighlightLanguage = (filePath = '') => {
  const normalized = String(filePath || '').toLowerCase()
  if (normalized.endsWith('.ts') || normalized.endsWith('.tsx')) return 'typescript'
  if (normalized.endsWith('.js') || normalized.endsWith('.jsx')) return 'javascript'
  if (normalized.endsWith('.vue') || normalized.endsWith('.html')) return 'xml'
  if (normalized.endsWith('.css') || normalized.endsWith('.scss') || normalized.endsWith('.less')) return 'css'
  if (normalized.endsWith('.json')) return 'json'
  if (normalized.endsWith('.py')) return 'python'
  if (normalized.endsWith('.cs')) return 'csharp'
  if (normalized.endsWith('.cpp') || normalized.endsWith('.cc')) return 'cpp'
  if (normalized.endsWith('.c') || normalized.endsWith('.h')) return 'c'
  return ''
}

const normalizeLanguage = (language = '', filePath = '') => {
  const normalized = String(language || '').trim().toLowerCase()
  if (normalized && HIGHLIGHT_LANGUAGE_ALIASES[normalized]) {
    return HIGHLIGHT_LANGUAGE_ALIASES[normalized]
  }
  return inferHighlightLanguage(filePath)
}

const getHighlighter = async () => {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [{ default: hljs }, ...languages] = await Promise.all([
        import('highlight.js/lib/core'),
        ...Object.values(HIGHLIGHT_LANGUAGE_LOADERS).map((loader) => loader())
      ])

      const [
        { default: javascript },
        { default: typescript },
        { default: json },
        { default: xml },
        { default: css },
        { default: python },
        { default: cpp },
        { default: csharp }
      ] = languages

      hljs.registerLanguage('javascript', javascript)
      hljs.registerLanguage('typescript', typescript)
      hljs.registerLanguage('json', json)
      hljs.registerLanguage('xml', xml)
      hljs.registerLanguage('css', css)
      hljs.registerLanguage('python', python)
      hljs.registerLanguage('cpp', cpp)
      hljs.registerLanguage('c', cpp)
      hljs.registerLanguage('csharp', csharp)

      return hljs
    })()
  }

  return highlighterPromise
}

export const warmupCodeHighlighter = () => {
  void getHighlighter()
}

export const highlightCodeAsync = async (content = '', options = {}) => {
  const source = String(content || '')
  if (!source) return ''

  const filePath = String(options.filePath || '')
  const language = normalizeLanguage(options.language, filePath)

  try {
    const hljs = await getHighlighter()
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(source, { language }).value
    }
    return hljs.highlightAuto(source).value
  } catch {
    return escapeHtml(source)
  }
}
