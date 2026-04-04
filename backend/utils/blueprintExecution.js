const MAX_STEP_SUMMARY_LENGTH = 80;
const MAX_STEP_ANALYSIS_LENGTH = 80;
const MAX_STEP_OUTPUT_LENGTH = 80;
const MAX_STEP_VISIBLE_INPUT_LENGTH = 2200;

const BLUEPRINT_NODE_EXECUTION_GUIDE = {
  design: '提炼游戏世界观、核心设定、题材和风格约束。',
  play: '围绕可玩的核心循环、目标、反馈和操作方式给出玩法方案。',
  visual: '整理视觉风格、色彩、镜头、材质、氛围和参考方向。',
  language: '明确建议使用的游戏编程语言，并说明原因、适配引擎和开发取舍。',
  character: '分析角色职能、阵营、能力、冲突关系和辨识度。',
  ui: '整理界面结构、HUD、交互层级、关键反馈和信息优先级。',
  level: '规划章节推进、地图节奏、关卡目标和流程节点。',
  progression: '定义等级、技能、装备、成长曲线和长期驱动。',
  economy: '定义货币、掉落、商店、奖励和资源循环。',
  narrative: '整理故事背景、事件推进、角色动机和叙事节奏。',
  music: '描述音乐风格、配器、情绪、节奏和使用场景。',
  mixer: '将多个上游节点结果重新梳理、去重并形成可继续传递的中间结论。',
  'prompt-positive': '整理需要强化和保留的正向创作要求。',
  'prompt-negative': '整理需要规避和限制的负向要求。',
  output: '把上游结果整合成最终可执行的方案或最终 Prompt。'
};

const serializeBlueprintTextValue = (value = '') => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  try {
    return JSON.stringify(value, null, 2).trim();
  } catch {
    return String(value).trim();
  }
};

const safeText = (value = '', maxLength = 0) => {
  const text = serializeBlueprintTextValue(value);
  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const decodeEscapedBlockText = (value = '') => {
  const text = String(value || '');
  if (!text.includes('\\n') && !text.includes('\\t') && !text.includes('\\"')) {
    return text;
  }

  return text
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"');
};

const stripBlueprintMarkdownLine = (value = '') => String(value || '')
  .replace(/^#{1,6}\s*/g, '')
  .replace(/^>\s*/g, '')
  .replace(/^[-*•]+\s+/g, '')
  .replace(/^\d+[.)]\s+/g, '')
  .replace(/^\s*(summary|analysis|output|input|result|process)\s*[:：-]?\s*/i, '')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/__(.*?)__/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/^\s*[-=_]{3,}\s*$/g, '')
  .trim();

const sanitizeBlueprintPlainText = (value = '', fallback = '') => {
  const text = decodeEscapedBlockText(value)
    .replace(/```(?:json)?/gi, '')
    .replace(/\r/g, '')
    .trim();

  if (!text) return String(fallback || '').trim();
  if (/^\s*[{[]+\s*$/.test(text)) return String(fallback || '').trim();
  if (/^\s*[}\]]+\s*$/.test(text)) return String(fallback || '').trim();

  const collapsed = text
    .split('\n')
    .map((line) => stripBlueprintMarkdownLine(line))
    .filter((line) => line && !/^[{}\[\],]+$/.test(line))
    .join('\n')
    .trim();

  if (!collapsed) return String(fallback || '').trim();
  return collapsed;
};

const extractJsonObject = (raw = '') => {
  const rawText = String(raw || '')
    .replace(/```(?:json)?/gi, '')
    .replace(/\r/g, '')
    .trim();
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    // continue
  }

  const text = decodeEscapedBlockText(rawText);

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

const formatGameNodeOutput = (node = {}) => [
  `游戏名称：${safeText(node.title || '未命名游戏', 80)}`,
  node.categoryLabel ? `游戏类型：${safeText(node.categoryLabel, 40)}` : '',
  node.engineLabel ? `推荐引擎：${safeText(node.engineLabel, 40)}` : '',
  node.codeTypeLabel ? `当前代码语言：${safeText(node.codeTypeLabel, 40)}` : '',
  node.description ? `游戏简介：${safeText(node.description, 280)}` : '',
  node.coverUrl ? `封面资源：${safeText(node.coverUrl, 240)}` : '',
  node.videoUrl ? `视频资源：${safeText(node.videoUrl, 240)}` : '',
  Array.isArray(node.videoKeyframes) && node.videoKeyframes.length
    ? `视频关键帧：\n${node.videoKeyframes.map((frame, index) => `${index + 1}. ${safeText(frame.url || frame.fileName || '', 240)}`).join('\n')}`
    : '',
  node.videoKeyframeNote ? `关键帧提取：${safeText(node.videoKeyframeNote, 240)}` : '',
  node.codeSummary ? `代码摘要：${safeText(node.codeSummary, 320)}` : '',
  node.codeEntryPath ? `代码入口：${safeText(node.codeEntryPath, 180)}` : '',
  node.codePackageUrl ? `代码包：${safeText(node.codePackageUrl, 240)}` : '',
  node.codeSnippet ? `代码片段：\n${safeText(node.codeSnippet, 900)}` : '',
  node.visionAnalysis?.summary ? `画面视觉理解：${safeText(node.visionAnalysis.summary, 240)}` : '',
  node.visionAnalysis?.analysis ? `视觉推断：${safeText(node.visionAnalysis.analysis, 420)}` : '',
  node.visionAnalysis?.output ? `视觉重点：\n${safeText(node.visionAnalysis.output, 900)}` : ''
].filter(Boolean).join('\n');

