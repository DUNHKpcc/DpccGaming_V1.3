export const BLUEPRINT_TUTORIAL_STORAGE_KEY = 'dpcc-blueprint-tutorial-dismissed'

export const BLUEPRINT_TUTORIAL_STEPS = [
  {
    id: 'blueprint-step-1',
    title: '第一步：AI模型配置',
    description: '配置你的蓝图执行模型',
    gifSrc: '/teaching/blueprint/blueprint1.gif'
  },
  {
    id: 'blueprint-step-2',
    title: '第二步：拖添加游戏库模仿节点',
    description: '将游戏节点拖入画布（长按拖入右侧画布）',
    gifSrc: '/teaching/blueprint/blueprint2.gif'
  },
  {
    id: 'blueprint-step-3',
    title: '第三步：别忘记保存哦⚠️',
    description: '点击左侧保存即可生成专属种子，可向小伙伴分享哦',
    gifSrc: '/teaching/blueprint/blueprint3.gif'
  },
  {
    id: 'blueprint-step-4',
    title: '第四步：运行你的节点🎉',
    description: '点击右上角节点运行，即可让AI执行当前流程',
    gifSrc: '/teaching/blueprint/blueprint4.gif'
  }
]

export const normalizeBlueprintTutorialStepIndex = (value, totalSteps = BLUEPRINT_TUTORIAL_STEPS.length) => {
  const maxIndex = Math.max(0, Number(totalSteps || 0) - 1)
  const nextIndex = Number.isFinite(Number(value)) ? Number(value) : 0
  return Math.min(maxIndex, Math.max(0, Math.trunc(nextIndex)))
}

export const getBlueprintTutorialPrefetchQueue = (
  activeIndex,
  steps = BLUEPRINT_TUTORIAL_STEPS
) => {
  const normalizedIndex = normalizeBlueprintTutorialStepIndex(activeIndex, steps.length)
  const laterSteps = steps.slice(normalizedIndex + 1)
  const earlierSteps = steps.slice(0, normalizedIndex)

  return [...laterSteps, ...earlierSteps].map((step) => step.gifSrc)
}

export const shouldAutoOpenBlueprintTutorial = ({ hasHydrated = false, dismissed = false } = {}) =>
  Boolean(hasHydrated) && !dismissed

export const readBlueprintTutorialDismissed = (storage = globalThis?.localStorage) => {
  try {
    return storage?.getItem(BLUEPRINT_TUTORIAL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const writeBlueprintTutorialDismissed = (
  dismissed,
  storage = globalThis?.localStorage
) => {
  try {
    if (!storage) return

    if (dismissed) {
      storage.setItem(BLUEPRINT_TUTORIAL_STORAGE_KEY, '1')
      return
    }

    storage.removeItem(BLUEPRINT_TUTORIAL_STORAGE_KEY)
  } catch {
    // Ignore storage failures and keep the tutorial usable.
  }
}
