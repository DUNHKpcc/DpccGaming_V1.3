const {
  getContinuableBlueprintStep,
  summarizeBlueprintRunStatus
} = require('../utils/blueprintRunState');
const {
  BLUEPRINT_SEED_PATTERN,
  DEFAULT_BLUEPRINT_EXECUTION_MODEL,
  normalizeSeed,
  parseNullableJson,
  toDatabaseTimestamp
} = require('../services/blueprint/blueprintCommon');

let blueprintTablesReady = false;
let blueprintTablesInitPromise = null;
let blueprintRunCleanupReady = false;

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
    await ensureBlueprintTableColumn(pool, 'blueprint_workflow_runs', 'artifact_manifest_json', 'artifact_manifest_json LONGTEXT NULL');
    await ensureBlueprintTableColumn(pool, 'blueprint_workflow_runs', 'preview_url', 'preview_url VARCHAR(512) DEFAULT NULL');
    await ensureBlueprintTableColumn(pool, 'blueprint_workflow_run_steps', 'visible_input_text', 'visible_input_text LONGTEXT DEFAULT NULL');
    await ensureBlueprintTableColumn(pool, 'blueprint_workflow_run_steps', 'artifact_type', 'artifact_type VARCHAR(64) DEFAULT NULL');
    await ensureBlueprintTableColumn(pool, 'blueprint_workflow_run_steps', 'artifact_json', 'artifact_json LONGTEXT DEFAULT NULL');
    await ensureBlueprintTableColumn(pool, 'blueprint_workflow_run_steps', 'artifacts_json', 'artifacts_json LONGTEXT DEFAULT NULL');
    await ensureBlueprintTableColumn(pool, 'blueprint_workflow_run_steps', 'retry_count', 'retry_count INT NOT NULL DEFAULT 0');

    if (!blueprintRunCleanupReady) {
      const cleanupConnection = typeof pool?.getConnection === 'function'
        ? await pool.getConnection()
        : pool;

      try {
        await cleanupInvalidBlueprintRuns(cleanupConnection);
        blueprintRunCleanupReady = true;
      } catch (error) {
        console.error('清理无效 Blueprint 运行记录失败:', error);
      } finally {
        cleanupConnection?.release?.();
      }
    }

    blueprintTablesReady = true;
  } finally {
    blueprintTablesInitPromise = null;
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

const resolveBlueprintRunPersistenceEligibility = async (executor, { seed, userId } = {}) => {
  const normalizedSeed = normalizeSeed(seed);
  const numericUserId = Number(userId || 0);

  if (!normalizedSeed || !BLUEPRINT_SEED_PATTERN.test(normalizedSeed) || !numericUserId) {
    return {
      shouldPersist: false,
      normalizedSeed: normalizedSeed || '',
      sourceExists: false,
      hasUserCopy: false,
      isSourceOwner: false
    };
  }

  const sourceRow = await getSourceBySeed(executor, normalizedSeed);
  if (!sourceRow) {
    return {
      shouldPersist: false,
      normalizedSeed,
      sourceExists: false,
      hasUserCopy: false,
      isSourceOwner: false
    };
  }

  const isSourceOwner = Number(sourceRow.owner_user_id || 0) === numericUserId;
  const copyRow = isSourceOwner ? null : await getCopyBySeedAndOwner(executor, normalizedSeed, numericUserId);
  const hasUserCopy = Boolean(copyRow);

  return {
    shouldPersist: isSourceOwner || hasUserCopy,
    normalizedSeed,
    sourceExists: true,
    hasUserCopy,
    isSourceOwner
  };
};

const findInvalidBlueprintRunIds = async (executor, { limit = 500 } = {}) => {
  const normalizedLimit = Math.max(1, Math.floor(Number(limit) || 500));
  const [rows] = await executor.execute(
    `SELECT r.id
     FROM blueprint_workflow_runs r
     LEFT JOIN blueprint_workflow_sources s
       ON s.seed = r.seed
     LEFT JOIN blueprint_workflow_copies c
       ON c.seed = r.seed
      AND c.owner_user_id = r.owner_user_id
     WHERE r.seed IS NULL
        OR r.seed = ''
        OR s.id IS NULL
        OR (s.owner_user_id <> r.owner_user_id AND c.id IS NULL)
     ORDER BY r.id ASC
     LIMIT ?`,
    [normalizedLimit]
  );

  return Array.isArray(rows)
    ? rows
      .map((row) => Number(row?.id || 0))
      .filter((id) => id > 0)
    : [];
};

const deleteBlueprintRunsCascade = async (executor, runIds = []) => {
  const normalizedRunIds = Array.isArray(runIds)
    ? runIds.map((runId) => Number(runId || 0)).filter((runId) => runId > 0)
    : [];

  if (!normalizedRunIds.length) {
    return { deletedRunCount: 0 };
  }

  const placeholders = normalizedRunIds.map(() => '?').join(', ');
  await executor.execute(
    `DELETE FROM blueprint_workflow_run_steps
     WHERE run_id IN (${placeholders})`,
    normalizedRunIds
  );
  await executor.execute(
    `DELETE FROM blueprint_workflow_runs
     WHERE id IN (${placeholders})`,
    normalizedRunIds
  );

  return { deletedRunCount: normalizedRunIds.length };
};

const cleanupInvalidBlueprintRuns = async (executor, { limit = 500 } = {}) => {
  if (!executor || typeof executor.execute !== 'function') {
    return { deletedRunCount: 0 };
  }

  const supportsTransaction = typeof executor.beginTransaction === 'function'
    && typeof executor.commit === 'function'
    && typeof executor.rollback === 'function';

  if (supportsTransaction) {
    await executor.beginTransaction();
  }

  try {
    const invalidRunIds = await findInvalidBlueprintRunIds(executor, { limit });
    const result = await deleteBlueprintRunsCascade(executor, invalidRunIds);

    if (supportsTransaction) {
      await executor.commit();
    }

    return result;
  } catch (error) {
    if (supportsTransaction) {
      await executor.rollback();
    }
    throw error;
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
      payload.modelName || DEFAULT_BLUEPRINT_EXECUTION_MODEL,
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

module.exports = {
  ensureBlueprintTables,
  getSourceBySeed,
  getCopyBySeedAndOwner,
  resolveBlueprintRunPersistenceEligibility,
  findInvalidBlueprintRunIds,
  deleteBlueprintRunsCascade,
  cleanupInvalidBlueprintRuns,
  getBlueprintRunCancellationStateFromStore,
  persistBlueprintRunCancellationRequest,
  createBlueprintRunRecord,
  updateBlueprintRunRecord,
  upsertBlueprintRunStepRecord,
  getBlueprintRunDetailById,
  getBlueprintRunSummaries
};
