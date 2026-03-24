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
  ensureRoomSettingsTable,
  ensureRoomMemberPreferencesTable,
  createNotification
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
    await Promise.all([
      ensureRoomSettingsTable(pool),
      ensureRoomMemberPreferencesTable(pool)
    ]);
    const [rooms] = await pool.execute(
      `SELECT r.id, r.room_uuid, r.room_code, r.game_id, r.mode, r.visibility, r.status, r.max_members,
              r.title, r.host_user_id, r.created_at, r.updated_at, g.title AS game_title, g.thumbnail_url AS game_thumbnail,
              rs.settings_json AS room_settings_json,
              rs.updated_by_user_id AS room_settings_updated_by_user_id,
              rs.updated_at AS room_settings_updated_at,
              me.role AS self_role,
              mp.custom_nickname AS member_custom_nickname,
              mp.cleared_before_message_id AS cleared_before_message_id,
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
                  AND m.id > COALESCE(mp.cleared_before_message_id, 0)
                ORDER BY m.id DESC
                LIMIT 1
              ) AS last_message_content,
              (
                SELECT m.metadata_json
                FROM discussion_messages m
                WHERE m.room_id = r.id
                  AND m.id > COALESCE(mp.cleared_before_message_id, 0)
                ORDER BY m.id DESC
                LIMIT 1
              ) AS last_message_metadata_json,
              (
                SELECT m.sender_type
                FROM discussion_messages m
                WHERE m.room_id = r.id
                  AND m.id > COALESCE(mp.cleared_before_message_id, 0)
                ORDER BY m.id DESC
                LIMIT 1
              ) AS last_message_sender_type,
              (
                SELECT m.sender_user_id
                FROM discussion_messages m
                WHERE m.room_id = r.id
                  AND m.id > COALESCE(mp.cleared_before_message_id, 0)
                ORDER BY m.id DESC
                LIMIT 1
              ) AS last_message_sender_user_id,
              (
                SELECT m.created_at
                FROM discussion_messages m
                WHERE m.room_id = r.id
                  AND m.id > COALESCE(mp.cleared_before_message_id, 0)
                ORDER BY m.id DESC
                LIMIT 1
              ) AS last_message_at
       FROM discussion_room_members me
       JOIN discussion_rooms r ON r.id = me.room_id
       JOIN games g ON g.game_id = r.game_id
       LEFT JOIN discussion_room_settings rs ON rs.room_id = r.id
       LEFT JOIN discussion_room_member_preferences mp ON mp.room_id = r.id AND mp.user_id = me.user_id
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

const sanitizeMemberIds = (rawMemberIds = [], currentUserId = null) => {
  if (!Array.isArray(rawMemberIds)) return [];
  const uniqueIds = new Set();
  rawMemberIds.forEach((value) => {
    const parsed = toInt(value);
    if (!parsed || parsed === currentUserId) return;
    uniqueIds.add(parsed);
  });
  return [...uniqueIds].slice(0, Math.max(0, MAX_ROOM_MEMBERS - 1));
};

const resolveRoomGame = async (connection, requestedGameId, participantIds = []) => {
  if (requestedGameId) {
    return getGameBasic(connection, requestedGameId);
  }

  const validParticipants = [...new Set(
    participantIds
      .map((value) => toInt(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  )];

  if (validParticipants.length) {
    const placeholders = validParticipants.map(() => '?').join(', ');
    const [preferredGames] = await connection.execute(
      `SELECT game_id
       FROM games
       WHERE uploaded_by IN (${placeholders})
       ORDER BY (status = 'approved') DESC, uploaded_at DESC, created_at DESC
       LIMIT 1`,
      validParticipants
    );
    if (preferredGames[0]?.game_id) {
      return getGameBasic(connection, preferredGames[0].game_id);
    }
  }

  const [anyGames] = await connection.execute(
    `SELECT game_id
     FROM games
     ORDER BY (status = 'approved') DESC, uploaded_at DESC, created_at DESC
     LIMIT 1`
  );
  if (!anyGames[0]?.game_id) return null;
  return getGameBasic(connection, anyGames[0].game_id);
};

const loadAcceptedFriendUsers = async (connection, userId, memberIds = []) => {
  if (!memberIds.length) return [];
  const placeholders = memberIds.map(() => '?').join(', ');
  const [rows] = await connection.execute(
    `SELECT u.id, u.username, u.status
     FROM users u
     WHERE u.id IN (${placeholders})
       AND u.status = 'active'
       AND EXISTS (
         SELECT 1
         FROM friendships f
         WHERE f.status = 'accepted'
           AND (
             (f.requester_id = ? AND f.addressee_id = u.id)
             OR (f.requester_id = u.id AND f.addressee_id = ?)
           )
       )`,
    [...memberIds, userId, userId]
  );
  return rows;
};

const createRoom = async (req, res) => {
  const {
    gameId,
    mode = 'room',
    visibility = 'private',
    title = '',
    memberIds = [],
    maxMembers = MAX_ROOM_MEMBERS
  } = req.body || {};
  const userId = req.user.userId;
  const finalMode = ['friend', 'room', 'match'].includes(mode) ? mode : 'room';
  const finalVisibility = ['private', 'public'].includes(visibility) ? visibility : 'private';
  const invitedMemberIds = finalMode === 'room' ? sanitizeMemberIds(memberIds, userId) : [];

  const connection = await beginTransaction();
  try {
    const acceptedFriendUsers = invitedMemberIds.length
      ? await loadAcceptedFriendUsers(connection, userId, invitedMemberIds)
      : [];
    if (acceptedFriendUsers.length !== invitedMemberIds.length) {
      await rollbackTransaction(connection);
      return res.status(400).json({ error: '仅可邀请已添加的有效好友创建群聊' });
    }

    const participantIds = [userId, ...invitedMemberIds];
    const game = await resolveRoomGame(connection, gameId, participantIds);
    if (!game) {
      await rollbackTransaction(connection);
      return res.status(404).json({ error: gameId ? '游戏不存在' : '当前没有可用游戏，暂时无法创建群聊' });
    }

    const roomUuid = crypto.randomUUID();
    const roomCode = await createUniqueRoomCode(connection);
    if (!roomCode) {
      await rollbackTransaction(connection);
      return res.status(500).json({ error: '生成房间邀请码失败，请重试' });
    }

    const nextMaxMembers = Math.max(
      Math.min(Number(maxMembers || MAX_ROOM_MEMBERS) || MAX_ROOM_MEMBERS, MAX_ROOM_MEMBERS),
      Math.max(2, participantIds.length)
    );
    const roomStatus = participantIds.length >= 2 ? 'active' : 'waiting';
    const startedAtSql = participantIds.length >= 2 ? 'CURRENT_TIMESTAMP' : 'NULL';

    const [insertRoomResult] = await connection.execute(
      `INSERT INTO discussion_rooms
       (room_uuid, room_code, game_id, host_user_id, mode, visibility, status, max_members, title, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${startedAtSql})`,
      [roomUuid, roomCode, game.game_id, userId, finalMode, finalVisibility, roomStatus, nextMaxMembers, title || null]
    );

    const roomId = insertRoomResult.insertId;

    await connection.execute(
      `INSERT INTO discussion_room_members
       (room_id, user_id, role, join_source, status)
       VALUES (?, ?, 'host', 'manual', 'joined')`,
      [roomId, userId]
    );

    if (invitedMemberIds.length) {
      const placeholders = invitedMemberIds.map(() => '(?, ?, \'member\', \'friend_invite\', \'joined\')').join(', ');
      const values = invitedMemberIds.flatMap((memberId) => [roomId, memberId]);
      await connection.execute(
        `INSERT INTO discussion_room_members
         (room_id, user_id, role, join_source, status)
         VALUES ${placeholders}`,
        values
      );
    }

    await commitTransaction(connection);

    const pool = getPool();
    const payload = await getRoomPayload(pool, roomId, userId);
    if (acceptedFriendUsers.length) {
      const roomName = String(title || '').trim() || `${game.title || '协作房间'} 群聊`;
      await Promise.all(
        acceptedFriendUsers.map((friend) => createNotification(
          Number(friend.id),
          'comment_reply',
          '你被邀请加入群聊',
          `[discussion-room:${roomId}] 你已加入群聊「${roomName}」，现在可以开始协作讨论。`,
          game.game_id,
          null
        ))
      );
    }
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
    const member = await getJoinedMember(pool, roomId, req.user.userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可查看房间详情' });
    }
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

    if (room.mode === 'friend') {
      await rollbackTransaction(connection);
      return res.status(403).json({ error: '该私聊房间仅限已加入成员进入' });
    }

    if (room.visibility === 'private' && (!existing || existing.status !== 'joined')) {
      await rollbackTransaction(connection);
      return res.status(403).json({ error: '该房间为私密群聊，请通过有效邀请加入' });
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
