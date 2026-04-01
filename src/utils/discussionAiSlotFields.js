const PULL_AI_CONNECTION_FIELDS = new Set([
  'enabled',
  'provider',
  'builtinModel',
  'customEndpoint',
  'customModel',
  'apiKey'
])

export const isPullAiConnectionField = (field = '') => PULL_AI_CONNECTION_FIELDS.has(String(field || '').trim())
