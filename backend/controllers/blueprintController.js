const crypto = require('crypto');
const { getPool } = require('../config/database');

const BLUEPRINT_SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BLUEPRINT_SEED_PATTERN = /^[A-Z0-9]{8,32}$/;

let blueprintTablesReady = false;
let blueprintTablesInitPromise = null;

const normalizeSeed = (value = '') => String(value || '').trim().toUpperCase();

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
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
    )
  ]);

  try {
    await blueprintTablesInitPromise;
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

module.exports = {
  createBlueprint,
  getBlueprintBySeed,
  saveBlueprintBySeed
};
