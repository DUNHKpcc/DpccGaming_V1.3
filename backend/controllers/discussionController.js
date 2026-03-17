const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
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
const FRIEND_INVITE_MIN_MINUTES = 5;
const FRIEND_INVITE_MAX_MINUTES = 7 * 24 * 60;
const FRIEND_INVITE_DEFAULT_MINUTES = 60;
const UPLOADS_ROOT = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');

let friendInviteLinksTableReady = false;
let friendInviteLinksTableInitPromise = null;

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const sanitizeMessageMetadata = (rawMetadata) => {
  if (!rawMetadata || typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    return null;
  }

  const next = {};
  const rawCodePreview = rawMetadata.code_preview;
  if (rawCodePreview && typeof rawCodePreview === 'object' && !Array.isArray(rawCodePreview)) {
    const pathValue = String(rawCodePreview.path || '').trim().slice(0, 320);
    const snippetValue = String(rawCodePreview.snippet || '')
      .replace(/\r/g, '')
      .slice(0, 2200);

    if (pathValue && snippetValue) {
      const codePreview = {
        path: pathValue,
        snippet: snippetValue
      };

      const language = String(rawCodePreview.language || '').trim().slice(0, 40);
      if (language) codePreview.language = language;

      const totalLines = toInt(rawCodePreview.total_lines);
      if (totalLines && totalLines > 0) codePreview.total_lines = totalLines;

      next.code_preview = codePreview;
    }
  }

  return Object.keys(next).length ? next : null;
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

const removeUploadedFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
};

const ensureFriendInviteLinksTable = async (pool) => {
  if (friendInviteLinksTableReady) return;

  if (friendInviteLinksTableInitPromise) {
    await friendInviteLinksTableInitPromise;
    return;
  }

  friendInviteLinksTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS friend_invite_links (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      link_code VARCHAR(96) NOT NULL,
      creator_user_id INT NOT NULL,
      expires_at DATETIME NOT NULL,
      status ENUM('active', 'used', 'expired', 'revoked') NOT NULL DEFAULT 'active',
      used_by_user_id INT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_friend_invite_links_code (link_code),
      KEY idx_friend_invite_links_creator_status (creator_user_id, status),
      KEY idx_friend_invite_links_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await friendInviteLinksTableInitPromise;
    friendInviteLinksTableReady = true;
  } finally {
    friendInviteLinksTableInitPromise = null;
  }
};

const generateFriendInviteCode = () => crypto.randomBytes(16).toString('hex');

const parseInviteCode = (rawValue) => {
  const text = String(rawValue || '').trim();
  if (!text) return '';

  const validCode = (value) => {
    const cleaned = String(value || '').trim();
    return /^[A-Za-z0-9_-]{8,96}$/.test(cleaned) ? cleaned : '';
  };

  const directCode = validCode(text);
  if (directCode) return directCode;

  try {
    const url = new URL(text);
    return (
      validCode(url.searchParams.get('friendInvite'))
      || validCode(url.searchParams.get('invite'))
      || validCode(url.searchParams.get('code'))
      || ''
    );
  } catch {
    return '';
  }
};

