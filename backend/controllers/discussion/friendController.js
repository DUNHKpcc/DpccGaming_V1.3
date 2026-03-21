const crypto = require('crypto');
const {
  getPool,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  createNotification,
  toInt,
  ensureFriendInviteLinksTable,
  generateFriendInviteCode,
  parseInviteCode,
  getFriendInviteLinkBase,
  createUniqueRoomCode,
  getRoomPayload,
  FRIEND_INVITE_MIN_MINUTES,
  FRIEND_INVITE_MAX_MINUTES,
  FRIEND_INVITE_DEFAULT_MINUTES
} = require('./shared');

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
  sendFriendRequest,
  getFriends,
  getOrCreateFriendDirectRoom,
  getFriendRequests,
  respondFriendRequest,
  searchUsersForFriend,
  createFriendInviteLink,
  redeemFriendInviteLink
};