const normalizeWorkflow = (workflow = {}) => ({
  nodes: Array.isArray(workflow?.nodes) ? workflow.nodes : [],
  edges: Array.isArray(workflow?.edges) ? workflow.edges : []
});

const buildBlueprintExecutionPlan = (workflow = {}) => {
  const normalized = normalizeWorkflow(workflow);
  const nodes = normalized.nodes.filter((node) => node?.id && node?.isGeneratedPlayable !== true);
  const edges = normalized.edges.filter((edge) => edge?.fromNodeId && edge?.toNodeId);
  const nodesById = {};
  const inputEdges = {};
  const outputEdges = {};
  const inDegree = {};
  const nodeOrderIndex = {};

  nodes.forEach((node, index) => {
    nodesById[node.id] = node;
    inputEdges[node.id] = [];
    outputEdges[node.id] = [];
    inDegree[node.id] = 0;
    nodeOrderIndex[node.id] = index;
  });

  edges.forEach((edge) => {
    if (!nodesById[edge.fromNodeId] || !nodesById[edge.toNodeId]) return;
    inputEdges[edge.toNodeId].push(edge.fromNodeId);
    outputEdges[edge.fromNodeId].push(edge.toNodeId);
    inDegree[edge.toNodeId] += 1;
  });

  const pending = nodes
    .filter((node) => inDegree[node.id] === 0)
    .sort((left, right) => nodeOrderIndex[left.id] - nodeOrderIndex[right.id]);
  const orderedNodes = [];

  while (pending.length) {
    const current = pending.shift();
    orderedNodes.push(current);

    outputEdges[current.id].forEach((targetNodeId) => {
      inDegree[targetNodeId] -= 1;
      if (inDegree[targetNodeId] === 0) {
        pending.push(nodesById[targetNodeId]);
        pending.sort((left, right) => nodeOrderIndex[left.id] - nodeOrderIndex[right.id]);
      }
    });
  }

  if (orderedNodes.length !== nodes.length) {
    throw new Error('蓝图存在循环连线，当前无法自动顺序执行。');
  }

  const stepsById = {};
  const order = orderedNodes.map((node) => {
    const mode = node.kind === 'game' ? 'source' : 'ai';
    const step = {
      nodeId: node.id,
      kind: node.kind,
      title: safeText(node.title || node.kind || '未命名节点', 80),
      mode,
      upstreamNodeIds: inputEdges[node.id],
      downstreamNodeIds: outputEdges[node.id],
      instruction: safeText(node.content || '', 800)
    };
    stepsById[node.id] = {
      ...step,
      node
    };
    return step;
  });

  return {
    order,
    stepsById
  };
};

const collectBlueprintDescendants = (stepsById = {}, startNodeId = '') => {
  const visited = new Set();
  const pending = [startNodeId];

  while (pending.length) {
    const currentNodeId = pending.shift();
    if (!currentNodeId || visited.has(currentNodeId) || !stepsById[currentNodeId]) continue;
    visited.add(currentNodeId);
    (stepsById[currentNodeId].downstreamNodeIds || []).forEach((nodeId) => {
      if (!visited.has(nodeId)) pending.push(nodeId);
    });
  }

  return visited;
};

const selectBlueprintExecutionSteps = (plan = {}, options = {}) => {
  const order = Array.isArray(plan?.order) ? plan.order : [];
  const stepsById = plan?.stepsById || {};
  const startNodeId = String(options?.startNodeId || '').trim();
  const scope = String(options?.scope || 'all').trim();

  if (!startNodeId) return order;
  if (!stepsById[startNodeId]) {
    throw new Error('指定的起始节点不存在，无法继续执行。');
  }

  if (scope === 'single') {
    return order.filter((step) => step.nodeId === startNodeId);
  }

  const descendants = collectBlueprintDescendants(stepsById, startNodeId);
  return order.filter((step) => descendants.has(step.nodeId));
};

