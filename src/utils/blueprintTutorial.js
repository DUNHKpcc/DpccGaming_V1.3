export const BLUEPRINT_TUTORIAL_STORAGE_KEY = 'dpcc-blueprint-tutorial-dismissed'

export const BLUEPRINT_TUTORIAL_STEPS = [
  {
    id: 'blueprint-step-1',
    title: '第一步：认识蓝图画布',
    description: '这里先放第一步教学文案，你可以直接在 blueprintTutorial.js 里修改成正式说明。',
    gifSrc: '/teaching/blueprint/blueprint1.gif'
  },
  {
    id: 'blueprint-step-2',
    title: '第二步：拖入节点开始搭建',
    description: '这里先放第二步教学文案，你可以直接在 blueprintTutorial.js 里修改成正式说明。',
    gifSrc: '/teaching/blueprint/blueprint2.gif'
  },
  {
    id: 'blueprint-step-3',
    title: '第三步：编辑节点并串联流程',
    description: '这里先放第三步教学文案，你可以直接在 blueprintTutorial.js 里修改成正式说明。',
    gifSrc: '/teaching/blueprint/blueprint3.gif'
  },
  {
    id: 'blueprint-step-4',
    title: '第四步：执行并查看结果',
    description: '这里先放第四步教学文案，你可以直接在 blueprintTutorial.js 里修改成正式说明。',
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
