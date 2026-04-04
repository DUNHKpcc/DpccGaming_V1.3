const { getPool } = require('../../config/database');
const { generateAiReply } = require('../../controllers/discussion/shared/ai');
const { loadBlueprintGameCodePreview } = require('../../utils/blueprintGameContext');
const { writeBlueprintRunBundle } = require('../../utils/blueprintArtifacts');
const { extractBlueprintVideoKeyframes } = require('../../utils/blueprintVideoFrames');
const {
  buildBlueprintExecutionPlan,
  selectBlueprintExecutionSteps
} = require('../../utils/blueprintExecution');
const {
  executeBlueprintNodeStep
} = require('../../utils/blueprintNodeHandlers');
const {
  clearActiveBlueprintRun,
  isBlueprintRunCancellationRequested,
  registerActiveBlueprintRun,
  requestBlueprintRunCancel
} = require('../../utils/blueprintRunControl');
const repository = require('../../repositories/blueprintRepository');
const {
  BLUEPRINT_EXECUTION_HEARTBEAT_MS,
  BLUEPRINT_SEED_PATTERN,
  DEFAULT_BLUEPRINT_EXECUTION_MODEL,
  DEFAULT_BLUEPRINT_VISION_MODEL,
  createHttpError,
  getBlueprintUploadsRootPath,
  normalizeBlueprintRerunInstruction,
  normalizeExecutionScope,
  normalizeModelName,
  normalizeVisionModelName,
  normalizeRunListLimit,
  normalizeSeed,
  normalizeWorkflowPayload
} = require('./blueprintCommon');

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

