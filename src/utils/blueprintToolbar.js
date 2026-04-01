import { BLUEPRINT_COMPACT_NODE_META } from './blueprintNodes.js'

export const BLUEPRINT_FAVORITE_NODE_KEYS = [
  'prompt-positive',
  'mixer',
  'visual',
  'play',
  'character'
]

export const BLUEPRINT_QUICK_PICK_NODE_KEYS = [
  'ui',
  'level',
  'language',
  'prompt-negative',
  'music'
]

export const BLUEPRINT_LIBRARY_GROUPS = [
  {
    key: 'prompt-and-output',
    title: '生成与整理',
    nodeKeys: ['prompt-positive', 'prompt-negative', 'mixer', 'output']
  },
  {
    key: 'game-design',
    title: '游戏策划',
    nodeKeys: ['design', 'play', 'language', 'character', 'level', 'progression', 'economy', 'narrative']
  },
  {
    key: 'presentation',
    title: '视听呈现',
    nodeKeys: ['visual', 'ui', 'music']
  }
]

export const getBlueprintToolbarNodeButton = (key = '') => {
  const meta = BLUEPRINT_COMPACT_NODE_META[key]
  if (!meta) return null

  return {
    key,
    label: meta.title,
    subtitle: meta.subtitle,
    icon: meta.iconClass
  }
}

export const buildBlueprintToolbarNodeButtons = (keys = []) =>
  keys
    .map((key) => getBlueprintToolbarNodeButton(key))
    .filter(Boolean)
