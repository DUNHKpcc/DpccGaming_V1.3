export const slugifyHeadingText = (text = '') => (
  String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+=\[\]{}|\\:;"'<>,.?/]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section'
)

export const createHeadingIdGenerator = () => {
  const seen = new Map()

  return (text = '') => {
    const base = slugifyHeadingText(text)
    const count = (seen.get(base) || 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  }
}

export const extractMarkdownHeadings = (markdown = '') => {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n')
  const getId = createHeadingIdGenerator()
  const headings = []
  let inCode = false

  for (const line of lines) {
    const codeFenceMatch = line.match(/^```([\w-]+)?/)
    if (codeFenceMatch) {
      inCode = !inCode
      continue
    }

    if (inCode) continue

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (!headingMatch) continue

    const level = headingMatch[1].length
    const text = headingMatch[2].trim()
    headings.push({
      level,
      text,
      id: getId(text)
    })
  }

  return headings
}
