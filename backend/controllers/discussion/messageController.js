const crypto = require('crypto');
const { primeRoomAiLoopForUserMessage } = require('./settingsController');
const {
  getPool,
  emitRoomMessage,
  toInt,
  getJoinedMember,
  sanitizeMessageMetadata,
  notifyRoomMembers,
  removeUploadedFile,
  resolveUploadedFilePath,
  buildUploadedFileUrl,
  getRuntimeRoomSettings,
  refreshRoomMemoryArtifacts,
  emitRoomMemoryEvent,
  requestRoomAiReplyBySlot,
  emitRoomAiProgressEvent,
  emitRoomHistoryClearedEventToUser,
  ensureRoomMemberPreferencesTable,
  getRoomMemberPreferences,
  saveRoomMemberPreferences,
  AI_REPLY_CHAR_LIMIT,
  AI_PROGRESS_STAGES,
  acquireRoomAiExecutionLock,
  releaseRoomAiExecutionLock
} = require('./shared');

const MESSAGE_REVOKE_WINDOW_MS = 60 * 1000;

const parseMessageMetadata = (rawValue) => {
  if (!rawValue) return null;
  if (typeof rawValue === 'object') return rawValue;
  if (typeof rawValue !== 'string') return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
};

const executeViewerMessageQuery = async (connection, currentUserId, sqlTail, params = []) => {
  const [rows] = await connection.execute(
    `SELECT m.id, m.room_id, m.sender_type, m.sender_user_id, m.message_type, m.content, m.metadata_json, m.created_at,
            CASE
              WHEN r.mode = 'room' THEN COALESCE(NULLIF(sender_pref.custom_nickname, ''), u.username)
              WHEN m.sender_user_id <> ? THEN COALESCE(NULLIF(viewer_pref.custom_nickname, ''), u.username)
              ELSE u.username
            END AS username,
            u.avatar_url
     FROM discussion_messages m
     JOIN discussion_rooms r ON r.id = m.room_id
     LEFT JOIN users u ON u.id = m.sender_user_id
     LEFT JOIN discussion_room_member_preferences sender_pref
       ON sender_pref.room_id = m.room_id
      AND sender_pref.user_id = m.sender_user_id
     LEFT JOIN discussion_room_member_preferences viewer_pref
       ON viewer_pref.room_id = m.room_id
      AND viewer_pref.user_id = ?
     ${sqlTail}`,
    [currentUserId, currentUserId, ...params]
  );
  return rows;
};

const resolveSingleAiSlot = (settings = {}) => {
  const slots = Array.isArray(settings.aiSlots) ? settings.aiSlots : [];
  return slots.find((slot) => slot?.enabled) || slots[0] || {
    id: 'slot-1',
    enabled: true,
    provider: 'builtin',
    builtinModel: 'DouBaoSeed1.6',
    customModel: '',
    customEndpoint: '',
    apiKey: '',
    name: 'AI 助手',
    context: '',
    memoryEnabled: true
  };
};

const escapeRegExp = (value = '') => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildAiRequestId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const extractMentionedAiSlot = (settings = {}, content = '') => {
  const text = String(content || '').trim();
  if (!text) return null;
  const enabledSlots = (Array.isArray(settings.aiSlots) ? settings.aiSlots : []).filter((slot) => slot?.enabled && String(slot.name || '').trim());
  for (const slot of enabledSlots) {
    const aiName = String(slot.name || '').trim();
    const mentionPattern = new RegExp(`(^|\\s)@${escapeRegExp(aiName)}(?=$|\\s|[，。,.!?！？:：])`, 'i');
    if (mentionPattern.test(text)) {
      return slot;
    }
  }
  return null;
};

const stripAiMention = (content = '', slot = {}) => {
  const aiName = String(slot?.name || '').trim();
  const source = String(content || '').trim();
  if (!aiName || !source) return source;
  const mentionPattern = new RegExp(`(^|\\s)@${escapeRegExp(aiName)}(?=$|\\s|[，。,.!?！？:：])`, 'ig');
  return source.replace(mentionPattern, ' ').replace(/\s+/g, ' ').trim();
};

