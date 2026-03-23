const {
  getPool,
  emitRoomMessage,
  toInt,
  getJoinedMember,
  sanitizeMessageMetadata,
  notifyRoomMembers,
  removeUploadedFile,
  buildUploadedFileUrl,
  getRuntimeRoomSettings,
  refreshRoomMemoryArtifacts,
  emitRoomMemoryEvent,
  requestRoomAiReplyBySlot
} = require('./shared');

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

    if (afterId) {
      const [messages] = await pool.execute(
        `SELECT m.id, m.room_id, m.sender_type, m.sender_user_id, m.message_type, m.content, m.metadata_json, m.created_at, u.username, u.avatar_url
         FROM discussion_messages m
         LEFT JOIN users u ON u.id = m.sender_user_id
         WHERE m.room_id = ?
           AND m.id > ?
         ORDER BY m.id ASC
         LIMIT ${limit}`,
        [roomId, afterId]
      );
      return res.json({ messages });
    }

    const [messages] = await pool.execute(
      `SELECT m.id, m.room_id, m.sender_type, m.sender_user_id, m.message_type, m.content, m.metadata_json, m.created_at, u.username, u.avatar_url
       FROM discussion_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.room_id = ?
       ${beforeId ? 'AND m.id < ?' : ''}
       ORDER BY m.id DESC
       LIMIT ${limit}`,
      beforeId ? [roomId, beforeId] : [roomId]
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

    const [rows] = await pool.execute(
      `SELECT m.id, m.room_id, m.sender_type, m.sender_user_id, m.message_type, m.content, m.metadata_json, m.created_at, u.username, u.avatar_url
       FROM discussion_messages m
      LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.id = ?
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
    res.status(201).json({ message: rows[0] });
  } catch (error) {
    console.error('发送房间消息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
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

    const [rows] = await pool.execute(
      `SELECT m.id, m.room_id, m.sender_type, m.sender_user_id, m.message_type, m.content, m.metadata_json, m.created_at, u.username, u.avatar_url
       FROM discussion_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.id = ?
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
    res.status(201).json({ message: rows[0] });
  } catch (error) {
    await removeUploadedFile(uploadedPath);
    console.error('上传讨论附件失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const sendAiRoomMessage = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    const prompt = (req.body?.prompt || '').toString().trim();
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!prompt) return res.status(400).json({ error: '请提供 prompt' });

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

    const [recentMessages] = await pool.execute(
      `SELECT m.id, m.sender_type, m.sender_user_id, m.content, m.metadata_json, m.created_at, u.username
       FROM discussion_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.room_id = ?
       ORDER BY m.id DESC
       LIMIT 20`,
      [roomId]
    );

    const roomSettings = await getRuntimeRoomSettings(pool, roomId);
    const slot = resolveSingleAiSlot(roomSettings);
    const aiText = await requestRoomAiReplyBySlot({
      pool,
      roomId,
      room: roomRows[0],
      slot,
      prompt,
      recentMessages: recentMessages.reverse()
    });

    const [insertResult] = await pool.execute(
      `INSERT INTO discussion_messages
       (room_id, sender_type, sender_user_id, message_type, content, metadata_json)
       VALUES (?, 'ai', NULL, 'text', ?, JSON_OBJECT('trigger_user_id', ?, 'game_id', ?, 'local_ai_name', ?, 'local_ai_avatar_url', ?, 'ai_provider', ?, 'ai_model', ?))`,
      [
        roomId,
        aiText,
        userId,
        roomRows[0].game_id,
        slot.name || 'AI 助手',
        slot.avatarUrl || '',
        slot.provider || 'builtin',
        slot.provider === 'custom' ? (slot.customModel || '') : (slot.builtinModel || '')
      ]
    );

    const [rows] = await pool.execute(
      `SELECT id, room_id, sender_type, sender_user_id, message_type, content, metadata_json, created_at
       FROM discussion_messages
       WHERE id = ?
       LIMIT 1`,
      [insertResult.insertId]
    );

    await notifyRoomMembers({
      pool,
      roomId,
      excludeUserId: userId,
      senderLabel: 'AI 助手',
      messageContent: rows[0]?.content || aiText
    });

    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
    emitRoomMessage(roomId, rows[0]);
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: userId
    });
    res.status(201).json({ message: rows[0] });
  } catch (error) {
    console.error('发送 AI 消息失败:', error);
    res.status(500).json({ error: error.message || 'AI 服务异常' });
  }
};

module.exports = {
  listRoomMessages,
  sendRoomMessage,
  uploadRoomAttachment,
  sendAiRoomMessage
};
