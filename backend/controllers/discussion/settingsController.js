const {
  getPool,
  toInt,
  getJoinedMember,
  ensureRoomSettingsTable,
  emitRoomMessage,
  emitRoomSettingsEvent,
  generateAiReply
} = require('./shared');

const AI_LOOP_DELAY_MS = 8000;
const roomAiLoopTimers = new Map();

const COLLAB_STATUS_OPTIONS = new Set([
  'private-chat',
  'pair-programming',
  'planning',
  'review',
  'client-sync'
]);

const DEFAULT_BUILTIN_MODEL = 'GPT-4o Mini';
const BUILTIN_MODEL_AVATAR_MAP = {
  'GPT-4o Mini': '/Ai/ChatGPT.svg',
  'GPT-4.1': '/Ai/ChatGPT.svg',
  'Claude 3.5 Sonnet': '/Ai/Claude.png',
  'Gemini 2.0 Flash': '/Ai/Gemini.svg',
  'DeepSeek-V3': '/Ai/DeepSeekR1.png',
  Qwen: '/Ai/Qwen.png'
};

const createDefaultAiSlot = (id, fallbackName = 'AI 助手') => ({
  id,
  enabled: false,
  provider: 'builtin',
  builtinModel: DEFAULT_BUILTIN_MODEL,
  customModel: '',
  customEndpoint: '',
  apiKey: '',
  ownerUserId: null,
  name: fallbackName,
  context: '',
  intensity: 60,
  avatarUrl: '',
  avatarUpdatedAt: 0
});

const createDefaultRoomSettings = () => ({
  sourceGameId: '',
  sourceGameTitle: '',
  customNickname: '',
  collaborationStatus: 'private-chat',
  collaborationNote: '',
  peerRolePreset: '初学者',
  dualAiLoopEnabled: false,
  dualAiLoopPrompt: '围绕当前房间里的需求继续推进讨论，并给出下一步。',
  dualAiLoopTurnCount: 0,
  aiSlots: [
    createDefaultAiSlot('slot-1', '协作 AI 1'),
    createDefaultAiSlot('slot-2', '协作 AI 2')
  ]
});

const safeText = (value, maxLength = 255) => String(value || '').trim().slice(0, maxLength);

const safeLongText = (value, maxLength = 4000) => String(value || '').replace(/\r/g, '').trim().slice(0, maxLength);
const getBuiltinModelAvatarUrl = (modelName = '') => BUILTIN_MODEL_AVATAR_MAP[String(modelName || '').trim()] || '/Ai/DouBaoSeed1.6.png';

const parseSettingsJson = (rawValue) => {
  if (!rawValue) return null;
  if (typeof rawValue === 'object') return rawValue;
  if (typeof rawValue !== 'string') return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
};

const normalizeAiSlot = (rawSlot = {}, existingSlot = {}, index = 0, userId = null) => {
  const fallback = createDefaultAiSlot(`slot-${index + 1}`, `协作 AI ${index + 1}`);
  const merged = {
    ...fallback,
    ...existingSlot,
    ...(rawSlot && typeof rawSlot === 'object' ? rawSlot : {})
  };

  const nextApiKey = safeText(rawSlot?.apiKey || '', 400);
  const shouldReplaceApiKey = Boolean(nextApiKey);
  const shouldClearApiKey = rawSlot?.clearApiKey === true;

  return {
    id: safeText(merged.id || fallback.id, 40) || fallback.id,
    enabled: Boolean(merged.enabled),
    provider: merged.provider === 'custom' ? 'custom' : 'builtin',
    builtinModel: safeText(merged.builtinModel || fallback.builtinModel, 120) || fallback.builtinModel,
    customModel: safeText(merged.customModel || '', 120),
    customEndpoint: safeText(merged.customEndpoint || '', 500),
    apiKey: shouldClearApiKey
      ? ''
      : (shouldReplaceApiKey ? nextApiKey : safeText(existingSlot?.apiKey || '', 400)),
    ownerUserId: shouldClearApiKey
      ? null
      : (shouldReplaceApiKey ? Number(userId || 0) || null : (Number(existingSlot?.ownerUserId || 0) || null)),
    name: safeText(merged.name || fallback.name, 40) || fallback.name,
    context: safeLongText(merged.context || '', 2000),
    intensity: Math.max(0, Math.min(100, Number(merged.intensity || fallback.intensity) || fallback.intensity)),
    avatarUrl: safeText(merged.avatarUrl || '', 200000),
    avatarUpdatedAt: Number(merged.avatarUpdatedAt || existingSlot?.avatarUpdatedAt || 0) || 0
  };
};

