const DEFAULT_ARK_MODEL = 'doubao-seed-1-6-251015';
const DEFAULT_ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DEFAULT_ARK_REASONING = 'medium';
const DEFAULT_ARK_API_KEY = '904fb2f6-8bfc-4c0b-baff-41a85380fd9e';

const DEFAULT_GLM_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const DEFAULT_GLM_API_KEY = '4c41d21037774fe388212b7e705ec6ff.hVqyHfZKejOrzu7Q';
const DEFAULT_GLM_MODEL = 'glm-4.5';

const DEFAULT_QWEN_CODEMAX_ENDPOINT = 'https://coding.dashscope.aliyuncs.com/v1/chat/completions';
const DEFAULT_QWEN_CODEMAX_API_KEY = 'sk-sp-9a16d7d7aa4740b7aeffccaeb07a80ce';
const DEFAULT_QWEN_CODEMAX_MODEL = 'qwen3.5-plus';

const DEFAULT_BUILTIN_MODEL = 'DouBaoSeed';

const normalizeBuiltinModelName = (value = '') => {
  const normalized = String(value || '').trim();
  const lower = normalized.toLowerCase();

  if (!normalized) return DEFAULT_BUILTIN_MODEL;
  if (lower === 'doubaoseed1.6' || lower === 'doubaoseed') return 'DouBaoSeed';
  if (lower === 'glm-4.5' || lower === 'glm4.5' || lower === 'glm') return 'GLM-4.5';
  if (lower === 'gemini 3.0 pro' || lower === 'gemini') return 'Gemini 3.0 Pro';
  if (lower === 'qwen3-codemax' || lower === 'qwencodemax') return 'Qwen3-CodeMax';
  if (lower === 'gpt-5.4') return 'GPT-5.4';
  if (lower === 'claude 4.6 opus') return 'Claude 4.6 opus';

  return normalized;
};

const buildBuiltinModelRequestConfig = (requestedModel = '') => {
  const normalizedModel = normalizeBuiltinModelName(requestedModel);

  if (normalizedModel === 'GLM-4.5') {
    return {
      normalizedModel,
      provider: 'glm',
      endpoint: process.env.GLM_BASE_URL || DEFAULT_GLM_ENDPOINT,
      apiKey: process.env.GLM_API_KEY || DEFAULT_GLM_API_KEY,
      payload: {
        model: process.env.GLM_MODEL || DEFAULT_GLM_MODEL,
        temperature: 0.35,
        thinking: {
          type: 'enabled'
        }
      }
    };
  }

  if (normalizedModel === 'Qwen3-CodeMax') {
    return {
      normalizedModel,
      provider: 'qwen',
      endpoint: process.env.QWEN_CODEMAX_BASE_URL || DEFAULT_QWEN_CODEMAX_ENDPOINT,
      apiKey: process.env.QWEN_CODEMAX_API_KEY || DEFAULT_QWEN_CODEMAX_API_KEY,
      payload: {
        model: process.env.QWEN_CODEMAX_MODEL || DEFAULT_QWEN_CODEMAX_MODEL,
        temperature: 0.35
      }
    };
  }

  return {
    normalizedModel,
    provider: 'ark',
    endpoint: process.env.ARK_API_URL || DEFAULT_ARK_ENDPOINT,
    apiKey: process.env.ARK_API_KEY || DEFAULT_ARK_API_KEY,
    payload: {
      model: process.env.ARK_MODEL_ID || DEFAULT_ARK_MODEL,
      max_completion_tokens: Number(process.env.ARK_MAX_TOKENS) || 2048,
      reasoning_effort: process.env.ARK_REASONING_LEVEL || DEFAULT_ARK_REASONING
    }
  };
};

module.exports = {
  DEFAULT_BUILTIN_MODEL,
  DEFAULT_ARK_MODEL,
  DEFAULT_ARK_ENDPOINT,
  DEFAULT_ARK_REASONING,
  DEFAULT_ARK_API_KEY,
  buildBuiltinModelRequestConfig,
  normalizeBuiltinModelName
};
