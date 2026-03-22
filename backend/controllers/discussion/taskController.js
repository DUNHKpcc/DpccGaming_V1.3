const {
  getPool,
  toInt,
  getJoinedMember,
  ensureRoomTasksTable,
  mapRoomTaskRow,
  normalizeOptionalTaskText,
  parseTaskPriority,
  parseTaskStatus,
  emitRoomTasksEvent
} = require('./shared');

const listRoomTasks = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const userId = req.user.userId;
    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可查看任务' });
    }

    await ensureRoomTasksTable(pool);
    const [rows] = await pool.execute(
      `SELECT t.id, t.room_id, t.creator_user_id, t.title, t.description, t.status, t.priority,
              t.deadline_label, t.completed_at, t.created_at, t.updated_at,
              u.username AS creator_name
       FROM discussion_room_tasks t
       LEFT JOIN users u ON u.id = t.creator_user_id
       WHERE t.room_id = ?
       ORDER BY
         CASE t.status
           WHEN 'in_progress' THEN 1
           WHEN 'pending' THEN 2
           ELSE 3
         END ASC,
         CASE t.priority
           WHEN 'urgent' THEN 1
           ELSE 2
         END ASC,
         COALESCE(t.completed_at, t.updated_at, t.created_at) DESC,
         t.id DESC`,
      [roomId]
    );

    res.json({ tasks: rows.map(mapRoomTaskRow) });
  } catch (error) {
    console.error('获取房间任务失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const createRoomTask = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const userId = req.user.userId;
    const title = String(req.body?.title || '').trim().slice(0, 160);
    const description = normalizeOptionalTaskText(req.body?.description, 4000);
    const deadlineLabel = normalizeOptionalTaskText(req.body?.deadlineLabel || req.body?.deadline_label, 120);
    const status = parseTaskStatus(req.body?.status);
    const priority = parseTaskPriority(req.body?.priority);

    if (!title) return res.status(400).json({ error: '任务标题不能为空' });

    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可创建任务' });
    }

    await ensureRoomTasksTable(pool);
    const completedAt = status === 'completed' ? new Date() : null;

    const [insertResult] = await pool.execute(
      `INSERT INTO discussion_room_tasks
       (room_id, creator_user_id, title, description, status, priority, deadline_label, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [roomId, userId, title, description, status, priority, deadlineLabel, completedAt]
    );

    const [rows] = await pool.execute(
      `SELECT t.id, t.room_id, t.creator_user_id, t.title, t.description, t.status, t.priority,
              t.deadline_label, t.completed_at, t.created_at, t.updated_at,
              u.username AS creator_name
       FROM discussion_room_tasks t
       LEFT JOIN users u ON u.id = t.creator_user_id
       WHERE t.id = ?
       LIMIT 1`,
      [insertResult.insertId]
    );

    const task = rows[0] ? mapRoomTaskRow(rows[0]) : null;
    if (task) {
      emitRoomTasksEvent(roomId, {
        action: 'created',
        task,
        updatedByUserId: userId
      });
    }

    res.status(201).json({ task });
  } catch (error) {
    console.error('创建房间任务失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const updateRoomTask = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const taskId = toInt(req.params.taskId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!taskId) return res.status(400).json({ error: '无效的 taskId' });

    const userId = req.user.userId;
    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可更新任务' });
    }

    await ensureRoomTasksTable(pool);

    const [existingRows] = await pool.execute(
      `SELECT id, room_id, creator_user_id, title, description, status, priority, deadline_label, completed_at
       FROM discussion_room_tasks
       WHERE id = ? AND room_id = ?
       LIMIT 1`,
      [taskId, roomId]
    );
    if (!existingRows.length) return res.status(404).json({ error: '任务不存在' });

    const existing = existingRows[0];
    const nextTitle = Object.prototype.hasOwnProperty.call(req.body || {}, 'title')
      ? String(req.body?.title || '').trim().slice(0, 160)
      : String(existing.title || '').trim();
    if (!nextTitle) return res.status(400).json({ error: '任务标题不能为空' });

    const nextDescription = Object.prototype.hasOwnProperty.call(req.body || {}, 'description')
      ? normalizeOptionalTaskText(req.body?.description, 4000)
      : existing.description;
    const nextDeadlineLabel = Object.prototype.hasOwnProperty.call(req.body || {}, 'deadlineLabel')
      || Object.prototype.hasOwnProperty.call(req.body || {}, 'deadline_label')
      ? normalizeOptionalTaskText(req.body?.deadlineLabel || req.body?.deadline_label, 120)
      : existing.deadline_label;
    const nextStatus = Object.prototype.hasOwnProperty.call(req.body || {}, 'status')
      ? parseTaskStatus(req.body?.status)
      : parseTaskStatus(existing.status);
    const nextPriority = Object.prototype.hasOwnProperty.call(req.body || {}, 'priority')
      ? parseTaskPriority(req.body?.priority)
      : parseTaskPriority(existing.priority);
    const nextCompletedAt = nextStatus === 'completed'
      ? (existing.completed_at || new Date())
      : null;

    await pool.execute(
      `UPDATE discussion_room_tasks
       SET title = ?, description = ?, status = ?, priority = ?, deadline_label = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND room_id = ?`,
      [nextTitle, nextDescription, nextStatus, nextPriority, nextDeadlineLabel, nextCompletedAt, taskId, roomId]
    );

    const [rows] = await pool.execute(
      `SELECT t.id, t.room_id, t.creator_user_id, t.title, t.description, t.status, t.priority,
              t.deadline_label, t.completed_at, t.created_at, t.updated_at,
              u.username AS creator_name
       FROM discussion_room_tasks t
       LEFT JOIN users u ON u.id = t.creator_user_id
       WHERE t.id = ?
       LIMIT 1`,
      [taskId]
    );

    const task = rows[0] ? mapRoomTaskRow(rows[0]) : null;
    if (task) {
      emitRoomTasksEvent(roomId, {
        action: 'updated',
        task,
        updatedByUserId: userId
      });
    }

    res.json({ task });
  } catch (error) {
    console.error('更新房间任务失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const deleteRoomTask = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const taskId = toInt(req.params.taskId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!taskId) return res.status(400).json({ error: '无效的 taskId' });

    const userId = req.user.userId;
    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可删除任务' });
    }

    await ensureRoomTasksTable(pool);
    const [result] = await pool.execute(
      `DELETE FROM discussion_room_tasks
       WHERE id = ? AND room_id = ?`,
      [taskId, roomId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: '任务不存在' });
    }

    emitRoomTasksEvent(roomId, {
      action: 'deleted',
      taskId,
      updatedByUserId: userId
    });

    res.json({ removed: true });
  } catch (error) {
    console.error('删除房间任务失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

module.exports = {
  listRoomTasks,
  createRoomTask,
  updateRoomTask,
  deleteRoomTask
};
