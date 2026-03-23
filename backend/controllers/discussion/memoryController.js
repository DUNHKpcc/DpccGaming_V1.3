const {
  getPool,
  toInt,
  getJoinedMember,
  getRoomSummary,
  listRoomMemoryEntries,
  refreshRoomMemoryArtifacts,
  emitRoomMemoryEvent
} = require('./shared');

const getRoomMemory = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可查看房间记忆' });
    }

    let summary = await getRoomSummary(pool, roomId);
    let memory = await listRoomMemoryEntries(pool, roomId);
    if (!summary || !memory.length) {
      const refreshed = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
      summary = refreshed.summary;
      memory = refreshed.memory;
    }

    res.json({ summary, memory });
  } catch (error) {
    console.error('获取房间记忆失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const refreshRoomMemory = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const userId = req.user.userId;
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可刷新房间记忆' });
    }

    const payload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
    emitRoomMemoryEvent(roomId, {
      summary: payload.summary,
      memory: payload.memory,
      updatedByUserId: userId
    });

    res.json(payload);
  } catch (error) {
    console.error('刷新房间记忆失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

module.exports = {
  getRoomMemory,
  refreshRoomMemory
};
