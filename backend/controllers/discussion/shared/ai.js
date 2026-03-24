const { ARK_CONFIG } = require('../../aiController');
const {
  AI_REPLY_CHAR_LIMIT,
  parseJsonObject,
  safeText,
  safeLongText,
  clampAiReplyContent
} = require('./core');

const DEFAULT_MODEL = ARK_CONFIG.defaultModel;
const DEFAULT_ENDPOINT = ARK_CONFIG.defaultEndpoint;
const DEFAULT_REASONING = ARK_CONFIG.defaultReasoning;
const DEFAULT_ARK_API_KEY = ARK_CONFIG.defaultApiKey;
const DEFAULT_QWEN_CODEMAX_ENDPOINT = 'https://coding.dashscope.aliyuncs.com/v1';
const DEFAULT_QWEN_CODEMAX_API_KEY = 'sk-sp-9a16d7d7aa4740b7aeffccaeb07a80ce';
const DEFAULT_QWEN_CODEMAX_MODEL = 'qwen3.5-plus';
const RESOURCE_READ_VERBS = [
  '看', '看看', '读', '读取', '阅读', '查看', '分析', '检查', '审查', '参考', '结合', '打开', '浏览',
  'read', 'review', 'inspect', 'check', 'open', 'load', 'use'
];
const CODE_RESOURCE_TERMS = [
  '源码', '代码', 'code', 'repo', '仓库', '脚本', '.js', '.ts', '.tsx', '.vue', '.py', '.java', '.cpp', '.cs'
];
const DOCUMENT_RESOURCE_TERMS = [
  '文档', '说明', 'readme', '需求', '方案', '设计', '手册', 'pdf', '.md', '.txt', '附件'
];
const LINKED_RESOURCE_TERMS = [
  '附件', '文件', '这份', '这个', '这段', '刚发', '刚刚发', '刚上传', '上面', '上一条', '刚才'
];

const parseTextMessageContent = (content) => {
  if (!content) return '';
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || '')
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
  return String(content).trim();
};

const buildAiSenderLabel = (message = {}) => {
  const senderType = safeText(message.sender_type || 'user', 20) || 'user';
  const metadata = parseJsonObject(message.metadata_json) || {};
  if (senderType === 'ai') {
    return safeText(metadata.local_ai_name || message.username || 'AI 助手', 60) || 'AI 助手';
  }
  if (senderType === 'system') return '系统';
  return safeText(message.username || `用户${message.sender_user_id || ''}`, 60) || '成员';
};

const describeMessageForMemory = (message = {}) => {
  const metadata = parseJsonObject(message.metadata_json) || {};
  const content = safeLongText(message.content || '', 600);
  const attachment = metadata.attachment && typeof metadata.attachment === 'object' ? metadata.attachment : null;
  const codePreview = metadata.code_preview && typeof metadata.code_preview === 'object' ? metadata.code_preview : null;
  const documentPreview = metadata.document_preview && typeof metadata.document_preview === 'object' ? metadata.document_preview : null;

  if (attachment?.type && attachment?.name) {
    return `${content || '发送了附件'}（${attachment.type}：${attachment.name}）`;
  }
  if (codePreview?.path) {
    return `${content || '分享了代码预览'}：${codePreview.path}\n${safeLongText(codePreview.snippet || '', 600)}`;
  }
  if (documentPreview?.name) {
    return `${content || '分享了文档预览'}：${documentPreview.name}\n${safeLongText(documentPreview.preview_text || '', 600)}`;
  }
  return content;
};

const formatRoomMessageForAi = (message = {}) => {
  const senderLabel = buildAiSenderLabel(message);
  const senderType = safeText(message.sender_type || 'user', 20) || 'user';
  const metadata = parseJsonObject(message.metadata_json) || {};
  const attachment = metadata.attachment && typeof metadata.attachment === 'object' ? metadata.attachment : null;
  const codePreview = metadata.code_preview && typeof metadata.code_preview === 'object' ? metadata.code_preview : null;
  const documentPreview = metadata.document_preview && typeof metadata.document_preview === 'object' ? metadata.document_preview : null;
  const detailParts = [];

  if (attachment?.name) {
    detailParts.push(`附件：${safeText(attachment.name, 180)}`);
  }
  if (codePreview?.path) {
    detailParts.push(`代码：${safeText(codePreview.path, 220)}`);
  }
  if (documentPreview?.name) {
    detailParts.push(`文档：${safeText(documentPreview.name, 180)}`);
  }

  const content = describeMessageForMemory(message);
  return `[${senderType}] ${senderLabel}${detailParts.length ? `（${detailParts.join('，')}）` : ''}：${content}`;
};

