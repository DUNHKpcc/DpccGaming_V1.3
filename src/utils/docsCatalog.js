const normalize = value => String(value || '').trim().toLowerCase()

export const buildDocsCatalog = (docs = [], query = '') => {
  const keyword = normalize(query)
  const groups = new Map()

  docs.forEach((doc) => {
    const haystack = [
      doc?.title,
      doc?.summary,
      doc?.tag
    ].map(normalize).join(' ')

    if (keyword && !haystack.includes(keyword)) {
      return
    }

    const key = doc?.tag || '其它'
    if (!groups.has(key)) {
      groups.set(key, { tag: key, items: [] })
    }
    groups.get(key).items.push(doc)
  })

  return Array.from(groups.values())
}
