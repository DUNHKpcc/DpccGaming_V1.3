const persistenceService = require('../services/blueprint/blueprintPersistenceService');
const runService = require('../services/blueprint/blueprintRunService');
const repository = require('../repositories/blueprintRepository');

const handleControllerError = (res, error, fallbackMessage, logLabel) => {
  console.error(logLabel, error);
  return res.status(error.status || 500).json({
    error: error.message || fallbackMessage
  });
};

const createBlueprint = async (req, res) => {
  try {
    const payload = await persistenceService.createBlueprint({
      userId: Number(req.user?.userId || 0),
      body: req.body
    });
    return res.status(201).json(payload);
  } catch (error) {
    return handleControllerError(res, error, '创建蓝图种子失败', '创建蓝图种子失败:');
  }
};

const planBlueprintWorkflow = async (req, res) => {
  try {
    const payload = await persistenceService.planBlueprintWorkflow({
      body: req.body
    });
    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, '规划蓝图工作流失败', '规划蓝图工作流失败:');
  }
};

const getBlueprintBySeed = async (req, res) => {
  try {
    const payload = await persistenceService.getBlueprintBySeed({
      userId: Number(req.user?.userId || 0),
      seed: req.params?.seed
    });
    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, '加载蓝图失败', '按种子获取蓝图失败:');
  }
};

const saveBlueprintBySeed = async (req, res) => {
  try {
    const payload = await persistenceService.saveBlueprintBySeed({
      userId: Number(req.user?.userId || 0),
      seed: req.params?.seed,
      body: req.body
    });
    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, '保存蓝图失败', '保存蓝图失败:');
  }
};

const listBlueprintRuns = async (req, res) => {
  try {
    const payload = await runService.listBlueprintRuns({
      userId: Number(req.user?.userId || 0),
      query: req.query
    });
    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, '获取蓝图运行列表失败', '获取蓝图运行列表失败:');
  }
};

const listRecentBlueprints = async (req, res) => {
  try {
    const payload = await persistenceService.listRecentBlueprints({
      userId: Number(req.user?.userId || 0),
      query: req.query
    });
    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, '获取最近蓝图列表失败', '获取最近蓝图列表失败:');
  }
};

const getBlueprintRunDetail = async (req, res) => {
  try {
    const payload = await runService.getBlueprintRunDetail({
      userId: Number(req.user?.userId || 0),
      runId: req.params?.runId
    });
    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, '获取蓝图运行记录失败', '获取蓝图运行记录失败:');
  }
};

const cancelBlueprintRun = async (req, res) => {
  try {
    const payload = await runService.cancelBlueprintRun({
      userId: Number(req.user?.userId || 0),
      runId: req.params?.runId
    });

    if (payload?.accepted === false) {
      return res.status(202).json(payload);
    }

    return res.json(payload);
  } catch (error) {
    return handleControllerError(res, error, '取消蓝图运行失败', '取消蓝图运行失败:');
  }
};

const executeBlueprintWorkflow = async (req, res) =>
  runService.executeBlueprintWorkflow({
    userId: Number(req.user?.userId || 0),
    body: req.body,
    res
  });

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
    ...runService.__test,
    ...persistenceService.__test,
    getBlueprintRunCancellationStateFromStore: repository.getBlueprintRunCancellationStateFromStore,
    createBlueprintRunRecord: repository.createBlueprintRunRecord,
    updateBlueprintRunRecord: repository.updateBlueprintRunRecord,
    persistBlueprintRunCancellationRequest: repository.persistBlueprintRunCancellationRequest,
    upsertBlueprintRunStepRecord: repository.upsertBlueprintRunStepRecord
  }
};
