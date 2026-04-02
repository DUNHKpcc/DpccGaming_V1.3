const BP_GRID_SIZE = 34;
const BP_PLANNER_WORLD_CENTER = {
  x: 2400,
  y: 1600
};
const BP_PLANNER_LAYOUT = {
  compactWidth: 264,
  compactHeight: 136,
  gameWidth: 238,
  gameHeight: 212,
  columnGap: 408,
  rowGap: 238
};
const BLUEPRINT_PLANNER_GAME_PLACEHOLDERS = {
  coverUrl: '/GameImg.jpg',
  categoryLabel: '动作',
  engineLabel: 'Cocos',
  codeTypeLabel: 'TypeScript'
};

const BLUEPRINT_PLANNER_NODE_CATALOG = [
  { kind: 'game', title: '游戏节点', subtitle: 'Game Source', responsibility: '引用已有游戏素材与上下文，作为工作流源节点。' },
  { kind: 'prompt-positive', title: '正向提示词', subtitle: 'Structured Prompt', responsibility: '整理需要强化和保留的正向创作要求。' },
  { kind: 'prompt-negative', title: '反向提示词', subtitle: 'Negative Prompt', responsibility: '整理需要规避和限制的负向要求。' },
  { kind: 'mixer', title: 'Mixer', subtitle: 'Context Mixer', responsibility: '将多个上游节点结果重新梳理并形成可继续传递的中间结论。' },
  { kind: 'visual', title: '视觉风格', subtitle: 'Visual Direction', responsibility: '整理视觉风格、色彩、镜头、材质、氛围和参考方向。' },
  { kind: 'language', title: '编程语言要求', subtitle: 'Code Language', responsibility: '明确编程语言、技术栈和开发取舍。' },
  { kind: 'design', title: '游戏设定', subtitle: 'Game Design', responsibility: '提炼世界观、核心设定、题材和风格约束。' },
  { kind: 'play', title: '游戏玩法', subtitle: 'Gameplay Loop', responsibility: '围绕核心循环、目标、反馈和操作方式给出玩法方案。' },
  { kind: 'character', title: '角色设定', subtitle: 'Character Cast', responsibility: '分析角色职能、阵营、能力和辨识度。' },
  { kind: 'ui', title: 'UI/HUD', subtitle: 'Interface Flow', responsibility: '整理界面结构、HUD 和交互层级。' },
  { kind: 'level', title: '关卡流程', subtitle: 'Level Flow', responsibility: '规划关卡推进、地图节奏和流程节点。' },
  { kind: 'progression', title: '数值成长', subtitle: 'Progression Curve', responsibility: '定义等级、技能、装备与成长曲线。' },
  { kind: 'economy', title: '经济奖励', subtitle: 'Economy Loop', responsibility: '定义货币、掉落、商店和资源循环。' },
  { kind: 'narrative', title: '剧情叙事', subtitle: 'Narrative Arc', responsibility: '整理剧情背景、事件推进和叙事节奏。' },
  { kind: 'music', title: '游戏音乐', subtitle: 'Game Music', responsibility: '描述音乐风格、配器、情绪和使用场景。' },
  { kind: 'output', title: '输出节点', subtitle: 'Prompt Output', responsibility: '把上游结果整合成最终可执行方案或最终 Prompt。' }
];

const ALLOWED_BLUEPRINT_NODE_KINDS = new Set(BLUEPRINT_PLANNER_NODE_CATALOG.map((entry) => entry.kind));
const BLUEPRINT_PLANNER_NODE_META_BY_KIND = new Map(
  BLUEPRINT_PLANNER_NODE_CATALOG.map((entry) => [entry.kind, entry])
);

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const snapValueToGrid = (value, gridSize = BP_GRID_SIZE) =>
  Math.round(Number(value || 0) / gridSize) * gridSize;

const snapPointToGrid = (point = {}) => ({
  x: snapValueToGrid(point.x),
  y: snapValueToGrid(point.y)
});

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