const buildAiProgressPayload = ({ requestId, slot = {}, stage, message, targetUsername = '', mode = 'single' }) => ({
  requestId,
  slotId: String(slot.id || '').trim() || 'slot-1',
  slotName: String(slot.name || '').trim() || 'AI 助手',
  slotAvatarUrl: String(slot.avatarUrl || '').trim() || '/Ai/DouBaoSeed1.6.png',
  stage,
  message,
  targetUsername: String(targetUsername || '').trim(),
  mode
});

const emitAiProgress = (roomId, payload = {}) => {
  emitRoomAiProgressEvent(roomId, payload);
};

const insertAiRoomMessage = async ({
  pool,
  roomId,
  userId,
  roomGameId,
  slot,
  replyResult,
  requestId,
  targetUserId = null,
  targetUsername = '',
  sourceMessageId = null,
  mode = 'single'
}) => {
  const [insertResult] = await pool.execute(
    `INSERT INTO discussion_messages
     (room_id, sender_type, sender_user_id, message_type, content, metadata_json)
     VALUES (?, 'ai', NULL, 'text', ?, JSON_OBJECT('trigger_user_id', ?, 'game_id', ?, 'local_ai_name', ?, 'local_ai_avatar_url', ?, 'ai_provider', ?, 'ai_model', ?, 'ai_request_id', ?, 'target_user_id', ?, 'target_username', ?, 'reply_token_count', ?, 'reply_char_count', ?, 'reply_char_limit', ?, 'source_message_id', ?, 'ai_mode', ?))`,
    [
      roomId,
      replyResult.content,
      userId || null,
      roomGameId || null,
      slot.name || 'AI 助手',
      slot.avatarUrl || '',
      slot.provider || 'builtin',
      slot.provider === 'custom' ? (slot.customModel || '') : (slot.builtinModel || ''),
      requestId,
      targetUserId || null,
      targetUsername || '',
      Number(replyResult.tokenCount || 0) || 0,
      Number(replyResult.charCount || 0) || 0,
      AI_REPLY_CHAR_LIMIT,
      sourceMessageId || null,
      mode
    ]
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

const triggerMentionedAiReply = async ({
  roomId,
  triggerUserId,
  triggerUsername,
  sourceMessage,
  sourceContent
}) => {
  const requestId = buildAiRequestId();
  if (!acquireRoomAiExecutionLock(roomId)) {
    return false;
  }

  try {
    const pool = getPool();
    await ensureRoomMemberPreferencesTable(pool);
    const roomSettings = await getRuntimeRoomSettings(pool, roomId);
    const slot = extractMentionedAiSlot(roomSettings, sourceContent);
    if (!slot) return false;

    const cleanedPrompt = stripAiMention(sourceContent, slot) || sourceContent;

    emitAiProgress(roomId, buildAiProgressPayload({
      requestId,
      slot,
      stage: AI_PROGRESS_STAGES.queued,
      message: '已收到请求，正在确认提问对象并整理最近对话…',
      targetUsername: triggerUsername,
      mode: 'mention'
    }));

    const [roomRows] = await pool.execute(
      `SELECT r.id, r.game_id, g.title AS game_title
       FROM discussion_rooms r
       JOIN games g ON g.game_id = r.game_id
       WHERE r.id = ?
       LIMIT 1`,
      [roomId]
    );
    if (!roomRows.length) return false;

    const recentMessages = await executeViewerMessageQuery(
      pool,
      triggerUserId,
      `WHERE m.room_id = ?
       ORDER BY m.id DESC
       LIMIT 20`,
      [roomId]
    );

    emitAiProgress(roomId, buildAiProgressPayload({
      requestId,
      slot,
      stage: AI_PROGRESS_STAGES.memory,
      message: '正在读取共享记忆、相关源码片段和文档内容…',
      targetUsername: triggerUsername,
      mode: 'mention'
    }));

    const replyResult = await requestRoomAiReplyBySlot({
      pool,
      roomId,
      room: roomRows[0],
      slot,
      prompt: cleanedPrompt,
      recentMessages: recentMessages.reverse(),
      targetUserName: triggerUsername
    });

    emitAiProgress(roomId, buildAiProgressPayload({
      requestId,
      slot,
      stage: AI_PROGRESS_STAGES.finalizing,
      message: '已生成草稿，正在压缩并写入房间消息流…',
      targetUsername: triggerUsername,
      mode: 'mention'
    }));

    const rawMessage = await insertAiRoomMessage({
      pool,
      roomId,
      userId: triggerUserId,
      roomGameId: roomRows[0].game_id,
      slot,
      replyResult,
      requestId,
      targetUserId: triggerUserId,
      targetUsername: triggerUsername,
      sourceMessageId: sourceMessage?.id || null,
      mode: 'mention'
    });
    if (!rawMessage) return false;

    await notifyRoomMembers({
      pool,
      roomId,
      excludeUserId: triggerUserId,
      senderLabel: slot.name || 'AI 助手',
      messageContent: rawMessage.content
    });

    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: triggerUserId });
    emitRoomMessage(roomId, rawMessage);
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: triggerUserId
    });
    return true;
  } catch (error) {
    emitAiProgress(roomId, {
      requestId,
      stage: AI_PROGRESS_STAGES.error,
      message: error.message || 'AI 回复失败',
      targetUsername: triggerUsername,
      mode: 'mention'
    });
    console.error('触发 @AI 回复失败:', error);
    return false;
  } finally {
    releaseRoomAiExecutionLock(roomId);
  }
};

