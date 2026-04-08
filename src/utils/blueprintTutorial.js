export const BLUEPRINT_TUTORIAL_STORAGE_KEY = 'dpcc-blueprint-tutorial-dismissed'

const createBlueprintTutorialVideoSources = (assetName) => ([
  {
    src: `/teaching/blueprint/${assetName}.webm`,
    type: 'video/webm'
  },
  {
    src: `/teaching/blueprint/${assetName}.mp4`,
    type: 'video/mp4'
  }
])

const createBlueprintTutorialStep = ({ id, title, description, assetName }) => ({
  id,
  title,
  description,
  posterSrc: `/teaching/blueprint/${assetName}.jpg`,
  videoSources: createBlueprintTutorialVideoSources(assetName)
})

export const BLUEPRINT_TUTORIAL_STEPS = [
  createBlueprintTutorialStep({
    id: 'blueprint-step-1',
    title: '第一步：AI模型配置',
    description: '配置你的蓝图执行模型',
    assetName: 'blueprint1'
  }),
  createBlueprintTutorialStep({
    id: 'blueprint-step-2',
    title: '第二步：拖添加游戏库模仿节点',
    description: '将游戏节点拖入画布（长按拖入右侧画布）',
    assetName: 'blueprint2'
  }),
  createBlueprintTutorialStep({
    id: 'blueprint-step-3',
    title: '第三步：别忘记保存哦⚠️',
    description: '点击左侧保存即可生成专属种子，可向小伙伴分享哦',
    assetName: 'blueprint3'
  }),
  createBlueprintTutorialStep({
    id: 'blueprint-step-4',
    title: '第四步：运行你的节点🎉',
    description: '点击右上角节点运行，即可让AI执行当前流程',
    assetName: 'blueprint4'
  })
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

  return [...laterSteps, ...earlierSteps]
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