const normalizeRoomSettings = (rawSettings = {}, existingSettings = {}, userId = null) => {
  const fallback = createDefaultRoomSettings();
  const base = {
    ...fallback,
    ...existingSettings,
    ...(rawSettings && typeof rawSettings === 'object' ? rawSettings : {})
  };
  const existingSlots = Array.isArray(existingSettings?.aiSlots) ? existingSettings.aiSlots : fallback.aiSlots;
  const rawSlots = Array.isArray(rawSettings?.aiSlots) ? rawSettings.aiSlots : base.aiSlots;

  return {
    sourceGameId: safeText(base.sourceGameId || '', 120),
    sourceGameTitle: safeText(base.sourceGameTitle || '', 255),
    customNickname: safeText(base.customNickname || '', 40),
    collaborationStatus: COLLAB_STATUS_OPTIONS.has(base.collaborationStatus) ? base.collaborationStatus : fallback.collaborationStatus,
    collaborationNote: safeLongText(base.collaborationNote || '', 1000),
    peerRolePreset: safeText(base.peerRolePreset || fallback.peerRolePreset, 40) || fallback.peerRolePreset,
    dualAiLoopEnabled: Boolean(base.dualAiLoopEnabled),
    dualAiLoopPrompt: safeLongText(base.dualAiLoopPrompt || fallback.dualAiLoopPrompt, 1000) || fallback.dualAiLoopPrompt,
    dualAiLoopTurnCount: Math.max(0, Number(existingSettings?.dualAiLoopTurnCount || base.dualAiLoopTurnCount || 0) || 0),
    aiSlots: [0, 1].map((index) => normalizeAiSlot(rawSlots[index], existingSlots[index], index, userId))
  };
};

const serializeRoomSettingsForClient = (settings = {}, userId = null) => {
  const normalized = normalizeRoomSettings(settings, settings, userId);
  return {
    ...normalized,
    aiSlots: normalized.aiSlots.map((slot) => ({
      ...slot,
      hasApiKey: Boolean(slot.apiKey),
      apiKey: Number(slot.ownerUserId || 0) === Number(userId || 0) ? slot.apiKey : ''
    }))
  };
};

const getRoomSettingsRow = async (pool, roomId) => {
  await ensureRoomSettingsTable(pool);
  const [rows] = await pool.execute(
    `SELECT room_id, settings_json, updated_by_user_id, updated_at
     FROM discussion_room_settings
     WHERE room_id = ?
     LIMIT 1`,
    [roomId]
  );
  return rows[0] || null;
};

const getStoredRoomSettings = async (pool, roomId) => {
  const row = await getRoomSettingsRow(pool, roomId);
  const parsed = normalizeRoomSettings(parseSettingsJson(row?.settings_json) || {});
  return {
    settings: parsed,
    row
  };
};

const saveRoomSettings = async (pool, roomId, settings, userId) => {
  await ensureRoomSettingsTable(pool);
  const serialized = JSON.stringify(normalizeRoomSettings(settings, settings, userId));
  await pool.execute(
    `INSERT INTO discussion_room_settings (room_id, settings_json, updated_by_user_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       settings_json = VALUES(settings_json),
       updated_by_user_id = VALUES(updated_by_user_id),
       updated_at = CURRENT_TIMESTAMP`,
    [roomId, serialized, userId]
  );
};

const getRoomContext = async (pool, roomId) => {
  const [rows] = await pool.execute(
    `SELECT r.id, r.mode, r.game_id, g.title AS game_title
     FROM discussion_rooms r
     JOIN games g ON g.game_id = r.game_id
     WHERE r.id = ?
     LIMIT 1`,
    [roomId]
  );
  return rows[0] || null;
};