const normalizeIntentText = (value = '') => String(value || '').toLowerCase();
const textIncludesAny = (text = '', terms = []) => terms.some((term) => text.includes(String(term || '').toLowerCase()));

const getMessageResourceMetadata = (message = {}) => {
  const metadata = parseJsonObject(message.metadata_json) || {};
  const codePreview = metadata.code_preview && typeof metadata.code_preview === 'object' ? metadata.code_preview : null;
  const documentPreview = metadata.document_preview && typeof metadata.document_preview === 'object' ? metadata.document_preview : null;
  const attachment = metadata.attachment && typeof metadata.attachment === 'object' ? metadata.attachment : null;
  return {
    codePreview,
    documentPreview,
    attachment
  };
};

const inferLatestLinkedResourceKind = (recentMessages = []) => {
  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const resourceMeta = getMessageResourceMetadata(recentMessages[index]);
    if (resourceMeta.codePreview?.path) return 'code';
    if (resourceMeta.documentPreview?.name || resourceMeta.documentPreview?.document_id) return 'document';
  }
  return '';
};

const resolveAiResourceContextPolicy = ({
  prompt = '',
  loopPrompt = '',
  recentMessages = []
}) => {
  const recentUserTexts = recentMessages
    .filter((message) => safeText(message.sender_type || 'user', 20) === 'user')
    .slice(-4)
    .map((message) => {
      const resourceMeta = getMessageResourceMetadata(message);
      return [
        safeLongText(message.content || '', 600),
        safeText(resourceMeta.codePreview?.path || '', 220),
        safeText(resourceMeta.documentPreview?.name || '', 220),
        safeText(resourceMeta.attachment?.name || '', 220)
      ].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n');

  const decisionText = [prompt, loopPrompt, recentUserTexts]
    .map((item) => normalizeIntentText(item))
    .filter(Boolean)
    .join('\n');

  const hasReadVerb = textIncludesAny(decisionText, RESOURCE_READ_VERBS);
  const asksCode = hasReadVerb && textIncludesAny(decisionText, CODE_RESOURCE_TERMS);
  const asksDocument = hasReadVerb && textIncludesAny(decisionText, DOCUMENT_RESOURCE_TERMS);
  const asksLinkedResource = hasReadVerb && textIncludesAny(decisionText, LINKED_RESOURCE_TERMS);
  const latestLinkedKind = inferLatestLinkedResourceKind(recentMessages);

  const includeCode = asksCode || (!asksCode && !asksDocument && asksLinkedResource && latestLinkedKind === 'code');
  const includeDocument = asksDocument || (!asksCode && !asksDocument && asksLinkedResource && latestLinkedKind === 'document');

  return {
    includeCode,
    includeDocument,
    usesExternalContext: includeCode || includeDocument
  };
};

const buildPromptFromAiContext = ({
  prompt,
  gameTitle,
  recentMessages = [],
  roomSummary = null,
  memoryEntries = [],
  systemDirective = ''
}) => {
  const recentText = recentMessages
    .map((message) => formatRoomMessageForAi(message))
    .join('\n')
    .slice(-6000);
  const summaryText = safeLongText(roomSummary?.summaryText || '', 2400);
  const memoryText = memoryEntries
    .map((entry) => {
      const label = entry.memoryType === 'code'
        ? '源码记忆'
        : entry.memoryType === 'document'
          ? '文档记忆'
          : entry.memoryType === 'profile'
            ? '房间配置'
            : '房间记忆';
      return `【${label}】${entry.title}\n${safeLongText(entry.content || '', 1800)}`;
    })
    .join('\n\n')
    .slice(-7200);

  return [
    systemDirective,
    summaryText ? `房间摘要：\n${summaryText}` : '',
    memoryText ? `检索到的房间记忆：\n${memoryText}` : '',
    recentText ? `最近对话：\n${recentText}` : '',
    `当前请求：\n${safeLongText(prompt || '', 2200)}`
  ].filter(Boolean).join('\n\n');
};

const requestArkAiReply = async ({ prompt, gameTitle, roomMessages, roomSummary, memoryEntries, systemDirective }) => {
  const apiKey = process.env.ARK_API_KEY || DEFAULT_ARK_API_KEY;
  if (!apiKey) {
    return 'AI 机器人暂未配置 ARK_API_KEY，当前先由系统占位回复。请配置后启用真实 AI 对话。';
  }

  const payload = {
    model: process.env.ARK_MODEL_ID || DEFAULT_MODEL,
    max_completion_tokens: Number(process.env.ARK_MAX_TOKENS) || 1200,
    reasoning_effort: process.env.ARK_REASONING_LEVEL || DEFAULT_REASONING,
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: systemDirective || '你是 DpccGaming 讨论房间内的 AI 协作成员。默认只根据成员消息回复；只有在当前请求明确要求时，才使用附带的文档或源码上下文。'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildPromptFromAiContext({
              prompt,
              gameTitle,
              recentMessages: roomMessages,
              roomSummary,
              memoryEntries,
              systemDirective
            })
          }
        ]
      }
    ]
  };

  const response = await fetch(process.env.ARK_API_URL || DEFAULT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `AI 调用失败，状态码 ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return 'AI 未返回有效内容，请稍后重试。';
  return parseTextMessageContent(content) || 'AI 未返回有效文本内容。';
};

const requestQwenCodeMaxReply = async ({ prompt, gameTitle, roomMessages, roomSummary, memoryEntries, systemDirective }) => {
  const apiKey = process.env.QWEN_CODEMAX_API_KEY || DEFAULT_QWEN_CODEMAX_API_KEY;
  const endpoint = (process.env.QWEN_CODEMAX_BASE_URL || DEFAULT_QWEN_CODEMAX_ENDPOINT).replace(/\/+$/, '');
  const model = process.env.QWEN_CODEMAX_MODEL || DEFAULT_QWEN_CODEMAX_MODEL;
  if (!apiKey) {
    return 'Qwen3-CodeMax 暂未配置 API KEY，当前先由系统占位回复。';
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: systemDirective || '你是 DpccGaming 讨论房间内的 AI 协作成员。默认只根据成员消息回复；只有在当前请求明确要求时，才使用附带的文档或源码上下文。'
        },
        {
          role: 'user',
          content: buildPromptFromAiContext({
            prompt,
            gameTitle,
            recentMessages: roomMessages,
            roomSummary,
            memoryEntries,
            systemDirective
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Qwen3-CodeMax 调用失败，状态码 ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return 'Qwen3-CodeMax 未返回有效内容，请稍后重试。';
  return parseTextMessageContent(content) || 'Qwen3-CodeMax 未返回有效文本内容。';
};

const generateAiReply = async ({ prompt, gameTitle, roomMessages, builtinModel = '', roomSummary = null, memoryEntries = [], systemDirective = '' }) => {
  const modelName = String(builtinModel || '').trim();
  if (modelName === 'Qwen3-CodeMax') {
    return requestQwenCodeMaxReply({ prompt, gameTitle, roomMessages, roomSummary, memoryEntries, systemDirective });
  }
  return requestArkAiReply({ prompt, gameTitle, roomMessages, roomSummary, memoryEntries, systemDirective });
};

const buildRoomScopedAiPrompt = ({
  slot = {},
  room = {},
  loopPrompt = '',
  prompt = '',
  targetUserName = '',
  roomSummary = null,
  recentMessages = [],
  contextPolicy = {}
}) => {
  const effectivePrompt = safeLongText(loopPrompt || prompt || '请结合当前讨论继续推进并给出下一步建议。', 1600);
  return [
    `当前 AI 名称：${safeText(slot.name || 'AI 助手', 80)}`,
    slot.context ? `以下是该 AI 在当前房间内必须长期遵守的固定上下文与职责，请优先按它执行：\n${safeLongText(slot.context, 1200)}` : '',
    targetUserName ? `本次优先回复对象：${safeText(targetUserName, 80)}` : '',
    prompt ? `调用指令：${safeLongText(prompt, 1200)}` : '',
    loopPrompt ? `轮询目标：${safeLongText(loopPrompt, 1200)}` : '',
    roomSummary?.summaryText ? `已有摘要：\n${safeLongText(roomSummary.summaryText, 1800)}` : '',
    recentMessages.length
      ? (
        contextPolicy.usesExternalContext
          ? '请基于最近消息接续发言；仅参考本次请求明确要求读取的源码或文档上下文。'
          : '请只根据当前房间成员最近的真实对话接续发言；除非用户明确要求，否则不要主动读取源码、文档或附件内容。'
      )
      : '',
    targetUserName && prompt ? '请优先围绕这位用户最近一次消息展开协作，不要脱离用户问题让 AI 之间无限互相追问。' : '',
    '最终回复必须使用简体中文，并严格控制在 80 字以内。',
    effectivePrompt
  ].filter(Boolean).join('\n\n');
};

const requestCustomAiReply = async ({ slot, prompt }) => {
  const endpoint = safeText(slot.customEndpoint || '', 500);
  const apiKey = safeText(slot.apiKey || '', 400);
  const model = safeText(slot.customModel || '', 120);
  if (!endpoint || !apiKey || !model) {
    throw new Error('自定义 AI 缺少 endpoint / model / apiKey');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: '你是多人协作聊天中的 AI 成员。默认只根据历史消息接续发言；只有当前请求明确要求时，才使用附带的文档或源码上下文。如果用户消息里附带了“AI 上下文/固定职责”，必须优先服从，不要忽略。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.35
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `自定义 AI 请求失败（${response.status}）`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('自定义 AI 未返回有效内容');
  }
  return parseTextMessageContent(content) || '自定义 AI 未返回有效文本内容。';
};

const createRequestRoomAiReplyBySlot = ({
  getRoomNotificationContext,
  refreshRoomMemoryArtifacts,
  getRoomSummary,
  retrieveRelevantMemoryEntries,
  findRecentMessageLinkedMemoryEntries,
  roomMemoryContextLimit
}) => async ({
  pool,
  roomId,
  room = null,
  slot = {},
  prompt = '',
  loopPrompt = '',
  recentMessages = [],
  targetUserName = ''
  }) => {
    const parsedRoomId = Number(roomId || 0);
    if (!parsedRoomId) throw new Error('无效的 roomId');
    const roomContext = room || (await getRoomNotificationContext(pool, parsedRoomId));
    if (!roomContext) throw new Error('房间不存在');
    const useMemory = slot.memoryEnabled !== false;
    const contextPolicy = resolveAiResourceContextPolicy({
      prompt,
      loopPrompt,
      recentMessages
    });
    let summary = null;
    let memoryEntries = [];

    if (useMemory && contextPolicy.usesExternalContext) {
      const roomMemory = await refreshRoomMemoryArtifacts(pool, parsedRoomId);
      const filteredEntries = (roomMemory.memory || []).filter((entry) => {
        const memoryType = safeText(entry?.memoryType || '', 32);
        if (memoryType === 'code') return contextPolicy.includeCode;
        if (memoryType === 'document') return contextPolicy.includeDocument;
        return false;
      });
      const relevantEntries = retrieveRelevantMemoryEntries(filteredEntries, `${prompt}\n${loopPrompt}`, '');
      const linkedEntries = findRecentMessageLinkedMemoryEntries(filteredEntries, recentMessages);
      memoryEntries = [...new Map(
        [...linkedEntries, ...relevantEntries].map((entry) => [entry.sourceKey || entry.id, entry])
      ).values()].slice(0, Math.max(roomMemoryContextLimit, linkedEntries.length));
      summary = null;
    }
    const scopedPrompt = buildRoomScopedAiPrompt({
      slot,
      room: roomContext,
      loopPrompt,
      prompt,
      targetUserName,
      roomSummary: summary,
      recentMessages,
      contextPolicy
    });

    let rawReply = '';
    if (slot.provider === 'custom' && slot.customEndpoint && slot.customModel && slot.apiKey) {
      rawReply = await requestCustomAiReply({
        slot,
        prompt: buildPromptFromAiContext({
          prompt: scopedPrompt,
          gameTitle: roomContext.game_title,
          recentMessages,
          roomSummary: summary,
          memoryEntries,
          systemDirective: '你是 DpccGaming 讨论房间内的自定义 AI 助手。默认只根据成员消息回复；只有当前请求明确要求时，才使用附带的文档或源码上下文。最终回复严格控制在80字以内。'
        })
      });
    } else {
      rawReply = await generateAiReply({
        prompt: scopedPrompt,
        gameTitle: roomContext.game_title,
        roomMessages: recentMessages,
        builtinModel: slot.builtinModel || 'DouBaoSeed1.6',
        roomSummary: summary,
        memoryEntries,
        systemDirective: '你是 DpccGaming 讨论房间内的 AI 协作成员。默认只根据成员消息和当前提问回复；只有当前请求明确要求时，才使用附带的文档或源码上下文。请明确区分是谁发了什么，并自然、可执行地回复。最终回复严格控制在80字以内。'
      });
    }

    return clampAiReplyContent(rawReply, AI_REPLY_CHAR_LIMIT);
  };

module.exports = {
  buildAiSenderLabel,
  describeMessageForMemory,
  generateAiReply,
  createRequestRoomAiReplyBySlot
};
