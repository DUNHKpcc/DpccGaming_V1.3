import { BLUEPRINT_COMPACT_NODE_META } from './blueprintNodes.js'

export const normalizeBlueprintPlannerPrompt = (value = '') =>
  String(value || '').trim()

const BLUEPRINT_NODE_RESPONSIBILITY = {
  game: '引用已有游戏素材与上下文，作为工作流源节点。',
  'prompt-positive': '整理需要强化和保留的正向创作要求。',
  'prompt-negative': '整理需要规避和限制的负向要求。',
  mixer: '将多个上游节点结果重新梳理并形成可继续传递的中间结论。',
  visual: '整理视觉风格、色彩、镜头、材质、氛围和参考方向。',
  language: '明确编程语言、技术栈和开发取舍。',
  design: '提炼世界观、核心设定、题材和风格约束。',
  play: '围绕核心循环、目标、反馈和操作方式给出玩法方案。',
  character: '分析角色职能、阵营、能力和辨识度。',
  ui: '整理界面结构、HUD 和交互层级。',
  level: '规划关卡推进、地图节奏和流程节点。',
  progression: '定义等级、技能、装备与成长曲线。',
  economy: '定义货币、掉落、商店和资源循环。',
  narrative: '整理剧情背景、事件推进和叙事节奏。',
  music: '描述音乐风格、配器、情绪和使用场景。',
  output: '把上游结果整合成最终可执行方案或最终 Prompt。'
}

export const buildBlueprintPlannerAvailableNodes = () => {
  const compactNodes = Object.entries(BLUEPRINT_COMPACT_NODE_META).map(([kind, meta]) => ({
    kind,
    title: meta.title,
    subtitle: meta.subtitle,
    contentLabel: meta.contentLabel,
    contentPlaceholder: meta.contentPlaceholder,
    responsibility: BLUEPRINT_NODE_RESPONSIBILITY[kind] || ''
  }))

  return [
    {
      kind: 'game',
      title: '游戏节点',
      subtitle: 'Game Source',
      contentLabel: '游戏上下文',
      contentPlaceholder: '引用已有游戏素材与代码上下文',
      responsibility: BLUEPRINT_NODE_RESPONSIBILITY.game
    },
    ...compactNodes
  ]
}