const normalizeText = (value = '') => String(value || '').trim();

const sanitizePlannerContent = (value = '') => {
  const text = String(value || '')
    .replace(/```(?:json)?/gi, '')
    .replace(/\r/g, '')
    .trim();

  if (!text) return '';
  if (/^[{[]+\s*$/.test(text)) return '';
  if (/^[}\]]+\s*$/.test(text)) return '';

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^[{}\[\],]+$/.test(line))
    .join('\n')
    .trim();
};

const ensureNodeId = (node = {}, index = 0) => {
  const rawId = normalizeText(node.id);
  if (rawId) return rawId;
  return `bp-plan-${Date.now().toString(36)}-${index + 1}`;
};

const resolveFallbackPosition = (existingNodeMap = new Map(), nodeId = '', index = 0) => {
  const existingNode = existingNodeMap.get(nodeId);
  if (existingNode?.position && Number.isFinite(Number(existingNode.position.x)) && Number.isFinite(Number(existingNode.position.y))) {
    return snapPointToGrid(existingNode.position);
  }

  return snapPointToGrid({
    x: 136 + (index % 4) * 340,
    y: 136 + Math.floor(index / 4) * 204
  });
};

const normalizePlannedNode = (node = {}, index = 0, existingNodeMap = new Map()) => {
  const kind = normalizeText(node.kind);
  if (!ALLOWED_BLUEPRINT_NODE_KINDS.has(kind)) {
    throw createHttpError(400, `不支持的节点类型：${kind || 'unknown'}`);
  }

  const nodeId = ensureNodeId(node, index);
  const existingNode = existingNodeMap.get(nodeId) || {};
  const position = Number.isFinite(Number(node?.position?.x)) && Number.isFinite(Number(node?.position?.y))
    ? snapPointToGrid(node.position)
    : resolveFallbackPosition(existingNodeMap, nodeId, index);

  const normalizedNode = {
    ...node,
    id: nodeId,
    kind,
    title: normalizeText(node.title),
    content: sanitizePlannerContent(
      typeof node.content === 'string' ? node.content : normalizeText(node.content)
    ),
    position
  };

  if (kind === 'game') {
    normalizedNode.coverUrl = normalizeText(node.coverUrl || existingNode.coverUrl)
      || BLUEPRINT_PLANNER_GAME_PLACEHOLDERS.coverUrl;
    normalizedNode.categoryLabel = normalizeText(
      node.categoryLabel || node.category || existingNode.categoryLabel || existingNode.category
    ) || BLUEPRINT_PLANNER_GAME_PLACEHOLDERS.categoryLabel;
    normalizedNode.engineLabel = normalizeText(
      node.engineLabel || node.engine || existingNode.engineLabel || existingNode.engine || existingNode.game_engine
    ) || BLUEPRINT_PLANNER_GAME_PLACEHOLDERS.engineLabel;
    normalizedNode.codeTypeLabel = normalizeText(
      node.codeTypeLabel
      || node.codeType
      || node.code_type
      || existingNode.codeTypeLabel
      || existingNode.codeType
      || existingNode.code_type
    ) || BLUEPRINT_PLANNER_GAME_PLACEHOLDERS.codeTypeLabel;
  }

  return normalizedNode;
};

const normalizePlannedEdge = (edge = {}, index = 0) => ({
  id: normalizeText(edge.id) || `bp-plan-edge-${index + 1}`,
  fromNodeId: normalizeText(edge.fromNodeId),
  toNodeId: normalizeText(edge.toNodeId)
});

const normalizeWorkflowShape = (workflow = {}) => ({
  nodes: Array.isArray(workflow?.nodes) ? workflow.nodes : [],
  edges: Array.isArray(workflow?.edges) ? workflow.edges : []
});

const getPlannerNodeSize = (node = {}) =>
  String(node?.kind || '').trim() === 'game'
    ? {
        width: BP_PLANNER_LAYOUT.gameWidth,
        height: BP_PLANNER_LAYOUT.gameHeight
      }
    : {
        width: BP_PLANNER_LAYOUT.compactWidth,
        height: BP_PLANNER_LAYOUT.compactHeight
      };

const computeWorkflowBounds = (nodes = []) => {
  if (!Array.isArray(nodes) || !nodes.length) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  nodes.forEach((node) => {
    const size = getPlannerNodeSize(node);
    const x = Number(node?.position?.x) || 0;
    const y = Number(node?.position?.y) || 0;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + size.width);
    maxY = Math.max(maxY, y + size.height);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  };
};

const shouldRelayoutPlannedNodes = (nodes = []) => {
  if (!Array.isArray(nodes) || nodes.length < 2) return false;

  const bounds = computeWorkflowBounds(nodes);
  if (!bounds) return true;

  const minimumExpectedWidth = Math.min(
    BP_PLANNER_LAYOUT.columnGap * Math.max(nodes.length - 1, 1),
    BP_PLANNER_LAYOUT.columnGap * 3
  );
  if (bounds.width < minimumExpectedWidth) {
    return true;
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const current = nodes[index];
    const currentSize = getPlannerNodeSize(current);

    for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
      const other = nodes[otherIndex];
      const otherSize = getPlannerNodeSize(other);
      const deltaX = Math.abs((Number(current?.position?.x) || 0) - (Number(other?.position?.x) || 0));
      const deltaY = Math.abs((Number(current?.position?.y) || 0) - (Number(other?.position?.y) || 0));
      const minGapX = Math.min(currentSize.width, otherSize.width) * 0.72;
      const minGapY = Math.min(currentSize.height, otherSize.height) * 0.82;

      if (deltaX < minGapX && deltaY < minGapY) {
        return true;
      }
    }
  }

  return false;
};

const buildNodeDepthMap = (nodes = [], edges = []) => {
  const nodeIds = nodes.map((node) => node.id);
  const inDegree = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
  const children = new Map(nodeIds.map((nodeId) => [nodeId, []]));

  edges.forEach((edge) => {
    if (!inDegree.has(edge.fromNodeId) || !inDegree.has(edge.toNodeId)) return;
    children.get(edge.fromNodeId).push(edge.toNodeId);
    inDegree.set(edge.toNodeId, Number(inDegree.get(edge.toNodeId) || 0) + 1);
  });

  const pending = nodes
    .filter((node) => Number(inDegree.get(node.id) || 0) === 0)
    .map((node) => node.id);
  const depthMap = new Map(nodeIds.map((nodeId) => [nodeId, 0]));

  while (pending.length) {
    const currentNodeId = pending.shift();
    const currentDepth = Number(depthMap.get(currentNodeId) || 0);

    (children.get(currentNodeId) || []).forEach((childNodeId) => {
      depthMap.set(
        childNodeId,
        Math.max(Number(depthMap.get(childNodeId) || 0), currentDepth + 1)
      );
      inDegree.set(childNodeId, Number(inDegree.get(childNodeId) || 0) - 1);
      if (Number(inDegree.get(childNodeId) || 0) === 0) {
        pending.push(childNodeId);
      }
    });
  }

  return depthMap;
};

const relayoutPlannedNodes = (nodes = [], edges = []) => {
  if (!Array.isArray(nodes) || nodes.length < 2) {
    return nodes;
  }

  const depthMap = buildNodeDepthMap(nodes, edges);
  const layers = new Map();

  nodes.forEach((node, index) => {
    const depth = Number(depthMap.get(node.id) || 0);
    const bucket = layers.get(depth) || [];
    bucket.push({ node, index });
    layers.set(depth, bucket);
  });

  const layerKeys = [...layers.keys()].sort((left, right) => left - right);
  const totalWidth = (Math.max(layerKeys.length - 1, 0) * BP_PLANNER_LAYOUT.columnGap) + BP_PLANNER_LAYOUT.gameWidth;
  const originX = BP_PLANNER_WORLD_CENTER.x - totalWidth / 2;
  const nextNodes = [...nodes];

  layerKeys.forEach((layerKey, columnIndex) => {
    const entries = layers.get(layerKey) || [];
    const totalHeight = (Math.max(entries.length - 1, 0) * BP_PLANNER_LAYOUT.rowGap) + BP_PLANNER_LAYOUT.compactHeight;
    const originY = BP_PLANNER_WORLD_CENTER.y - totalHeight / 2;

    entries.forEach(({ node, index }, rowIndex) => {
      const size = getPlannerNodeSize(node);
      const x = snapValueToGrid(originX + columnIndex * BP_PLANNER_LAYOUT.columnGap);
      const y = snapValueToGrid(originY + rowIndex * BP_PLANNER_LAYOUT.rowGap + (BP_PLANNER_LAYOUT.compactHeight - size.height) / 2);

      nextNodes[index] = {
        ...node,
        position: {
          x,
          y
        }
      };
    });
  });

  return nextNodes;
};

const escapeRegExp = (value = '') =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildPlannerNodeKindMatchers = () =>
  BLUEPRINT_PLANNER_NODE_CATALOG.map((entry) => {
    const aliases = [
      entry.kind,
      entry.title,
      entry.subtitle
    ]
      .map((value) => normalizeText(value))
      .filter(Boolean);

    return {
      kind: entry.kind,
      matcher: new RegExp(aliases.map((value) => escapeRegExp(value)).join('|'), 'ig')
    };
  });

const BLUEPRINT_PLANNER_NODE_KIND_MATCHERS = buildPlannerNodeKindMatchers();

const collectMentionedPlannerKinds = (parsed = {}, rawReply = '') => {
  const rankedKinds = new Map();
  const pushKindsFromText = (text = '', baseWeight = 0) => {
    const normalizedText = String(text || '');
    if (!normalizedText.trim()) return;

    BLUEPRINT_PLANNER_NODE_KIND_MATCHERS.forEach(({ kind, matcher }) => {
      matcher.lastIndex = 0;
      const match = matcher.exec(normalizedText);
      if (match === null) return;

      const currentRank = rankedKinds.get(kind);
      const nextRank = baseWeight + match.index;
      if (typeof currentRank === 'number' && currentRank <= nextRank) return;
      rankedKinds.set(kind, nextRank);
    });
  };

  const changes = Array.isArray(parsed?.changes) ? parsed.changes : [];
  changes.forEach((item, index) => {
    pushKindsFromText(item, index * 1000);
  });

  pushKindsFromText(parsed?.summary, changes.length * 1000 + 200);
  pushKindsFromText(rawReply, changes.length * 1000 + 400);

  return [...rankedKinds.entries()]
    .sort((left, right) => left[1] - right[1])
    .map(([kind]) => kind);
};

const createFallbackPlannedNode = (kind = '', existingNode = null) => {
  const normalizedKind = normalizeText(kind);
  const meta = BLUEPRINT_PLANNER_NODE_META_BY_KIND.get(normalizedKind) || null;
  if (!meta) return null;

  if (existingNode && typeof existingNode === 'object') {
    return {
      ...existingNode,
      kind: normalizedKind,
      title: normalizeText(existingNode.title) || meta.title
    };
  }

  return {
    kind: normalizedKind,
    title: meta.title,
    subtitle: meta.subtitle,
    content: ''
  };
};

const mergeMentionedNodesIntoWorkflow = (plannedWorkflow = {}, parsed = {}, existingWorkflow = {}, rawReply = '') => {
  const normalizedPlannedWorkflow = normalizeWorkflowShape(plannedWorkflow);
  const normalizedExistingWorkflow = normalizeWorkflowShape(existingWorkflow);
  const plannedNodes = [...normalizedPlannedWorkflow.nodes];
  const plannedKinds = new Set(
    plannedNodes.map((node) => normalizeText(node?.kind)).filter(Boolean)
  );
  const existingNodeByKind = new Map();

  normalizedExistingWorkflow.nodes.forEach((node) => {
    const kind = normalizeText(node?.kind);
    if (!kind || existingNodeByKind.has(kind)) return;
    existingNodeByKind.set(kind, node);
  });

  collectMentionedPlannerKinds(parsed, rawReply).forEach((kind) => {
    if (plannedKinds.has(kind)) return;
    if (kind === 'game' && !existingNodeByKind.has(kind)) return;

    const fallbackNode = createFallbackPlannedNode(kind, existingNodeByKind.get(kind) || null);
    if (!fallbackNode) return;
    plannedNodes.push(fallbackNode);
    plannedKinds.add(kind);
  });

  return {
    nodes: plannedNodes,
    edges: normalizedPlannedWorkflow.edges
  };
};

const extractWorkflowCandidate = (payload = {}) => {
  if (!payload || typeof payload !== 'object') {
    return normalizeWorkflowShape();
  }

  if (payload.workflow && typeof payload.workflow === 'object') {
    const workflowCandidate = normalizeWorkflowShape(payload.workflow);
    if (workflowCandidate.nodes.length || workflowCandidate.edges.length) {
      return workflowCandidate;
    }
  }

  if (payload.graph && typeof payload.graph === 'object') {
    const graphCandidate = normalizeWorkflowShape(payload.graph);
    if (graphCandidate.nodes.length || graphCandidate.edges.length) {
      return graphCandidate;
    }
  }

  return normalizeWorkflowShape(payload);
};

const resolveBlueprintPlannerModel = (requestedModel = '') => {
  const normalizedModel = normalizeText(requestedModel);

  if (
    normalizedModel === 'DouBaoSeed'
    || normalizedModel === 'GLM-4.5'
    || normalizedModel === 'Qwen3-CodeMax'
  ) {
    return normalizedModel;
  }

  return 'DouBaoSeed';
};

const buildBlueprintPlannerNodeCatalog = () =>
  BLUEPRINT_PLANNER_NODE_CATALOG.map((entry) => ({ ...entry }));

const buildBlueprintPlanningPrompt = ({
  prompt = '',
  workflow = {},
  availableNodes = [],
  seed = ''
} = {}) => {
  const normalizedWorkflow = normalizeWorkflowShape(workflow);
  const plannerNodes = Array.isArray(availableNodes) && availableNodes.length
    ? availableNodes
    : buildBlueprintPlannerNodeCatalog();

  return {
    systemDirective: [
      '你是 DpccGaming BluePrint 的工作流规划器。',
      '你的任务是根据用户最新需求，直接产出可执行且面向最终可玩产物的蓝图工作流 JSON。',
      '最终目标必须指向一个可直接运行、可直接玩的 H5 小游戏，而不是静态页面、演示稿或半成品说明。',
      '默认采用增量修改策略：优先保留现有节点和已有节点 id，只在必要时新增、删除或重连节点。',
      '必须返回严格 JSON，不要输出 Markdown 代码块或额外解释。'
    ].join('\n'),
    prompt: [
      `用户需求：${normalizeText(prompt) || '未提供需求'}`,
      seed ? `当前蓝图种子：${seed}` : '',
      '可用节点：',
      JSON.stringify(plannerNodes, null, 2),
      '当前工作流：',
      JSON.stringify(normalizedWorkflow, null, 2),
      [
        '输出 JSON 结构只能包含 summary、changes、warnings、workflow 四个顶级字段。',
        'workflow 内必须包含 nodes 和 edges。',
        'nodes 中每个节点必须包含 id、kind、title、position，紧凑节点可带 content。',
        '规划结果必须服务于“生成可直接玩的 H5 游戏”这一目标，至少保证 output 节点明确承接最终可执行游戏产物。',
        'changes 或 summary 里提到新增、调用、使用的节点，必须真实出现在 workflow.nodes 中，不能只写说明文字。',
        '如果复用现有节点，请尽量保留原 id。',
        '禁止输出不在可用节点清单中的 kind。',
        '如果工作流已有内容，不要无故清空画布。',
        '所有 content、summary、changes、warnings 都必须是干净自然语言，不要出现多余符号，不要残留 {、}、```、字段名或半截 JSON。'
      ].join('\n')
    ].filter(Boolean).join('\n\n')
  };
};