const getFriendInviteLinkBase = (req) => {
  const fromEnv = String(process.env.APP_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;

  const fromOrigin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (fromOrigin) return fromOrigin;

  return '';
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
                SELECT rm.user_id
                FROM discussion_room_members rm
                WHERE rm.room_id = r.id
                  AND rm.status = 'joined'
                  AND rm.user_id <> ?
                ORDER BY rm.joined_at ASC
                LIMIT 1
              ) AS friend_user_id,
              (
                SELECT u.username
                FROM discussion_room_members rm
                JOIN users u ON u.id = rm.user_id
                WHERE rm.room_id = r.id
                  AND rm.status = 'joined'
                  AND rm.user_id <> ?
                ORDER BY rm.joined_at ASC
                LIMIT 1
              ) AS friend_username,
              (
                SELECT u.avatar_url
                FROM discussion_room_members rm
                JOIN users u ON u.id = rm.user_id
                WHERE rm.room_id = r.id
                  AND rm.status = 'joined'
                  AND rm.user_id <> ?
                ORDER BY rm.joined_at ASC
                LIMIT 1
              ) AS friend_avatar_url,
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
      [userId, userId, userId, userId]
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
    const rawContent = (req.body?.content || '').toString().trim();
    const metadata = sanitizeMessageMetadata(req.body?.metadata);
    const fallbackContent = metadata?.code_preview?.path
      ? `代码预览：${metadata.code_preview.path}`
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

    emitRoomMessage(roomId, rows[0]);
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

    const relativePath = path.relative(UPLOADS_ROOT, uploadedPath)
      .split(path.sep)
      .join('/');
    const fileUrl = relativePath && !relativePath.startsWith('..')
      ? `/uploads/${relativePath}`
      : `/uploads/discussion/${kind}/${req.file.filename}`;
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

    emitRoomMessage(roomId, rows[0]);
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

    const [requesterRows] = await pool.execute(
      `SELECT username
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [requesterId]
    );
    const requesterName = requesterRows[0]?.username || '有用户';

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

        await createNotification(
          addresseeId,
          'comment_reply',
          '好友申请已通过',
          `${requesterName} 已同意你的好友申请`,
          null,
          null
        );
        return res.json({ message: '已自动接受对方好友请求' });
      }

      return res.status(409).json({ error: '好友请求已存在，请勿重复发送' });
    }

    const [insertResult] = await pool.execute(
      `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES (?, ?, 'pending')`,
      [requesterId, addresseeId]
    );

    await createNotification(
      addresseeId,
      'comment_reply',
      '收到好友申请',
      `[friend-request:${insertResult.insertId}] ${requesterName} 想添加你为好友`,
      null,
      null
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
      `SELECT u.id, u.username, u.email, u.avatar_url, f.updated_at AS friend_since
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

const getOrCreateFriendDirectRoom = async (req, res) => {
  let connection = null;
  try {
    const userId = req.user.userId;
    const friendUserId = toInt(req.params.friendUserId);
    if (!friendUserId) return res.status(400).json({ error: 'friendUserId 无效' });
    if (friendUserId === userId) return res.status(400).json({ error: '不能与自己创建私聊' });

    const pool = getPool();
    const [friendRows] = await pool.execute(
      `SELECT id, username, status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [friendUserId]
    );
    if (!friendRows.length) return res.status(404).json({ error: '目标好友不存在' });
    if (friendRows[0].status !== 'active') return res.status(400).json({ error: '目标好友状态不可用' });

    const [friendshipRows] = await pool.execute(
      `SELECT id, status
       FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?)
          OR (requester_id = ? AND addressee_id = ?)
       ORDER BY id DESC
       LIMIT 1`,
      [userId, friendUserId, friendUserId, userId]
    );
    if (!friendshipRows.length || friendshipRows[0].status !== 'accepted') {
      return res.status(403).json({ error: '仅可与已添加好友开启私聊协作' });
    }

    const [existingRooms] = await pool.execute(
      `SELECT r.id
       FROM discussion_rooms r
       JOIN discussion_room_members me
         ON me.room_id = r.id
        AND me.user_id = ?
        AND me.status = 'joined'
       JOIN discussion_room_members peer
         ON peer.room_id = r.id
        AND peer.user_id = ?
        AND peer.status = 'joined'
       WHERE r.mode = 'friend'
         AND r.status IN ('waiting', 'active')
         AND (
           SELECT COUNT(*)
           FROM discussion_room_members rm
           WHERE rm.room_id = r.id AND rm.status = 'joined'
         ) = 2
       ORDER BY COALESCE(r.updated_at, r.created_at) DESC
       LIMIT 1`,
      [userId, friendUserId]
    );

    if (existingRooms.length) {
      const roomId = Number(existingRooms[0].id);
      const room = await getRoomPayload(pool, roomId, userId);
      if (room) {
        return res.json({ room, created: false });
      }
    }

    const [preferredGames] = await pool.execute(
      `SELECT game_id
       FROM games
       WHERE uploaded_by IN (?, ?)
       ORDER BY (status = 'approved') DESC, uploaded_at DESC, created_at DESC
       LIMIT 1`,
      [userId, friendUserId]
    );
    let fallbackGameId = preferredGames[0]?.game_id || null;

    if (!fallbackGameId) {
      const [anyGames] = await pool.execute(
        `SELECT game_id
         FROM games
         ORDER BY (status = 'approved') DESC, uploaded_at DESC, created_at DESC
         LIMIT 1`
      );
      fallbackGameId = anyGames[0]?.game_id || null;
    }

    if (!fallbackGameId) {
      return res.status(400).json({ error: '当前没有可用游戏，暂时无法创建协作房间' });
    }

    connection = await beginTransaction();

    const roomCode = await createUniqueRoomCode(connection);
    if (!roomCode) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(500).json({ error: '生成房间邀请码失败，请重试' });
    }

    const roomTitle = `${friendRows[0].username || '好友'} · 好友协作`;
    const [insertRoomResult] = await connection.execute(
      `INSERT INTO discussion_rooms
       (room_uuid, room_code, game_id, host_user_id, mode, visibility, status, max_members, title, started_at)
       VALUES (?, ?, ?, ?, 'friend', 'private', 'active', 2, ?, CURRENT_TIMESTAMP)`,
      [crypto.randomUUID(), roomCode, fallbackGameId, userId, roomTitle]
    );
    const roomId = Number(insertRoomResult.insertId);

    await connection.execute(
      `INSERT INTO discussion_room_members
       (room_id, user_id, role, join_source, status)
       VALUES (?, ?, 'host', 'manual', 'joined')`,
      [roomId, userId]
    );

    await connection.execute(
      `INSERT INTO discussion_room_members
       (room_id, user_id, role, join_source, status)
       VALUES (?, ?, 'member', 'friend_invite', 'joined')`,
      [roomId, friendUserId]
    );

    await connection.execute(
      `INSERT INTO discussion_messages
       (room_id, sender_type, sender_user_id, message_type, content, metadata_json)
       VALUES (?, 'system', NULL, 'text', ?, JSON_OBJECT('type', 'friend_direct_room'))`,
      [roomId, '好友协作房间已创建，开始你们的讨论吧。']
    );

    await commitTransaction(connection);
    connection = null;

    const room = await getRoomPayload(pool, roomId, userId);
    res.status(201).json({ room, created: true });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('获取或创建好友私聊房间失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();

    const [incoming] = await pool.execute(
      `SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
              u.username AS requester_name, u.avatar_url AS requester_avatar_url
       FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );

    const [outgoing] = await pool.execute(
      `SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
              u.username AS addressee_name, u.avatar_url AS addressee_avatar_url
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
      `SELECT id, requester_id, addressee_id, status
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

    const requesterId = Number(row.requester_id);
    if (requesterId > 0) {
      const [operatorRows] = await pool.execute(
        `SELECT username
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId]
      );
      const operatorName = operatorRows[0]?.username || '对方';
      const titleMap = {
        accepted: '好友申请已通过',
        rejected: '好友申请被拒绝',
        blocked: '好友申请被屏蔽'
      };
      const textMap = {
        accepted: `${operatorName} 已同意你的好友申请`,
        rejected: `${operatorName} 拒绝了你的好友申请`,
        blocked: `${operatorName} 屏蔽了你的好友申请`
      };
      await createNotification(
        requesterId,
        'comment_reply',
        titleMap[nextStatus] || '好友申请状态更新',
        textMap[nextStatus] || `${operatorName} 更新了好友申请状态`,
        null,
        null
      );
    }

    res.json({ message: `好友请求已${nextStatus}` });
  } catch (error) {
    console.error('处理好友请求失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const searchUsersForFriend = async (req, res) => {
  try {
    const userId = req.user.userId;
    const keyword = String(req.query?.q || '').trim();
    if (!keyword) return res.json({ users: [] });

    const pool = getPool();
    const escapedKeyword = keyword.replace(/[\\%_]/g, '\\$&');
    const likeValue = `%${escapedKeyword}%`;

    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.avatar_url,
              outgoing.id AS outgoing_request_id, outgoing.status AS outgoing_status,
              incoming.id AS incoming_request_id, incoming.status AS incoming_status
       FROM users u
       LEFT JOIN friendships outgoing
         ON outgoing.requester_id = ? AND outgoing.addressee_id = u.id
       LEFT JOIN friendships incoming
         ON incoming.requester_id = u.id AND incoming.addressee_id = ?
       WHERE u.status = 'active'
         AND u.id <> ?
         AND u.username LIKE ? ESCAPE '\\\\'
       ORDER BY u.username ASC
       LIMIT 20`,
      [userId, userId, userId, likeValue]
    );

    const users = rows.map((row) => {
      const outgoingStatus = row.outgoing_status || null;
      const incomingStatus = row.incoming_status || null;

      let friendStatus = 'none';
      if (outgoingStatus === 'accepted' || incomingStatus === 'accepted') {
        friendStatus = 'accepted';
      } else if (outgoingStatus === 'pending') {
        friendStatus = 'outgoing_pending';
      } else if (incomingStatus === 'pending') {
        friendStatus = 'incoming_pending';
      } else if (outgoingStatus === 'blocked' || incomingStatus === 'blocked') {
        friendStatus = 'blocked';
      }

      return {
        id: row.id,
        username: row.username,
        email: row.email,
        avatar_url: row.avatar_url,
        friend_status: friendStatus,
        incoming_request_id: row.incoming_request_id,
        outgoing_request_id: row.outgoing_request_id
      };
    });

    res.json({ users });
  } catch (error) {
    console.error('搜索用户失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const createFriendInviteLink = async (req, res) => {
  try {
    const userId = req.user.userId;
    const rawMinutes = toInt(req.body?.expiresInMinutes);
    const expiresInMinutes = Math.min(
      Math.max(rawMinutes || FRIEND_INVITE_DEFAULT_MINUTES, FRIEND_INVITE_MIN_MINUTES),
      FRIEND_INVITE_MAX_MINUTES
    );

    const pool = getPool();
    await ensureFriendInviteLinksTable(pool);

    const expiresAt = new Date(Date.now() + (expiresInMinutes * 60 * 1000));
    let linkCode = '';

    for (let i = 0; i < 8; i += 1) {
      const candidate = generateFriendInviteCode();
      const [exists] = await pool.execute(
        `SELECT id
         FROM friend_invite_links
         WHERE link_code = ?
         LIMIT 1`,
        [candidate]
      );
      if (!exists.length) {
        linkCode = candidate;
        break;
      }
    }

    if (!linkCode) {
      return res.status(500).json({ error: '生成邀请链接失败，请重试' });
    }

    await pool.execute(
      `INSERT INTO friend_invite_links (link_code, creator_user_id, expires_at, status)
       VALUES (?, ?, ?, 'active')`,
      [linkCode, userId, expiresAt]
    );

    const base = getFriendInviteLinkBase(req);
    const inviteLink = base
      ? `${base}/account?friendInvite=${encodeURIComponent(linkCode)}`
      : linkCode;

    res.status(201).json({
      invite_code: linkCode,
      invite_link: inviteLink,
      expires_at: expiresAt.toISOString(),
      expires_in_minutes: expiresInMinutes
    });
  } catch (error) {
    console.error('创建好友邀请链接失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const redeemFriendInviteLink = async (req, res) => {
  const userId = req.user.userId;
  const inviteCode = parseInviteCode(req.body?.code);
  if (!inviteCode) {
    return res.status(400).json({ error: '邀请码无效' });
  }

  let connection = null;
  try {
    const pool = getPool();
    await ensureFriendInviteLinksTable(pool);
    connection = await beginTransaction();

    const [inviteRows] = await connection.execute(
      `SELECT id, link_code, creator_user_id, expires_at, status
       FROM friend_invite_links
       WHERE link_code = ?
       LIMIT 1
       FOR UPDATE`,
      [inviteCode]
    );

    if (!inviteRows.length) {
      await rollbackTransaction(connection);
      return res.status(404).json({ error: '邀请链接不存在' });
    }

    const invite = inviteRows[0];
    const creatorUserId = Number(invite.creator_user_id);
    if (creatorUserId === userId) {
      await rollbackTransaction(connection);
      return res.status(400).json({ error: '不能使用自己的邀请链接' });
    }

    const now = new Date();
    const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
    const isExpired = !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime();

    if (invite.status !== 'active' || isExpired) {
      if (invite.status === 'active' && isExpired) {
        await connection.execute(
          `UPDATE friend_invite_links
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [invite.id]
        );
      }
      await rollbackTransaction(connection);
      return res.status(400).json({ error: '邀请链接已失效' });
    }

    const [existing] = await connection.execute(
      `SELECT id, requester_id, addressee_id, status
       FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?)
          OR (requester_id = ? AND addressee_id = ?)
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [creatorUserId, userId, userId, creatorUserId]
    );

    if (existing.length) {
      const relation = existing[0];
      if (relation.status === 'accepted') {
        await rollbackTransaction(connection);
        return res.status(409).json({ error: '你们已经是好友' });
      }
      if (relation.status === 'blocked') {
        await rollbackTransaction(connection);
        return res.status(403).json({ error: '当前关系不可通过邀请链接建立好友' });
      }

      await connection.execute(
        `UPDATE friendships
         SET status = 'accepted', responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [relation.id]
      );
    } else {
      await connection.execute(
        `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
         VALUES (?, ?, 'accepted', CURRENT_TIMESTAMP)`,
        [creatorUserId, userId]
      );
    }

    await connection.execute(
      `UPDATE friend_invite_links
       SET status = 'used',
           used_by_user_id = ?,
           used_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId, invite.id]
    );

    await commitTransaction(connection);
    connection = null;

    const [redeemerRows] = await pool.execute(
      `SELECT username
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );
    const redeemerName = redeemerRows[0]?.username || '有用户';

    await createNotification(
      creatorUserId,
      'comment_reply',
      '邀请链接已使用',
      `${redeemerName} 通过你的邀请链接成为了好友`,
      null,
      null
    );

    res.json({ message: '已通过邀请链接添加好友' });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('兑换好友邀请链接失败:', error);
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
  uploadRoomAttachment,
  sendAiRoomMessage,
  enqueueMatch,
  cancelMatchQueue,
  getMatchQueueStatus,
  sendFriendRequest,
  getFriends,
  getOrCreateFriendDirectRoom,
  getFriendRequests,
  respondFriendRequest,
  searchUsersForFriend,
  createFriendInviteLink,
  redeemFriendInviteLink
};
