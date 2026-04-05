const fs = require('node:fs/promises');
const {
  DEFAULT_BLUEPRINT_EXECUTION_MODEL,
  DEFAULT_BLUEPRINT_VISION_MODEL
} = require('../services/blueprint/blueprintCommon');

const {
  createBlueprintSourceStepOutput,
  buildBlueprintNodePrompt,
  normalizeBlueprintStepResult,
  collectBlueprintUpstreamNodeIds
} = require('./blueprintExecution');
const {
  buildBlueprintHtmlSkeleton
} = require('./blueprintOutputTemplates');
const {
  REQUIRED_BLUEPRINT_OUTPUT_FILES,
  validateBlueprintOutputBundle
} = require('./blueprintOutputValidation');

const OUTPUT_FILE_CONTENT_TYPES = {
  'index.html': 'text/html; charset=utf-8'
};
const BLUEPRINT_OUTPUT_PROMPT_PREVIEW_LIMIT = 240;
const BLUEPRINT_OUTPUT_SECTION_LIMIT = 480;
const BLUEPRINT_OUTPUT_SOURCE_SNIPPET_LIMIT = 420;

const clipBlueprintPromptText = (value = '', maxLength = 0) => {
  const text = String(value || '').replace(/\r/g, '').trim();
  if (!text || !Number.isFinite(Number(maxLength)) || maxLength <= 0 || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(32, Math.floor(maxLength))).trim()}...`;
};

const summarizeBlueprintPreviousFiles = (files = {}) =>
  Object.entries(files || {})
    .filter(([fileName]) => REQUIRED_BLUEPRINT_OUTPUT_FILES.includes(fileName))
    .map(([fileName, content]) => {
      const text = String(content || '').replace(/\r/g, '');
      return {
        fileName,
        charCount: text.length,
        lineCount: text ? text.split('\n').length : 0,
        preview: clipBlueprintPromptText(text, BLUEPRINT_OUTPUT_PROMPT_PREVIEW_LIMIT)
      };
    });

const compactBlueprintGameSpec = (gameSpec = {}) => {
  const sections = {};

  Object.entries(gameSpec?.sections || {}).forEach(([kind, section]) => {
    sections[kind] = {
      title: String(section?.title || kind || '').trim(),
      summary: clipBlueprintPromptText(section?.summary || '', 80),
      analysis: clipBlueprintPromptText(section?.analysis || '', 80),
      output: clipBlueprintPromptText(section?.output || '', 80)
    };
  });

  return {
    title: String(gameSpec?.title || '').trim(),
    category: String(gameSpec?.category || '').trim(),
    engine: String(gameSpec?.engine || '').trim(),
    codeType: String(gameSpec?.codeType || '').trim(),
    description: clipBlueprintPromptText(gameSpec?.description || '', 80),
    theme: clipBlueprintPromptText(gameSpec?.theme || '', 80),
    coreLoop: clipBlueprintPromptText(gameSpec?.coreLoop || '', 80),
    uiDirection: clipBlueprintPromptText(gameSpec?.uiDirection || '', 80),
    technicalDirection: clipBlueprintPromptText(gameSpec?.technicalDirection || '', 80),
    sourceContext: {
      coverUrl: String(gameSpec?.sourceContext?.coverUrl || '').trim(),
      videoUrl: String(gameSpec?.sourceContext?.videoUrl || '').trim(),
      codeSummary: clipBlueprintPromptText(gameSpec?.sourceContext?.codeSummary || '', 80),
      codeEntryPath: String(gameSpec?.sourceContext?.codeEntryPath || '').trim(),
      codeSnippet: clipBlueprintPromptText(gameSpec?.sourceContext?.codeSnippet || '', 220)
    },
    sections
  };
};

const VISION_FRAME_LIMIT = 4;

const IMAGE_MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
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

const normalizeBlueprintHtmlDocument = (value = '') => {
  const html = String(value || '').trim();
  if (!html) return '';

  if (!/(<!doctype\s+html\b|<html\b)/i.test(html)) return '';
  if (!/<body\b[\s\S]*<\/body>/i.test(html)) return '';
  if (!/<script\b[^>]*>[\s\S]*?<\/script>/i.test(html)) return '';

  return html;
};

const extractBlueprintHtmlCodeBlock = (rawReply = '') => {
  const text = String(rawReply || '').trim();
  if (!text) return '';

  const htmlFenceMatches = Array.from(text.matchAll(/```html\s*([\s\S]*?)```/gi));
  for (const match of htmlFenceMatches) {
    const html = normalizeBlueprintHtmlDocument(match[1] || '');
    if (html) return html;
  }

  const genericFenceMatches = Array.from(text.matchAll(/```(?:\w+)?\s*([\s\S]*?)```/g));
  for (const match of genericFenceMatches) {
    const html = normalizeBlueprintHtmlDocument(match[1] || '');
    if (html) return html;
  }

  return '';
};

const extractBlueprintHtmlDocument = (rawReply = '') => {
  const text = String(rawReply || '').trim();
  if (!text) return '';

  const directHtml = normalizeBlueprintHtmlDocument(text);
  if (directHtml) return directHtml;

  const doctypeIndex = text.search(/<!doctype\s+html\b/i);
  if (doctypeIndex >= 0) {
    const candidate = normalizeBlueprintHtmlDocument(text.slice(doctypeIndex));
    if (candidate) return candidate;
  }

  const htmlIndex = text.search(/<html\b/i);
  if (htmlIndex >= 0) {
    const candidate = normalizeBlueprintHtmlDocument(text.slice(htmlIndex));
    if (candidate) return candidate;
  }

  return '';
};

const readBlueprintFileContent = (value) => {
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    return value
      .map((entry) => readBlueprintFileContent(entry))
      .filter(Boolean)
      .join('\n');
  }

  if (!value || typeof value !== 'object') return '';

  const preferredKeys = ['content', 'text', 'code', 'value', 'source', 'body', 'data'];
  for (const key of preferredKeys) {
    if (!(key in value)) continue;
    const normalized = readBlueprintFileContent(value[key]);
    if (normalized) return normalized;
  }

  return '';
};

const mapBlueprintFileEntries = (entries = []) =>
  (Array.isArray(entries) ? entries : []).reduce((accumulator, entry) => {
    if (!entry || typeof entry !== 'object') return accumulator;

    const fileName = String(
      entry.fileName || entry.name || entry.path || entry.file || ''
    ).trim();
    if (!fileName) return accumulator;

    const content = readBlueprintFileContent(entry);
    if (!content) return accumulator;

    accumulator[fileName] = content;
    return accumulator;
  }, {});

const normalizeBlueprintOutputFiles = (candidate = {}) => {
  if (Array.isArray(candidate)) {
    return mapBlueprintFileEntries(candidate);
  }

  if (!candidate || typeof candidate !== 'object') return {};

  return REQUIRED_BLUEPRINT_OUTPUT_FILES.reduce((files, fileName) => {
    const content = readBlueprintFileContent(candidate[fileName]);
    if (content) {
      files[fileName] = content;
    }
    return files;
  }, {});
};

const extractBlueprintOutputFiles = (rawReply = '') => {
  const parsed = extractJsonObject(rawReply);
  if (parsed && typeof parsed === 'object') {
    const candidates = [
      parsed?.files,
      parsed,
      parsed?.output?.files,
      parsed?.output,
      parsed?.bundle?.files,
      parsed?.bundle,
      parsed?.artifacts,
      parsed?.data?.files,
      parsed?.data
    ];

    for (const candidate of candidates) {
      const files = normalizeBlueprintOutputFiles(candidate);
      if (Object.keys(files).length) {
        return files;
      }
    }
  }

  const htmlFromCodeBlock = extractBlueprintHtmlCodeBlock(rawReply);
  if (htmlFromCodeBlock) {
    return {
      'index.html': htmlFromCodeBlock
    };
  }

  const htmlDocument = extractBlueprintHtmlDocument(rawReply);
  if (htmlDocument) {
    return {
      'index.html': htmlDocument
    };
  }

  return {};
};

const resolveImageMimeType = (filePath = '') => {
  const normalizedPath = String(filePath || '').trim().toLowerCase();
  const matchedExtension = Object.keys(IMAGE_MIME_BY_EXTENSION)
    .find((extension) => normalizedPath.endsWith(extension));
  return matchedExtension ? IMAGE_MIME_BY_EXTENSION[matchedExtension] : 'image/jpeg';
};

const readFrameAsDataUrl = async (frame = {}) => {
  const imagePath = String(frame?.path || '').trim();
  if (!imagePath) return '';

  const fileBuffer = await fs.readFile(imagePath);
  return `data:${resolveImageMimeType(imagePath)};base64,${fileBuffer.toString('base64')}`;
};

const buildSourceVisionUserContentItems = async (node = {}) => {
  const frameInputs = Array.isArray(node?.videoKeyframes)
    ? node.videoKeyframes.slice(0, VISION_FRAME_LIMIT)
    : [];

  if (!frameInputs.length) return [];

  const imageItems = [];

  for (const frame of frameInputs) {
    let imageUrl = '';

    try {
      imageUrl = await readFrameAsDataUrl(frame);
    } catch {
      imageUrl = '';
    }

    if (!imageUrl) {
      const fallbackUrl = String(frame?.url || '').trim();
      if (/^(https?:|data:)/i.test(fallbackUrl)) {
        imageUrl = fallbackUrl;
      }
    }

    if (!imageUrl) continue;

    imageItems.push({
      type: 'image_url',
      image_url: {
        url: imageUrl
      }
    });
  }

  if (!imageItems.length) return [];

  return [
    {
      type: 'text',
      text: [
        `请分析这款游戏《${String(node?.title || '未命名游戏').trim() || '未命名游戏'}》的关键帧截图。`,
        '你看到的是同一款游戏的多个连续画面，请综合判断，不要只描述单张图片。',
        '必须返回严格 JSON，不要输出 Markdown 代码块。字段只能是 summary、analysis、output。',
        'summary 用 1 句话总结画面与玩法感受；analysis 用 2 到 4 句解释你从画面中观察到的镜头、HUD/UI、场景与动作反馈；output 给出可供后续节点复用的视觉理解结论。'
      ].join('\n')
    },
    ...imageItems
  ];
};

const analyzeBlueprintSourceVision = async ({
  node = {},
  selectedVisionModel = '',
  generateAiReply
} = {}) => {
  if (selectedVisionModel !== 'GLM-4.6V') return null;
  if (typeof generateAiReply !== 'function') return null;

  const userContentItems = await buildSourceVisionUserContentItems(node);
  if (!userContentItems.length) return null;

  const rawReply = await generateAiReply({
    prompt: [
      `分析游戏《${String(node?.title || '未命名游戏').trim() || '未命名游戏'}》的关键帧截图。`,
      '请总结画面风格、镜头视角、HUD/UI 呈现、场景特征、角色或载具动作反馈。'
    ].join('\n'),
    gameTitle: node?.title || '',
    roomMessages: [],
    roomSummary: null,
    memoryEntries: [],
    builtinModel: selectedVisionModel,
    systemDirective: '你是 DpccGaming BluePrint 的视觉理解节点分析器。你会读取游戏关键帧截图，并返回严格 JSON。',
    userContentItems
  });

  const parsed = extractJsonObject(rawReply);
  if (!parsed || typeof parsed !== 'object') {
    return {
      summary: '',
      analysis: '',
      output: String(rawReply || '').trim(),
      rawReply
    };
  }

  return {
    summary: String(parsed.summary || '').trim(),
    analysis: String(parsed.analysis || '').trim(),
    output: typeof parsed.output === 'string'
      ? parsed.output.trim()
      : JSON.stringify(parsed.output || '', null, 2).trim(),
    rawReply
  };
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
  const technicalDirection = sections.language?.output || '优先使用原生 HTML/CSS/JavaScript 直接输出可运行 H5 版本，无外部依赖、无额外构建步骤。';

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
  previousFiles = null,
  rerunInstruction = ''
} = {}) => {
  const title = String(gameSpec.title || 'Blueprint H5 Game').trim() || 'Blueprint H5 Game';
  const htmlSkeleton = buildBlueprintHtmlSkeleton({ title });
  const normalizedRerunInstruction = String(rerunInstruction || '').trim();
  const compactGameSpec = compactBlueprintGameSpec(gameSpec);
  const previousFileSummaries = previousFiles ? summarizeBlueprintPreviousFiles(previousFiles) : [];

  return [
    '你要生成一个可直接浏览器预览的单页 HTML 文档页，优先返回严格 JSON。',
    '目标文件固定为 files.index.html。',
    '要求：单页、原生 HTML/CSS/JS、无第三方依赖、可直接打开 index.html 运行。',
    '默认优先贴近可直接运行的 H5 版本：优先原生 HTML/CSS/JavaScript，不要默认使用 Cocos、TypeScript 或需要额外构建步骤的方案，除非规格或用户说明明确要求。',
    '这是一个结构完整的 HTML 文档页，可以是说明页、展示页、模板页或整理后的内容页，但不能只是空白骨架。',
    '页面必须有清晰的信息结构，例如标题区、正文区、模块区或说明区。',
    'index.html 必须包含 id="app" 的挂载节点。',
    'index.html 必须内嵌完整 <style> 和 <script>，不要依赖外部 css/js 文件。',
    '优先返回格式：{"files":{"index.html":"<!doctype html>..."}}。',
    '如果无法稳定返回 JSON，就直接返回完整的 index.html 源码；不要附加说明、总结或多文件方案。',
    `游戏规格摘要：\n${JSON.stringify(compactGameSpec, null, 2)}`,
    normalizedRerunInstruction
      ? `本次重跑补充说明：\n${normalizedRerunInstruction}\n请把它视为本次输出修订的优先要求，但不要把它写成给用户看的说明文字。`
      : '',
    `HTML 骨架参考：\n${htmlSkeleton}`,
    previousIssues.length
      ? `上一次生成未通过 HTML 页面合同校验，必须修复这些问题：\n- ${previousIssues.join('\n- ')}`
      : '',
    previousFileSummaries.length
      ? `上一次生成的文件摘要如下，请保留可用部分并定向修复：\n${JSON.stringify(previousFileSummaries, null, 2)}`
      : '',
    '返回格式示例：{"files":{"index.html":"<!doctype html>..."}}'
  ].filter(Boolean).join('\n\n');
};

const buildBlueprintPlannedOutputPrompt = ({
  plannedPrompt = '',
  previousIssues = [],
  previousFiles = null
} = {}) => {
  const normalizedPlannedPrompt = String(plannedPrompt || '').trim();
  const title = normalizedPlannedPrompt || 'Blueprint Planned H5 Game';
  const htmlSkeleton = buildBlueprintHtmlSkeleton({ title });
  const previousFileSummaries = previousFiles ? summarizeBlueprintPreviousFiles(previousFiles) : [];

  return [
    '你要直接根据用户原始需求生成一个可直接浏览器预览的单页 HTML 文档页，优先返回严格 JSON。',
    '不要结合任何前置节点分析、规格汇总、世界观拆解或技术建议；只围绕下面这条用户原始需求做最终页面。',
    `用户原始需求：${normalizedPlannedPrompt || '生成一个单页 HTML 文档页'}`,
    '目标文件固定为 files.index.html。',
    '要求：单页、原生 HTML/CSS/JavaScript、无第三方依赖、无额外构建步骤、可直接打开 index.html 运行。',
    '这是一个结构完整的 HTML 文档页，可以是说明页、概览页、模板页或静态展示网页，但不能只是空白占位。',
    '页面必须包含清晰的信息结构和可阅读内容，不要求游戏循环、失败状态或重开逻辑。',
    'index.html 必须包含 id="app" 的挂载节点。',
    'index.html 必须内嵌完整 <style> 和 <script>，不要依赖外部 css/js 文件。',
    '优先返回格式：{"files":{"index.html":"<!doctype html>..."}}。',
    '如果无法稳定返回 JSON，就直接返回完整的 index.html 源码；不要附加解释、总结或多文件输出。',
    `HTML 骨架参考：\n${htmlSkeleton}`,
    previousIssues.length
      ? `上一次生成未通过 HTML 页面合同校验，必须修复这些问题：\n- ${previousIssues.join('\n- ')}`
      : '',
    previousFileSummaries.length
      ? `上一次生成的文件摘要如下，请定向修复并继续保持页面完整性：\n${JSON.stringify(previousFileSummaries, null, 2)}`
      : '',
    '返回格式示例：{"files":{"index.html":"<!doctype html>..."}}'
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
  executionMode = 'default',
  plannedPrompt = '',
  selectedModel = '',
  generateAiReply,
  startedAt = new Date().toISOString(),
  maxRepairAttempts = 3,
  rerunInstruction = '',
  onProgress
} = {}) => {
  const gameSpec = buildBlueprintGameSpec({ step, node, stepResults, stepsById });
  const normalizedExecutionMode = String(executionMode || '').trim().toLowerCase() === 'planned'
    ? 'planned'
    : 'default';
  const normalizedPlannedPrompt = String(plannedPrompt || '').trim();
  const usePlannedPromptDirectly = normalizedExecutionMode === 'planned' && Boolean(normalizedPlannedPrompt);
  const effectiveOutputModel = selectedModel || 'GLM-4.5';
  let attempt = 0;
  let previousFiles = null;
  let previousIssues = [];
  let lastRawReply = '';

  emitBlueprintStepProgress(onProgress, {
    progress: 0.16,
    stage: 'prepare',
    detail: '正在整理上游规格并准备输出文件约束。'
  });

  while (attempt <= maxRepairAttempts) {
    const prompt = usePlannedPromptDirectly
      ? buildBlueprintPlannedOutputPrompt({
        plannedPrompt: normalizedPlannedPrompt,
        previousIssues,
        previousFiles
      })
      : buildBlueprintOutputPrompt({
        gameSpec,
        previousIssues,
        previousFiles,
        rerunInstruction
      });
    emitBlueprintStepProgress(onProgress, {
      progress: 0.52,
      stage: 'generate',
      detail: attempt > 0
        ? `正在根据校验结果修复文件，第 ${attempt} 次重试。`
        : '正在请求模型生成最终输出文件。'
    });
    const rawReply = await generateAiReply({
      prompt,
      builtinModel: effectiveOutputModel,
      gameTitle: usePlannedPromptDirectly ? normalizedPlannedPrompt : (gameSpec.title || ''),
      roomMessages: [],
      roomSummary: null,
      memoryEntries: [],
      systemDirective: '你是 DpccGaming BluePrint 的输出节点执行器。优先返回 {"files":{"index.html":"..."}}；如果无法稳定返回 JSON，则直接返回完整可运行的 index.html 文档页，不要附加额外说明。',
      requestOptions: {
        promptLimit: 12000
      }
    });
    lastRawReply = rawReply;

    emitBlueprintStepProgress(onProgress, {
      progress: 0.84,
      stage: 'parse',
      detail: '模型已返回，正在解析并校验输出文件。'
    });
    const files = extractBlueprintOutputFiles(rawReply);
    const validation = validateBlueprintOutputBundle(files);

    if (validation.ok) {
      const completedAt = new Date().toISOString();
      const artifacts = buildBlueprintOutputArtifacts(files);
      emitBlueprintStepProgress(onProgress, {
        progress: 1,
        stage: 'finalize',
        detail: '输出文件已整理完成并通过 HTML 页面合同校验。'
      });
      const normalized = normalizeBlueprintStepResult({
        summary: '已生成可直接预览的单页 HTML 文档页。',
        analysis: usePlannedPromptDirectly
          ? '输出节点已直接根据 planned 模式原始提示词生成单文件 HTML 页面，并通过页面合同校验。'
          : '输出节点已基于上游规格生成单文件 HTML 页面，并通过页面合同校验。',
        output: REQUIRED_BLUEPRINT_OUTPUT_FILES.join('\n'),
        rawReply,
        input: usePlannedPromptDirectly ? normalizedPlannedPrompt : JSON.stringify(gameSpec, null, 2),
        visibleInputText: usePlannedPromptDirectly
          ? `plannedPrompt:\n${normalizedPlannedPrompt}`
          : JSON.stringify(gameSpec, null, 2),
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
          executionMode: normalizedExecutionMode,
          plannedPrompt: normalizedPlannedPrompt,
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
        model: effectiveOutputModel,
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
  emitBlueprintStepProgress(onProgress, {
    progress: 1,
    stage: 'finalize',
    detail: errorMessage
  });
  const normalized = normalizeBlueprintStepResult({
    rawReply: lastRawReply,
    input: usePlannedPromptDirectly ? normalizedPlannedPrompt : JSON.stringify(gameSpec, null, 2),
    visibleInputText: usePlannedPromptDirectly
      ? `plannedPrompt:\n${normalizedPlannedPrompt}`
      : JSON.stringify(gameSpec, null, 2),
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
      executionMode: normalizedExecutionMode,
      plannedPrompt: normalizedPlannedPrompt,
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
    model: effectiveOutputModel,
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
  onProgress,
  selectedVisionModel = DEFAULT_BLUEPRINT_VISION_MODEL,
  generateAiReply
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

    let visionAnalysis = null;

    if (Array.isArray(node.videoKeyframes) && node.videoKeyframes.length && selectedVisionModel === 'GLM-4.6V') {
      emitBlueprintStepProgress(onProgress, {
        progress: 0.9,
        stage: 'vision',
        detail: `正在使用 ${selectedVisionModel} 分析关键帧画面。`
      });

      visionAnalysis = await analyzeBlueprintSourceVision({
        node,
        selectedVisionModel,
        generateAiReply
      });
    }

    const sourceOutput = createBlueprintSourceStepOutput({
      ...node,
      visionAnalysis
    });
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
        visionModel: selectedVisionModel,
        visionAnalysis,
        videoKeyframes: Array.isArray(node.videoKeyframes) ? node.videoKeyframes : [],
        videoKeyframeNote: String(node.videoKeyframeNote || '')
      }
    }, node);

    return buildBlueprintStepRuntime({
      step,
      normalized,
      model: selectedVisionModel,
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
      model: selectedVisionModel,
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
  rerunInstruction = '',
  onProgress
} = {}) => {
  try {
    const effectiveModel = selectedModel || DEFAULT_BLUEPRINT_EXECUTION_MODEL;
    emitBlueprintStepProgress(onProgress, {
      progress: 0.16,
      stage: 'prepare',
      detail: '正在整理当前节点可见的上游输入。'
    });
    const preparedPrompt = buildBlueprintNodePrompt({
      step,
      stepResults,
      stepsById,
      rerunInstruction
    });
    emitBlueprintStepProgress(onProgress, {
      progress: 0.52,
      stage: 'generate',
      detail: '正在请求模型分析当前节点。'
    });
    const rawReply = await generateAiReply({
      prompt: preparedPrompt.prompt,
      builtinModel: effectiveModel,
      gameTitle: resolveBlueprintGameTitle({
        step,
        stepResults,
        stepsById
      }),
      roomMessages: [],
      roomSummary: null,
      memoryEntries: [],
      systemDirective: preparedPrompt.systemDirective,
      requestOptions: {
        promptLimit: 12000
      }
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
      model: effectiveModel,
      status: 'completed',
      startedAt,
      completedAt,
      handlerType: 'ai-domain'
    });
  } catch (error) {
    const preparedPrompt = buildBlueprintNodePrompt({
      step,
      stepResults,
      stepsById,
      rerunInstruction
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
      model: effectiveModel,
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
  executeBlueprintNodeStep,
  __test: {
    buildBlueprintOutputPrompt,
    buildBlueprintPlannedOutputPrompt,
    extractBlueprintOutputFiles,
    summarizeBlueprintPreviousFiles,
    compactBlueprintGameSpec
  }
};
