const { getPool } = require('../config/database');

// 创建通知的辅助函数
async function createNotification(userId, type, title, content, relatedGameId = null, relatedCommentId = null) {
  try {
    const pool = getPool();
    await pool.execute(`
      INSERT INTO notifications (user_id, type, title, content, related_game_id, related_comment_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, type, title, content, relatedGameId, relatedCommentId]);
  } catch (error) {
    console.error('创建通知失败:', error);
  }
}

module.exports = {
  createNotification
};
