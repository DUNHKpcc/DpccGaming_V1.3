export const CATEGORY_MAP_EN_TO_ZH = {
  action: '动作',
  adventure: '冒险',
  puzzle: '益智',
  racing: '赛车',
  simulation: '模拟',
  strategy: '策略',
  casual: '休闲',
  sports: '体育',
  rpg: '角色扮演',
  shooter: '射击',
  arcade: '街机',
  platformer: '平台',
  card: '卡牌',
  board: '桌游',
  music: '音乐',
  horror: '恐怖',
  other: '其他'
}

export const CATEGORY_MAP_ZH_TO_EN = {
  动作: 'action',
  冒险: 'adventure',
  益智: 'puzzle',
  谜题: 'puzzle',
  赛车: 'racing',
  模拟: 'simulation',
  策略: 'strategy',
  休闲: 'casual',
  体育: 'sports',
  角色扮演: 'rpg',
  射击: 'shooter',
  街机: 'arcade',
  平台: 'platformer',
  卡牌: 'card',
  桌游: 'board',
  音乐: 'music',
  恐怖: 'horror',
  其他: 'other'
}

export function categoryToZh(category) {
  if (!category && category !== 0) return '其他'
  const key = String(category).trim().toLowerCase()
  if (CATEGORY_MAP_EN_TO_ZH[key]) return CATEGORY_MAP_EN_TO_ZH[key]
  return String(category)
}

export function categoryToCode(category) {
  if (!category && category !== 0) return 'other'
  const raw = String(category).trim()
  const lower = raw.toLowerCase()
  if (CATEGORY_MAP_EN_TO_ZH[lower]) return lower
  return CATEGORY_MAP_ZH_TO_EN[raw] || 'other'
}

