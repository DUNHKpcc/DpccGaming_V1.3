const {
  getPool,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  toInt,
  getJoinedMember,
  getJoinedMemberCount,
  getRoomByIdForUpdate,
  getRoomPayload,
  getRuntimeRoomSettings,
  ensureRoomInviteLinksTable,
  generateRoomInviteCode,
  parseInviteCode,
  getDiscussionInviteLinkBase,
  createNotification
} = require('./shared');

const ROOM_INVITE_MIN_MINUTES = 15;
const ROOM_INVITE_MAX_MINUTES = 7 * 24 * 60;
const ROOM_INVITE_DEFAULT_MINUTES = 60;

const ensureGroupRoomMember = async (connection, roomId, userId, options = {}) => {
  const room = options.lockedRoom || await getRoomByIdForUpdate(connection, roomId);
  if (!room) {
    return { ok: false, status: 404, error: '房间不存在' };
  }
  if (room.mode !== 'room') {
    return { ok: false, status: 400, error: '当前功能仅支持多人群聊房间' };
  }

  const member = await getJoinedMember(connection, roomId, userId, true);
  if (!member || member.status !== 'joined') {
    return { ok: false, status: 403, error: '仅群成员可执行该操作' };
  }

  return { ok: true, room, member };
};

const canInviteIntoRoom = (room = {}, settings = {}, userId = null) => {
  if (settings?.invitePermission === 'all-members') return true;
  return Number(room?.host_user_id || 0) === Number(userId || 0);
};

