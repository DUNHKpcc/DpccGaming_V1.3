const path = require('node:path');
const {
  DEFAULT_AI_REQUEST_OPTIONS
} = require('../../controllers/discussion/shared/ai');
const {
  DEFAULT_BUILTIN_MODEL,
  normalizeBuiltinModelName
} = require('../../utils/aiProviderConfig');

const BLUEPRINT_SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BLUEPRINT_SEED_PATTERN = /^[A-Z0-9]{8,32}$/;
const BLUEPRINT_EXECUTION_HEARTBEAT_MS = 15000;
const DEFAULT_BLUEPRINT_EXECUTION_MODEL = 'GLM-4.5';
const DEFAULT_BLUEPRINT_VISION_MODEL = DEFAULT_BUILTIN_MODEL;

const normalizeSeed = (value = '') => String(value || '').trim().toUpperCase();
const normalizeModelName = (value = '') => normalizeBuiltinModelName(value || DEFAULT_BLUEPRINT_EXECUTION_MODEL);
const normalizeVisionModelName = (value = '') => normalizeBuiltinModelName(value || DEFAULT_BLUEPRINT_VISION_MODEL);
const normalizeExecutionScope = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'single') return 'single';
  if (normalized === 'branch') return 'branch';
  return 'all';
};
const normalizeRunListLimit = (value = 6) => {
  const parsed = Number(value || 0);
  if (!parsed) return 6;
  return Math.min(20, Math.max(1, Math.floor(parsed)));
};
const normalizeBlueprintRerunInstruction = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, 1200);
};
const buildBlueprintPlannerRequestOptions = () => ({
  ...DEFAULT_AI_REQUEST_OPTIONS
});

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const toDatabaseTimestamp = (value, fallbackValue = null) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallbackValue : value;
  }

  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackValue;
  }

  return parsed;
};

const getBlueprintUploadsRootPath = () => process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');

const generateSeedValue = (length = 12) => {
  const crypto = require('crypto');
  const bytes = crypto.randomBytes(length);
  let seed = '';

  for (let index = 0; index < length; index += 1) {
    seed += BLUEPRINT_SEED_ALPHABET[bytes[index] % BLUEPRINT_SEED_ALPHABET.length];
  }

  return seed;
};

const normalizeWorkflowPayload = (input, { requireNodes = true } = {}) => {
  let parsed = input;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw createHttpError(400, '节点工作流 JSON 格式无效');
    }
  }

  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
  const edges = Array.isArray(parsed?.edges) ? parsed.edges : [];
  const meta = parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta)
    ? parsed.meta
    : {};

  if (requireNodes && nodes.length === 0) {
    throw createHttpError(400, '请先创建至少一个节点，再生成或保存种子');
  }

  return {
    version: Number(parsed?.version) || 1,
    nodes,
    edges,
    meta
  };
};

const parseStoredWorkflow = (workflowJson = '') => {
  try {
    return normalizeWorkflowPayload(workflowJson, { requireNodes: false });
  } catch {
    throw createHttpError(500, '蓝图工作流数据已损坏');
  }
};

const clipBlueprintListText = (value = '', maxLength = 72) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const deriveBlueprintListMeta = (workflow = {}) => {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  const edges = Array.isArray(workflow?.edges) ? workflow.edges : [];
  const gameNode = nodes.find((node) => node?.kind === 'game' && String(node?.title || '').trim());
  const outputNode = nodes.find((node) => node?.kind === 'output' && String(node?.content || '').trim());
  const contentNode = nodes.find((node) => String(node?.content || '').trim());
  const firstTitledNode = nodes.find((node) => String(node?.title || '').trim());

  const title = clipBlueprintListText(
    gameNode?.title
    || outputNode?.title
    || firstTitledNode?.title
    || '未命名蓝图',
    36
  );

  const summary = clipBlueprintListText(
    outputNode?.content
    || contentNode?.content
    || gameNode?.description
    || '',
    92
  );

  return {
    title,
    summary,
    nodeCount: nodes.length,
    edgeCount: edges.length
  };
};

const parseNullableJson = (rawValue, fallbackValue) => {
  if (!rawValue) return fallbackValue;

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
};

const buildBlueprintResponse = (sourceRow, copyRow, userId) => {
  const isOwner = Number(sourceRow?.owner_user_id || 0) === Number(userId || 0);
  const workflow = parseStoredWorkflow(
    copyRow?.workflow_json || sourceRow?.workflow_json || ''
  );

  return {
    seed: sourceRow.seed,
    ownership: isOwner ? 'source' : 'copy',
    is_owner: isOwner,
    workflow,
    source_created_at: sourceRow.created_at || null,
    source_updated_at: sourceRow.updated_at || null,
    copy_updated_at: copyRow?.updated_at || null
  };
};

module.exports = {
  BLUEPRINT_SEED_PATTERN,
  BLUEPRINT_EXECUTION_HEARTBEAT_MS,
  DEFAULT_BLUEPRINT_EXECUTION_MODEL,
  DEFAULT_BLUEPRINT_VISION_MODEL,
  DEFAULT_BUILTIN_MODEL,
  buildBlueprintPlannerRequestOptions,
  buildBlueprintResponse,
  createHttpError,
  deriveBlueprintListMeta,
  generateSeedValue,
  getBlueprintUploadsRootPath,
  normalizeBlueprintRerunInstruction,
  normalizeExecutionScope,
  normalizeModelName,
  normalizeVisionModelName,
  normalizeRunListLimit,
  normalizeSeed,
  normalizeWorkflowPayload,
  parseNullableJson,
  parseStoredWorkflow,
  toDatabaseTimestamp
};
