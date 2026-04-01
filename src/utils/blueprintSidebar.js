export const getBlueprintSidebarMaxPage = (items = [], pageSize = 2) =>
  Math.max(0, Math.ceil((Array.isArray(items) ? items.length : 0) / Math.max(1, Number(pageSize) || 1)) - 1)

export const clampBlueprintSidebarPage = (page = 0, items = [], pageSize = 2) => {
  const maxPage = getBlueprintSidebarMaxPage(items, pageSize)
  return Math.min(maxPage, Math.max(0, Number(page) || 0))
}

export const getBlueprintSidebarPageItems = (items = [], page = 0, pageSize = 2) => {
  const normalizedItems = Array.isArray(items) ? items : []
  const normalizedPageSize = Math.max(1, Number(pageSize) || 1)
  const normalizedPage = clampBlueprintSidebarPage(page, normalizedItems, normalizedPageSize)
  const start = normalizedPage * normalizedPageSize
  return normalizedItems.slice(start, start + normalizedPageSize)
}

export const findBlueprintSidebarPageBySeed = (items = [], seed = '', pageSize = 2) => {
  const normalizedItems = Array.isArray(items) ? items : []
  const normalizedSeed = String(seed || '').trim()
  if (!normalizedSeed) return -1

  const targetIndex = normalizedItems.findIndex((item) => String(item?.seed || '').trim() === normalizedSeed)
  if (targetIndex < 0) return -1

  return Math.floor(targetIndex / Math.max(1, Number(pageSize) || 1))
}
