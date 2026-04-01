const normalizeStepStatus = (value = '') => String(value || '').trim().toLowerCase();

const summarizeBlueprintRunStatus = (runDetail = {}) => {
  const explicitStatus = normalizeStepStatus(runDetail?.status);
  if (explicitStatus) return explicitStatus;

  const steps = Array.isArray(runDetail?.steps) ? runDetail.steps : [];
  if (!steps.length) return 'pending';

  if (steps.some((step) => normalizeStepStatus(step?.status) === 'failed')) {
    return 'failed';
  }

  if (steps.some((step) => normalizeStepStatus(step?.status) === 'running')) {
    return 'running';
  }

  if (steps.every((step) => normalizeStepStatus(step?.status) === 'completed')) {
    return 'completed';
  }

  return 'pending';
};

const getContinuableBlueprintStep = (runDetail = {}) => {
  const runStatus = summarizeBlueprintRunStatus(runDetail);
  const steps = Array.isArray(runDetail?.steps) ? runDetail.steps : [];

  if (!steps.length) return null;

  if (runStatus === 'failed') {
    const failedStep = steps.find((step) => normalizeStepStatus(step?.status) === 'failed');
    if (failedStep?.nodeId) {
      return {
        nodeId: failedStep.nodeId,
        scope: 'branch'
      };
    }
  }

  if (runStatus === 'running' || runStatus === 'pending') {
    const resumableStep = steps.find((step) => {
      const status = normalizeStepStatus(step?.status);
      return status === 'running' || status === 'pending';
    });

    if (resumableStep?.nodeId) {
      return {
        nodeId: resumableStep.nodeId,
        scope: 'branch'
      };
    }
  }

  return null;
};

module.exports = {
  getContinuableBlueprintStep,
  summarizeBlueprintRunStatus
};