const ensureDirectRoomMember = async (pool, roomId, userId) => {
  const member = await getJoinedMember(pool, roomId, userId, false);
  if (!member || member.status !== 'joined') {
    return { ok: false, error: '仅房间成员可操作该配置', status: 403 };
  }
  const room = await getRoomContext(pool, roomId);
  if (!room) {
    return { ok: false, error: '房间不存在', status: 404 };
  }
  if (room.mode !== 'friend') {
    return { ok: false, error: '当前功能仅支持一对一私聊房间', status: 400 };
  }
  return { ok: true, room };
};

const buildSlotPrompt = ({ slot, room, recentMessages, loopPrompt }) => {
  const recentText = recentMessages
    .map((item) => `[${item.sender_type}] ${String(item.content || '').trim()}`)
    .join('\n')
    .slice(-4000);
  const intensityHint = slot.intensity >= 75
    ? '请更主动、更直接地给出下一步。'
    : slot.intensity >= 45
      ? '请平衡分析与行动建议。'
      : '请先用温和方式澄清风险与上下文。';

  return [
    `当前房间游戏：${room.game_title || '未命名游戏'}`,
    `当前 AI 名称：${slot.name || 'AI 助手'}`,
    slot.context ? `AI 上下文：${slot.context}` : '',
    `轮询目标：${loopPrompt || '继续推进当前讨论'}`,
    intensityHint,
    recentText ? `最近消息：\n${recentText}` : '',
    '请输出一条适合作为房间新消息发送的简洁回复，避免使用列表编号。'
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
          content: '你是多人协作聊天中的 AI 成员，请自然接续上下文发言。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: Math.max(0.2, Math.min(1.1, 0.2 + ((Number(slot.intensity || 60) || 60) / 100) * 0.9))
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

  if (Array.isArray(content)) {
    return content.map((item) => item?.text || '').join('\n').trim();
  }
  return String(content).trim();
};

const requestAiReplyBySlot = async ({ slot, room, recentMessages, loopPrompt }) => {
  const prompt = buildSlotPrompt({ slot, room, recentMessages, loopPrompt });
  if (slot.provider === 'custom' && slot.customEndpoint && slot.customModel && slot.apiKey) {
    return requestCustomAiReply({ slot, prompt });
  }

  return generateAiReply({
    prompt,
    gameTitle: room.game_title,
    roomMessages: recentMessages
  });
};

const insertAiLoopMessage = async (pool, roomId, triggerUserId, slot, content) => {
  const metadata = {
    ai_slot_id: slot.id,
    local_ai_name: slot.name || 'AI 助手',
    local_ai_avatar_url: slot.avatarUrl || getBuiltinModelAvatarUrl(slot.builtinModel || ''),
    ai_provider: slot.provider || 'builtin',
    ai_model: slot.provider === 'custom' ? (slot.customModel || '') : (slot.builtinModel || ''),
    trigger_user_id: triggerUserId || null
  };

  const [insertResult] = await pool.execute(
    `INSERT INTO discussion_messages
     (room_id, sender_type, sender_user_id, message_type, content, metadata_json)
     VALUES (?, 'ai', NULL, 'text', ?, ?)`,
    [roomId, content, JSON.stringify(metadata)]
  );

  const [rows] = await pool.execute(
    `SELECT id, room_id, sender_type, sender_user_id, message_type, content, metadata_json, created_at
     FROM discussion_messages
     WHERE id = ?
     LIMIT 1`,
    [insertResult.insertId]
  );

  return rows[0] || null;
};

const stopRoomAiLoop = (roomId) => {
  const roomKey = String(roomId || '').trim();
  if (!roomKey) return;
  const timer = roomAiLoopTimers.get(roomKey);
  if (timer) {
    clearTimeout(timer);
    roomAiLoopTimers.delete(roomKey);
  }
};

const scheduleRoomAiLoop = (roomId, delay = AI_LOOP_DELAY_MS) => {
  const roomKey = String(roomId || '').trim();
  if (!roomKey) return;
  stopRoomAiLoop(roomKey);
  const timer = setTimeout(() => {
    runRoomAiLoopTurn(roomKey).catch((error) => {
      console.error('房间双 AI 轮询失败:', error);
      stopRoomAiLoop(roomKey);
    });
  }, delay);
  roomAiLoopTimers.set(roomKey, timer);
};

async function runRoomAiLoopTurn(roomId, options = {}) {
  const parsedRoomId = toInt(roomId);
  if (!parsedRoomId) return null;

  const pool = getPool();
  const room = await getRoomContext(pool, parsedRoomId);
  if (!room || room.mode !== 'friend') {
    stopRoomAiLoop(parsedRoomId);
    return null;
  }

  const { settings } = await getStoredRoomSettings(pool, parsedRoomId);
  const enabledSlots = settings.aiSlots.filter((slot) => slot.enabled);
  if (!settings.dualAiLoopEnabled || enabledSlots.length < 2) {
    stopRoomAiLoop(parsedRoomId);
    return null;
  }

  const turnIndex = Number(settings.dualAiLoopTurnCount || 0);
  const slot = enabledSlots[turnIndex % enabledSlots.length];
  const [recentMessages] = await pool.execute(
    `SELECT sender_type, content
     FROM discussion_messages
     WHERE room_id = ?
     ORDER BY id DESC
     LIMIT 20`,
    [parsedRoomId]
  );

  const content = await requestAiReplyBySlot({
    slot,
    room,
    recentMessages: recentMessages.reverse(),
    loopPrompt: settings.dualAiLoopPrompt
  });

  const message = await insertAiLoopMessage(pool, parsedRoomId, options.triggerUserId || null, slot, content);
  if (!message) {
    stopRoomAiLoop(parsedRoomId);
    return null;
  }

  settings.dualAiLoopTurnCount = turnIndex + 1;
  await saveRoomSettings(pool, parsedRoomId, settings, options.triggerUserId || 0);

  emitRoomMessage(parsedRoomId, message);
  emitRoomSettingsEvent(parsedRoomId, {
    settings: serializeRoomSettingsForClient(settings)
  });

  if (!options.manual && settings.dualAiLoopEnabled) {
    scheduleRoomAiLoop(parsedRoomId);
  }

  return message;
}

const syncRoomAiLoop = async (roomId) => {
  const parsedRoomId = toInt(roomId);
  if (!parsedRoomId) return;
  const pool = getPool();
  const { settings } = await getStoredRoomSettings(pool, parsedRoomId);
  const enabledCount = settings.aiSlots.filter((slot) => slot.enabled).length;
  if (!settings.dualAiLoopEnabled || enabledCount < 2) {
    stopRoomAiLoop(parsedRoomId);
    return;
  }
  if (!roomAiLoopTimers.has(String(parsedRoomId))) {
    scheduleRoomAiLoop(parsedRoomId, 2500);
  }
};

const getRoomSettings = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const pool = getPool();
    const permission = await ensureDirectRoomMember(pool, roomId, userId);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    const { settings, row } = await getStoredRoomSettings(pool, roomId);
    await syncRoomAiLoop(roomId);
    res.json({
      settings: serializeRoomSettingsForClient(settings, userId),
      updatedAt: row?.updated_at || null,
      updatedByUserId: row?.updated_by_user_id || null
    });
  } catch (error) {
    console.error('获取房间设置失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const updateRoomSettings = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const pool = getPool();
    const permission = await ensureDirectRoomMember(pool, roomId, userId);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    const { settings: existingSettings } = await getStoredRoomSettings(pool, roomId);
    const nextSettings = normalizeRoomSettings(req.body?.settings || req.body || {}, existingSettings, userId);
    await saveRoomSettings(pool, roomId, nextSettings, userId);

    await syncRoomAiLoop(roomId);
    emitRoomSettingsEvent(roomId, {
      settings: serializeRoomSettingsForClient(nextSettings),
      updatedByUserId: userId
    });

    res.json({
      settings: serializeRoomSettingsForClient(nextSettings, userId),
      updatedByUserId: userId
    });
  } catch (error) {
    console.error('更新房间设置失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const triggerRoomAiLoopTurn = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const pool = getPool();
    const permission = await ensureDirectRoomMember(pool, roomId, userId);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    const message = await runRoomAiLoopTurn(roomId, {
      manual: true,
      triggerUserId: userId
    });
    if (!message) {
      return res.status(400).json({ error: '当前房间未满足双 AI 轮询条件' });
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('手动触发双 AI 轮询失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

module.exports = {
  getRoomSettings,
  updateRoomSettings,
  triggerRoomAiLoopTurn
};
