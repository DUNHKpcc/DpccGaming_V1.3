const DEFAULT_MODEL = 'doubao-seed-1-6-251015';
const DEFAULT_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DEFAULT_REASONING = 'medium';
const MAX_CODE_CONTEXT_LENGTH = 4000;

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

const codeAssistant = async (req, res) => {
  const arkApiKey = process.env.ARK_API_KEY || '904fb2f6-8bfc-4c0b-baff-41a85380fd9e';
  if (!arkApiKey) {
    return res.status(400).json({ message: 'AI 服务未配置 API KEY' });
  }

  try {
    const {
      prompt,
      selectedFile = '',
      fileContent = '',
      files = []
    } = req.body || {};

    if (!prompt || !prompt.toString().trim()) {
      return res.status(400).json({ message: '请输入要咨询的问题' });
    }

    const contextText = buildContextText({ prompt, selectedFile, fileContent, files });

    const payload = {
      model: process.env.ARK_MODEL_ID || DEFAULT_MODEL,
      max_completion_tokens: Number(process.env.ARK_MAX_TOKENS) || 2048,
      reasoning_effort: process.env.ARK_REASONING_LEVEL || DEFAULT_REASONING,
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: '你是 DpccGaming 平台的代码助手。请结合提供的源码上下文，用简体中文给出清晰的分析与建议。'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: contextText
            }
          ]
        }
      ]
    };

    const response = await fetch(process.env.ARK_API_URL || DEFAULT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arkApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      throw new Error(errorPayload || `Ark API 请求失败，状态码 ${response.status}`);
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
  codeAssistant
};
