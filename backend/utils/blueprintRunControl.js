const activeBlueprintRuns = new Map();

const normalizeRunId = (value) => Number(value || 0);

const registerActiveBlueprintRun = (runId, payload = {}) => {
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) return;

  activeBlueprintRuns.set(normalizedRunId, {
    ownerUserId: Number(payload.ownerUserId || 0),
    cancelRequested: false
  });
};

const requestBlueprintRunCancel = (runId, requesterUserId = 0) => {
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) return false;

  const current = activeBlueprintRuns.get(normalizedRunId);
  if (!current) return false;
  if (current.ownerUserId && Number(requesterUserId || 0) && current.ownerUserId !== Number(requesterUserId || 0)) {
    return false;
  }

  activeBlueprintRuns.set(normalizedRunId, {
    ...current,
    cancelRequested: true
  });
  return true;
};

const isBlueprintRunCancellationRequested = (runId) => {
  const current = activeBlueprintRuns.get(normalizeRunId(runId));
  return Boolean(current?.cancelRequested);
};

const clearActiveBlueprintRun = (runId) => {
  activeBlueprintRuns.delete(normalizeRunId(runId));
};

const clearBlueprintRunControlState = () => {
  activeBlueprintRuns.clear();
};

module.exports = {
  clearActiveBlueprintRun,
  clearBlueprintRunControlState,
  isBlueprintRunCancellationRequested,
  registerActiveBlueprintRun,
  requestBlueprintRunCancel
};
