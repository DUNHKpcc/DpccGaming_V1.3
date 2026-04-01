const MAX_CODE_CONTEXT_LENGTH = 4000;
const {
  DEFAULT_ARK_API_KEY,
  DEFAULT_ARK_ENDPOINT,
  DEFAULT_ARK_MODEL,
  DEFAULT_ARK_REASONING,
  buildBuiltinModelRequestConfig
} = require('../utils/aiProviderConfig');

const ensureText = (input, fallback = '') => {
  if (typeof input === 'string') return input;
  return input ? String(input) : fallback;
};

const buildContextText = ({ prompt, selectedFile, fileContent, files }) => {
  const safePrompt = ensureText(prompt, '').trim();
  const safeFilePath = ensureText(selectedFile, '').trim();
  const safeContent = ensureText(fileContent, '');

  const trimmedContent = safeContent.length > MAX_CODE_CONTEXT_LENGTH
    ? `${safeContent.slice(0, MAX_CODE_CONTEXT_LENGTH)}\n...\n(其余内容已截断)`
    : safeContent;

  const fileList = Array.isArray(files)
    ? files.map((file) => `${file.path || file.name || 'unknown'} (${file.language || 'text'})`).join('\n')
    : '';

  return [
    safePrompt && `用户问题：\n${safePrompt}`,
    safeFilePath && `当前选中文件：${safeFilePath}`,
    trimmedContent && `文件内容：\n${trimmedContent}`,
    fileList && `项目文件列表：\n${fileList}`
  ].filter(Boolean).join('\n\n');
};

const extractAnswerText = (arkResponse) => {
  const firstChoice = arkResponse?.choices?.[0];
  if (!firstChoice?.message?.content) return '';
  const segments = Array.isArray(firstChoice.message.content)
    ? firstChoice.message.content
    : [{ type: 'text', text: firstChoice.message.content }];
  return segments
    .filter((segment) => segment?.type === 'text' && segment.text)
    .map((segment) => segment.text.trim())
    .join('\n\n');
};

const buildProviderMessages = (provider = 'ark', systemText = '', userText = '') => {
  if (provider === 'ark') {
    return [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: systemText
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userText
          }
        ]
      }
    ];
  }

  return [
    {
      role: 'system',
      content: systemText
    },
    {
      role: 'user',
      content: userText
    }
  ];
};

const buildModelRequestConfig = (requestedModel = '') => buildBuiltinModelRequestConfig(requestedModel);

const codeAssistant = async (req, res) => {
  try {
    const {
      prompt,
      selectedFile = '',
      fileContent = '',
      files = [],
      model = ''
    } = req.body || {};

    if (!prompt || !prompt.toString().trim()) {
      return res.status(400).json({ message: '请输入要咨询的问题' });
    }

    const contextText = buildContextText({ prompt, selectedFile, fileContent, files });

    const requestConfig = buildModelRequestConfig(model);
    if (!requestConfig.apiKey) {
      return res.status(400).json({ message: 'AI 服务未配置 API KEY' });
    }

    const payload = {
      ...requestConfig.payload,
      messages: buildProviderMessages(
        requestConfig.provider,
        '你是 DpccGaming 平台的代码助手。请结合提供的源码上下文，用简体中文给出清晰的分析与建议。',
        contextText
      )
    };

    const response = await fetch(requestConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requestConfig.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      throw new Error(errorPayload || `AI API 请求失败，状态码 ${response.status}`);
    }

    const arkResult = await response.json();
    const answerText = extractAnswerText(arkResult);

    if (!answerText) {
      return res.status(502).json({ message: 'AI 服务未返回有效内容' });
    }

    res.json({
      answer: answerText,
      usage: arkResult?.usage || null
    });
  } catch (error) {
    console.error('调用 AI 服务失败:', error);
    res.status(500).json({ message: error.message || 'AI 服务暂不可用' });
  }
};

module.exports = {
  codeAssistant,
  ARK_CONFIG: {
    defaultModel: DEFAULT_ARK_MODEL,
    defaultEndpoint: DEFAULT_ARK_ENDPOINT,
    defaultReasoning: DEFAULT_ARK_REASONING,
    defaultApiKey: DEFAULT_ARK_API_KEY
  }
};
