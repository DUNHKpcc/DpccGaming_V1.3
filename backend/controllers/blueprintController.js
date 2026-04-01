const crypto = require('crypto');
const path = require('node:path');
const { getPool } = require('../config/database');
const { generateAiReply } = require('./discussion/shared/ai');
const { loadBlueprintGameCodePreview } = require('../utils/blueprintGameContext');
const { writeBlueprintRunBundle } = require('../utils/blueprintArtifacts');
const { validateBlueprintRunBundleBrowser } = require('../utils/blueprintBundleSmoke');
const { extractBlueprintVideoKeyframes } = require('../utils/blueprintVideoFrames');
const {
  buildBlueprintExecutionPlan,
  selectBlueprintExecutionSteps
} = require('../utils/blueprintExecution');
const {
  executeBlueprintNodeStep
} = require('../utils/blueprintNodeHandlers');
const {
  getContinuableBlueprintStep,
  summarizeBlueprintRunStatus
} = require('../utils/blueprintRunState');
const {
  clearActiveBlueprintRun,
  isBlueprintRunCancellationRequested,
  registerActiveBlueprintRun,
  requestBlueprintRunCancel
} = require('../utils/blueprintRunControl');
const { DEFAULT_BUILTIN_MODEL, normalizeBuiltinModelName } = require('../utils/aiProviderConfig');
const {
  buildBlueprintPlanningRepairPrompt,
  buildBlueprintPlannerNodeCatalog,
  buildBlueprintPlanningPrompt,
  normalizeBlueprintPlanningResult,
  resolveBlueprintPlannerModel
} = require('../utils/blueprintPlanner');

const BLUEPRINT_SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BLUEPRINT_SEED_PATTERN = /^[A-Z0-9]{8,32}$/;

let blueprintTablesReady = false;
let blueprintTablesInitPromise = null;

const normalizeSeed = (value = '') => String(value || '').trim().toUpperCase();
const normalizeModelName = (value = '') => normalizeBuiltinModelName(value || DEFAULT_BUILTIN_MODEL);
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

