const crypto = require('crypto');
const {
  MAX_ROOM_MEMBERS,
  getPool,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  getGameBasic,
  createUniqueRoomCode,
  getRoomPayload
} = require('./shared');

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

module.exports = {
  enqueueMatch,
  cancelMatchQueue,
  getMatchQueueStatus
};