const withExecutionHeartbeat = async ({
  res,
  intervalMs = BLUEPRINT_EXECUTION_HEARTBEAT_MS,
  buildPayload
} = {}, task) => {
  if (typeof task !== 'function') {
    throw new TypeError('withExecutionHeartbeat requires a task function');
  }

  if (!res || typeof buildPayload !== 'function') {
    return task();
  }

  const normalizedIntervalMs = Math.max(10, Math.floor(Number(intervalMs) || BLUEPRINT_EXECUTION_HEARTBEAT_MS));
  const timer = setInterval(() => {
    try {
      const payload = buildPayload();
      if (!payload || typeof payload !== 'object') return;
      const { event = 'workflow-log', ...eventPayload } = payload;
      writeExecutionEvent(res, event, eventPayload);
    } catch {
      // ignore heartbeat write errors and let the main task finish/fail naturally
    }
  }, normalizedIntervalMs);

  timer.unref?.();

  try {
    return await task();
  } finally {
    clearInterval(timer);
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

const normalizeBlueprintExecutionMode = (value = '') =>
  String(value || '').trim().toLowerCase() === 'planned' ? 'planned' : 'default';

const clipBlueprintArtifactText = (value = '', maxLength = 420) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const buildGeneratedPlayableNodePayload = ({
  runId = 0,
  previewUrl = '',
  stepResults = {},
  selectedSteps = [],
  plannedPrompt = ''
} = {}) => {
  const outputStep = [...(Array.isArray(selectedSteps) ? selectedSteps : [])]
    .reverse()
    .find((step) => step?.kind === 'output');
  const outputRuntime = outputStep ? stepResults?.[outputStep.nodeId] : null;
  if (!outputRuntime || String(outputRuntime.artifactType || '') !== 'file-bundle') {
    return null;
  }

  const gameSpec = outputRuntime?.artifactJson?.gameSpec || {};
  const title = String(
    gameSpec?.title
    || outputStep?.title
    || plannedPrompt
    || `Blueprint Run ${Number(runId || 0)}`
  ).trim();

  return {
    id: `blueprint-output-${Number(runId || 0)}`,
    title: title || `Blueprint Run ${Number(runId || 0)}`,
    category: 'other',
    description: String(plannedPrompt || outputRuntime.summary || '').trim(),
    engineLabel: 'HTML5',
    codeTypeLabel: 'JavaScript',
    codeSummary: 'Blueprint planned 模式生成的可直接游玩 H5 成品。',
    codeEntryPath: 'index.html',
    codePackageUrl: String(previewUrl || '').trim(),
    previewUrl: String(previewUrl || '').trim(),
    isGeneratedPlayable: true,
    generatedFromRunId: Number(runId || 0),
    generatedFromNodeId: String(outputStep?.nodeId || '')
  };
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

const shouldWriteBlueprintRunBundle = (stepResults = {}, selectedSteps = []) =>
  Boolean(findBlueprintOutputBundleFiles(stepResults, selectedSteps));

const listBlueprintRuns = async ({ userId, query = {} } = {}) => {
  const seed = normalizeSeed(query?.seed);
  const limit = normalizeRunListLimit(query?.limit);
  const pool = getPool();
  await repository.ensureBlueprintTables(pool);

  const runs = await repository.getBlueprintRunSummaries(pool, {
    userId,
    seed: BLUEPRINT_SEED_PATTERN.test(seed) ? seed : '',
    limit
  });

  return { runs };
};

const getBlueprintRunDetail = async ({ userId, runId } = {}) => {
  const numericRunId = Number(runId || 0);
  if (!numericRunId) {
    throw createHttpError(400, '运行记录 ID 无效');
  }

  const pool = getPool();
  await repository.ensureBlueprintTables(pool);

  const runDetail = await repository.getBlueprintRunDetailById(pool, numericRunId, userId);
  if (!runDetail) {
    throw createHttpError(404, '未找到对应的运行记录');
  }

  return runDetail;
};

const cancelBlueprintRun = async ({ userId, runId } = {}) => {
  const numericRunId = Number(runId || 0);
  if (!numericRunId) {
    throw createHttpError(400, '运行记录 ID 无效');
  }

  const pool = getPool();
  await repository.ensureBlueprintTables(pool);

  const runDetail = await repository.getBlueprintRunDetailById(pool, numericRunId, userId);
  if (!runDetail) {
    throw createHttpError(404, '未找到对应的运行记录');
  }

  if (!['running', 'cancel_requested'].includes(String(runDetail.status || ''))) {
    throw createHttpError(409, '当前运行已经结束，无法取消。');
  }

  const cancelAccepted = requestBlueprintRunCancel(numericRunId, userId);
  await repository.persistBlueprintRunCancellationRequest(
    pool,
    numericRunId,
    JSON.stringify(runDetail.runtimeSnapshot || {}),
    {
      artifactManifestJson: JSON.stringify(runDetail.artifactManifest || {}),
      previewUrl: runDetail.previewUrl || null
    }
  );

  if (!cancelAccepted) {
    return {
      runId: numericRunId,
      status: 'cancel_requested',
      accepted: false,
      message: '取消请求已记录，但当前进程无法直接中断该运行。'
    };
  }

  return {
    runId: numericRunId,
    status: 'cancel_requested',
    accepted: true
  };
};

const executeBlueprintWorkflow = async ({ userId, body = {}, res } = {}) => {
  let runId = 0;
  let runtimeSnapshotJson = '{}';
  let artifactManifestJson = null;
  let previewUrl = null;

  try {
    const pool = getPool();
    await repository.ensureBlueprintTables(pool);
    const workflow = normalizeWorkflowPayload(body?.workflow, { requireNodes: true });
    const selectedModel = body?.modelExplicit === false
      ? ''
      : normalizeModelName(body?.model);
    const selectedVisionModel = normalizeVisionModelName(body?.visionModel || DEFAULT_BLUEPRINT_VISION_MODEL);
    const plan = buildBlueprintExecutionPlan(workflow);
    const executionMode = normalizeBlueprintExecutionMode(body?.executionMode);
    const plannedPrompt = String(workflow?.meta?.plannedPrompt || '').trim();
    const normalizedSeed = normalizeSeed(body?.seed);
    const startNodeId = String(body?.startNodeId || '').trim();
    const scope = normalizeExecutionScope(body?.scope);
    const rerunInstruction = scope === 'single'
      ? normalizeBlueprintRerunInstruction(body?.rerunInstruction)
      : '';
    const runtimeSnapshot = body?.runtimeSnapshot && typeof body.runtimeSnapshot === 'object'
      ? body.runtimeSnapshot
      : {};
    const selectedSteps = selectBlueprintExecutionSteps(plan, { startNodeId, scope });
    const stepResults = {};
    const startedAt = new Date();
    const defaultExecutionModel = selectedModel || DEFAULT_BLUEPRINT_EXECUTION_MODEL;

    Object.entries(runtimeSnapshot).forEach(([nodeId, runtime]) => {
      if (!plan.stepsById[nodeId] || !runtime || typeof runtime !== 'object') return;
      stepResults[nodeId] = {
        ...runtime,
        kind: runtime.kind || plan.stepsById[nodeId].kind,
        status: runtime.status || 'completed'
      };
    });

    runtimeSnapshotJson = JSON.stringify(stepResults);
    runId = await repository.createBlueprintRunRecord(pool, {
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
      model: defaultExecutionModel,
      visionModel: selectedVisionModel,
      executionMode,
      totalSteps: selectedSteps.length,
      startNodeId: startNodeId || '',
      scope,
      startedAt: startedAt.toISOString()
    });

    for (const step of selectedSteps) {
      if (
        isBlueprintRunCancellationRequested(runId)
        || await repository.getBlueprintRunCancellationStateFromStore(pool, runId)
      ) {
        const cancelledAt = new Date().toISOString();
        await repository.updateBlueprintRunRecord(pool, runId, {
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
      const stepStartedAt = new Date().toISOString();
      const stepModel = step.mode === 'source'
        ? selectedVisionModel
        : (step.kind === 'output' ? (selectedModel || 'GLM-4.5') : defaultExecutionModel);

      await repository.upsertBlueprintRunStepRecord(pool, runId, step, {
        status: 'running',
        model: stepModel,
        startedAt: stepStartedAt
      });

      writeExecutionEvent(res, 'step-start', {
        runId,
        nodeId: step.nodeId,
        nodeTitle: step.title,
        nodeKind: step.kind,
        mode: step.mode,
        model: stepModel,
        upstreamNodeIds: step.upstreamNodeIds,
        startedAt: stepStartedAt
      });

      let stepRuntime;
      let latestStepProgress = {
        progress: 0.08,
        stage: 'prepare',
        detail: '节点仍在执行中，请保持连接。'
      };

      try {
        const executionNode = step.mode === 'source'
          ? await enrichBlueprintGameNodeContext(node)
          : node;

        stepRuntime = await withExecutionHeartbeat({
          res,
          buildPayload: () => ({
            event: 'step-progress',
            runId,
            nodeId: step.nodeId,
            nodeTitle: step.title,
            nodeKind: step.kind,
            progress: latestStepProgress.progress,
            stage: latestStepProgress.stage,
            detail: latestStepProgress.stage === 'generate'
              ? '仍在等待模型返回结果，请保持连接。'
              : '节点仍在执行中，请保持连接。'
          })
        }, () => executeBlueprintNodeStep({
          step: stepInfo,
          node: executionNode,
          stepResults,
          stepsById: plan.stepsById,
          executionMode,
          plannedPrompt,
          selectedModel,
          selectedVisionModel,
          generateAiReply,
          startedAt: stepStartedAt,
          rerunInstruction: step.nodeId === startNodeId ? rerunInstruction : '',
          onProgress: (progressEvent = {}) => {
            latestStepProgress = {
              progress: Number.isFinite(Number(progressEvent.progress))
                ? Number(progressEvent.progress)
                : latestStepProgress.progress,
              stage: String(progressEvent.stage || latestStepProgress.stage || 'prepare'),
              detail: String(progressEvent.detail || latestStepProgress.detail || '')
            };
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
        }));
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
          model: stepModel,
          status: 'failed',
          upstreamNodeIds: step.upstreamNodeIds,
          startedAt: stepStartedAt,
          completedAt: failedAt,
          errorMessage: failedMessage
        };
      }

      stepResults[step.nodeId] = stepRuntime;
      runtimeSnapshotJson = JSON.stringify(stepResults);
      await repository.upsertBlueprintRunStepRecord(pool, runId, step, {
        ...stepRuntime,
        artifactsJson: stepRuntime.artifactsJson || stepRuntime.artifacts
      });

      if (stepRuntime.status === 'failed') {
        await repository.updateBlueprintRunRecord(pool, runId, {
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
      || await repository.getBlueprintRunCancellationStateFromStore(pool, runId)
    ) {
      const cancelledAt = new Date().toISOString();
      await repository.updateBlueprintRunRecord(pool, runId, {
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

    if (shouldWriteBlueprintRunBundle(stepResults, selectedSteps)) {
      const outputBundleFiles = findBlueprintOutputBundleFiles(stepResults, selectedSteps) || {};
      const bundleResult = await writeBlueprintRunBundle({
        uploadsRootPath: getBlueprintUploadsRootPath(),
        runId,
        manifest: artifactManifest,
        indexHtml: outputBundleFiles['index.html']
      });
      artifactManifestJson = JSON.stringify(bundleResult.manifest);
      previewUrl = bundleResult.previewUrl;

      writeExecutionEvent(res, 'workflow-log', {
        runId,
        message: '生成产物已写入预览目录。'
      });
    } else {
      artifactManifestJson = JSON.stringify(artifactManifest);
      previewUrl = null;
      writeExecutionEvent(res, 'workflow-log', {
        runId,
        message: '本次执行未触达输出节点，已跳过预览产物写入。'
      });
    }

    if (
      isBlueprintRunCancellationRequested(runId)
      || await repository.getBlueprintRunCancellationStateFromStore(pool, runId)
    ) {
      const cancelledAt = new Date().toISOString();
      await repository.updateBlueprintRunRecord(pool, runId, {
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

    await repository.updateBlueprintRunRecord(pool, runId, {
      status: 'completed',
      runtimeSnapshotJson,
      artifactManifestJson,
      previewUrl,
      completedAt
    });

    const generatedPlayableNode = executionMode === 'planned'
      ? buildGeneratedPlayableNodePayload({
          runId,
          previewUrl,
          stepResults,
          selectedSteps,
          plannedPrompt
        })
      : null;

    writeExecutionEvent(res, 'workflow-complete', {
      runId,
      model: selectedModel,
      executionMode,
      previewUrl,
      generatedPlayableNode,
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
        await repository.updateBlueprintRunRecord(getPool(), runId, {
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
  listBlueprintRuns,
  getBlueprintRunDetail,
  cancelBlueprintRun,
  executeBlueprintWorkflow,
  __test: {
    prepareExecutionStreamResponse,
    writeExecutionEvent,
    withExecutionHeartbeat,
    shouldWriteBlueprintRunBundle
  }
};
