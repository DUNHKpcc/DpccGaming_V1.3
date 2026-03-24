const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const {
  getPool,
  MAX_ROOM_MEMBERS,
  toInt,
  getJoinedMember,
  ensureRoomSettingsTable,
  ensureRoomMemberPreferencesTable,
  emitRoomMessage,
  emitRoomSettingsEventToUser,
  emitRoomMemoryEvent,
  emitRoomAiProgressEvent,
  refreshRoomMemoryArtifacts,
  requestRoomAiReplyBySlot,
  AI_REPLY_CHAR_LIMIT,
  AI_PROGRESS_STAGES,
  buildUploadedFileUrl,
  resolveUploadedFilePath,
  getRoomMemberPreferences,
  saveRoomMemberPreferences,
  acquireRoomAiExecutionLock,
  releaseRoomAiExecutionLock
} = require('./shared');

const AI_LOOP_DELAY_MS = 8000;
const USER_LED_AI_LOOP_DELAY_MS = 250;
const ROOM_AVATAR_OUTPUT_SIZE = Number(process.env.DISCUSSION_ROOM_AVATAR_SIZE || process.env.AVATAR_SIZE || 256);
const ROOM_AVATAR_WEBP_QUALITY = Number(process.env.DISCUSSION_ROOM_AVATAR_WEBP_QUALITY || process.env.AVATAR_WEBP_QUALITY || 82);
const ROOM_AVATAR_UPLOAD_PREFIX = '/uploads/discussion/avatar/';
const roomAiLoopTimers = new Map();
const buildAiRequestId = () => `ai-loop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const COLLAB_STATUS_OPTIONS = new Set([
  'private-chat',
  'pair-programming',
  'planning',
  'review',
  'client-sync'
]);
const ROOM_INVITE_PERMISSION_OPTIONS = new Set(['host-only', 'all-members']);

const DEFAULT_BUILTIN_MODEL = 'DouBaoSeed';
const BUILTIN_MODEL_AVATAR_MAP = {
  'DouBaoSeed': '/Ai/DouBaoSeed1.6.png',
  'DouBaoSeed1.6': '/Ai/DouBaoSeed1.6.png',
  'GPT-5.4': '/Ai/ChatGPT.svg',
  'Claude 4.6 opus': '/Ai/Claude.png',
  'Gemini 3.0 Pro': '/Ai/Gemini.svg',
  'DeepSeek-R1': '/Ai/DeepSeekR1.png',
  'Qwen3-CodeMax': '/Ai/Qwen.png'
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
  memoryEnabled: true,
  avatarUrl: '',
  avatarUpdatedAt: 0
});

const createDefaultRoomSettings = () => ({
  sourceGameId: '',
  sourceGameTitle: '',
  roomTitle: '',
  roomAvatarUrl: '',
  roomMaxMembers: MAX_ROOM_MEMBERS,
  invitePermission: 'host-only',
  collaborationStatus: 'private-chat',
  collaborationNote: '',
  peerRolePreset: '初学者',
  dualAiLoopEnabled: false,
  dualAiLoopPrompt: '围绕当前房间里的需求继续推进讨论，并给出下一步。',
  dualAiLoopTurnCount: 0,
  dualAiLoopAnchorMessageId: 0,
  dualAiLoopRepliesForAnchor: 0,
  aiSlots: [
    createDefaultAiSlot('slot-1', '协作 AI 1'),
    createDefaultAiSlot('slot-2', '协作 AI 2')
  ]
});

const createDefaultRoomMemberSettings = () => ({
  customNickname: '',
  clearedBeforeMessageId: 0
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
    memoryEnabled: merged.memoryEnabled !== false,
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
  const aiSlots = [0, 1].map((index) => normalizeAiSlot(rawSlots[index], existingSlots[index], index, userId));
  const dualAiLoopEnabled = Boolean(base.dualAiLoopEnabled);
  const enabledAiCount = aiSlots.filter((slot) => slot?.enabled).length;
  const dualAiLoopAnchorMessageId = dualAiLoopEnabled && enabledAiCount >= 2
    ? Math.max(0, Number(existingSettings?.dualAiLoopAnchorMessageId || base.dualAiLoopAnchorMessageId || 0) || 0)
    : 0;
  const dualAiLoopRepliesForAnchor = dualAiLoopEnabled && enabledAiCount >= 2
    ? Math.max(0, Number(existingSettings?.dualAiLoopRepliesForAnchor || base.dualAiLoopRepliesForAnchor || 0) || 0)
    : 0;

  return {
    sourceGameId: safeText(base.sourceGameId || '', 120),
    sourceGameTitle: safeText(base.sourceGameTitle || '', 255),
    roomTitle: safeText(base.roomTitle || '', 120),
    roomAvatarUrl: safeText(base.roomAvatarUrl || '', 200000),
    roomMaxMembers: Math.max(2, Math.min(MAX_ROOM_MEMBERS, Number(base.roomMaxMembers || fallback.roomMaxMembers) || fallback.roomMaxMembers)),
    invitePermission: ROOM_INVITE_PERMISSION_OPTIONS.has(base.invitePermission) ? base.invitePermission : fallback.invitePermission,
    collaborationStatus: COLLAB_STATUS_OPTIONS.has(base.collaborationStatus) ? base.collaborationStatus : fallback.collaborationStatus,
    collaborationNote: safeLongText(base.collaborationNote || '', 1000),
    peerRolePreset: safeText(base.peerRolePreset || fallback.peerRolePreset, 40) || fallback.peerRolePreset,
    dualAiLoopEnabled,
    dualAiLoopPrompt: safeLongText(base.dualAiLoopPrompt || fallback.dualAiLoopPrompt, 1000) || fallback.dualAiLoopPrompt,
    dualAiLoopTurnCount: Math.max(0, Number(existingSettings?.dualAiLoopTurnCount || base.dualAiLoopTurnCount || 0) || 0),
    dualAiLoopAnchorMessageId,
    dualAiLoopRepliesForAnchor,
    aiSlots
  };
};

const serializeRoomSettingsForClient = (settings = {}, userId = null, memberSettings = {}) => {
  const normalized = normalizeRoomSettings(settings, settings, userId);
  const normalizedMemberSettings = {
    ...createDefaultRoomMemberSettings(),
    ...(memberSettings && typeof memberSettings === 'object' ? memberSettings : {})
  };
  return {
    ...normalized,
    customNickname: safeText(normalizedMemberSettings.customNickname || '', 40),
    clearedBeforeMessageId: Math.max(0, Number(normalizedMemberSettings.clearedBeforeMessageId || 0) || 0),
    aiSlots: normalized.aiSlots.map((slot) => ({
      ...slot,
      hasApiKey: Boolean(slot.apiKey),
      apiKey: Number(slot.ownerUserId || 0) === Number(userId || 0) ? slot.apiKey : ''
    }))
  };
};

const getRoomMemberSettings = async (pool, roomId, userId) => {
  const stored = await getRoomMemberPreferences(pool, roomId, userId);
  return {
    ...createDefaultRoomMemberSettings(),
    ...(stored && typeof stored === 'object' ? stored : {})
  };
};

const saveRoomMemberSettings = async (pool, roomId, userId, nextSettings = {}) => {
  const stored = await saveRoomMemberPreferences(pool, roomId, userId, nextSettings);
  return {
    ...createDefaultRoomMemberSettings(),
    ...(stored && typeof stored === 'object' ? stored : {})
  };
};

const emitRoomSettingsToJoinedMembers = async (pool, roomId, settings = {}, updatedByUserId = null) => {
  const [members] = await pool.execute(
    `SELECT user_id
     FROM discussion_room_members
     WHERE room_id = ? AND status = 'joined'
     ORDER BY joined_at ASC`,
    [roomId]
  );

  await Promise.all(
    members.map(async (member) => {
      const targetUserId = Number(member?.user_id || 0) || null;
      if (!targetUserId) return;
      const memberSettings = await getRoomMemberSettings(pool, roomId, targetUserId);
      emitRoomSettingsEventToUser(targetUserId, roomId, {
        settings: serializeRoomSettingsForClient(settings, targetUserId, memberSettings),
        updatedByUserId
      });
    })
  );
};

const buildAiProgressPayload = ({ requestId, slot = {}, stage, message, targetUsername = '', mode = 'dual-loop' }) => ({
  requestId,
  slotId: String(slot.id || '').trim() || 'slot-1',
  slotName: String(slot.name || '').trim() || 'AI 助手',
  slotAvatarUrl: String(slot.avatarUrl || '').trim() || getBuiltinModelAvatarUrl(slot.builtinModel || ''),
  stage,
  message,
  targetUsername: String(targetUsername || '').trim(),
  mode
});

const deriveLoopTargetUsername = (recentMessages = [], currentSlot = {}) => {
  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index] || {};
    if (String(message.sender_type || '').trim() === 'system') continue;
    const metadata = parseSettingsJson(message.metadata_json) || {};
    const localAiName = safeText(metadata.local_ai_name || '', 80);
    const username = safeText(message.username || '', 80);
    const senderLabel = localAiName || username;
    if (!senderLabel) continue;
    if (senderLabel === safeText(currentSlot.name || '', 80)) continue;
    return senderLabel;
  }
  return '';
};

const getDualAiReplyLimit = (settings = {}) => {
  const enabledCount = Array.isArray(settings.aiSlots)
    ? settings.aiSlots.filter((slot) => slot?.enabled).length
    : 0;
  return Math.min(Math.max(enabledCount, 0), 2);
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
  const room = await getRoomContext(pool, roomId);
  const parsed = normalizeRoomSettings({
    ...(parseSettingsJson(row?.settings_json) || {}),
    roomTitle: room?.title || '',
    roomMaxMembers: room?.max_members || MAX_ROOM_MEMBERS
  });
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
    `SELECT r.id, r.mode, r.game_id, r.host_user_id, r.title, r.max_members, g.title AS game_title
     FROM discussion_rooms r
     JOIN games g ON g.game_id = r.game_id
     WHERE r.id = ?
     LIMIT 1`,
    [roomId]
  );
  return rows[0] || null;
};

const ensureRoomMemberAccess = async (pool, roomId, userId) => {
  const member = await getJoinedMember(pool, roomId, userId, false);
  if (!member || member.status !== 'joined') {
    return { ok: false, error: '仅房间成员可操作该配置', status: 403 };
  }
  const room = await getRoomContext(pool, roomId);
  if (!room) {
    return { ok: false, error: '房间不存在', status: 404 };
  }
  return { ok: true, room, member };
};

const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup failures
  }
};

const isManagedRoomAvatarUrl = (avatarUrl = '') => {
  const normalized = String(avatarUrl || '').trim();
  return normalized.startsWith(ROOM_AVATAR_UPLOAD_PREFIX);
};

const cleanupPreviousRoomAvatar = async (previousAvatarUrl = '', nextAvatarUrl = '') => {
  const previousUrl = String(previousAvatarUrl || '').trim();
  const nextUrl = String(nextAvatarUrl || '').trim();
  if (!previousUrl || previousUrl === nextUrl || !isManagedRoomAvatarUrl(previousUrl)) return;

  const previousAvatarPath = resolveUploadedFilePath(previousUrl);
  const nextAvatarPath = resolveUploadedFilePath(nextUrl);
  if (!previousAvatarPath || previousAvatarPath === nextAvatarPath) return;
  await safeUnlink(previousAvatarPath);
};

const processRoomAvatarImage = async (inputPath) => {
  if (!inputPath) {
    throw new Error('群头像文件路径无效');
  }

  const parsedPath = path.parse(inputPath);
  const outputFileName = String(parsedPath.ext || '').toLowerCase() === '.webp'
    ? `${parsedPath.name}-processed.webp`
    : `${parsedPath.name}.webp`;
  const outputPath = path.join(parsedPath.dir, outputFileName);

  await sharp(inputPath)
    .rotate()
    .resize(ROOM_AVATAR_OUTPUT_SIZE, ROOM_AVATAR_OUTPUT_SIZE, { fit: 'cover', position: 'attention' })
    .webp({ quality: ROOM_AVATAR_WEBP_QUALITY })
    .toFile(outputPath);

  if (outputPath !== inputPath) {
    await safeUnlink(inputPath);
  }

  return {
    outputPath,
    outputFilename: path.basename(outputPath)
  };
};

const insertAiLoopMessage = async (pool, roomId, triggerUserId, slot, replyResult, options = {}) => {
  const metadata = {
    ai_slot_id: slot.id,
    local_ai_name: slot.name || 'AI 助手',
    local_ai_avatar_url: slot.avatarUrl || getBuiltinModelAvatarUrl(slot.builtinModel || ''),
    ai_provider: slot.provider || 'builtin',
    ai_model: slot.provider === 'custom' ? (slot.customModel || '') : (slot.builtinModel || ''),
    trigger_user_id: triggerUserId || null,
    ai_request_id: String(options.requestId || '').trim(),
    target_username: String(options.targetUsername || '').trim(),
    reply_token_count: Number(replyResult?.tokenCount || 0) || 0,
    reply_char_count: Number(replyResult?.charCount || 0) || 0,
    reply_char_limit: AI_REPLY_CHAR_LIMIT,
    ai_mode: String(options.mode || 'dual-loop').trim() || 'dual-loop'
  };

  const [insertResult] = await pool.execute(
    `INSERT INTO discussion_messages
     (room_id, sender_type, sender_user_id, message_type, content, metadata_json)
     VALUES (?, 'ai', NULL, 'text', ?, ?)`,
    [roomId, replyResult?.content || '', JSON.stringify(metadata)]
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

const shouldRunDualAiLoop = (settings = {}) => {
  const enabledCount = Array.isArray(settings.aiSlots)
    ? settings.aiSlots.filter((slot) => slot?.enabled).length
    : 0;
  return Boolean(settings.dualAiLoopEnabled) && enabledCount >= 2;
};

const hasPendingDualAiLoopTurn = (settings = {}) => {
  if (!shouldRunDualAiLoop(settings)) return false;
  const anchorMessageId = Math.max(0, Number(settings.dualAiLoopAnchorMessageId || 0) || 0);
  const repliesForAnchor = Math.max(0, Number(settings.dualAiLoopRepliesForAnchor || 0) || 0);
  return Boolean(anchorMessageId) && repliesForAnchor < getDualAiReplyLimit(settings);
};

const getLatestUserMessage = async (pool, roomId) => {
  const [rows] = await pool.execute(
    `SELECT m.id, m.room_id, m.sender_type, m.sender_user_id, m.content, m.metadata_json, m.created_at, u.username
     FROM discussion_messages m
     LEFT JOIN users u ON u.id = m.sender_user_id
     WHERE m.room_id = ?
       AND m.sender_type = 'user'
     ORDER BY m.id DESC
     LIMIT 1`,
    [roomId]
  );
  return rows[0] || null;
};

const getRoomMessageById = async (pool, messageId) => {
  const [rows] = await pool.execute(
    `SELECT m.id, m.room_id, m.sender_type, m.sender_user_id, m.content, m.metadata_json, m.created_at, u.username
     FROM discussion_messages m
     LEFT JOIN users u ON u.id = m.sender_user_id
     WHERE m.id = ?
     LIMIT 1`,
    [messageId]
  );
  return rows[0] || null;
};

async function runRoomAiLoopTurn(roomId, options = {}) {
  const parsedRoomId = toInt(roomId);
  if (!parsedRoomId) return null;

  const lockAcquired = acquireRoomAiExecutionLock(parsedRoomId);
  if (!lockAcquired) {
    if (!options.manual) {
      scheduleRoomAiLoop(parsedRoomId, AI_LOOP_DELAY_MS);
      return null;
    }
    const conflictError = new Error('当前房间已有 AI 正在回复，请等待本轮完成');
    conflictError.status = 409;
    throw conflictError;
  }

  let requestId = '';
  try {
    const pool = getPool();
    const room = await getRoomContext(pool, parsedRoomId);
    if (!room || room.mode !== 'friend') {
      stopRoomAiLoop(parsedRoomId);
      return null;
    }

    const { settings } = await getStoredRoomSettings(pool, parsedRoomId);
    const enabledSlots = settings.aiSlots.filter((slot) => slot.enabled);
    if (!shouldRunDualAiLoop(settings) || enabledSlots.length < 2) {
      stopRoomAiLoop(parsedRoomId);
      return null;
    }

    const replyLimit = getDualAiReplyLimit(settings);
    let anchorMessageId = Math.max(0, Number(settings.dualAiLoopAnchorMessageId || 0) || 0);
    let repliesForAnchor = Math.max(0, Number(settings.dualAiLoopRepliesForAnchor || 0) || 0);
    let anchorMessage = null;

    if (options.manual) {
      const latestUserMessage = await getLatestUserMessage(pool, parsedRoomId);
      if (!latestUserMessage) {
        stopRoomAiLoop(parsedRoomId);
        return null;
      }
      const shouldResetAnchor = anchorMessageId !== Number(latestUserMessage.id || 0) || repliesForAnchor >= replyLimit;
      if (shouldResetAnchor) {
        settings.dualAiLoopAnchorMessageId = Number(latestUserMessage.id || 0) || 0;
        settings.dualAiLoopRepliesForAnchor = 0;
        await saveRoomSettings(pool, parsedRoomId, settings, options.triggerUserId || 0);
        anchorMessageId = settings.dualAiLoopAnchorMessageId;
        repliesForAnchor = 0;
      }
      anchorMessage = latestUserMessage;
    } else if (!hasPendingDualAiLoopTurn(settings)) {
      stopRoomAiLoop(parsedRoomId);
      return null;
    }

    if (!anchorMessageId) {
      stopRoomAiLoop(parsedRoomId);
      return null;
    }

    if (!anchorMessage) {
      anchorMessage = await getRoomMessageById(pool, anchorMessageId);
    }
    if (!anchorMessage || String(anchorMessage.sender_type || '').trim() !== 'user') {
      const { settings: latestSettings } = await getStoredRoomSettings(pool, parsedRoomId);
      latestSettings.dualAiLoopAnchorMessageId = 0;
      latestSettings.dualAiLoopRepliesForAnchor = 0;
      await saveRoomSettings(pool, parsedRoomId, latestSettings, options.triggerUserId || 0);
      stopRoomAiLoop(parsedRoomId);
      return null;
    }

    const slot = enabledSlots[repliesForAnchor % enabledSlots.length];
    requestId = buildAiRequestId();
    const targetUsername = safeText(anchorMessage.username || '', 80);
    const anchorPrompt = safeLongText(anchorMessage.content || '', 2000);

    emitRoomAiProgressEvent(parsedRoomId, buildAiProgressPayload({
      requestId,
      slot,
      stage: AI_PROGRESS_STAGES.queued,
      message: '正在围绕最近一条用户消息生成协作回复…',
      targetUsername,
      mode: 'dual-loop'
    }));

    const [recentMessages] = await pool.execute(
      `SELECT m.id, m.sender_type, m.sender_user_id, m.content, m.metadata_json, m.created_at, u.username
       FROM discussion_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.room_id = ?
       ORDER BY m.id DESC
       LIMIT 20`,
      [parsedRoomId]
    );
    const orderedMessages = recentMessages.reverse();

    emitRoomAiProgressEvent(parsedRoomId, buildAiProgressPayload({
      requestId,
      slot,
      stage: AI_PROGRESS_STAGES.memory,
      message: '正在同步与该用户问题相关的记忆、对话、源码片段和文档内容…',
      targetUsername,
      mode: 'dual-loop'
    }));

    const replyResult = await requestRoomAiReplyBySlot({
      pool,
      roomId: parsedRoomId,
      slot,
      room,
      prompt: anchorPrompt,
      recentMessages: orderedMessages,
      loopPrompt: settings.dualAiLoopPrompt,
      targetUserName: targetUsername
    });

    emitRoomAiProgressEvent(parsedRoomId, buildAiProgressPayload({
      requestId,
      slot,
      stage: AI_PROGRESS_STAGES.finalizing,
      message: '已生成本轮草稿，正在压缩并写入房间消息流…',
      targetUsername,
      mode: 'dual-loop'
    }));

    const { settings: latestSettingsBeforeInsert } = await getStoredRoomSettings(pool, parsedRoomId);
    const latestEnabledSlots = Array.isArray(latestSettingsBeforeInsert.aiSlots)
      ? latestSettingsBeforeInsert.aiSlots.filter((item) => item?.enabled)
      : [];
    const isCurrentSlotStillEnabled = latestEnabledSlots.some((item) => String(item?.id || '') === String(slot?.id || ''));
    const latestAnchorMessageId = Math.max(0, Number(latestSettingsBeforeInsert.dualAiLoopAnchorMessageId || 0) || 0);
    const latestRepliesForAnchor = Math.max(0, Number(latestSettingsBeforeInsert.dualAiLoopRepliesForAnchor || 0) || 0);
    const anchorStillCurrent = latestAnchorMessageId === anchorMessageId;
    const replyStateStillCurrent = latestRepliesForAnchor === repliesForAnchor;
    if (!shouldRunDualAiLoop(latestSettingsBeforeInsert) || !isCurrentSlotStillEnabled || !anchorStillCurrent || !replyStateStillCurrent) {
      stopRoomAiLoop(parsedRoomId);
      return null;
    }

    const message = await insertAiLoopMessage(pool, parsedRoomId, options.triggerUserId || null, slot, replyResult, {
      requestId,
      targetUsername,
      mode: 'dual-loop'
    });
    if (!message) {
      stopRoomAiLoop(parsedRoomId);
      return null;
    }

    const { settings: latestSettings } = await getStoredRoomSettings(pool, parsedRoomId);
    const latestAnchorAfterInsert = Math.max(0, Number(latestSettings.dualAiLoopAnchorMessageId || 0) || 0);
    const anchorDidNotChange = latestAnchorAfterInsert === anchorMessageId;
    if (anchorDidNotChange) {
      latestSettings.dualAiLoopRepliesForAnchor = Math.max(
        Number(latestSettings.dualAiLoopRepliesForAnchor || 0) || 0,
        repliesForAnchor + 1
      );
      latestSettings.dualAiLoopTurnCount = Math.max(
        Number(latestSettings.dualAiLoopTurnCount || 0) || 0,
        (Number(latestSettings.dualAiLoopTurnCount || 0) || 0) + 1
      );
      await saveRoomSettings(pool, parsedRoomId, latestSettings, options.triggerUserId || 0);
    }
    const memoryPayload = await refreshRoomMemoryArtifacts(pool, parsedRoomId, { updatedByUserId: options.triggerUserId || 0 });

    emitRoomMessage(parsedRoomId, message);
    await emitRoomSettingsToJoinedMembers(
      pool,
      parsedRoomId,
      latestSettings,
      options.triggerUserId || null
    );
    emitRoomMemoryEvent(parsedRoomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: options.triggerUserId || null
    });

    if (!options.manual && anchorDidNotChange && hasPendingDualAiLoopTurn(latestSettings)) {
      scheduleRoomAiLoop(parsedRoomId);
    } else {
      stopRoomAiLoop(parsedRoomId);
    }

    return message;
  } catch (error) {
    if (requestId) {
      emitRoomAiProgressEvent(parsedRoomId, {
        requestId,
        stage: AI_PROGRESS_STAGES.error,
        message: error.message || '双 AI 轮询失败',
        mode: 'dual-loop'
      });
    }
    throw error;
  } finally {
    releaseRoomAiExecutionLock(parsedRoomId);
  }
}

const syncRoomAiLoop = async (roomId) => {
  const parsedRoomId = toInt(roomId);
  if (!parsedRoomId) return;
  const pool = getPool();
  const { settings } = await getStoredRoomSettings(pool, parsedRoomId);
  if (!hasPendingDualAiLoopTurn(settings)) {
    stopRoomAiLoop(parsedRoomId);
    return;
  }
  if (!roomAiLoopTimers.has(String(parsedRoomId))) {
    scheduleRoomAiLoop(parsedRoomId, USER_LED_AI_LOOP_DELAY_MS);
  }
};

const primeRoomAiLoopForUserMessage = async ({ roomId, userId, messageId }) => {
  const parsedRoomId = toInt(roomId);
  const parsedMessageId = toInt(messageId);
  if (!parsedRoomId || !parsedMessageId) return false;

  const pool = getPool();
  const { settings } = await getStoredRoomSettings(pool, parsedRoomId);
  if (!shouldRunDualAiLoop(settings)) {
    stopRoomAiLoop(parsedRoomId);
    return false;
  }

  settings.dualAiLoopAnchorMessageId = parsedMessageId;
  settings.dualAiLoopRepliesForAnchor = 0;
  await saveRoomSettings(pool, parsedRoomId, settings, userId || 0);
  scheduleRoomAiLoop(parsedRoomId, USER_LED_AI_LOOP_DELAY_MS);
  return true;
};

const getRoomSettings = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const pool = getPool();
    const permission = await ensureRoomMemberAccess(pool, roomId, userId);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    const { settings, row } = await getStoredRoomSettings(pool, roomId);
    const memberSettings = await getRoomMemberSettings(pool, roomId, userId);
    const settingsWithRoomContext = normalizeRoomSettings({
      ...settings,
      roomTitle: permission.room?.title || settings.roomTitle,
      roomMaxMembers: permission.room?.max_members || settings.roomMaxMembers
    }, settings, userId);
    await syncRoomAiLoop(roomId);
    res.json({
      settings: serializeRoomSettingsForClient(settingsWithRoomContext, userId, memberSettings),
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
    const permission = await ensureRoomMemberAccess(pool, roomId, userId);
    if (!permission.ok) {
      return res.status(permission.status).json({ error: permission.error });
    }

    await ensureRoomMemberPreferencesTable(pool);
    const incomingSettings = req.body?.settings || req.body || {};
    const { settings: existingSettings } = await getStoredRoomSettings(pool, roomId);
    const mergedExistingSettings = normalizeRoomSettings({
      ...existingSettings,
      roomTitle: permission.room?.title || existingSettings.roomTitle,
      roomMaxMembers: permission.room?.max_members || existingSettings.roomMaxMembers
    }, existingSettings, userId);
    const previousRoomAvatarUrl = safeText(mergedExistingSettings.roomAvatarUrl || '', 200000);
    const touchesGroupMeta = ['roomTitle', 'roomAvatarUrl', 'roomMaxMembers', 'invitePermission']
      .some((field) => Object.prototype.hasOwnProperty.call(incomingSettings, field));

    if (permission.room?.mode === 'room' && touchesGroupMeta && Number(permission.room?.host_user_id || 0) !== Number(userId)) {
      return res.status(403).json({ error: '仅群主可修改群聊资料、邀请权限和人数上限' });
    }

    const nextSettings = normalizeRoomSettings(incomingSettings, mergedExistingSettings, userId);

    if (permission.room?.mode === 'room' && touchesGroupMeta) {
      const nextMaxMembers = Math.max(2, Math.min(MAX_ROOM_MEMBERS, Number(nextSettings.roomMaxMembers || permission.room?.max_members || MAX_ROOM_MEMBERS) || MAX_ROOM_MEMBERS));
      const [joinedRows] = await pool.execute(
        `SELECT COUNT(*) AS joined_count
         FROM discussion_room_members
         WHERE room_id = ? AND status = 'joined'`,
        [roomId]
      );
      const joinedCount = Math.max(0, Number(joinedRows[0]?.joined_count || 0) || 0);
      if (nextMaxMembers < joinedCount) {
        return res.status(400).json({ error: `当前群内已有 ${joinedCount} 人，人数上限不能低于当前人数` });
      }

      await pool.execute(
        `UPDATE discussion_rooms
         SET title = ?, max_members = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [safeText(nextSettings.roomTitle || permission.room?.title || '', 120) || null, nextMaxMembers, roomId]
      );
      nextSettings.roomMaxMembers = nextMaxMembers;
    }

    await saveRoomSettings(pool, roomId, nextSettings, userId);
    const nextMemberSettings = await saveRoomMemberSettings(
      pool,
      roomId,
      userId,
      Object.prototype.hasOwnProperty.call(incomingSettings, 'customNickname')
        ? { customNickname: incomingSettings.customNickname }
        : {}
    );
    if (!shouldRunDualAiLoop(nextSettings)) {
      stopRoomAiLoop(roomId);
    }
    await syncRoomAiLoop(roomId);
    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, {
      updatedByUserId: userId,
      settings: nextSettings
    });
    await emitRoomSettingsToJoinedMembers(pool, roomId, nextSettings, userId);
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: userId
    });
    if (Object.prototype.hasOwnProperty.call(incomingSettings, 'roomAvatarUrl')) {
      await cleanupPreviousRoomAvatar(previousRoomAvatarUrl, nextSettings.roomAvatarUrl);
    }

    res.json({
      settings: serializeRoomSettingsForClient(nextSettings, userId, nextMemberSettings),
      updatedByUserId: userId
    });
  } catch (error) {
    console.error('更新房间设置失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const uploadRoomAvatar = async (req, res) => {
  let transientUploadPath = req.file?.path || '';
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    if (!roomId) {
      await safeUnlink(transientUploadPath);
      return res.status(400).json({ error: '无效的 roomId' });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请上传群头像图片' });
    }

    const pool = getPool();
    const permission = await ensureRoomMemberAccess(pool, roomId, userId);
    if (!permission.ok) {
      await safeUnlink(transientUploadPath);
      return res.status(permission.status).json({ error: permission.error });
    }
    if (permission.room?.mode !== 'room') {
      await safeUnlink(transientUploadPath);
      return res.status(400).json({ error: '当前房间不支持群头像上传' });
    }
    if (Number(permission.room?.host_user_id || 0) !== Number(userId)) {
      await safeUnlink(transientUploadPath);
      return res.status(403).json({ error: '仅群主可修改群头像' });
    }

    const { settings: existingSettings } = await getStoredRoomSettings(pool, roomId);
    const mergedExistingSettings = normalizeRoomSettings({
      ...existingSettings,
      roomTitle: permission.room?.title || existingSettings.roomTitle,
      roomMaxMembers: permission.room?.max_members || existingSettings.roomMaxMembers
    }, existingSettings, userId);
    const previousRoomAvatarUrl = safeText(mergedExistingSettings.roomAvatarUrl || '', 200000);

    const { outputPath, outputFilename } = await processRoomAvatarImage(req.file.path);
    transientUploadPath = outputPath;
    const nextRoomAvatarUrl = buildUploadedFileUrl(outputPath, `discussion/avatar/${outputFilename}`);
    const nextSettings = normalizeRoomSettings({
      ...mergedExistingSettings,
      roomAvatarUrl: nextRoomAvatarUrl
    }, mergedExistingSettings, userId);

    await saveRoomSettings(pool, roomId, nextSettings, userId);
    transientUploadPath = '';

    const nextMemberSettings = await getRoomMemberSettings(pool, roomId, userId);
    await emitRoomSettingsToJoinedMembers(pool, roomId, nextSettings, userId);
    await cleanupPreviousRoomAvatar(previousRoomAvatarUrl, nextSettings.roomAvatarUrl);

    return res.json({
      avatarUrl: nextSettings.roomAvatarUrl,
      settings: serializeRoomSettingsForClient(nextSettings, userId, nextMemberSettings),
      updatedByUserId: userId
    });
  } catch (error) {
    console.error('上传群头像失败:', error);
    await safeUnlink(transientUploadPath);
    return res.status(500).json({ error: '群头像上传失败' });
  }
};

const triggerRoomAiLoopTurn = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const pool = getPool();
    const permission = await ensureRoomMemberAccess(pool, roomId, userId);
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
    res.status(error.status || 500).json({ error: error.message || '服务器内部错误' });
  }
};

module.exports = {
  getRoomSettings,
  updateRoomSettings,
  uploadRoomAvatar,
  triggerRoomAiLoopTurn,
  primeRoomAiLoopForUserMessage
};