const buildBlueprintPlanningRepairPrompt = ({
  rawReply = '',
  workflow = {}
} = {}) => ({
  systemDirective: [
    '你是 DpccGaming BluePrint 的工作流 JSON 修复器。',
    '你会把上一轮模型回复修复成严格可解析的蓝图工作流 JSON。',
    '禁止输出 Markdown 代码块、解释文字或多余字段。'
  ].join('\n'),
  prompt: [
    '请把下面这段回复修复为严格 JSON。',
    '顶级字段只能包含 summary、changes、warnings、workflow。',
    'workflow 内必须包含 nodes 和 edges。',
    '如果原回复里没有明确工作流结构，请基于当前工作流做最小增量调整，不要返回空数组。',
    '当前工作流：',
    JSON.stringify(normalizeWorkflowShape(workflow), null, 2),
    '待修复回复：',
    String(rawReply || '').trim() || '（空回复）'
  ].join('\n\n')
});

const normalizeBlueprintPlanningResult = ({
  rawReply = '',
  workflow = {}
} = {}) => {
  const parsed = extractJsonObject(rawReply);
  if (!parsed || typeof parsed !== 'object') {
    throw createHttpError(400, 'AI 没有返回有效的工作流规划 JSON。');
  }

  const existingWorkflow = normalizeWorkflowShape(workflow);
  const plannedWorkflow = mergeMentionedNodesIntoWorkflow(
    extractWorkflowCandidate(parsed),
    parsed,
    existingWorkflow,
    rawReply
  );
  if (!plannedWorkflow.nodes.length) {
    throw createHttpError(400, 'AI 返回了空工作流，无法继续。');
  }

  const existingNodeMap = new Map(
    existingWorkflow.nodes
      .filter((node) => node?.id)
      .map((node) => [String(node.id), node])
  );

  let nodes = plannedWorkflow.nodes.map((node, index) =>
    normalizePlannedNode(node, index, existingNodeMap)
  );
  if (shouldRelayoutPlannedNodes(nodes)) {
    nodes = relayoutPlannedNodes(nodes, plannedWorkflow.edges);
  }
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const edges = plannedWorkflow.edges
    .map((edge, index) => normalizePlannedEdge(edge, index))
    .filter((edge) =>
      edge.fromNodeId
      && edge.toNodeId
      && edge.fromNodeId !== edge.toNodeId
      && validNodeIds.has(edge.fromNodeId)
      && validNodeIds.has(edge.toNodeId)
    );
  const edgeKeySet = new Set(
    edges.map((edge) => `${edge.fromNodeId}=>${edge.toNodeId}`)
  );

  nodes.forEach((node, index) => {
    const nextNode = nodes[index + 1];
    if (!nextNode) return;

    const edgeKey = `${node.id}=>${nextNode.id}`;
    if (edgeKeySet.has(edgeKey)) return;

    edges.push({
      id: `bp-plan-edge-auto-${index + 1}`,
      fromNodeId: node.id,
      toNodeId: nextNode.id
    });
    edgeKeySet.add(edgeKey);
  });

  return {
    summary: normalizeText(parsed.summary) || 'AI 已根据需求更新工作流。',
    changes: Array.isArray(parsed.changes)
      ? parsed.changes.map((item) => normalizeText(item)).filter(Boolean)
      : [],
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.map((item) => normalizeText(item)).filter(Boolean)
      : [],
    workflow: {
      version: Number(plannedWorkflow.version) || 1,
      nodes,
      edges
    }
  };
};

module.exports = {
  buildBlueprintPlanningRepairPrompt,
  buildBlueprintPlannerNodeCatalog,
  buildBlueprintPlanningPrompt,
  normalizeBlueprintPlanningResult,
  resolveBlueprintPlannerModel
};
