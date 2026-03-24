const { Server } = require('socket.io');
const { getPool } = require('../config/database');
const { extractToken, verifyToken } = require('../middleware/auth');

let ioInstance = null;

const roomChannel = (roomId) => `discussion:room:${roomId}`;
const userChannel = (userId) => `user:${userId}`;

const parseRoomId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const isJoinedMember = async (roomId, userId) => {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id
     FROM discussion_room_members
     WHERE room_id = ? AND user_id = ? AND status = 'joined'
     LIMIT 1`,
    [roomId, userId]
  );
  return rows.length > 0;
};

const initDiscussionRealtime = ({ server, corsOrigins = [] }) => {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(server, {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  });

  ioInstance.use((socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;
      const queryToken = socket.handshake.query?.token;
      const normalizedAuthToken = typeof authToken === 'string'
        ? authToken.replace(/^Bearer\s+/i, '').trim()
        : '';
      const normalizedQueryToken = typeof queryToken === 'string'
        ? queryToken.replace(/^Bearer\s+/i, '').trim()
        : '';

      const tokenFromHeaders = extractToken({
        headers: {
          authorization: socket.handshake.headers?.authorization,
          cookie: socket.handshake.headers?.cookie
        }
      });

      const token = normalizedAuthToken || normalizedQueryToken || tokenFromHeaders;
      if (!token) return next(new Error('未提供认证令牌'));

      const payload = verifyToken(token);
      socket.data.user = payload;
      return next();
    } catch (error) {
      return next(new Error('无效的认证令牌'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const userId = parseRoomId(socket.data.user?.userId);
    if (userId) {
      socket.join(userChannel(userId));
    }

    socket.on('discussion:join', async (payload = {}, ack) => {
      const callback = typeof ack === 'function' ? ack : () => { };
      try {
        const roomId = parseRoomId(payload.roomId);
        const userId = socket.data.user?.userId;

        if (!roomId || !userId) {
          callback({ ok: false, error: '无效的 roomId' });
          return;
        }

        const canJoin = await isJoinedMember(roomId, userId);
        if (!canJoin) {
          callback({ ok: false, error: '仅房间成员可订阅实时消息' });
          return;
        }

        socket.join(roomChannel(roomId));
        callback({ ok: true, roomId });
      } catch (error) {
        callback({ ok: false, error: error.message || '加入实时房间失败' });
      }
    });

    socket.on('discussion:leave', (payload = {}, ack) => {
      const callback = typeof ack === 'function' ? ack : () => { };
      const roomId = parseRoomId(payload.roomId);
      if (!roomId) {
        callback({ ok: false, error: '无效的 roomId' });
        return;
      }
      socket.leave(roomChannel(roomId));
      callback({ ok: true, roomId });
    });
  });

  return ioInstance;
};

const emitUserNotificationEvent = (userId, payload = {}) => {
  if (!ioInstance) return;
  const nextUserId = parseRoomId(userId);
  if (!nextUserId) return;
  ioInstance.to(userChannel(nextUserId)).emit('notification:new', {
    userId: nextUserId,
    ...payload
  });
};

const emitRoomMessage = (roomId, message) => {
  if (!ioInstance) return;
  const nextRoomId = parseRoomId(roomId);
  if (!nextRoomId) return;
  ioInstance.to(roomChannel(nextRoomId)).emit('discussion:message', {
    roomId: nextRoomId,
    message
  });
};

const emitRoomDocumentsEvent = (roomId, payload = {}) => {
  if (!ioInstance) return;
  const nextRoomId = parseRoomId(roomId);
  if (!nextRoomId) return;
  ioInstance.to(roomChannel(nextRoomId)).emit('discussion:documents', {
    roomId: nextRoomId,
    ...payload
  });
};

const emitRoomTasksEvent = (roomId, payload = {}) => {
  if (!ioInstance) return;
  const nextRoomId = parseRoomId(roomId);
  if (!nextRoomId) return;
  ioInstance.to(roomChannel(nextRoomId)).emit('discussion:tasks', {
    roomId: nextRoomId,
    ...payload
  });
};

const emitRoomSettingsEvent = (roomId, payload = {}) => {
  if (!ioInstance) return;
  const nextRoomId = parseRoomId(roomId);
  if (!nextRoomId) return;
  ioInstance.to(roomChannel(nextRoomId)).emit('discussion:room-settings', {
    roomId: nextRoomId,
    ...payload
  });
};

const emitRoomSettingsEventToUser = (userId, roomId, payload = {}) => {
  if (!ioInstance) return;
  const nextUserId = parseRoomId(userId);
  const nextRoomId = parseRoomId(roomId);
  if (!nextUserId || !nextRoomId) return;
  ioInstance.to(userChannel(nextUserId)).emit('discussion:room-settings', {
    roomId: nextRoomId,
    ...payload
  });
};

const emitRoomHistoryClearedEventToUser = (userId, roomId, payload = {}) => {
  if (!ioInstance) return;
  const nextUserId = parseRoomId(userId);
  const nextRoomId = parseRoomId(roomId);
  if (!nextUserId || !nextRoomId) return;
  ioInstance.to(userChannel(nextUserId)).emit('discussion:room-history-cleared', {
    roomId: nextRoomId,
    ...payload
  });
};

const emitRoomMemoryEvent = (roomId, payload = {}) => {
  if (!ioInstance) return;
  const nextRoomId = parseRoomId(roomId);
  if (!nextRoomId) return;
  ioInstance.to(roomChannel(nextRoomId)).emit('discussion:room-memory', {
    roomId: nextRoomId,
    ...payload
  });
};

const emitRoomAiProgressEvent = (roomId, payload = {}) => {
  if (!ioInstance) return;
  const nextRoomId = parseRoomId(roomId);
  if (!nextRoomId) return;
  ioInstance.to(roomChannel(nextRoomId)).emit('discussion:ai-progress', {
    roomId: nextRoomId,
    ...payload
  });
};

const emitRoomRemovedEvent = (roomId, payload = {}) => {
  if (!ioInstance) return;
  const nextRoomId = parseRoomId(roomId);
  if (!nextRoomId) return;
  ioInstance.to(roomChannel(nextRoomId)).emit('discussion:room-removed', {
    roomId: nextRoomId,
    ...payload
  });
};

module.exports = {
  initDiscussionRealtime,
  emitRoomMessage,
  emitRoomDocumentsEvent,
  emitRoomTasksEvent,
  emitRoomSettingsEvent,
  emitRoomSettingsEventToUser,
  emitRoomHistoryClearedEventToUser,
  emitRoomMemoryEvent,
  emitRoomAiProgressEvent,
  emitRoomRemovedEvent,
  emitUserNotificationEvent,
  roomChannel
};
