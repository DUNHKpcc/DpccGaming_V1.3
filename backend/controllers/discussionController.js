const crypto = require('crypto');
const {
  getPool,
  beginTransaction,
  commitTransaction,
  rollbackTransaction
} = require('../config/database');
const { emitRoomMessage } = require('../utils/discussionRealtime');
const { createNotification } = require('../utils/notification');

const MAX_ROOM_MEMBERS = 4;
const DEFAULT_MODEL = 'doubao-seed-1-6-251015';
const DEFAULT_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildRoomCode = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const createUniqueRoomCode = async (connection, retries = 8) => {
  for (let i = 0; i < retries; i += 1) {
    const code = buildRoomCode(6);
    const [rows] = await connection.execute(
      'SELECT id FROM discussion_rooms WHERE room_code = ? LIMIT 1',
      [code]
    );
    if (!rows.length) return code;
  }
  return null;
};

const getGameBasic = async (connection, gameId) => {
  const [games] = await connection.execute(
    `SELECT game_id, title, status
     FROM games
     WHERE game_id = ?
     LIMIT 1`,
    [gameId]
  );
  return games[0] || null;
};

const getRoomByIdForUpdate = async (connection, roomId) => {
  const [rows] = await connection.execute(
    `SELECT *
     FROM discussion_rooms
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [roomId]
  );
  return rows[0] || null;
};

const getJoinedMemberCount = async (connection, roomId) => {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count
     FROM discussion_room_members
     WHERE room_id = ? AND status = 'joined'`,
    [roomId]
  );
  return Number(rows[0]?.count || 0);
};

const getJoinedMember = async (connection, roomId, userId, forUpdate = false) => {
  const sql = `
    SELECT *
    FROM discussion_room_members
    WHERE room_id = ? AND user_id = ?
    LIMIT 1
    ${forUpdate ? 'FOR UPDATE' : ''}
  `;
  const [rows] = await connection.execute(sql, [roomId, userId]);
  return rows[0] || null;
};

const getRoomPayload = async (connection, roomId, currentUserId = null) => {
  const [rooms] = await connection.execute(
    `SELECT r.*,
            g.title AS game_title,
            g.thumbnail_url AS game_thumbnail
     FROM discussion_rooms r
     JOIN games g ON g.game_id = r.game_id
     WHERE r.id = ?
     LIMIT 1`,
    [roomId]
  );

  if (!rooms.length) return null;

  const [members] = await connection.execute(
    `SELECT m.user_id, m.role, m.status, m.join_source, m.joined_at, m.left_at, u.username
     FROM discussion_room_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.room_id = ?
     ORDER BY m.joined_at ASC`,
    [roomId]
  );

  const joinedCount = members.filter((m) => m.status === 'joined').length;
  const amIMember = currentUserId
    ? members.some((m) => m.user_id === currentUserId && m.status === 'joined')
    : false;

  return {
    ...rooms[0],
    joined_count: joinedCount,
    am_i_member: amIMember,
    members
  };
};

const generateAiReply = async ({ prompt, gameTitle, roomMessages }) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return 'AI 机器人暂未配置 ARK_API_KEY，当前先由系统占位回复。请配置后启用真实 AI 对话。';
  }

  const contextText = roomMessages
    .map((msg) => `[${msg.sender_type}] ${msg.content}`)
    .join('\n')
    .slice(-4000);

  const payload = {
    model: process.env.ARK_MODEL_ID || DEFAULT_MODEL,
    max_completion_tokens: Number(process.env.ARK_MAX_TOKENS) || 1200,
    reasoning_effort: process.env.ARK_REASONING_LEVEL || 'medium',
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: '你是 DpccGaming 讨论房间内的 AI 制作顾问。请围绕当前游戏制作流程给出结构化、可执行的建议。'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `当前讨论游戏：${gameTitle}\n\n最近讨论内容：\n${contextText}\n\n用户新问题：\n${prompt}`
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

  if (Array.isArray(content)) {
    return content
      .filter((item) => item?.type === 'text' && item?.text)
      .map((item) => item.text.trim())
      .join('\n\n')
      .trim() || 'AI 未返回有效文本内容。';
  }

  return String(content).trim();
};