const createBlueprintSourceStepOutput = (node = {}) => {
  const output = formatGameNodeOutput(node);
  const hasVisionAnalysis = Boolean(
    String(node?.visionAnalysis?.summary || '').trim()
    || String(node?.visionAnalysis?.analysis || '').trim()
    || String(node?.visionAnalysis?.output || '').trim()
  );
  return {
    summary: hasVisionAnalysis
      ? `已读取《${safeText(node.title || '未命名游戏', 60)}》的基础元信息，并完成关键帧视觉理解。`
      : `已读取《${safeText(node.title || '未命名游戏', 60)}》的基础元信息。`,
    analysis: hasVisionAnalysis
      ? '该节点作为源节点提供游戏标题、类型、引擎、代码语言、简介，以及可用的封面/视频/代码摘要与代码片段信息；同时已基于关键帧补充画面风格、HUD/UI 与场景节奏的视觉理解，供后续 AI 节点继续分析。'
      : '该节点作为源节点提供游戏标题、类型、引擎、代码语言、简介，以及可用的封面/视频/代码摘要与代码片段信息，供后续 AI 节点继续分析。',
    output
  };
};

const formatUpstreamResults = (step = {}, stepResults = {}, stepsById = {}) =>
  (step.upstreamNodeIds || [])
    .map((nodeId) => {
      const runtime = stepResults[nodeId];
      const upstreamStep = stepsById[nodeId];
      if (!runtime || !upstreamStep) return '';
      return [
        `【${upstreamStep.title}】`,
        runtime.summary ? `摘要：${safeText(runtime.summary, 100)}` : '',
        runtime.output ? `输出：${safeText(runtime.output, 100)}` : ''
      ].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');

const collectBlueprintUpstreamNodeIds = (stepsById = {}, startNodeIds = []) => {
  const visited = new Set();
  const pending = Array.isArray(startNodeIds) ? [...startNodeIds] : [];

  while (pending.length) {
    const currentNodeId = pending.shift();
    if (!currentNodeId || visited.has(currentNodeId) || !stepsById[currentNodeId]) continue;
    visited.add(currentNodeId);
    (stepsById[currentNodeId].upstreamNodeIds || []).forEach((nodeId) => {
      if (!visited.has(nodeId)) pending.push(nodeId);
    });
  }

  return visited;
};

const buildBlueprintNodePrompt = ({
  step,
  stepResults = {},
  stepsById = {},
  rerunInstruction = ''
}) => {
  const node = step?.node || {};
  const upstreamText = formatUpstreamResults(step, stepResults, stepsById);
  const reachableUpstreamNodeIds = collectBlueprintUpstreamNodeIds(stepsById, step?.upstreamNodeIds || []);
  const sourceContext = Object.entries(stepResults)
    .filter(([nodeId, runtime]) => reachableUpstreamNodeIds.has(nodeId) && runtime?.kind === 'game')
    .map(([, runtime]) => runtime.visibleInputText || runtime.output)
    .filter(Boolean)
    .join('\n\n');
  const nodeGoal = BLUEPRINT_NODE_EXECUTION_GUIDE[node.kind] || '根据当前节点名称和上游结果，整理出可供下游继续使用的结构化结论。';
  const instruction = safeText(node.content || '', 1200);
  const normalizedRerunInstruction = safeText(rerunInstruction || '', 1200);
  const visibleInput = [
    sourceContext ? `游戏上下文：\n${sourceContext}` : '',
    upstreamText ? `可见上游结果：\n${upstreamText}` : '',
    instruction ? `当前节点原始要求：\n${instruction}` : '当前节点原始要求：未填写，请按节点类型合理补全。',
    normalizedRerunInstruction ? `本次重跑补充说明：\n${normalizedRerunInstruction}` : ''
  ].filter(Boolean).join('\n\n');
  const prompt = [
    `你正在自动执行 DpccGaming BluePrint 的节点：「${safeText(step.title, 60)}」。`,
    `节点类型：${safeText(node.kind, 30)}。`,
    `节点职责：${nodeGoal}`,
    visibleInput,
    normalizedRerunInstruction
      ? '这是本次重跑时用户追加的临时修改要求。请在保留上游约束的前提下，优先按这条补充说明调整当前节点输出，但不要把它当成长期固定节点内容。'
      : '',
    '请先提炼你从上游拿到了什么，再分析当前节点应该产出什么，最后给出可供下游继续使用的结果。',
    '所有字段都要用干净自然语言表达，不要保留 JSON 片段、字段名、代码围栏、列表前缀或多余符号。',
    '最终文本必须以简体中文为主，不要输出英文小标题，不要输出 Markdown 标题、星号、井号、项目符号、反引号或其他装饰性符号。',
    '如果当前节点会影响最终产物，请明确服务于“生成可直接玩的浏览器 H5 游戏”，避免输出停留在概念层。',
    '必须返回严格 JSON 对象，不要加 Markdown 代码块。字段只能是 summary、analysis、output。',
    'summary、analysis、output 都必须简洁精悍，每项尽量控制在 80 字以内。',
    'summary 用 1 句话概括本节点完成了什么；analysis 用 1 到 2 句解释判断依据；output 输出该节点最终结论，且 output 必须是可继续给下游消费的纯文本。'
  ].join('\n\n');

  return {
    visibleInput,
    prompt,
    systemDirective: '你是 DpccGaming BluePrint 的节点执行器。你会按顺序读取上游节点输出，完成当前节点分析，并返回严格 JSON。禁止输出额外解释、标题或代码块。'
  };
};

const normalizeBlueprintStepResult = (payload = {}, node = {}) => {
  const normalizedPayload = typeof payload === 'string'
    ? { rawReply: payload }
    : (payload || {});
  const rawReply = serializeBlueprintTextValue(normalizedPayload.rawReply || '');
  const parsed = extractJsonObject(rawReply);
  const fallbackSummary = sanitizeBlueprintPlainText(rawReply, `${safeText(node.title || '当前节点', 40)}已完成。`);
  const fallbackOutput = sanitizeBlueprintPlainText(rawReply, safeText(node.content || '', 400));
  const summary = safeText(
    sanitizeBlueprintPlainText(
      normalizedPayload.summary || parsed?.summary || fallbackSummary || `${safeText(node.title || '当前节点', 40)}已完成。`,
      `${safeText(node.title || '当前节点', 40)}已完成。`
    ),
    MAX_STEP_SUMMARY_LENGTH
  );
  const analysis = safeText(
    sanitizeBlueprintPlainText(
      normalizedPayload.analysis || parsed?.analysis || '模型未返回结构化分析，已使用原始回复兜底。',
      '模型未返回结构化分析，已使用原始回复兜底。'
    ),
    MAX_STEP_ANALYSIS_LENGTH
  );
  const output = safeText(
    sanitizeBlueprintPlainText(
      normalizedPayload.output || parsed?.output || fallbackOutput || safeText(node.content || '', 400),
      safeText(node.content || '', 400)
    ),
    MAX_STEP_OUTPUT_LENGTH
  );
  const visibleInputText = safeText(
    normalizedPayload.visibleInputText || normalizedPayload.input || '',
    MAX_STEP_VISIBLE_INPUT_LENGTH
  );
  const input = safeText(
    normalizedPayload.input || visibleInputText,
    MAX_STEP_VISIBLE_INPUT_LENGTH
  );
  const retryCount = Number.isFinite(Number(normalizedPayload.retryCount))
    ? Number(normalizedPayload.retryCount)
    : 0;
  const artifactType = String(
    normalizedPayload.artifactType || (normalizedPayload.mode === 'source' ? 'source-context' : 'ai-result')
  );
  const artifactJson = normalizedPayload.artifactJson || {
    type: artifactType,
    nodeId: normalizedPayload.nodeId || node.id || '',
    nodeTitle: normalizedPayload.nodeTitle || node.title || '',
    nodeKind: normalizedPayload.nodeKind || node.kind || '',
    mode: normalizedPayload.mode || '',
    status: normalizedPayload.status || 'completed',
    summary,
    analysis,
    output,
    rawReply,
    input,
    visibleInputText,
    retryCount,
    errorMessage: normalizedPayload.errorMessage || ''
  };
  const artifacts = Array.isArray(normalizedPayload.artifacts) && normalizedPayload.artifacts.length > 0
    ? normalizedPayload.artifacts
    : Array.isArray(normalizedPayload.artifactsJson) && normalizedPayload.artifactsJson.length > 0
      ? normalizedPayload.artifactsJson
      : [artifactJson];

  return {
    input,
    visibleInputText,
    summary,
    analysis,
    output,
    rawReply,
    artifactType,
    artifactJson,
    artifacts,
    artifactsJson: artifacts,
    retryCount,
    status: normalizedPayload.status || 'completed',
    errorMessage: normalizedPayload.errorMessage || ''
  };
};

module.exports = {
  buildBlueprintExecutionPlan,
  selectBlueprintExecutionSteps,
  collectBlueprintUpstreamNodeIds,
  createBlueprintSourceStepOutput,
  buildBlueprintNodePrompt,
  normalizeBlueprintStepResult,
  __test: {
    BLUEPRINT_NODE_EXECUTION_GUIDE
  }
};