const ensureBlueprintTableColumn = async (executor, tableName, columnName, columnDefinition) => {
  try {
    const [rows] = await executor.execute(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
       LIMIT 1`,
      [tableName, columnName]
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return;
    }

    await executor.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  } catch (error) {
    const errorCode = String(error?.code || '').toUpperCase();
    const errorMessage = String(error?.message || '').toLowerCase();
    if (errorCode === 'ER_DUP_FIELDNAME' || errorCode === 'ER_DUPLICATE_COLUMN_NAME' || errorMessage.includes('duplicate column')) {
      return;
    }
    throw error;
  }
};

const generateSeedValue = (length = 12) => {
  const bytes = crypto.randomBytes(length);
  let seed = '';

  for (let index = 0; index < length; index += 1) {
    seed += BLUEPRINT_SEED_ALPHABET[bytes[index] % BLUEPRINT_SEED_ALPHABET.length];
  }

  return seed;
};

const ensureBlueprintTables = async (pool) => {
  if (blueprintTablesReady) return;
  if (blueprintTablesInitPromise) {
    await blueprintTablesInitPromise;
    return;
  }

  blueprintTablesInitPromise = Promise.all([
    pool.execute(
      `CREATE TABLE IF NOT EXISTS blueprint_workflow_sources (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        seed VARCHAR(32) NOT NULL,
        owner_user_id BIGINT UNSIGNED NOT NULL,
        source_name VARCHAR(255) DEFAULT NULL,
        workflow_json LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_blueprint_seed (seed),
        KEY idx_blueprint_source_owner (owner_user_id),
        KEY idx_blueprint_source_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ),
    pool.execute(
      `CREATE TABLE IF NOT EXISTS blueprint_workflow_copies (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        seed VARCHAR(32) NOT NULL,
        owner_user_id BIGINT UNSIGNED NOT NULL,
        workflow_json LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_blueprint_seed_owner (seed, owner_user_id),
        KEY idx_blueprint_copy_owner (owner_user_id),
        KEY idx_blueprint_copy_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ),
    pool.execute(
      `CREATE TABLE IF NOT EXISTS blueprint_workflow_runs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        seed VARCHAR(32) DEFAULT NULL,
        owner_user_id BIGINT UNSIGNED NOT NULL,
        workflow_json LONGTEXT NOT NULL,
        runtime_snapshot_json LONGTEXT NULL,
        artifact_manifest_json LONGTEXT NULL,
        preview_url VARCHAR(512) DEFAULT NULL,
        model_name VARCHAR(120) NOT NULL,
        scope VARCHAR(16) NOT NULL DEFAULT 'all',
        start_node_id VARCHAR(128) DEFAULT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        error_message TEXT DEFAULT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_blueprint_run_owner (owner_user_id),
        KEY idx_blueprint_run_seed (seed),
        KEY idx_blueprint_run_status (status),
        KEY idx_blueprint_run_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ),
    pool.execute(
      `CREATE TABLE IF NOT EXISTS blueprint_workflow_run_steps (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        run_id BIGINT UNSIGNED NOT NULL,
        node_id VARCHAR(128) NOT NULL,
        node_kind VARCHAR(64) NOT NULL,
        node_title VARCHAR(255) NOT NULL,
        mode VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        upstream_node_ids_json LONGTEXT DEFAULT NULL,
        input_text LONGTEXT DEFAULT NULL,
        visible_input_text LONGTEXT DEFAULT NULL,
        summary_text TEXT DEFAULT NULL,
        analysis_text LONGTEXT DEFAULT NULL,
        output_text LONGTEXT DEFAULT NULL,
        raw_reply_text LONGTEXT DEFAULT NULL,
        artifact_type VARCHAR(64) DEFAULT NULL,
        artifact_json LONGTEXT DEFAULT NULL,
        artifacts_json LONGTEXT DEFAULT NULL,
        retry_count INT NOT NULL DEFAULT 0,
        model_name VARCHAR(120) DEFAULT NULL,
        started_at TIMESTAMP NULL DEFAULT NULL,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        error_message TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_blueprint_run_node (run_id, node_id),
        KEY idx_blueprint_run_step_status (status),
        KEY idx_blueprint_run_step_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )
  ]);

  try {
    await blueprintTablesInitPromise;
    await ensureBlueprintTableColumn(
      pool,
      'blueprint_workflow_runs',
      'artifact_manifest_json',
      'artifact_manifest_json LONGTEXT NULL'
    );
    await ensureBlueprintTableColumn(
      pool,
      'blueprint_workflow_runs',
      'preview_url',
      'preview_url VARCHAR(512) DEFAULT NULL'
    );
    await ensureBlueprintTableColumn(
      pool,
      'blueprint_workflow_run_steps',
      'visible_input_text',
      'visible_input_text LONGTEXT DEFAULT NULL'
    );
    await ensureBlueprintTableColumn(
      pool,
      'blueprint_workflow_run_steps',
      'artifact_type',
      'artifact_type VARCHAR(64) DEFAULT NULL'
    );
    await ensureBlueprintTableColumn(
      pool,
      'blueprint_workflow_run_steps',
      'artifact_json',
      'artifact_json LONGTEXT DEFAULT NULL'
    );
    await ensureBlueprintTableColumn(
      pool,
      'blueprint_workflow_run_steps',
      'artifacts_json',
      'artifacts_json LONGTEXT DEFAULT NULL'
    );
    await ensureBlueprintTableColumn(
      pool,
      'blueprint_workflow_run_steps',
      'retry_count',
      'retry_count INT NOT NULL DEFAULT 0'
    );
    blueprintTablesReady = true;
  } finally {
    blueprintTablesInitPromise = null;
  }
};

const normalizeWorkflowPayload = (input, { requireNodes = true } = {}) => {
  let parsed = input;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (error) {
      throw createHttpError(400, '节点工作流 JSON 格式无效');
    }
  }

  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
  const edges = Array.isArray(parsed?.edges) ? parsed.edges : [];

  if (requireNodes && nodes.length === 0) {
    throw createHttpError(400, '请先创建至少一个节点，再生成或保存种子');
  }

  return {
    version: Number(parsed?.version) || 1,
    nodes,
    edges
  };
};

const parseStoredWorkflow = (workflowJson = '') => {
  try {
    return normalizeWorkflowPayload(workflowJson, { requireNodes: false });
  } catch (error) {
    throw createHttpError(500, '蓝图工作流数据已损坏');
  }
};

const getSourceBySeed = async (executor, seed) => {
  const [rows] = await executor.execute(
    `SELECT id, seed, owner_user_id, source_name, workflow_json, created_at, updated_at
     FROM blueprint_workflow_sources
     WHERE seed = ?
     LIMIT 1`,
    [seed]
  );

  return rows?.[0] || null;
};

const getCopyBySeedAndOwner = async (executor, seed, userId) => {
  const [rows] = await executor.execute(
    `SELECT id, seed, owner_user_id, workflow_json, created_at, updated_at
     FROM blueprint_workflow_copies
     WHERE seed = ? AND owner_user_id = ?
     LIMIT 1`,
    [seed, userId]
  );

  return rows?.[0] || null;
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

const getBlueprintRunCancellationStateFromStore = async (executor, runId) => {
  const numericRunId = Number(runId || 0);
  if (!numericRunId) return false;

  const [rows] = await executor.execute(
    `SELECT status
     FROM blueprint_workflow_runs
     WHERE id = ?
     LIMIT 1`,
    [numericRunId]
  );

  const status = String(rows?.[0]?.status || '').trim().toLowerCase();
  return status === 'cancel_requested' || status === 'cancelled';
};

const persistBlueprintRunCancellationRequest = async (executor, runId, runtimeSnapshotJson = '{}', payload = {}) => {
  await updateBlueprintRunRecord(executor, runId, {
    status: 'cancel_requested',
    errorMessage: '用户已请求取消运行。',
    runtimeSnapshotJson,
    artifactManifestJson: payload.artifactManifestJson || null,
    previewUrl: payload.previewUrl || null,
    completedAt: null
  });
};

const createBlueprintRunRecord = async (executor, payload = {}) => {
  const [result] = await executor.execute(
    `INSERT INTO blueprint_workflow_runs (
      seed,
      owner_user_id,
      workflow_json,
      runtime_snapshot_json,
      artifact_manifest_json,
      preview_url,
      model_name,
      scope,
      start_node_id,
      status,
      started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.seed || null,
      Number(payload.ownerUserId || 0),
      payload.workflowJson || '{}',
      payload.runtimeSnapshotJson || '{}',
      payload.artifactManifestJson || null,
      payload.previewUrl || null,
      payload.modelName || DEFAULT_BUILTIN_MODEL,
      payload.scope || 'all',
      payload.startNodeId || null,
      payload.status || 'running',
      toDatabaseTimestamp(payload.startedAt, new Date())
    ]
  );

  return Number(result?.insertId || 0);
};

const updateBlueprintRunRecord = async (executor, runId, payload = {}) => {
  if (!runId) return;

  await executor.execute(
    `UPDATE blueprint_workflow_runs
     SET status = ?,
         error_message = ?,
         runtime_snapshot_json = ?,
         artifact_manifest_json = ?,
         preview_url = ?,
         completed_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      payload.status || 'running',
      payload.errorMessage || null,
      payload.runtimeSnapshotJson || '{}',
      payload.artifactManifestJson || null,
      payload.previewUrl || null,
      toDatabaseTimestamp(payload.completedAt, null),
      runId
    ]
  );
};

const upsertBlueprintRunStepRecord = async (executor, runId, step = {}, payload = {}) => {
  if (!runId || !step?.nodeId) return;

  await executor.execute(
    `INSERT INTO blueprint_workflow_run_steps (
      run_id,
      node_id,
      node_kind,
      node_title,
      mode,
      status,
      upstream_node_ids_json,
      input_text,
      visible_input_text,
      summary_text,
      analysis_text,
      output_text,
      raw_reply_text,
      artifact_type,
      artifact_json,
      artifacts_json,
      retry_count,
      model_name,
      started_at,
      completed_at,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      node_kind = VALUES(node_kind),
      node_title = VALUES(node_title),
      mode = VALUES(mode),
      status = VALUES(status),
      upstream_node_ids_json = VALUES(upstream_node_ids_json),
      input_text = VALUES(input_text),
      visible_input_text = VALUES(visible_input_text),
      summary_text = VALUES(summary_text),
      analysis_text = VALUES(analysis_text),
      output_text = VALUES(output_text),
      raw_reply_text = VALUES(raw_reply_text),
      artifact_type = VALUES(artifact_type),
      artifact_json = VALUES(artifact_json),
      artifacts_json = VALUES(artifacts_json),
      retry_count = VALUES(retry_count),
      model_name = VALUES(model_name),
      started_at = VALUES(started_at),
      completed_at = VALUES(completed_at),
      error_message = VALUES(error_message),
      updated_at = CURRENT_TIMESTAMP`,
    [
      runId,
      step.nodeId,
      step.kind || '',
      step.title || step.nodeId,
      step.mode || 'ai',
      payload.status || 'pending',
      JSON.stringify(Array.isArray(step.upstreamNodeIds) ? step.upstreamNodeIds : []),
      payload.input || '',
      payload.visibleInputText || '',
      payload.summary || '',
      payload.analysis || '',
      payload.output || '',
      payload.rawReply || '',
      payload.artifactType || '',
      payload.artifactJson ? JSON.stringify(payload.artifactJson) : null,
      payload.artifactsJson
        ? JSON.stringify(payload.artifactsJson)
        : payload.artifacts
          ? JSON.stringify(payload.artifacts)
          : null,
      Number.isFinite(Number(payload.retryCount)) ? Number(payload.retryCount) : 0,
      payload.model || '',
      toDatabaseTimestamp(payload.startedAt, null),
      toDatabaseTimestamp(payload.completedAt, null),
      payload.errorMessage || null
    ]
  );
};

const getBlueprintRunDetailById = async (executor, runId, userId) => {
  const numericRunId = Number(runId || 0);
  if (!numericRunId) return null;

  const [runRows] = await executor.execute(
    `SELECT id, seed, owner_user_id, workflow_json, runtime_snapshot_json, artifact_manifest_json, preview_url, model_name, scope,
            start_node_id, status, error_message, started_at, completed_at, created_at, updated_at
     FROM blueprint_workflow_runs
     WHERE id = ? AND owner_user_id = ?
     LIMIT 1`,
    [numericRunId, Number(userId || 0)]
  );

  const runRow = runRows?.[0] || null;
  if (!runRow) return null;

  const [stepRows] = await executor.execute(
    `SELECT id, node_id, node_kind, node_title, mode, status, upstream_node_ids_json,
            input_text, visible_input_text, summary_text, analysis_text, output_text, raw_reply_text,
            artifact_type, artifact_json, artifacts_json, retry_count, model_name,
            started_at, completed_at, error_message, created_at, updated_at
     FROM blueprint_workflow_run_steps
     WHERE run_id = ?
     ORDER BY id ASC`,
    [numericRunId]
  );

  const steps = Array.isArray(stepRows)
    ? stepRows.map((row) => ({
      id: Number(row.id || 0),
      nodeId: row.node_id,
      nodeKind: row.node_kind,
      nodeTitle: row.node_title,
      mode: row.mode,
      status: row.status,
      upstreamNodeIds: parseNullableJson(row.upstream_node_ids_json, []),
      input: row.input_text || '',
      visibleInputText: row.visible_input_text || '',
      summary: row.summary_text || '',
      analysis: row.analysis_text || '',
      output: row.output_text || '',
      rawReply: row.raw_reply_text || '',
      artifactType: row.artifact_type || '',
      artifact: parseNullableJson(row.artifact_json, {}),
      artifactJson: parseNullableJson(row.artifact_json, {}),
      artifacts: parseNullableJson(row.artifacts_json, []),
      artifactsJson: parseNullableJson(row.artifacts_json, []),
      retryCount: Number(row.retry_count || 0),
      model: row.model_name || '',
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null,
      errorMessage: row.error_message || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    }))
    : [];

  const detail = {
    id: Number(runRow.id || 0),
    seed: runRow.seed || '',
    ownerUserId: Number(runRow.owner_user_id || 0),
    model: runRow.model_name || '',
    scope: runRow.scope || 'all',
    startNodeId: runRow.start_node_id || '',
    status: runRow.status || 'pending',
    errorMessage: runRow.error_message || null,
    startedAt: runRow.started_at || null,
    completedAt: runRow.completed_at || null,
    createdAt: runRow.created_at || null,
    updatedAt: runRow.updated_at || null,
    artifactManifest: parseNullableJson(runRow.artifact_manifest_json, {}),
    previewUrl: runRow.preview_url || '',
    workflow: parseNullableJson(runRow.workflow_json, { nodes: [], edges: [] }),
    runtimeSnapshot: parseNullableJson(runRow.runtime_snapshot_json, {}),
    steps
  };

  return {
    ...detail,
    status: summarizeBlueprintRunStatus(detail),
    continuation: getContinuableBlueprintStep(detail)
  };
};

const getBlueprintRunSummaries = async (executor, { userId, seed = '', limit = 6 } = {}) => {
  const conditions = ['owner_user_id = ?'];
  const values = [Number(userId || 0)];

  if (seed) {
    conditions.push('seed = ?');
    values.push(seed);
  }

  values.push(limit);

  const [runRows] = await executor.execute(
    `SELECT id, seed, owner_user_id, model_name, scope, start_node_id, status, error_message,
            preview_url,
            started_at, completed_at, created_at, updated_at
     FROM blueprint_workflow_runs
     WHERE ${conditions.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT ?`,
    values
  );

  const runs = Array.isArray(runRows)
    ? runRows.map((row) => ({
      id: Number(row.id || 0),
      seed: row.seed || '',
      ownerUserId: Number(row.owner_user_id || 0),
      model: row.model_name || '',
      scope: row.scope || 'all',
      startNodeId: row.start_node_id || '',
      status: row.status || 'pending',
      errorMessage: row.error_message || null,
      previewUrl: row.preview_url || '',
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    }))
    : [];

  if (!runs.length) return [];

  const runIds = runs.map((run) => run.id);
  const placeholders = runIds.map(() => '?').join(', ');
  const [stepRows] = await executor.execute(
    `SELECT run_id, node_id, status
     FROM blueprint_workflow_run_steps
     WHERE run_id IN (${placeholders})
     ORDER BY id ASC`,
    runIds
  );

  const stepsByRunId = new Map();
  (stepRows || []).forEach((row) => {
    const runId = Number(row.run_id || 0);
    if (!stepsByRunId.has(runId)) {
      stepsByRunId.set(runId, []);
    }
    stepsByRunId.get(runId).push({
      nodeId: row.node_id,
      status: row.status
    });
  });

  return runs.map((run) => {
    const steps = stepsByRunId.get(run.id) || [];
    const detail = {
      ...run,
      steps
    };
    return {
      ...run,
      status: summarizeBlueprintRunStatus(detail),
      continuation: getContinuableBlueprintStep(detail)
    };
  });
};

const respondWithBlueprint = (res, sourceRow, copyRow, userId) => {
  const isOwner = Number(sourceRow?.owner_user_id || 0) === Number(userId || 0);
  const workflow = parseStoredWorkflow(
    copyRow?.workflow_json || sourceRow?.workflow_json || ''
  );

  res.json({
    seed: sourceRow.seed,
    ownership: isOwner ? 'source' : 'copy',
    is_owner: isOwner,
    workflow,
    source_created_at: sourceRow.created_at || null,
    source_updated_at: sourceRow.updated_at || null,
    copy_updated_at: copyRow?.updated_at || null
  });
};

const createBlueprint = async (req, res) => {
  const userId = Number(req.user?.userId || 0);
  const clientSeed = normalizeSeed(req.body?.seed);

  try {
    const workflow = normalizeWorkflowPayload(req.body?.workflow, { requireNodes: true });
    const seed = clientSeed || generateSeedValue();

    if (!BLUEPRINT_SEED_PATTERN.test(seed)) {
      return res.status(400).json({ error: '种子格式无效，请使用 8-32 位大写字母或数字' });
    }

    const pool = getPool();
    await ensureBlueprintTables(pool);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existingSource = await getSourceBySeed(connection, seed);
      if (existingSource) {
        throw createHttpError(409, '该种子已存在，请重新生成');
      }

      const workflowJson = JSON.stringify(workflow);

      await connection.execute(
        `INSERT INTO blueprint_workflow_sources (seed, owner_user_id, workflow_json)
         VALUES (?, ?, ?)`,
        [seed, userId, workflowJson]
      );

      await connection.execute(
        `INSERT INTO blueprint_workflow_copies (seed, owner_user_id, workflow_json)
         VALUES (?, ?, ?)`,
        [seed, userId, workflowJson]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const sourceRow = {
      seed,
      owner_user_id: userId,
      workflow_json: JSON.stringify(workflow),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return res.status(201).json({
      seed,
      ownership: 'source',
      is_owner: true,
      workflow,
      source_created_at: sourceRow.created_at,
      source_updated_at: sourceRow.updated_at,
      copy_updated_at: sourceRow.updated_at
    });
  } catch (error) {
    console.error('创建蓝图种子失败:', error);
    return res.status(error.status || 500).json({
      error: error.message || '创建蓝图种子失败'
    });
  }
};

const planBlueprintWorkflow = async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  const seed = normalizeSeed(req.body?.seed);

  if (!prompt) {
    return res.status(400).json({ error: '请输入工作流需求后再让 AI 规划。' });
  }

  try {
    const workflow = normalizeWorkflowPayload(req.body?.workflow, { requireNodes: false });
    const requestedModel = normalizeModelName(req.body?.model || DEFAULT_BUILTIN_MODEL);
    const plannerModel = resolveBlueprintPlannerModel(requestedModel);
    const availableNodes = Array.isArray(req.body?.availableNodes) && req.body.availableNodes.length
      ? req.body.availableNodes
      : buildBlueprintPlannerNodeCatalog();
    const plannerPrompt = buildBlueprintPlanningPrompt({
      prompt,
      workflow,
      availableNodes,
      seed
    });

    const rawReply = await generateAiReply({
      prompt: plannerPrompt.prompt,
      gameTitle: 'Blueprint Workflow Planner',
      roomMessages: [],
      roomSummary: null,
      memoryEntries: [],
      builtinModel: plannerModel,
      systemDirective: plannerPrompt.systemDirective
    });

    let plannedResult = null;
    let repaired = false;

    try {
      plannedResult = normalizeBlueprintPlanningResult({
        rawReply,
        workflow
      });
    } catch (error) {
      if (error?.status !== 400) {
        throw error;
      }

      const repairPrompt = buildBlueprintPlanningRepairPrompt({
        rawReply,
        workflow
      });

      const repairedReply = await generateAiReply({
        prompt: repairPrompt.prompt,
        gameTitle: 'Blueprint Workflow Planner Repair',
        roomMessages: [],
        roomSummary: null,
        memoryEntries: [],
        builtinModel: plannerModel,
        systemDirective: repairPrompt.systemDirective
      });

      plannedResult = normalizeBlueprintPlanningResult({
        rawReply: repairedReply,
        workflow
      });
      repaired = true;
    }

    if (repaired) {
      plannedResult = {
        ...plannedResult,
        warnings: [
          'AI 首次回复未返回标准工作流，系统已自动修复格式。',
          ...plannedResult.warnings
        ]
      };
    }

    return res.json({
      ...plannedResult,
      model: plannerModel
    });
  } catch (error) {
    console.error('规划蓝图工作流失败:', error);
    return res.status(error.status || 500).json({
      error: error.message || '规划蓝图工作流失败'
    });
  }
};

const getBlueprintBySeed = async (req, res) => {
  const userId = Number(req.user?.userId || 0);
  const seed = normalizeSeed(req.params?.seed);

  if (!BLUEPRINT_SEED_PATTERN.test(seed)) {
    return res.status(400).json({ error: '种子格式无效' });
  }

  try {
    const pool = getPool();
    await ensureBlueprintTables(pool);

    const sourceRow = await getSourceBySeed(pool, seed);
    if (!sourceRow) {
      return res.status(404).json({ error: '未找到对应的蓝图种子' });
    }

    let copyRow = await getCopyBySeedAndOwner(pool, seed, userId);

    if (!copyRow) {
      await pool.execute(
        `INSERT INTO blueprint_workflow_copies (seed, owner_user_id, workflow_json)
         VALUES (?, ?, ?)`,
        [seed, userId, sourceRow.workflow_json]
      );

      copyRow = await getCopyBySeedAndOwner(pool, seed, userId);
    }

    return respondWithBlueprint(res, sourceRow, copyRow, userId);
  } catch (error) {
    console.error('按种子获取蓝图失败:', error);
    return res.status(error.status || 500).json({
      error: error.message || '加载蓝图失败'
    });
  }
};

const saveBlueprintBySeed = async (req, res) => {
  const userId = Number(req.user?.userId || 0);
  const seed = normalizeSeed(req.params?.seed);

  if (!BLUEPRINT_SEED_PATTERN.test(seed)) {
    return res.status(400).json({ error: '种子格式无效' });
  }

  try {
    const workflow = normalizeWorkflowPayload(req.body?.workflow, { requireNodes: true });
    const workflowJson = JSON.stringify(workflow);

    const pool = getPool();
    await ensureBlueprintTables(pool);

    const connection = await pool.getConnection();
    let sourceRow = null;

    try {
      await connection.beginTransaction();

      sourceRow = await getSourceBySeed(connection, seed);
      if (!sourceRow) {
        throw createHttpError(404, '未找到对应的蓝图种子');
      }

      await connection.execute(
        `INSERT INTO blueprint_workflow_copies (seed, owner_user_id, workflow_json)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           workflow_json = VALUES(workflow_json),
           updated_at = CURRENT_TIMESTAMP`,
        [seed, userId, workflowJson]
      );

      if (Number(sourceRow.owner_user_id || 0) === userId) {
        await connection.execute(
          `UPDATE blueprint_workflow_sources
           SET workflow_json = ?, updated_at = CURRENT_TIMESTAMP
           WHERE seed = ?`,
          [workflowJson, seed]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const refreshedSourceRow = await getSourceBySeed(pool, seed);
    const refreshedCopyRow = await getCopyBySeedAndOwner(pool, seed, userId);
    return respondWithBlueprint(res, refreshedSourceRow || sourceRow, refreshedCopyRow, userId);
  } catch (error) {
    console.error('保存蓝图失败:', error);
    return res.status(error.status || 500).json({
      error: error.message || '保存蓝图失败'
    });
  }
};

const listBlueprintRuns = async (req, res) => {
  const userId = Number(req.user?.userId || 0);
  const seed = normalizeSeed(req.query?.seed);
  const limit = normalizeRunListLimit(req.query?.limit);

  try {
    const pool = getPool();
    await ensureBlueprintTables(pool);

    const runs = await getBlueprintRunSummaries(pool, {
      userId,
      seed: BLUEPRINT_SEED_PATTERN.test(seed) ? seed : '',
      limit
    });

    return res.json({ runs });
  } catch (error) {
    console.error('获取蓝图运行列表失败:', error);
    return res.status(error.status || 500).json({
      error: error.message || '获取蓝图运行列表失败'
    });
  }
};

const listRecentBlueprints = async (req, res) => {
  const userId = Number(req.user?.userId || 0);
  const limit = normalizeRunListLimit(req.query?.limit);

  try {
    const pool = getPool();
    await ensureBlueprintTables(pool);

    const [rows] = await pool.execute(
      `SELECT c.seed, c.workflow_json, c.created_at, c.updated_at,
              CASE
                WHEN s.owner_user_id = ? THEN 'source'
                ELSE 'copy'
              END AS ownership
       FROM blueprint_workflow_copies c
       LEFT JOIN blueprint_workflow_sources s
         ON s.seed = c.seed
       WHERE c.owner_user_id = ?
       ORDER BY c.updated_at DESC
       LIMIT ?`,
      [userId, userId, limit]
    );

    const blueprints = Array.isArray(rows)
      ? rows.map((row) => {
        const workflow = parseStoredWorkflow(row.workflow_json || '{}');
        const meta = deriveBlueprintListMeta(workflow);

        return {
          seed: row.seed || '',
          ownership: row.ownership || 'copy',
          createdAt: row.created_at || null,
          updatedAt: row.updated_at || null,
          ...meta
        };
      })
      : [];

    return res.json({ blueprints });
  } catch (error) {
    console.error('获取最近蓝图列表失败:', error);
    return res.status(error.status || 500).json({
      error: error.message || '获取最近蓝图列表失败'
    });
  }
};

const getBlueprintRunDetail = async (req, res) => {
  const userId = Number(req.user?.userId || 0);
  const runId = Number(req.params?.runId || 0);

  if (!runId) {
    return res.status(400).json({ error: '运行记录 ID 无效' });
  }

  try {
    const pool = getPool();
    await ensureBlueprintTables(pool);

    const runDetail = await getBlueprintRunDetailById(pool, runId, userId);
    if (!runDetail) {
      return res.status(404).json({ error: '未找到对应的运行记录' });
    }

    return res.json(runDetail);
  } catch (error) {
    console.error('获取蓝图运行记录失败:', error);
    return res.status(error.status || 500).json({
      error: error.message || '获取蓝图运行记录失败'
    });
  }
};

const cancelBlueprintRun = async (req, res) => {
  const userId = Number(req.user?.userId || 0);
  const runId = Number(req.params?.runId || 0);

  if (!runId) {
    return res.status(400).json({ error: '运行记录 ID 无效' });
  }

  try {
    const pool = getPool();
    await ensureBlueprintTables(pool);

    const runDetail = await getBlueprintRunDetailById(pool, runId, userId);
    if (!runDetail) {
      return res.status(404).json({ error: '未找到对应的运行记录' });
    }

    if (!['running', 'cancel_requested'].includes(String(runDetail.status || ''))) {
      return res.status(409).json({ error: '当前运行已经结束，无法取消。' });
    }

    const cancelAccepted = requestBlueprintRunCancel(runId, userId);
    if (!cancelAccepted) {
      await persistBlueprintRunCancellationRequest(
        pool,
        runId,
        JSON.stringify(runDetail.runtimeSnapshot || {}),
        {
          artifactManifestJson: JSON.stringify(runDetail.artifactManifest || {}),
          previewUrl: runDetail.previewUrl || null
        }
      );
      return res.status(202).json({
        runId,
        status: 'cancel_requested',
        accepted: false,
        message: '取消请求已记录，但当前进程无法直接中断该运行。'
      });
    }

    await persistBlueprintRunCancellationRequest(
      pool,
      runId,
      JSON.stringify(runDetail.runtimeSnapshot || {}),
      {
        artifactManifestJson: JSON.stringify(runDetail.artifactManifest || {}),
        previewUrl: runDetail.previewUrl || null
      }
    );

    return res.json({
      runId,
      status: 'cancel_requested',
      accepted: true
    });
  } catch (error) {
    console.error('取消蓝图运行失败:', error);
    return res.status(error.status || 500).json({
      error: error.message || '取消蓝图运行失败'
    });
  }
};

const prepareExecutionStreamResponse = (res) => {
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  if (typeof res.socket?.setNoDelay === 'function') {
    res.socket.setNoDelay(true);
  }
};

const writeExecutionEvent = (res, event, payload = {}) => {
  res.write(`${JSON.stringify({ event, ...payload })}\n`);

  if (typeof res.flush === 'function') {
    res.flush();
  }
};

const enrichBlueprintGameNodeContext = async (node = {}) => {
  const [codePreview, videoKeyframeResult] = await Promise.all([
    loadBlueprintGameCodePreview({
      gameId: node.gameId,
      preferredPath: node.codeEntryPath
    }),
    extractBlueprintVideoKeyframes({
      gameId: node.gameId,
      videoUrl: node.videoUrl,
      uploadsRootPath: getBlueprintUploadsRootPath()
    })
  ]);

  return {
    ...node,
    codeSnippet: node.codeSnippet || codePreview.codeSnippet || '',
    codeEntryPath: node.codeEntryPath || codePreview.codeSnippetPath || '',
    videoKeyframes: Array.isArray(videoKeyframeResult?.frames) ? videoKeyframeResult.frames : [],
    videoKeyframeNote: String(videoKeyframeResult?.reason || '')
  };
};

const clipBlueprintArtifactText = (value = '', maxLength = 420) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const buildBlueprintRunArtifactManifest = ({
  runId = 0,
  seed = '',
  modelName = '',
  scope = 'all',
  startNodeId = '',
  status = 'completed',
  startedAt = null,
  completedAt = null,
  stepResults = {},
  selectedSteps = []
} = {}) => ({
  runId: Number(runId || 0),
  title: `Blueprint Run ${Number(runId || 0)}`,
  artifactType: 'h5-bundle',
  seed: String(seed || ''),
  runtime: {
    modelName: String(modelName || ''),
    scope: String(scope || 'all'),
    startNodeId: String(startNodeId || ''),
    status: String(status || 'completed'),
    startedAt,
    completedAt,
    stepCount: Array.isArray(selectedSteps) ? selectedSteps.length : 0
  },
  steps: Array.isArray(selectedSteps)
    ? selectedSteps.map((step) => {
      const runtime = stepResults?.[step.nodeId] || {};
      return {
        nodeId: step.nodeId,
        nodeTitle: step.title || step.nodeId || '',
        nodeKind: step.kind || '',
        mode: step.mode || '',
        status: runtime.status || 'pending',
        summary: clipBlueprintArtifactText(runtime.summary || ''),
        output: clipBlueprintArtifactText(runtime.output || ''),
        artifactType: runtime.artifactType || ''
      };
    })
    : []
});

const findBlueprintOutputBundleFiles = (stepResults = {}, selectedSteps = []) => {
  const orderedSteps = Array.isArray(selectedSteps) ? [...selectedSteps].reverse() : [];

  for (const step of orderedSteps) {
    const runtime = stepResults?.[step.nodeId];
    if (!runtime || runtime.status !== 'completed' || runtime.artifactType !== 'file-bundle') continue;
    const files = runtime.artifactJson?.files;
    if (!files || typeof files !== 'object') continue;
    return files;
  }

  return null;
};

const findBlueprintOutputStepRuntime = (stepResults = {}, selectedSteps = []) => {
  const orderedSteps = Array.isArray(selectedSteps) ? [...selectedSteps].reverse() : [];

  for (const step of orderedSteps) {
    const runtime = stepResults?.[step.nodeId];
    if (!runtime || runtime.artifactType !== 'file-bundle') continue;
    return { step, runtime };
  }

  return null;
};

const executeBlueprintWorkflow = async (req, res) => {
  let runId = 0;
  let runtimeSnapshotJson = '{}';
  let artifactManifestJson = null;
  let previewUrl = null;

  try {
    const userId = Number(req.user?.userId || 0);
    const pool = getPool();
    await ensureBlueprintTables(pool);
    const workflow = normalizeWorkflowPayload(req.body?.workflow, { requireNodes: true });
    const selectedModel = normalizeModelName(req.body?.model);
    const selectedVisionModel = normalizeModelName(req.body?.visionModel || DEFAULT_BUILTIN_MODEL);
    const plan = buildBlueprintExecutionPlan(workflow);
    const normalizedSeed = normalizeSeed(req.body?.seed);
    const startNodeId = String(req.body?.startNodeId || '').trim();
    const scope = normalizeExecutionScope(req.body?.scope);
    const runtimeSnapshot = req.body?.runtimeSnapshot && typeof req.body.runtimeSnapshot === 'object'
      ? req.body.runtimeSnapshot
      : {};
    const selectedSteps = selectBlueprintExecutionSteps(plan, { startNodeId, scope });
    const stepResults = {};
    const startedAt = new Date();

    Object.entries(runtimeSnapshot).forEach(([nodeId, runtime]) => {
      if (!plan.stepsById[nodeId] || !runtime || typeof runtime !== 'object') return;
      stepResults[nodeId] = {
        ...runtime,
        kind: runtime.kind || plan.stepsById[nodeId].kind,
        status: runtime.status || 'completed'
      };
    });

    runtimeSnapshotJson = JSON.stringify(stepResults);
    runId = await createBlueprintRunRecord(pool, {
      seed: BLUEPRINT_SEED_PATTERN.test(normalizedSeed) ? normalizedSeed : null,
      ownerUserId: userId,
      workflowJson: JSON.stringify(workflow),
      runtimeSnapshotJson,
      modelName: selectedModel,
      scope,
      startNodeId,
      status: 'running',
      startedAt
    });
    registerActiveBlueprintRun(runId, { ownerUserId: userId });

    prepareExecutionStreamResponse(res);

    writeExecutionEvent(res, 'workflow-start', {
      runId,
      model: selectedModel,
      visionModel: selectedVisionModel,
      totalSteps: selectedSteps.length,
      startNodeId: startNodeId || '',
      scope,
      startedAt: startedAt.toISOString()
    });

    for (const step of selectedSteps) {
      if (
        isBlueprintRunCancellationRequested(runId)
        || await getBlueprintRunCancellationStateFromStore(pool, runId)
      ) {
        const cancelledAt = new Date().toISOString();
        await updateBlueprintRunRecord(pool, runId, {
          status: 'cancelled',
          errorMessage: '运行已取消。',
          runtimeSnapshotJson,
          completedAt: cancelledAt
        });
        writeExecutionEvent(res, 'workflow-cancelled', {
          runId,
          cancelledAt
        });
        return res.end();
      }

      const stepInfo = plan.stepsById[step.nodeId];
      const node = stepInfo.node;
      const startedAt = new Date().toISOString();

      await upsertBlueprintRunStepRecord(pool, runId, step, {
        status: 'running',
        model: step.mode === 'source' ? selectedVisionModel : selectedModel,
        startedAt
      });

      writeExecutionEvent(res, 'step-start', {
        runId,
        nodeId: step.nodeId,
        nodeTitle: step.title,
        nodeKind: step.kind,
        mode: step.mode,
        model: step.mode === 'source' ? selectedVisionModel : selectedModel,
        upstreamNodeIds: step.upstreamNodeIds,
        startedAt
      });

      let stepRuntime;

      try {
        const executionNode = step.mode === 'source'
          ? await enrichBlueprintGameNodeContext(node)
          : node;

        stepRuntime = await executeBlueprintNodeStep({
          step: stepInfo,
          node: executionNode,
          stepResults,
          stepsById: plan.stepsById,
          selectedModel,
          selectedVisionModel,
          generateAiReply,
          startedAt,
          onProgress: (progressEvent = {}) => {
            writeExecutionEvent(res, 'step-progress', {
              runId,
              nodeId: step.nodeId,
              nodeTitle: step.title,
              nodeKind: step.kind,
              progress: progressEvent.progress,
              stage: progressEvent.stage,
              detail: progressEvent.detail
            });
          }
        });
      } catch (error) {
        const failedAt = new Date().toISOString();
        const failedMessage = error.message || '节点执行失败';
        stepRuntime = {
          input: '',
          visibleInputText: '',
          summary: '',
          analysis: '',
          output: '',
          rawReply: '',
          artifactType: step.mode === 'source' ? 'source-context' : 'ai-result',
          artifactJson: {
            type: step.mode === 'source' ? 'source-context' : 'ai-result',
            nodeId: step.nodeId,
            nodeTitle: step.title,
            nodeKind: step.kind,
            mode: step.mode,
            status: 'failed',
            summary: '',
            analysis: '',
            output: '',
            rawReply: '',
            input: '',
            visibleInputText: '',
            retryCount: 0,
            errorMessage: failedMessage
          },
          artifacts: [],
          artifactsJson: [],
          retryCount: 0,
          mode: step.mode,
          kind: step.kind,
          model: step.mode === 'source' ? 'source' : selectedModel,
          status: 'failed',
          upstreamNodeIds: step.upstreamNodeIds,
          startedAt,
          completedAt: failedAt,
          errorMessage: failedMessage
        };
      }

      stepResults[step.nodeId] = stepRuntime;
      runtimeSnapshotJson = JSON.stringify(stepResults);
      await upsertBlueprintRunStepRecord(pool, runId, step, {
        ...stepRuntime,
        artifactsJson: stepRuntime.artifactsJson || stepRuntime.artifacts
      });

      if (stepRuntime.status === 'failed') {
        await updateBlueprintRunRecord(pool, runId, {
          status: 'failed',
          errorMessage: stepRuntime.errorMessage || '节点执行失败',
          runtimeSnapshotJson,
          completedAt: stepRuntime.completedAt || new Date().toISOString()
        });

        writeExecutionEvent(res, 'step-failed', {
          runId,
          nodeId: step.nodeId,
          nodeTitle: step.title,
          nodeKind: step.kind,
          runtime: stepRuntime
        });
        writeExecutionEvent(res, 'workflow-error', {
          runId,
          failedNodeId: step.nodeId,
          message: stepRuntime.errorMessage || '节点执行失败'
        });
        return res.end();
      }

      writeExecutionEvent(res, 'step-complete', {
        runId,
        nodeId: step.nodeId,
        nodeTitle: step.title,
        nodeKind: step.kind,
        runtime: stepRuntime
      });
    }

    const completedAt = new Date().toISOString();
    const artifactManifest = buildBlueprintRunArtifactManifest({
      runId,
      seed: normalizedSeed,
      modelName: selectedModel,
      scope,
      startNodeId,
      status: 'completed',
      startedAt: startedAt.toISOString(),
      completedAt,
      stepResults,
      selectedSteps
    });

    if (
      isBlueprintRunCancellationRequested(runId)
      || await getBlueprintRunCancellationStateFromStore(pool, runId)
    ) {
      const cancelledAt = new Date().toISOString();
      await updateBlueprintRunRecord(pool, runId, {
        status: 'cancelled',
        errorMessage: '运行已取消。',
        runtimeSnapshotJson,
        completedAt: cancelledAt
      });
      writeExecutionEvent(res, 'workflow-cancelled', {
        runId,
        cancelledAt
      });
      return res.end();
    }

    try {
      const outputBundleFiles = findBlueprintOutputBundleFiles(stepResults, selectedSteps) || {};
      const bundleResult = await writeBlueprintRunBundle({
        uploadsRootPath: getBlueprintUploadsRootPath(),
        runId,
        manifest: artifactManifest,
        indexHtml: outputBundleFiles['index.html'],
        styleCss: outputBundleFiles['style.css'],
        gameJs: outputBundleFiles['game.js'],
        readmeMd: outputBundleFiles['README.md']
      });
      artifactManifestJson = JSON.stringify(bundleResult.manifest);
      previewUrl = bundleResult.previewUrl;

      const smokeValidation = await validateBlueprintRunBundleBrowser({
        bundleDir: bundleResult.bundleDir
      });

      const outputStepRuntimeEntry = findBlueprintOutputStepRuntime(stepResults, selectedSteps);
      if (outputStepRuntimeEntry) {
        const nextOutputRuntime = {
          ...outputStepRuntimeEntry.runtime,
          artifactJson: {
            ...(outputStepRuntimeEntry.runtime.artifactJson || {}),
            browserValidation: smokeValidation
          }
        };

        if (!smokeValidation.skipped) {
          nextOutputRuntime.analysis = [
            String(outputStepRuntimeEntry.runtime.analysis || '').trim(),
            smokeValidation.ok
              ? '附加校验：浏览器级 smoke 校验已通过。'
              : `附加校验：浏览器级 smoke 校验失败。${smokeValidation.issues.join('；')}`
          ].filter(Boolean).join('\n');
        } else {
          nextOutputRuntime.analysis = [
            String(outputStepRuntimeEntry.runtime.analysis || '').trim(),
            smokeValidation.issues[0] || '附加校验：当前环境已跳过浏览器级 smoke 校验。'
          ].filter(Boolean).join('\n');
        }

        stepResults[outputStepRuntimeEntry.step.nodeId] = nextOutputRuntime;
        runtimeSnapshotJson = JSON.stringify(stepResults);
        await upsertBlueprintRunStepRecord(pool, runId, outputStepRuntimeEntry.step, {
          ...nextOutputRuntime,
          artifactsJson: nextOutputRuntime.artifactsJson || nextOutputRuntime.artifacts
        });

        writeExecutionEvent(res, 'step-complete', {
          runId,
          nodeId: outputStepRuntimeEntry.step.nodeId,
          nodeTitle: outputStepRuntimeEntry.step.title,
          nodeKind: outputStepRuntimeEntry.step.kind,
          runtime: nextOutputRuntime
        });
      }

      if (!smokeValidation.skipped && !smokeValidation.ok) {
        const errorMessage = `生成产物未通过浏览器校验：${smokeValidation.issues.join('；')}`;
        if (outputStepRuntimeEntry) {
          const failedOutputRuntime = {
            ...stepResults[outputStepRuntimeEntry.step.nodeId],
            status: 'failed',
            completedAt: new Date().toISOString(),
            errorMessage,
            artifactJson: {
              ...(stepResults[outputStepRuntimeEntry.step.nodeId]?.artifactJson || {}),
              status: 'failed',
              browserValidation: smokeValidation
            }
          };

          stepResults[outputStepRuntimeEntry.step.nodeId] = failedOutputRuntime;
          runtimeSnapshotJson = JSON.stringify(stepResults);
          await upsertBlueprintRunStepRecord(pool, runId, outputStepRuntimeEntry.step, {
            ...failedOutputRuntime,
            artifactsJson: failedOutputRuntime.artifactsJson || failedOutputRuntime.artifacts
          });

          writeExecutionEvent(res, 'step-failed', {
            runId,
            nodeId: outputStepRuntimeEntry.step.nodeId,
            nodeTitle: outputStepRuntimeEntry.step.title,
            nodeKind: outputStepRuntimeEntry.step.kind,
            runtime: failedOutputRuntime
          });
        }

        await updateBlueprintRunRecord(pool, runId, {
          status: 'failed',
          errorMessage,
          runtimeSnapshotJson,
          artifactManifestJson,
          previewUrl,
          completedAt: new Date().toISOString()
        });
        writeExecutionEvent(res, 'workflow-error', {
          runId,
          message: errorMessage
        });
        return res.end();
      }

      if (smokeValidation.skipped) {
        writeExecutionEvent(res, 'workflow-log', {
          runId,
          message: smokeValidation.issues[0] || '已跳过浏览器级校验。'
        });
      } else {
        writeExecutionEvent(res, 'workflow-log', {
          runId,
          message: '生成产物已通过浏览器级校验。'
        });
      }
    } catch (bundleError) {
      console.error('写入蓝图运行产物失败:', bundleError);
      artifactManifestJson = JSON.stringify(artifactManifest);
      previewUrl = null;
    }

    if (
      isBlueprintRunCancellationRequested(runId)
      || await getBlueprintRunCancellationStateFromStore(pool, runId)
    ) {
      const cancelledAt = new Date().toISOString();
      await updateBlueprintRunRecord(pool, runId, {
        status: 'cancelled',
        errorMessage: '运行已取消。',
        runtimeSnapshotJson,
        artifactManifestJson,
        previewUrl,
        completedAt: cancelledAt
      });
      writeExecutionEvent(res, 'workflow-cancelled', {
        runId,
        cancelledAt
      });
      return res.end();
    }

    await updateBlueprintRunRecord(pool, runId, {
      status: 'completed',
      runtimeSnapshotJson,
      artifactManifestJson,
      previewUrl,
      completedAt
    });

    writeExecutionEvent(res, 'workflow-complete', {
      runId,
      model: selectedModel,
      totalSteps: selectedSteps.length,
      startNodeId: startNodeId || '',
      scope,
      completedAt
    });
    return res.end();
  } catch (error) {
    console.error('执行蓝图工作流失败:', error);

    if (runId) {
      try {
        await updateBlueprintRunRecord(getPool(), runId, {
          status: 'failed',
          errorMessage: error.message || '执行蓝图工作流失败',
          runtimeSnapshotJson,
          completedAt: new Date().toISOString()
        });
      } catch (persistError) {
        console.error('更新蓝图运行失败状态时出错:', persistError);
      }
    }

    if (!res.headersSent) {
      return res.status(error.status || 500).json({
        error: error.message || '执行蓝图工作流失败'
      });
    }

    writeExecutionEvent(res, 'workflow-error', {
      message: error.message || '执行蓝图工作流失败'
    });
    return res.end();
  } finally {
    if (runId) {
      clearActiveBlueprintRun(runId);
    }
  }
};

module.exports = {
  createBlueprint,
  getBlueprintBySeed,
  planBlueprintWorkflow,
  listRecentBlueprints,
  saveBlueprintBySeed,
  listBlueprintRuns,
  getBlueprintRunDetail,
  cancelBlueprintRun,
  executeBlueprintWorkflow,
  __test: {
    prepareExecutionStreamResponse,
    writeExecutionEvent,
    getBlueprintRunCancellationStateFromStore,
    createBlueprintRunRecord,
    updateBlueprintRunRecord,
    persistBlueprintRunCancellationRequest,
    upsertBlueprintRunStepRecord
  }
};
