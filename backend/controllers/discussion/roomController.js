const crypto = require('crypto');
const {
  MAX_ROOM_MEMBERS,
  getPool,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  toInt,
  createUniqueRoomCode,
  getGameBasic,
  getRoomByIdForUpdate,
  getJoinedMemberCount,
  getJoinedMember,
  getRoomPayload,
  ensureRoomSettingsTable
} = require('./shared');

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
    await ensureRoomSettingsTable(pool);
    const [rooms] = await pool.execute(
      `SELECT r.id, r.room_uuid, r.room_code, r.game_id, r.mode, r.visibility, r.status, r.max_members,
              r.title, r.host_user_id, r.created_at, r.updated_at, g.title AS game_title, g.thumbnail_url AS game_thumbnail,
              rs.settings_json AS room_settings_json,
              rs.updated_by_user_id AS room_settings_updated_by_user_id,
              rs.updated_at AS room_settings_updated_at,
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
       LEFT JOIN discussion_room_settings rs ON rs.room_id = r.id
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

module.exports = {
  listPublicRoomsByGame,
  listMyRooms,
  createRoom,
  getRoomDetail,
  joinRoom,
  leaveRoom
};