const getRoomNotificationContext = async (pool, roomId) => {
  const [rows] = await pool.execute(
    `SELECT r.id, r.title, r.game_id, g.title AS game_title
     FROM discussion_rooms r
     JOIN games g ON g.game_id = r.game_id
     WHERE r.id = ?
     LIMIT 1`,
    [roomId]
  );
  return rows[0] || null;
};

const notifyRoomMembers = async ({
  pool,
  roomId,
  excludeUserId,
  senderLabel,
  messageContent
}) => {
  const roomContext = await getRoomNotificationContext(pool, roomId);
  if (!roomContext) return;

  const [members] = await pool.execute(
    `SELECT user_id
     FROM discussion_room_members
     WHERE room_id = ? AND status = 'joined'`,
    [roomId]
  );

  const roomName = roomContext.title?.trim() || `${roomContext.game_title || '未命名游戏'} 讨论房`;
  const preview = String(messageContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const content = `[discussion-room:${roomId}] ${senderLabel} 在「${roomName}」发送了新消息：${preview || '（空消息）'}`;

  for (const member of members) {
    const memberUserId = Number(member.user_id);
    if (!memberUserId) continue;
    if (excludeUserId && memberUserId === excludeUserId) continue;

    await createNotification(
      memberUserId,
      'comment_reply',
      '讨论新消息',
      content,
      roomContext.game_id,
      null
    );
  }
};

const listPublicRoomsByGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const pool = getPool();
    const [rooms] = await pool.execute(
      `SELECT r.id, r.room_uuid, r.room_code, r.game_id, r.mode, r.visibility, r.status, r.max_members,
              r.title, r.host_user_id, r.created_at, g.title AS game_title,
              SUM(CASE WHEN m.status = 'joined' THEN 1 ELSE 0 END) AS joined_count
       FROM discussion_rooms r
       JOIN games g ON g.game_id = r.game_id
       LEFT JOIN discussion_room_members m ON m.room_id = r.id
       WHERE r.game_id = ? AND r.visibility = 'public' AND r.status IN ('waiting', 'active')
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [gameId]
    );

    res.json({ rooms });
  } catch (error) {
    console.error('获取公开房间列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const listMyRooms = async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();
    const [rooms] = await pool.execute(
      `SELECT r.id, r.room_uuid, r.room_code, r.game_id, r.mode, r.visibility, r.status, r.max_members,
              r.title, r.host_user_id, r.created_at, r.updated_at, g.title AS game_title, g.thumbnail_url AS game_thumbnail,
              (
                SELECT COUNT(*)
                FROM discussion_room_members rm
                WHERE rm.room_id = r.id AND rm.status = 'joined'
              ) AS joined_count,
              (
                SELECT m.content
                FROM discussion_messages m
                WHERE m.room_id = r.id
                ORDER BY m.id DESC
                LIMIT 1
              ) AS last_message_content,
              (
                SELECT m.created_at
                FROM discussion_messages m
                WHERE m.room_id = r.id
                ORDER BY m.id DESC
                LIMIT 1
              ) AS last_message_at
       FROM discussion_room_members me
       JOIN discussion_rooms r ON r.id = me.room_id
       JOIN games g ON g.game_id = r.game_id
       WHERE me.user_id = ?
         AND me.status = 'joined'
         AND r.status IN ('waiting', 'active')
       ORDER BY COALESCE(last_message_at, r.updated_at, r.created_at) DESC`,
      [userId]
    );

    res.json({ rooms });
  } catch (error) {
    console.error('获取我的房间列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const createRoom = async (req, res) => {
  const { gameId, mode = 'room', visibility = 'private', title = '' } = req.body || {};
  const userId = req.user.userId;
  const finalMode = ['friend', 'room', 'match'].includes(mode) ? mode : 'room';
  const finalVisibility = ['private', 'public'].includes(visibility) ? visibility : 'private';

  if (!gameId) {
    return res.status(400).json({ error: '缺少 gameId' });
  }

  const connection = await beginTransaction();
  try {
    const game = await getGameBasic(connection, gameId);
    if (!game) {
      await rollbackTransaction(connection);
      return res.status(404).json({ error: '游戏不存在' });
    }

    const roomUuid = crypto.randomUUID();
    const roomCode = await createUniqueRoomCode(connection);
    if (!roomCode) {
      await rollbackTransaction(connection);
      return res.status(500).json({ error: '生成房间邀请码失败，请重试' });
    }

    const [insertRoomResult] = await connection.execute(
      `INSERT INTO discussion_rooms
       (room_uuid, room_code, game_id, host_user_id, mode, visibility, status, max_members, title)
       VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?)`,
      [roomUuid, roomCode, gameId, userId, finalMode, finalVisibility, MAX_ROOM_MEMBERS, title || null]
    );

    const roomId = insertRoomResult.insertId;

    await connection.execute(
      `INSERT INTO discussion_room_members
       (room_id, user_id, role, join_source, status)
       VALUES (?, ?, 'host', 'manual', 'joined')`,
      [roomId, userId]
    );

    await commitTransaction(connection);

    const pool = getPool();
    const payload = await getRoomPayload(pool, roomId, userId);
    res.status(201).json({ room: payload });
  } catch (error) {
    await rollbackTransaction(connection);
    console.error('创建房间失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const getRoomDetail = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const pool = getPool();
    const room = await getRoomPayload(pool, roomId, req.user.userId);
    if (!room) return res.status(404).json({ error: '房间不存在' });

    res.json({ room });
  } catch (error) {
    console.error('获取房间详情失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const joinRoom = async (req, res) => {
  const roomId = toInt(req.params.roomId);
  const userId = req.user.userId;
  if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

  const connection = await beginTransaction();
  try {
    const room = await getRoomByIdForUpdate(connection, roomId);
    if (!room) {
      await rollbackTransaction(connection);
      return res.status(404).json({ error: '房间不存在' });
    }

    if (room.status === 'closed') {
      await rollbackTransaction(connection);
      return res.status(400).json({ error: '房间已关闭' });
    }

    const existing = await getJoinedMember(connection, roomId, userId, true);
    if (existing && existing.status === 'joined') {
      await commitTransaction(connection);
      const roomDetail = await getRoomPayload(getPool(), roomId, userId);
      return res.json({ room: roomDetail, message: '已在房间中' });
    }

    const joinedCount = await getJoinedMemberCount(connection, roomId);
    if (joinedCount >= room.max_members) {
      await rollbackTransaction(connection);
      return res.status(409).json({ error: '房间人数已满' });
    }

    if (!existing) {
      await connection.execute(
        `INSERT INTO discussion_room_members
         (room_id, user_id, role, join_source, status)
         VALUES (?, ?, 'member', 'manual', 'joined')`,
        [roomId, userId]
      );
    } else {
      await connection.execute(
        `UPDATE discussion_room_members
         SET status = 'joined', left_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [existing.id]
      );
    }

    if (room.status === 'waiting' && joinedCount + 1 >= 2) {
      await connection.execute(
        `UPDATE discussion_rooms
         SET status = 'active', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [roomId]
      );
    }

    await commitTransaction(connection);

    const roomDetail = await getRoomPayload(getPool(), roomId, userId);
    res.json({ room: roomDetail });
  } catch (error) {
    await rollbackTransaction(connection);
    console.error('加入房间失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const leaveRoom = async (req, res) => {
  const roomId = toInt(req.params.roomId);
  const userId = req.user.userId;
  if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

  const connection = await beginTransaction();
  try {
    const room = await getRoomByIdForUpdate(connection, roomId);
    if (!room) {
      await rollbackTransaction(connection);
      return res.status(404).json({ error: '房间不存在' });
    }

    const member = await getJoinedMember(connection, roomId, userId, true);
    if (!member || member.status !== 'joined') {
      await rollbackTransaction(connection);
      return res.status(400).json({ error: '你不在该房间中' });
    }

    await connection.execute(
      `UPDATE discussion_room_members
       SET status = 'left', left_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [member.id]
    );

    const [joinedMembers] = await connection.execute(
      `SELECT user_id, role, joined_at
       FROM discussion_room_members
       WHERE room_id = ? AND status = 'joined'
       ORDER BY joined_at ASC`,
      [roomId]
    );

    if (joinedMembers.length === 0) {
      await connection.execute(
        `UPDATE discussion_rooms
         SET status = 'closed', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [roomId]
      );
    } else {
      if (room.host_user_id === userId) {
        const newHost = joinedMembers[0];
        await connection.execute(
          `UPDATE discussion_rooms
           SET host_user_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newHost.user_id, roomId]
        );
        await connection.execute(
          `UPDATE discussion_room_members
           SET role = CASE WHEN user_id = ? THEN 'host' ELSE 'member' END,
               updated_at = CURRENT_TIMESTAMP
           WHERE room_id = ? AND status = 'joined'`,
          [newHost.user_id, roomId]
        );
      }

      const nextStatus = joinedMembers.length >= 2 ? 'active' : 'waiting';
      await connection.execute(
        `UPDATE discussion_rooms
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextStatus, roomId]
      );
    }

    await commitTransaction(connection);
    res.json({ message: '已退出房间' });
  } catch (error) {
    await rollbackTransaction(connection);
    console.error('退出房间失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const listRoomMessages = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const limit = Math.min(Math.max(toInt(req.query.limit) || 50, 1), 200);
    const beforeId = toInt(req.query.beforeId);
    const userId = req.user.userId;
    const pool = getPool();

    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可查看消息' });
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

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('获取房间消息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const sendRoomMessage = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    const content = (req.body?.content || '').toString().trim();
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!content) return res.status(400).json({ error: '消息内容不能为空' });

    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可发送消息' });
    }

    const [result] = await pool.execute(
      `INSERT INTO discussion_messages
       (room_id, sender_type, sender_user_id, message_type, content)
       VALUES (?, 'user', ?, 'text', ?)`,
      [roomId, userId, content]
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

    emitRoomMessage(roomId, rows[0]);
    res.status(201).json({ message: rows[0] });
  } catch (error) {
    console.error('发送房间消息失败:', error);
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
      `SELECT sender_type, content
       FROM discussion_messages
       WHERE room_id = ?
       ORDER BY id DESC
       LIMIT 20`,
      [roomId]
    );

    const aiText = await generateAiReply({
      prompt,
      gameTitle: roomRows[0].game_title,
      roomMessages: recentMessages.reverse()
    });

    const [insertResult] = await pool.execute(
      `INSERT INTO discussion_messages
       (room_id, sender_type, sender_user_id, message_type, content, metadata_json)
       VALUES (?, 'ai', NULL, 'text', ?, JSON_OBJECT('trigger_user_id', ?, 'game_id', ?))`,
      [roomId, aiText, userId, roomRows[0].game_id]
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

    emitRoomMessage(roomId, rows[0]);
    res.status(201).json({ message: rows[0] });
  } catch (error) {
    console.error('发送 AI 消息失败:', error);
    res.status(500).json({ error: error.message || 'AI 服务异常' });
  }
};

const enqueueMatch = async (req, res) => {
  const userId = req.user.userId;
  const gameId = (req.body?.gameId || '').toString().trim();
  const preference = req.body?.preference || null;
  if (!gameId) return res.status(400).json({ error: '缺少 gameId' });

  const connection = await beginTransaction();
  try {
    const game = await getGameBasic(connection, gameId);
    if (!game) {
      await rollbackTransaction(connection);
      return res.status(404).json({ error: '游戏不存在' });
    }

    await connection.execute(
      `INSERT INTO discussion_match_queue (user_id, game_id, preference_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         game_id = VALUES(game_id),
         preference_json = VALUES(preference_json),
         queued_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, gameId, preference ? JSON.stringify(preference) : null]
    );

    const [queuedRows] = await connection.execute(
      `SELECT user_id
       FROM discussion_match_queue
       WHERE game_id = ?
       ORDER BY queued_at ASC
       LIMIT 4
       FOR UPDATE`,
      [gameId]
    );

    if (queuedRows.length < 2) {
      await commitTransaction(connection);
      return res.json({ matched: false, queued_count: queuedRows.length });
    }

    const matchedUsers = queuedRows.map((row) => row.user_id);
    const roomUuid = crypto.randomUUID();
    const roomCode = await createUniqueRoomCode(connection);
    if (!roomCode) {
      await rollbackTransaction(connection);
      return res.status(500).json({ error: '匹配房间创建失败，请重试' });
    }

    const [roomResult] = await connection.execute(
      `INSERT INTO discussion_rooms
       (room_uuid, room_code, game_id, host_user_id, mode, visibility, status, max_members, title, started_at)
       VALUES (?, ?, ?, ?, 'match', 'private', 'active', ?, ?, CURRENT_TIMESTAMP)`,
      [roomUuid, roomCode, gameId, matchedUsers[0], MAX_ROOM_MEMBERS, `${game.title} 自动匹配房间`]
    );
    const roomId = roomResult.insertId;

    for (let i = 0; i < matchedUsers.length; i += 1) {
      await connection.execute(
        `INSERT INTO discussion_room_members
         (room_id, user_id, role, join_source, status)
         VALUES (?, ?, ?, 'match', 'joined')`,
        [roomId, matchedUsers[i], i === 0 ? 'host' : 'member']
      );
    }

    await connection.execute(
      `DELETE FROM discussion_match_queue
       WHERE user_id IN (${matchedUsers.map(() => '?').join(', ')})`,
      matchedUsers
    );

    await connection.execute(
      `INSERT INTO discussion_messages
       (room_id, sender_type, sender_user_id, message_type, content)
       VALUES (?, 'system', NULL, 'system', ?)`,
      [roomId, `匹配成功，已组建 ${matchedUsers.length} 人讨论房间。`]
    );

    await commitTransaction(connection);

    const payload = await getRoomPayload(getPool(), roomId, userId);
    res.json({ matched: true, room: payload });
  } catch (error) {
    await rollbackTransaction(connection);
    console.error('匹配入队失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const cancelMatchQueue = async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();
    const [result] = await pool.execute(
      'DELETE FROM discussion_match_queue WHERE user_id = ?',
      [userId]
    );
    res.json({ removed: result.affectedRows > 0 });
  } catch (error) {
    console.error('取消匹配队列失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const getMatchQueueStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT q.user_id, q.game_id, q.preference_json, q.queued_at, g.title AS game_title
       FROM discussion_match_queue q
       JOIN games g ON g.game_id = q.game_id
       WHERE q.user_id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) return res.json({ queued: false });
    res.json({ queued: true, queue: rows[0] });
  } catch (error) {
    console.error('获取匹配队列状态失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const sendFriendRequest = async (req, res) => {
  try {
    const requesterId = req.user.userId;
    const addresseeId = toInt(req.body?.targetUserId);
    if (!addresseeId) return res.status(400).json({ error: 'targetUserId 无效' });
    if (requesterId === addresseeId) return res.status(400).json({ error: '不能添加自己为好友' });

    const pool = getPool();
    const [targetUsers] = await pool.execute(
      `SELECT id, status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [addresseeId]
    );
    if (!targetUsers.length) return res.status(404).json({ error: '目标用户不存在' });
    if (targetUsers[0].status !== 'active') return res.status(400).json({ error: '目标用户不可添加' });

    const [existing] = await pool.execute(
      `SELECT id, requester_id, addressee_id, status
       FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?)
          OR (requester_id = ? AND addressee_id = ?)
       ORDER BY id DESC
       LIMIT 1`,
      [requesterId, addresseeId, addresseeId, requesterId]
    );

    if (existing.length) {
      const row = existing[0];
      if (row.status === 'accepted') return res.status(409).json({ error: '你们已经是好友' });
      if (row.status === 'blocked') return res.status(403).json({ error: '当前关系不可发起好友请求' });

      // 对方曾对我发起 pending，则直接互相接受
      if (row.status === 'pending' && row.requester_id === addresseeId && row.addressee_id === requesterId) {
        await pool.execute(
          `UPDATE friendships
           SET status = 'accepted', responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [row.id]
        );
        return res.json({ message: '已自动接受对方好友请求' });
      }

      return res.status(409).json({ error: '好友请求已存在，请勿重复发送' });
    }

    await pool.execute(
      `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES (?, ?, 'pending')`,
      [requesterId, addresseeId]
    );

    res.status(201).json({ message: '好友请求已发送' });
  } catch (error) {
    console.error('发送好友请求失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const getFriends = async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, f.updated_at AS friend_since
       FROM friendships f
       JOIN users u ON (
           (f.requester_id = ? AND f.addressee_id = u.id)
        OR (f.addressee_id = ? AND f.requester_id = u.id)
       )
       WHERE f.status = 'accepted'
       ORDER BY f.updated_at DESC`,
      [userId, userId]
    );
    res.json({ friends: rows });
  } catch (error) {
    console.error('获取好友列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();

    const [incoming] = await pool.execute(
      `SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at, u.username AS requester_name
       FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );

    const [outgoing] = await pool.execute(
      `SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at, u.username AS addressee_name
       FROM friendships f
       JOIN users u ON u.id = f.addressee_id
       WHERE f.requester_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json({ incoming, outgoing });
  } catch (error) {
    console.error('获取好友请求失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const respondFriendRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const requestId = toInt(req.params.requestId);
    const action = (req.body?.action || '').toString().trim();
    const map = {
      accept: 'accepted',
      accepted: 'accepted',
      reject: 'rejected',
      rejected: 'rejected',
      block: 'blocked',
      blocked: 'blocked'
    };
    const nextStatus = map[action];

    if (!requestId) return res.status(400).json({ error: 'requestId 无效' });
    if (!nextStatus) return res.status(400).json({ error: 'action 仅支持 accept/reject/block' });

    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, addressee_id, status
       FROM friendships
       WHERE id = ?
       LIMIT 1`,
      [requestId]
    );
    if (!rows.length) return res.status(404).json({ error: '好友请求不存在' });

    const row = rows[0];
    if (row.addressee_id !== userId) return res.status(403).json({ error: '无权限处理该请求' });
    if (row.status !== 'pending') return res.status(400).json({ error: '该请求已处理' });

    await pool.execute(
      `UPDATE friendships
       SET status = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextStatus, requestId]
    );

    res.json({ message: `好友请求已${nextStatus}` });
  } catch (error) {
    console.error('处理好友请求失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

module.exports = {
  listPublicRoomsByGame,
  listMyRooms,
  createRoom,
  getRoomDetail,
  joinRoom,
  leaveRoom,
  listRoomMessages,
  sendRoomMessage,
  sendAiRoomMessage,
  enqueueMatch,
  cancelMatchQueue,
  getMatchQueueStatus,
  sendFriendRequest,
  getFriends,
  getFriendRequests,
  respondFriendRequest
};
