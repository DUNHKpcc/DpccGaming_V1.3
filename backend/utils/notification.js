const { getPool } = require('../config/database');
const { emitUserNotificationEvent } = require('./discussionRealtime');

// 创建通知的辅助函数
async function createNotification(userId, type, title, content, relatedGameId = null, relatedCommentId = null) {
  try {
    const pool = getPool();
    const [result] = await pool.execute(`
      INSERT INTO notifications (user_id, type, title, content, related_game_id, related_comment_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, type, title, content, relatedGameId, relatedCommentId]);

    const [rows] = await pool.execute(`
      SELECT *
      FROM notifications
      WHERE id = ?
      LIMIT 1
    `, [result.insertId]);

    if (rows[0]) {
      emitUserNotificationEvent(userId, {
        notification: rows[0]
      });
    }
  } catch (error) {
    console.error('创建通知失败:', error);
  }
}

module.exports = {
  createNotification
};