const loadActiveUser = async (connection, userId) => {
  const [rows] = await connection.execute(
    `SELECT id, username, status
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );
  const user = rows[0] || null;
  if (!user || user.status !== 'active') return null;
  return user;
};

const areAcceptedFriends = async (connection, userId, targetUserId) => {
  const [rows] = await connection.execute(
    `SELECT id
     FROM friendships
     WHERE status = 'accepted'
       AND (
         (requester_id = ? AND addressee_id = ?)
         OR (requester_id = ? AND addressee_id = ?)
       )
     LIMIT 1`,
    [userId, targetUserId, targetUserId, userId]
  );
  return rows.length > 0;
};

const createRoomInviteLink = async (req, res) => {
  let connection = null;
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    const expiresInMinutes = Math.max(
      ROOM_INVITE_MIN_MINUTES,
      Math.min(ROOM_INVITE_MAX_MINUTES, Number(req.body?.expiresInMinutes || ROOM_INVITE_DEFAULT_MINUTES) || ROOM_INVITE_DEFAULT_MINUTES)
    );
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    connection = await beginTransaction();
    await ensureRoomInviteLinksTable(connection);
    const permission = await ensureGroupRoomMember(connection, roomId, userId);
    if (!permission.ok) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(permission.status).json({ error: permission.error });
    }
    if (permission.room.status === 'closed') {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(400).json({ error: '房间已关闭，无法继续生成邀请链接' });
    }

    const settings = await getRuntimeRoomSettings(connection, roomId);
    if (!canInviteIntoRoom(permission.room, settings, userId)) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(403).json({ error: '当前群聊仅允许群主邀请新成员' });
    }

    const linkCode = generateRoomInviteCode();
    const expiresAt = new Date(Date.now() + (expiresInMinutes * 60 * 1000));

    await connection.execute(
      `INSERT INTO discussion_room_invite_links
       (room_id, link_code, creator_user_id, expires_at, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [roomId, linkCode, userId, expiresAt]
    );

    await commitTransaction(connection);
    connection = null;

    const base = getDiscussionInviteLinkBase(req);
    const inviteLink = base
      ? `${base}/discussion/${roomId}?roomInvite=${encodeURIComponent(linkCode)}`
      : linkCode;

    return res.status(201).json({
      roomId,
      invite_code: linkCode,
      invite_link: inviteLink,
      expires_at: expiresAt.toISOString()
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('创建群聊邀请链接失败:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
};

const redeemRoomInviteLink = async (req, res) => {
  let connection = null;
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    const inviteCode = parseInviteCode(req.body?.code || req.query?.code || req.query?.roomInvite);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!inviteCode) return res.status(400).json({ error: '请提供有效的邀请码或邀请链接' });

    connection = await beginTransaction();
    await ensureRoomInviteLinksTable(connection);

    const room = await getRoomByIdForUpdate(connection, roomId);
    if (!room) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(404).json({ error: '房间不存在' });
    }
    if (room.mode !== 'room') {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(400).json({ error: '当前链接不对应多人群聊房间' });
    }
    if (room.status === 'closed') {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(400).json({ error: '房间已关闭' });
    }

    const [inviteRows] = await connection.execute(
      `SELECT id, status, expires_at
       FROM discussion_room_invite_links
       WHERE room_id = ? AND link_code = ?
       LIMIT 1
       FOR UPDATE`,
      [roomId, inviteCode]
    );
    const invite = inviteRows[0] || null;
    if (!invite) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(404).json({ error: '邀请链接不存在或已失效' });
    }

    const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
    const isExpired = !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now();
    if (invite.status !== 'active' || isExpired) {
      if (invite.status === 'active' && isExpired) {
        await connection.execute(
          `UPDATE discussion_room_invite_links
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [invite.id]
        );
      }
      await rollbackTransaction(connection);
      connection = null;
      return res.status(400).json({ error: '邀请链接已过期或不可用' });
    }

    const existingMember = await getJoinedMember(connection, roomId, userId, true);
    if (existingMember && existingMember.status === 'joined') {
      await commitTransaction(connection);
      connection = null;
      const roomPayload = await getRoomPayload(getPool(), roomId, userId);
      return res.json({ room: roomPayload, joined: false, message: '你已在该群聊中' });
    }

    const joinedCount = await getJoinedMemberCount(connection, roomId);
    if ((!existingMember || existingMember.status !== 'joined') && joinedCount >= Number(room.max_members || 0)) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(409).json({ error: '群聊人数已满' });
    }

    if (!existingMember) {
      await connection.execute(
        `INSERT INTO discussion_room_members
         (room_id, user_id, role, join_source, status)
         VALUES (?, ?, 'member', 'room_code', 'joined')`,
        [roomId, userId]
      );
    } else {
      await connection.execute(
        `UPDATE discussion_room_members
         SET role = 'member',
             join_source = 'room_code',
             status = 'joined',
             left_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [existingMember.id]
      );
    }

    if (room.status === 'waiting' && joinedCount + 1 >= 2) {
      await connection.execute(
        `UPDATE discussion_rooms
         SET status = 'active',
             started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [roomId]
      );
    }

    await commitTransaction(connection);
    connection = null;

    const roomPayload = await getRoomPayload(getPool(), roomId, userId);
    return res.json({ room: roomPayload, joined: true });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('通过群聊邀请链接加入房间失败:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
};

const inviteFriendToRoom = async (req, res) => {
  let connection = null;
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    const targetUserId = toInt(req.body?.userId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!targetUserId) return res.status(400).json({ error: '请提供有效的好友用户 ID' });
    if (targetUserId === userId) return res.status(400).json({ error: '不能邀请自己' });

    connection = await beginTransaction();
    const permission = await ensureGroupRoomMember(connection, roomId, userId);
    if (!permission.ok) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(permission.status).json({ error: permission.error });
    }
    if (permission.room.status === 'closed') {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(400).json({ error: '房间已关闭，无法继续邀请好友' });
    }

    const settings = await getRuntimeRoomSettings(connection, roomId);
    if (!canInviteIntoRoom(permission.room, settings, userId)) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(403).json({ error: '当前群聊仅允许群主邀请新成员' });
    }

    const targetUser = await loadActiveUser(connection, targetUserId);
    if (!targetUser) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(404).json({ error: '目标好友不存在或状态不可用' });
    }

    const accepted = await areAcceptedFriends(connection, userId, targetUserId);
    if (!accepted) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(403).json({ error: '仅可直接邀请已添加的好友' });
    }

    const existingMember = await getJoinedMember(connection, roomId, targetUserId, true);
    if (existingMember && existingMember.status === 'joined') {
      await commitTransaction(connection);
      connection = null;
      const roomPayload = await getRoomPayload(getPool(), roomId, userId);
      return res.json({ room: roomPayload, invited: false, message: '该好友已在群聊中' });
    }

    const joinedCount = await getJoinedMemberCount(connection, roomId);
    if ((!existingMember || existingMember.status !== 'joined') && joinedCount >= Number(permission.room.max_members || 0)) {
      await rollbackTransaction(connection);
      connection = null;
      return res.status(409).json({ error: '群聊人数已满，无法继续邀请' });
    }

    if (!existingMember) {
      await connection.execute(
        `INSERT INTO discussion_room_members
         (room_id, user_id, role, join_source, status)
         VALUES (?, ?, 'member', 'friend_invite', 'joined')`,
        [roomId, targetUserId]
      );
    } else {
      await connection.execute(
        `UPDATE discussion_room_members
         SET role = 'member',
             join_source = 'friend_invite',
             status = 'joined',
             left_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [existingMember.id]
      );
    }

    if (permission.room.status === 'waiting' && joinedCount + 1 >= 2) {
      await connection.execute(
        `UPDATE discussion_rooms
         SET status = 'active',
             started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [roomId]
      );
    }

    await commitTransaction(connection);
    connection = null;

    const roomPayload = await getRoomPayload(getPool(), roomId, userId);
    const roomName = String(permission.room.title || '').trim() || '未命名群聊';
    await createNotification(
      targetUserId,
      'comment_reply',
      '你被邀请加入群聊',
      `[discussion-room:${roomId}] 你已加入群聊「${roomName}」，现在可以开始协作讨论。`,
      permission.room.game_id,
      null
    );

    return res.json({ room: roomPayload, invited: true, invitedUserId: targetUserId });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('邀请好友进入群聊失败:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
};

module.exports = {
  createRoomInviteLink,
  redeemRoomInviteLink,
  inviteFriendToRoom
};
