const { getPool } = require('../../config/database');
const { generateAiReply } = require('../../controllers/discussion/shared/ai');
const {
  buildBlueprintPlanningRepairPrompt,
  buildBlueprintPlannerNodeCatalog,
  buildBlueprintPlanningPrompt,
  normalizeBlueprintPlanningResult,
  resolveBlueprintPlannerModel
} = require('../../utils/blueprintPlanner');
const repository = require('../../repositories/blueprintRepository');
const {
  BLUEPRINT_SEED_PATTERN,
  buildBlueprintPlannerRequestOptions,
  buildBlueprintResponse,
  createHttpError,
  deriveBlueprintListMeta,
  generateSeedValue,
  normalizeModelName,
  normalizeRunListLimit,
  normalizeSeed,
  normalizeWorkflowPayload,
  parseStoredWorkflow
} = require('./blueprintCommon');

const BLUEPRINT_PLAN_LOG_PREFIX = '[blueprint:plan]';

const summarizeBlueprintPlannerNodesForLog = (workflow = {}) =>
  (Array.isArray(workflow?.nodes) ? workflow.nodes : []).map((node = {}) => ({
    id: String(node?.id || '').trim(),
    kind: String(node?.kind || '').trim(),
    title: String(node?.title || '').trim()
  }));

const buildBlueprintPlannerAiReplyLogPayload = ({
  prompt = '',
  seed = '',
  plannerModel = '',
  workflow = {},
  rawReply = ''
} = {}) => ({
  seed: String(seed || '').trim(),
  model: String(plannerModel || '').trim(),
  prompt: String(prompt || '').trim(),
  existingNodeCount: Array.isArray(workflow?.nodes) ? workflow.nodes.length : 0,
  existingEdgeCount: Array.isArray(workflow?.edges) ? workflow.edges.length : 0,
  existingNodes: summarizeBlueprintPlannerNodesForLog(workflow),
  rawReply: String(rawReply || '')
});

const buildBlueprintPlannerResultLogPayload = ({
  result = {},
  fallbackReason = ''
} = {}) => ({
  summary: String(result?.summary || '').trim(),
  warnings: Array.isArray(result?.warnings) ? result.warnings : [],
  fallbackReason: String(fallbackReason || '').trim(),
  nodeCount: Array.isArray(result?.workflow?.nodes) ? result.workflow.nodes.length : 0,
  edgeCount: Array.isArray(result?.workflow?.edges) ? result.workflow.edges.length : 0,
  nodes: summarizeBlueprintPlannerNodesForLog(result?.workflow || {})
});

const resolveBlueprintPlannerRequestModel = (body = {}) => {
  const requestedModel = normalizeModelName(body?.model);
  return resolveBlueprintPlannerModel(requestedModel);
};

const normalizeOrRepairBlueprintPlanningResult = async ({
  prompt = '',
  workflow = {},
  plannerModel = '',
  rawReply = '',
  requestRepair
} = {}) => {
  try {
    return {
      result: normalizeBlueprintPlanningResult({
        rawReply,
        workflow
      }),
      repaired: false,
      fallbackUsed: false
    };
  } catch (error) {
    if (error?.status !== 400) {
      throw error;
    }

    if (typeof requestRepair !== 'function') {
      throw error;
    }

    const repairPrompt = buildBlueprintPlanningRepairPrompt({
      rawReply,
      workflow
    });

    const repairedReply = await requestRepair({
      prompt: repairPrompt.prompt,
      systemDirective: repairPrompt.systemDirective,
      plannerModel,
      originalPrompt: prompt,
      rawReply
    });

    const result = normalizeBlueprintPlanningResult({
      rawReply: repairedReply,
      workflow
    });

    return {
      result: {
        ...result,
        warnings: [
          'AI 首次回复未返回标准工作流，系统已自动修复格式。',
          ...(Array.isArray(result?.warnings) ? result.warnings : [])
        ]
      },
      repaired: true,
      fallbackUsed: false,
      repairedReply
    };
  }
};

const createBlueprint = async ({ userId, body = {} } = {}) => {
  const clientSeed = normalizeSeed(body?.seed);
  const workflow = normalizeWorkflowPayload(body?.workflow, { requireNodes: true });
  const seed = clientSeed || generateSeedValue();

  if (!BLUEPRINT_SEED_PATTERN.test(seed)) {
    throw createHttpError(400, '种子格式无效，请使用 8-32 位大写字母或数字');
  }

  const pool = getPool();
  await repository.ensureBlueprintTables(pool);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const existingSource = await repository.getSourceBySeed(connection, seed);
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

  const now = new Date().toISOString();
  return {
    seed,
    ownership: 'source',
    is_owner: true,
    workflow,
    source_created_at: now,
    source_updated_at: now,
    copy_updated_at: now
  };
};

