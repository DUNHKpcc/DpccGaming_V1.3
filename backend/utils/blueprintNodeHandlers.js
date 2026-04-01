const {
  createBlueprintSourceStepOutput,
  buildBlueprintNodePrompt,
  normalizeBlueprintStepResult,
  collectBlueprintUpstreamNodeIds
} = require('./blueprintExecution');
const {
  buildBlueprintHtmlSkeleton,
  buildBlueprintReadmeTemplate
} = require('./blueprintOutputTemplates');
const {
  REQUIRED_BLUEPRINT_OUTPUT_FILES,
  validateBlueprintOutputBundle
} = require('./blueprintOutputValidation');

const OUTPUT_FILE_CONTENT_TYPES = {
  'index.html': 'text/html; charset=utf-8',
  'style.css': 'text/css; charset=utf-8',
  'game.js': 'text/javascript; charset=utf-8',
  'README.md': 'text/markdown; charset=utf-8'
};

const extractJsonObject = (raw = '') => {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

const resolveBlueprintGameTitle = ({
  step = {},
  stepResults = {},
  stepsById = {}
} = {}) => {
  const reachableUpstreamNodeIds = collectBlueprintUpstreamNodeIds(
    stepsById,
    step?.upstreamNodeIds || []
  );

  for (const nodeId of reachableUpstreamNodeIds) {
    const runtime = stepResults?.[nodeId];
    if (runtime?.kind !== 'game') continue;
    return String(runtime.summary || runtime.output || '').trim();
  }

  return '';
};

const collectReachableBlueprintRuntimes = ({
  step = {},
  stepResults = {},
  stepsById = {}
} = {}) => {
  const reachableUpstreamNodeIds = collectBlueprintUpstreamNodeIds(
    stepsById,
    step?.upstreamNodeIds || []
  );

  return Array.from(reachableUpstreamNodeIds)
    .map((nodeId) => ({
      nodeId,
      step: stepsById[nodeId],
      runtime: stepResults?.[nodeId]
    }))
    .filter(({ step: upstreamStep, runtime }) => upstreamStep && runtime);
};

const buildBlueprintGameSpec = ({
  step = {},
  node = {},
  stepResults = {},
  stepsById = {}
} = {}) => {
  const reachable = collectReachableBlueprintRuntimes({ step, stepResults, stepsById });
  const sourceEntry = reachable.find(({ runtime }) => runtime?.kind === 'game');
  const sourceNode = sourceEntry?.step?.node || {};
  const domainEntries = reachable.filter(({ runtime }) => runtime?.kind && runtime.kind !== 'game');
  const sections = {};

  domainEntries.forEach(({ runtime, step: upstreamStep }) => {
    const kind = String(runtime.kind || upstreamStep?.kind || '').trim();
    if (!kind) return;
    sections[kind] = {
      nodeId: upstreamStep?.nodeId || upstreamStep?.id || '',
      title: upstreamStep?.title || kind,
      summary: runtime.summary || '',
      analysis: runtime.analysis || '',
      output: runtime.output || '',
      artifactType: runtime.artifactType || ''
    };
  });

  const theme = sections.visual?.output || sections.design?.output || sourceNode.description || '';
  const coreLoop = sections.play?.output || sections.level?.output || sections.progression?.output || '';
  const uiDirection = sections.ui?.output || '';
  const technicalDirection = sections.language?.output || `${sourceNode.codeTypeLabel || 'JavaScript'} + 原生 HTML/CSS/JS，无外部依赖`;

  return {
    title: sourceNode.title || node.title || 'Blueprint H5 Game',
    category: sourceNode.categoryLabel || '',
    engine: sourceNode.engineLabel || 'HTML5',
    codeType: sourceNode.codeTypeLabel || 'JavaScript',
    description: sourceNode.description || '',
    theme,
    coreLoop,
    uiDirection,
    technicalDirection,
    sourceContext: {
      coverUrl: sourceNode.coverUrl || '',
      videoUrl: sourceNode.videoUrl || '',
      codeSummary: sourceNode.codeSummary || '',
      codeEntryPath: sourceNode.codeEntryPath || '',
      codeSnippet: sourceNode.codeSnippet || ''
    },
    sections
  };
};

const buildBlueprintOutputPrompt = ({
  gameSpec = {},
  previousIssues = [],
  previousFiles = null
} = {}) => {
  const title = String(gameSpec.title || 'Blueprint H5 Game').trim() || 'Blueprint H5 Game';
  const htmlSkeleton = buildBlueprintHtmlSkeleton({ title });
  const readmeTemplate = buildBlueprintReadmeTemplate({ title });

  return [
    '你要生成一个可直接运行的轻量 H5 网页小游戏，且只能输出严格 JSON。',
    '目标文件固定为 files.index.html、files.style.css、files.game.js、files.README.md。',
    '要求：单页、原生 HTML/CSS/JS、无第三方依赖、可直接打开 index.html 运行。',
    'index.html 必须引用 style.css 和 game.js，并包含 id="app" 的挂载节点。',
    'README.md 必须包含“## 玩法 / ## 操作 / ## 结构 / ## 运行”四个章节。',
    `游戏规格：\n${JSON.stringify(gameSpec, null, 2)}`,
    `HTML 骨架参考：\n${htmlSkeleton}`,
    `README 结构参考：\n${readmeTemplate}`,
    previousIssues.length
      ? `上一次生成未通过校验，必须修复这些问题：\n- ${previousIssues.join('\n- ')}`
      : '',
    previousFiles
      ? `上一次生成的文件如下，请基于它修复，不要忽略已有可用部分：\n${JSON.stringify(previousFiles, null, 2)}`
      : '',
    '返回格式示例：{"files":{"index.html":"...","style.css":"...","game.js":"...","README.md":"..."}}'
  ].filter(Boolean).join('\n\n');
};

const buildBlueprintOutputArtifacts = (files = {}) => REQUIRED_BLUEPRINT_OUTPUT_FILES.map((fileName) => ({
  type: 'file',
  fileName,
  contentType: OUTPUT_FILE_CONTENT_TYPES[fileName] || 'text/plain; charset=utf-8',
  content: String(files[fileName] || '')
}));

const executeBlueprintOutputStep = async ({
  step = {},
  node = {},
  stepResults = {},
  stepsById = {},
  selectedModel = '',
  generateAiReply,
  startedAt = new Date().toISOString(),
  maxRepairAttempts = 1
} = {}) => {
  const gameSpec = buildBlueprintGameSpec({ step, node, stepResults, stepsById });
  let attempt = 0;
  let previousFiles = null;
  let previousIssues = [];
  let lastRawReply = '';

  while (attempt <= maxRepairAttempts) {
    const prompt = buildBlueprintOutputPrompt({
      gameSpec,
      previousIssues,
      previousFiles
    });
    const rawReply = await generateAiReply({
      prompt,
      builtinModel: selectedModel,
      gameTitle: gameSpec.title || '',
      roomMessages: [],
      roomSummary: null,
      memoryEntries: [],
      systemDirective: '你是 DpccGaming BluePrint 的输出节点执行器。返回严格 JSON，不要输出 Markdown 代码块或额外说明。'
    });
    lastRawReply = rawReply;

    const parsed = extractJsonObject(rawReply) || {};
    const files = parsed?.files && typeof parsed.files === 'object' ? parsed.files : {};
    const validation = validateBlueprintOutputBundle(files);

    if (validation.ok) {
      const completedAt = new Date().toISOString();
      const artifacts = buildBlueprintOutputArtifacts(files);
      const normalized = normalizeBlueprintStepResult({
        summary: '已生成可直接运行的 H5 游戏四文件。',
        analysis: `输出节点已基于上游规格生成四文件，并通过了 ${REQUIRED_BLUEPRINT_OUTPUT_FILES.length} 文件合同校验。`,
        output: REQUIRED_BLUEPRINT_OUTPUT_FILES.join('\n'),
        rawReply,
        input: JSON.stringify(gameSpec, null, 2),
        visibleInputText: JSON.stringify(gameSpec, null, 2),
        artifactType: 'file-bundle',
        mode: step.mode || 'ai',
        status: 'completed',
        nodeId: step.nodeId || node.id || '',
        nodeTitle: step.title || node.title || '',
        nodeKind: step.kind || node.kind || '',
        retryCount: attempt,
        artifactJson: {
          type: 'file-bundle',
          nodeId: step.nodeId || node.id || '',
          nodeTitle: step.title || node.title || '',
          nodeKind: step.kind || node.kind || '',
          status: 'completed',
          gameSpec,
          files,
          validation,
          repairAttempts: attempt
        },
        artifacts
      }, node);

      return buildBlueprintStepRuntime({
        step,
        normalized,
        model: selectedModel,
        status: 'completed',
        startedAt,
        completedAt,
        handlerType: 'output'
      });
    }

    previousFiles = files;
    previousIssues = validation.issues;
    attempt += 1;
  }

  const completedAt = new Date().toISOString();
  const errorMessage = `输出节点校验失败：${previousIssues.join('；') || '未生成有效文件。'}`;
  const normalized = normalizeBlueprintStepResult({
    rawReply: lastRawReply,
    input: JSON.stringify(gameSpec, null, 2),
    visibleInputText: JSON.stringify(gameSpec, null, 2),
    artifactType: 'file-bundle',
    mode: step.mode || 'ai',
    status: 'failed',
    nodeId: step.nodeId || node.id || '',
    nodeTitle: step.title || node.title || '',
    nodeKind: step.kind || node.kind || '',
    errorMessage,
    retryCount: attempt,
    artifactJson: {
      type: 'file-bundle',
      nodeId: step.nodeId || node.id || '',
      nodeTitle: step.title || node.title || '',
      nodeKind: step.kind || node.kind || '',
      status: 'failed',
      gameSpec,
      files: previousFiles || {},
      validation: {
        ok: false,
        issues: previousIssues
      },
      repairAttempts: attempt
    },
    artifacts: buildBlueprintOutputArtifacts(previousFiles || {})
  }, node);

  return buildBlueprintStepRuntime({
    step,
    normalized,
    model: selectedModel,
    status: 'failed',
    startedAt,
    completedAt,
    errorMessage,
    handlerType: 'output'
  });
};

const buildBlueprintStepRuntime = ({
  step = {},
  normalized = {},
  model = '',
  status = 'completed',
  startedAt = null,
  completedAt = null,
  errorMessage = null,
  handlerType = ''
} = {}) => ({
  ...normalized,
  handlerType,
  mode: step.mode || normalized.mode || '',
  kind: step.kind || normalized.kind || '',
  model,
  status,
  upstreamNodeIds: Array.isArray(step.upstreamNodeIds) ? step.upstreamNodeIds : [],
  startedAt,
  completedAt,
  errorMessage
});

const emitBlueprintStepProgress = (onProgress, payload = {}) => {
  if (typeof onProgress !== 'function') return;
  onProgress({
    progress: 0,
    stage: '',
    detail: '',
    ...payload
  });
};

const executeBlueprintSourceStep = async ({
  step = {},
  node = {},
  startedAt = new Date().toISOString(),
  onProgress
} = {}) => {
  try {
    emitBlueprintStepProgress(onProgress, {
      progress: 0.16,
      stage: 'metadata',
      detail: '正在整理游戏元信息。'
    });

    emitBlueprintStepProgress(onProgress, {
      progress: 0.42,
      stage: 'code',
      detail: node.codeSnippet
        ? '已加载代码片段，正在整理源码上下文。'
        : '未找到代码片段，已跳过源码上下文补充。'
    });

    emitBlueprintStepProgress(onProgress, {
      progress: 0.74,
      stage: 'video',
      detail: Array.isArray(node.videoKeyframes) && node.videoKeyframes.length
        ? `已提取 ${node.videoKeyframes.length} 张视频关键帧。`
        : (node.videoKeyframeNote || '当前没有可用视频关键帧，已跳过该阶段。')
    });

    const sourceOutput = createBlueprintSourceStepOutput(node);
    const visibleInputText = sourceOutput.output;
    const completedAt = new Date().toISOString();
    emitBlueprintStepProgress(onProgress, {
      progress: 1,
      stage: 'finalize',
      detail: '游戏源节点上下文已整理完成。'
    });
    const normalized = normalizeBlueprintStepResult({
      summary: sourceOutput.summary,
      analysis: sourceOutput.analysis,
      output: sourceOutput.output,
      input: visibleInputText,
      visibleInputText,
      artifactType: 'source-context',
      mode: 'source',
      status: 'completed',
      nodeId: step.nodeId || node.id || '',
      nodeTitle: step.title || node.title || '',
      nodeKind: step.kind || node.kind || '',
      artifactJson: {
        type: 'source-context',
        nodeId: step.nodeId || node.id || '',
        nodeTitle: step.title || node.title || '',
        nodeKind: step.kind || node.kind || '',
        mode: 'source',
        status: 'completed',
        summary: sourceOutput.summary,
        analysis: sourceOutput.analysis,
        output: sourceOutput.output,
        input: visibleInputText,
        visibleInputText,
        videoKeyframes: Array.isArray(node.videoKeyframes) ? node.videoKeyframes : [],
        videoKeyframeNote: String(node.videoKeyframeNote || '')
      }
    }, node);

    return buildBlueprintStepRuntime({
      step,
      normalized,
      model: 'source',
      status: 'completed',
      startedAt,
      completedAt,
      handlerType: 'source'
    });
  } catch (error) {
    const completedAt = new Date().toISOString();
    const errorMessage = error?.message || '源节点执行失败';
    const normalized = normalizeBlueprintStepResult({
      input: '',
      visibleInputText: '',
      artifactType: 'source-context',
      mode: 'source',
      status: 'failed',
      nodeId: step.nodeId || node.id || '',
      nodeTitle: step.title || node.title || '',
      nodeKind: step.kind || node.kind || '',
      errorMessage
    }, node);

    return buildBlueprintStepRuntime({
      step,
      normalized,
      model: 'source',
      status: 'failed',
      startedAt,
      completedAt,
      errorMessage,
      handlerType: 'source'
    });
  }
};

const executeBlueprintAiDomainStep = async ({
  step = {},
  node = {},
  stepResults = {},
  stepsById = {},
  selectedModel = '',
  generateAiReply,
  startedAt = new Date().toISOString(),
  onProgress
} = {}) => {
  try {
    emitBlueprintStepProgress(onProgress, {
      progress: 0.16,
      stage: 'prepare',
      detail: '正在整理当前节点可见的上游输入。'
    });
    const preparedPrompt = buildBlueprintNodePrompt({
      step,
      stepResults,
      stepsById
    });
    emitBlueprintStepProgress(onProgress, {
      progress: 0.52,
      stage: 'generate',
      detail: '正在请求模型分析当前节点。'
    });
    const rawReply = await generateAiReply({
      prompt: preparedPrompt.prompt,
      builtinModel: selectedModel,
      gameTitle: resolveBlueprintGameTitle({
        step,
        stepResults,
        stepsById
      }),
      roomMessages: [],
      roomSummary: null,
      memoryEntries: [],
      systemDirective: preparedPrompt.systemDirective
    });
    emitBlueprintStepProgress(onProgress, {
      progress: 0.84,
      stage: 'parse',
      detail: '模型已返回，正在解析结构化结果。'
    });
    const completedAt = new Date().toISOString();
    emitBlueprintStepProgress(onProgress, {
      progress: 1,
      stage: 'finalize',
      detail: '节点结果已整理完成。'
    });
    const normalized = normalizeBlueprintStepResult({
      rawReply,
      input: preparedPrompt.visibleInput,
      visibleInputText: preparedPrompt.visibleInput,
      artifactType: 'ai-result',
      mode: step.mode || 'ai',
      status: 'completed',
      nodeId: step.nodeId || node.id || '',
      nodeTitle: step.title || node.title || '',
      nodeKind: step.kind || node.kind || ''
    }, node);

    return buildBlueprintStepRuntime({
      step,
      normalized,
      model: selectedModel,
      status: 'completed',
      startedAt,
      completedAt,
      handlerType: 'ai-domain'
    });
  } catch (error) {
    const preparedPrompt = buildBlueprintNodePrompt({
      step,
      stepResults,
      stepsById
    });
    const completedAt = new Date().toISOString();
    const errorMessage = error?.message || '节点执行失败';
    const normalized = normalizeBlueprintStepResult({
      input: preparedPrompt.visibleInput,
      visibleInputText: preparedPrompt.visibleInput,
      artifactType: 'ai-result',
      mode: step.mode || 'ai',
      status: 'failed',
      nodeId: step.nodeId || node.id || '',
      nodeTitle: step.title || node.title || '',
      nodeKind: step.kind || node.kind || '',
      errorMessage
    }, node);

    return buildBlueprintStepRuntime({
      step,
      normalized,
      model: selectedModel,
      status: 'failed',
      startedAt,
      completedAt,
      errorMessage,
      handlerType: 'ai-domain'
    });
  }
};

const executeBlueprintNodeStep = async (context = {}) => {
  if (context?.step?.mode === 'source') {
    return executeBlueprintSourceStep(context);
  }

  if (context?.step?.kind === 'output') {
    return executeBlueprintOutputStep(context);
  }

  return executeBlueprintAiDomainStep(context);
};

module.exports = {
  executeBlueprintSourceStep,
  executeBlueprintAiDomainStep,
  executeBlueprintOutputStep,
  executeBlueprintNodeStep
};