const listRoomMessages = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const limit = Math.min(Math.max(toInt(req.query.limit) || 50, 1), 200);
    const beforeId = toInt(req.query.beforeId);
    const afterId = toInt(req.query.afterId);
    if (beforeId && afterId) {
      return res.status(400).json({ error: 'beforeId 与 afterId 不能同时传入' });
    }
    const userId = req.user.userId;
    const pool = getPool();

    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可查看消息' });
    }

    await ensureRoomMemberPreferencesTable(pool);
    const memberPreferences = await getRoomMemberPreferences(pool, roomId, userId);
    const clearedBeforeMessageId = Math.max(0, Number(memberPreferences.clearedBeforeMessageId || 0) || 0);

    if (afterId) {
      const effectiveAfterId = Math.max(afterId, clearedBeforeMessageId);
      const messages = await executeViewerMessageQuery(
        pool,
        userId,
        `WHERE m.room_id = ?
           AND m.id > ?
         ORDER BY m.id ASC
         LIMIT ${limit}`,
        [roomId, effectiveAfterId]
      );
      return res.json({ messages });
    }

    const messages = await executeViewerMessageQuery(
      pool,
      userId,
      `WHERE m.room_id = ?
         AND m.id > ?
       ${beforeId ? 'AND m.id < ?' : ''}
       ORDER BY m.id DESC
       LIMIT ${limit}`,
      beforeId ? [roomId, clearedBeforeMessageId, beforeId] : [roomId, clearedBeforeMessageId]
    );

    return res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('获取房间消息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const sendRoomMessage = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    const rawContent = (req.body?.content || '').toString().trim();
    const metadata = sanitizeMessageMetadata(req.body?.metadata);
    const fallbackContent = metadata?.code_preview?.path
      ? `代码预览：${metadata.code_preview.path}`
      : metadata?.document_preview?.name
        ? `文档预览：${metadata.document_preview.name}`
      : '';
    const content = rawContent || fallbackContent;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!content) return res.status(400).json({ error: '消息内容不能为空' });

    const pool = getPool();
    await ensureRoomMemberPreferencesTable(pool);
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可发送消息' });
    }

    const [result] = await pool.execute(
      `INSERT INTO discussion_messages
       (room_id, sender_type, sender_user_id, message_type, content, metadata_json)
       VALUES (?, 'user', ?, 'text', ?, ?)`,
      [roomId, userId, content, metadata ? JSON.stringify(metadata) : null]
    );

    const rows = await executeViewerMessageQuery(
      pool,
      userId,
      `WHERE m.id = ?
       LIMIT 1`,
      [result.insertId]
    );

    await notifyRoomMembers({
      pool,
      roomId,
      excludeUserId: userId,
      senderLabel: rows[0]?.username || '成员',
      messageContent: rows[0]?.content || content
    });

    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
    emitRoomMessage(roomId, rows[0]);
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: userId
    });

    const roomSettings = await getRuntimeRoomSettings(pool, roomId);
    const mentionedAiSlot = extractMentionedAiSlot(roomSettings, content);
    if (mentionedAiSlot) {
      setTimeout(() => {
        triggerMentionedAiReply({
          roomId,
          triggerUserId: userId,
          triggerUsername: rows[0]?.username || '成员',
          sourceMessage: rows[0] || null,
          sourceContent: content
        }).catch((error) => {
          console.error('异步触发 @AI 回复失败:', error);
        });
      }, 0);
    } else if (roomSettings.dualAiLoopEnabled) {
      setTimeout(() => {
        primeRoomAiLoopForUserMessage({
          roomId,
          userId,
          messageId: rows[0]?.id || result.insertId
        }).catch((error) => {
          console.error('启动用户主导双 AI 对话失败:', error);
        });
      }, 0);
    }

    res.status(201).json({ message: rows[0] });
  } catch (error) {
    console.error('发送房间消息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const clearRoomMessages = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const pool = getPool();
    await ensureRoomMemberPreferencesTable(pool);
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可清空聊天记录' });
    }

    const [latestRows] = await pool.execute(
      `SELECT MAX(id) AS latest_message_id
       FROM discussion_messages
       WHERE room_id = ?`,
      [roomId]
    );

    const latestMessageId = Math.max(0, Number(latestRows[0]?.latest_message_id || 0) || 0);
    const memberPreferences = await saveRoomMemberPreferences(pool, roomId, userId, {
      clearedBeforeMessageId: latestMessageId,
      clearedAt: latestMessageId ? new Date() : null
    });

    emitRoomHistoryClearedEventToUser(userId, roomId, {
      clearedBeforeMessageId: memberPreferences.clearedBeforeMessageId
    });

    return res.json({
      roomId,
      clearedBeforeMessageId: memberPreferences.clearedBeforeMessageId
    });
  } catch (error) {
    console.error('清空聊天记录失败:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
};

const revokeRoomMessage = async (req, res) => {
  let attachmentFilePath = '';
  try {
    const roomId = toInt(req.params.roomId);
    const messageId = toInt(req.params.messageId);
    const userId = req.user.userId;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!messageId) return res.status(400).json({ error: '无效的 messageId' });

    const pool = getPool();
    await ensureRoomMemberPreferencesTable(pool);
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可撤回消息' });
    }

    const [messageRows] = await pool.execute(
      `SELECT id, room_id, sender_type, sender_user_id, message_type, content, metadata_json, created_at
       FROM discussion_messages
       WHERE id = ? AND room_id = ?
       LIMIT 1`,
      [messageId, roomId]
    );
    const message = messageRows[0] || null;
    if (!message) {
      return res.status(404).json({ error: '消息不存在' });
    }
    if (String(message.sender_type || '').trim() !== 'user' || Number(message.sender_user_id || 0) !== Number(userId)) {
      return res.status(403).json({ error: '只能撤回自己发送的消息' });
    }

    const createdAtMs = new Date(message.created_at).getTime();
    if (!createdAtMs || Number.isNaN(createdAtMs)) {
      return res.status(400).json({ error: '消息时间无效，暂时无法撤回' });
    }
    if (Date.now() - createdAtMs > MESSAGE_REVOKE_WINDOW_MS) {
      return res.status(400).json({ error: '消息发送超过 1 分钟，无法撤回' });
    }

    const metadata = parseMessageMetadata(message.metadata_json) || {};
    if (metadata?.revoked) {
      return res.status(409).json({ error: '该消息已撤回' });
    }

    const attachmentUrl = String(metadata?.attachment?.url || '').trim();
    attachmentFilePath = resolveUploadedFilePath(attachmentUrl);

    const revokedMetadata = {
      revoked: true,
      revoked_by_user_id: userId,
      revoked_at: new Date().toISOString()
    };

    await pool.execute(
      `UPDATE discussion_messages
       SET content = '',
           metadata_json = ?
       WHERE id = ? AND room_id = ?`,
      [JSON.stringify(revokedMetadata), messageId, roomId]
    );

    const updatedRows = await executeViewerMessageQuery(
      pool,
      userId,
      `WHERE m.id = ?
       LIMIT 1`,
      [messageId]
    );
    const updatedMessage = updatedRows[0] || null;
    if (!updatedMessage) {
      return res.status(500).json({ error: '撤回后的消息读取失败' });
    }

    if (attachmentFilePath) {
      await removeUploadedFile(attachmentFilePath);
    }

    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
    emitRoomMessage(roomId, updatedMessage);
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: userId
    });

    return res.json({ message: updatedMessage });
  } catch (error) {
    console.error('撤回消息失败:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
};

const uploadRoomAttachment = async (req, res) => {
  const uploadedPath = req.file?.path || '';
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    const kind = String(req.params.kind || '').trim().toLowerCase();
    if (!roomId) {
      await removeUploadedFile(uploadedPath);
      return res.status(400).json({ error: '无效的 roomId' });
    }
    if (!['image', 'video', 'code'].includes(kind)) {
      await removeUploadedFile(uploadedPath);
      return res.status(400).json({ error: '不支持的附件类型' });
    }
    if (!req.file) return res.status(400).json({ error: '请上传文件' });

    const pool = getPool();
    await ensureRoomMemberPreferencesTable(pool);
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      await removeUploadedFile(uploadedPath);
      return res.status(403).json({ error: '仅房间成员可上传附件' });
    }

    const [roomRows] = await pool.execute(
      `SELECT id, game_id
       FROM discussion_rooms
       WHERE id = ?
       LIMIT 1`,
      [roomId]
    );
    if (!roomRows.length) {
      await removeUploadedFile(uploadedPath);
      return res.status(404).json({ error: '房间不存在' });
    }

    const fileUrl = buildUploadedFileUrl(uploadedPath, `discussion/${kind}/${req.file.filename}`);
    const originalName = String(req.file.originalname || req.file.filename || `${kind}-file`).trim();
    const attachment = {
      type: kind,
      url: fileUrl,
      name: originalName,
      size: Number(req.file.size || 0),
      mime: String(req.file.mimetype || '')
    };

    if (kind === 'code') {
      attachment.game_id = roomRows[0].game_id;
    }

    const kindLabel = kind === 'image' ? '图片' : kind === 'video' ? '视频' : '代码文件';
    const content = `上传了${kindLabel}：${originalName}`;
    const metadataJson = JSON.stringify({ attachment });

    const [result] = await pool.execute(
      `INSERT INTO discussion_messages
       (room_id, sender_type, sender_user_id, message_type, content, metadata_json)
       VALUES (?, 'user', ?, 'text', ?, ?)`,
      [roomId, userId, content, metadataJson]
    );

    const rows = await executeViewerMessageQuery(
      pool,
      userId,
      `WHERE m.id = ?
       LIMIT 1`,
      [result.insertId]
    );

    await notifyRoomMembers({
      pool,
      roomId,
      excludeUserId: userId,
      senderLabel: rows[0]?.username || '成员',
      messageContent: rows[0]?.content || content
    });

    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
    emitRoomMessage(roomId, rows[0]);
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: userId
    });
    const roomSettings = await getRuntimeRoomSettings(pool, roomId);
    if (roomSettings.dualAiLoopEnabled) {
      setTimeout(() => {
        primeRoomAiLoopForUserMessage({
          roomId,
          userId,
          messageId: rows[0]?.id || result.insertId
        }).catch((error) => {
          console.error('启动附件消息双 AI 对话失败:', error);
        });
      }, 0);
    }
    res.status(201).json({ message: rows[0] });
  } catch (error) {
    await removeUploadedFile(uploadedPath);
    console.error('上传讨论附件失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const sendAiRoomMessage = async (req, res) => {
  let lockAcquired = false;
  let requestId = '';
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    const prompt = (req.body?.prompt || '').toString().trim();
    const requestedSlotId = String(req.body?.slotId || '').trim();
    const targetUsername = String(req.body?.targetUsername || '').trim();
    const targetUserId = toInt(req.body?.targetUserId);
    const sourceMessageId = toInt(req.body?.sourceMessageId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!prompt) return res.status(400).json({ error: '请提供 prompt' });

    lockAcquired = acquireRoomAiExecutionLock(roomId);
    if (!lockAcquired) {
      return res.status(409).json({ error: '当前房间已有 AI 正在回复，请等待本轮完成' });
    }

    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可调用 AI' });
    }

    const [roomRows] = await pool.execute(
      `SELECT r.id, r.game_id, g.title AS game_title
       FROM discussion_rooms r
       JOIN games g ON g.game_id = r.game_id
       WHERE r.id = ?
       LIMIT 1`,
      [roomId]
    );
    if (!roomRows.length) return res.status(404).json({ error: '房间不存在' });

    const recentMessages = await executeViewerMessageQuery(
      pool,
      userId,
      `WHERE m.room_id = ?
       ORDER BY m.id DESC
       LIMIT 20`,
      [roomId]
    );

    const roomSettings = await getRuntimeRoomSettings(pool, roomId);
    const slot = (Array.isArray(roomSettings.aiSlots) ? roomSettings.aiSlots : []).find((item) => String(item?.id || '').trim() === requestedSlotId)
      || resolveSingleAiSlot(roomSettings);

    requestId = buildAiRequestId();
    emitAiProgress(roomId, buildAiProgressPayload({
      requestId,
      slot,
      stage: AI_PROGRESS_STAGES.queued,
      message: 'AI 已收到请求，正在整理最近对话与任务目标…',
      targetUsername: targetUsername || '',
      mode: 'single'
    }));

    emitAiProgress(roomId, buildAiProgressPayload({
      requestId,
      slot,
      stage: AI_PROGRESS_STAGES.memory,
      message: '正在检索共享记忆、相关源码片段和文档内容…',
      targetUsername: targetUsername || '',
      mode: 'single'
    }));

    const replyResult = await requestRoomAiReplyBySlot({
      pool,
      roomId,
      room: roomRows[0],
      slot,
      prompt,
      recentMessages: recentMessages.reverse(),
      targetUserName: targetUsername || ''
    });

    emitAiProgress(roomId, buildAiProgressPayload({
      requestId,
      slot,
      stage: AI_PROGRESS_STAGES.finalizing,
      message: '已生成回复草稿，正在压缩并写入房间消息流…',
      targetUsername: targetUsername || '',
      mode: 'single'
    }));

    const rawMessage = await insertAiRoomMessage({
      pool,
      roomId,
      userId,
      roomGameId: roomRows[0].game_id,
      slot,
      replyResult,
      requestId,
      targetUserId,
      targetUsername,
      sourceMessageId,
      mode: 'single'
    });
    if (!rawMessage) {
      throw new Error('AI 回复写入失败');
    }

    await notifyRoomMembers({
      pool,
      roomId,
      excludeUserId: userId,
      senderLabel: slot.name || 'AI 助手',
      messageContent: rawMessage.content || replyResult.content
    });

    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
    emitRoomMessage(roomId, rawMessage);
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: userId
    });
    res.status(201).json({ message: rawMessage });
  } catch (error) {
    if (requestId) {
      emitAiProgress(req.params.roomId, {
        requestId,
        stage: AI_PROGRESS_STAGES.error,
        message: error.message || 'AI 服务异常',
        mode: 'single'
      });
    }
    console.error('发送 AI 消息失败:', error);
    res.status(500).json({ error: error.message || 'AI 服务异常' });
  } finally {
    if (lockAcquired) {
      releaseRoomAiExecutionLock(req.params.roomId);
    }
  }
};

module.exports = {
  listRoomMessages,
  sendRoomMessage,
  clearRoomMessages,
  revokeRoomMessage,
  uploadRoomAttachment,
  sendAiRoomMessage
};