const planBlueprintWorkflow = async ({ body = {} } = {}) => {
  const prompt = String(body?.prompt || '').trim();
  const seed = normalizeSeed(body?.seed);
  const plannerRequestOptions = buildBlueprintPlannerRequestOptions();

  if (!prompt) {
    throw createHttpError(400, '请输入工作流需求后再让 AI 规划。');
  }

  const workflow = normalizeWorkflowPayload(body?.workflow, { requireNodes: false });
  const plannerModel = resolveBlueprintPlannerRequestModel(body);
  const availableNodes = Array.isArray(body?.availableNodes) && body.availableNodes.length
    ? body.availableNodes
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
    systemDirective: plannerPrompt.systemDirective,
    requestOptions: plannerRequestOptions
  });

  console.info(
    `${BLUEPRINT_PLAN_LOG_PREFIX} 收到 AI 规划回复`,
    buildBlueprintPlannerAiReplyLogPayload({
      prompt,
      seed,
      plannerModel,
      workflow,
      rawReply
    })
  );

  const {
    result: plannedResult,
    repaired,
    repairedReply
  } = await normalizeOrRepairBlueprintPlanningResult({
    prompt,
    workflow,
    plannerModel,
    rawReply,
    requestRepair: async ({ prompt: repairPrompt, systemDirective }) => {
      console.warn(
        `${BLUEPRINT_PLAN_LOG_PREFIX} AI 规划回复不可解析，开始请求修复`,
        buildBlueprintPlannerAiReplyLogPayload({
          prompt,
          seed,
          plannerModel,
          workflow,
          rawReply
        })
      );

      return generateAiReply({
        prompt: repairPrompt,
        gameTitle: 'Blueprint Workflow Planner Repair',
        roomMessages: [],
        roomSummary: null,
        memoryEntries: [],
        builtinModel: plannerModel,
        systemDirective,
        requestOptions: plannerRequestOptions
      });
    }
  });

  if (repaired) {
    console.info(
      `${BLUEPRINT_PLAN_LOG_PREFIX} AI 规划修复完成`,
      {
        repairedReply: String(repairedReply || ''),
        ...buildBlueprintPlannerResultLogPayload({
          result: plannedResult
        })
      }
    );
  } else {
    console.info(
      `${BLUEPRINT_PLAN_LOG_PREFIX} AI 规划归一化完成`,
      buildBlueprintPlannerResultLogPayload({
        result: plannedResult
      })
    );
  }

  return {
    ...plannedResult,
    workflow: {
      ...(plannedResult.workflow || {}),
      meta: {
        ...(workflow?.meta && typeof workflow.meta === 'object' ? workflow.meta : {}),
        plannedPrompt: prompt
      }
    },
    model: plannerModel
  };
};

const getBlueprintBySeed = async ({ userId, seed } = {}) => {
  const normalizedSeed = normalizeSeed(seed);
  if (!BLUEPRINT_SEED_PATTERN.test(normalizedSeed)) {
    throw createHttpError(400, '种子格式无效');
  }

  const pool = getPool();
  await repository.ensureBlueprintTables(pool);

  const sourceRow = await repository.getSourceBySeed(pool, normalizedSeed);
  if (!sourceRow) {
    throw createHttpError(404, '未找到对应的蓝图种子');
  }

  let copyRow = await repository.getCopyBySeedAndOwner(pool, normalizedSeed, userId);

  if (!copyRow) {
    await pool.execute(
      `INSERT INTO blueprint_workflow_copies (seed, owner_user_id, workflow_json)
       VALUES (?, ?, ?)`,
      [normalizedSeed, userId, sourceRow.workflow_json]
    );

    copyRow = await repository.getCopyBySeedAndOwner(pool, normalizedSeed, userId);
  }

  return buildBlueprintResponse(sourceRow, copyRow, userId);
};

const saveBlueprintBySeed = async ({ userId, seed, body = {} } = {}) => {
  const normalizedSeed = normalizeSeed(seed);
  if (!BLUEPRINT_SEED_PATTERN.test(normalizedSeed)) {
    throw createHttpError(400, '种子格式无效');
  }

  const workflow = normalizeWorkflowPayload(body?.workflow, { requireNodes: true });
  const workflowJson = JSON.stringify(workflow);

  const pool = getPool();
  await repository.ensureBlueprintTables(pool);

  const connection = await pool.getConnection();
  let sourceRow = null;

  try {
    await connection.beginTransaction();

    sourceRow = await repository.getSourceBySeed(connection, normalizedSeed);
    if (!sourceRow) {
      throw createHttpError(404, '未找到对应的蓝图种子');
    }

    await connection.execute(
      `INSERT INTO blueprint_workflow_copies (seed, owner_user_id, workflow_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         workflow_json = VALUES(workflow_json),
         updated_at = CURRENT_TIMESTAMP`,
      [normalizedSeed, userId, workflowJson]
    );

    if (Number(sourceRow.owner_user_id || 0) === Number(userId || 0)) {
      await connection.execute(
        `UPDATE blueprint_workflow_sources
         SET workflow_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE seed = ?`,
        [workflowJson, normalizedSeed]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const refreshedSourceRow = await repository.getSourceBySeed(pool, normalizedSeed);
  const refreshedCopyRow = await repository.getCopyBySeedAndOwner(pool, normalizedSeed, userId);
  return buildBlueprintResponse(refreshedSourceRow || sourceRow, refreshedCopyRow, userId);
};

const listRecentBlueprints = async ({ userId, query = {} } = {}) => {
  const limit = normalizeRunListLimit(query?.limit);
  const pool = getPool();
  await repository.ensureBlueprintTables(pool);

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

  return { blueprints };
};

module.exports = {
  createBlueprint,
  planBlueprintWorkflow,
  getBlueprintBySeed,
  saveBlueprintBySeed,
  listRecentBlueprints,
  __test: {
    buildBlueprintPlannerRequestOptions,
    buildBlueprintPlannerAiReplyLogPayload,
    buildBlueprintPlannerResultLogPayload,
    normalizeOrRepairBlueprintPlanningResult,
    resolveBlueprintPlannerRequestModel
  }
};
