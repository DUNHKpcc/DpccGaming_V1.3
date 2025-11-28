const { getPool } = require('../config/database');

// 获取用户通知列表
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // 获取数据库连接池
    const pool = getPool();

    const [notifications] = await pool.execute(`
      SELECT n.*, g.title as game_title
      FROM notifications n
      LEFT JOIN games g ON n.related_game_id = g.game_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.userId, parseInt(limit), parseInt(offset)]);

    // 获取总数
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM notifications WHERE user_id = ?
    `, [req.user.userId]);

    const total = countResult[0].total;
    const hasMore = offset + notifications.length < total;

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore
      }
    });
  } catch (error) {
    console.error('获取通知列表错误:', error);
    res.status(500).json({ error: '获取通知列表失败' });
  }
};

// 标记通知为已读
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    // 获取数据库连接池
    const pool = getPool();

    await pool.execute(`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.userId]);

    res.json({ message: '通知已标记为已读' });
  } catch (error) {
    console.error('标记通知已读错误:', error);
    res.status(500).json({ error: '标记通知已读失败' });
  }
};

// 全部标记为已读
const markAllNotificationsAsRead = async (req, res) => {
  try {
    // 获取数据库连接池
    const pool = getPool();

    await pool.execute(`
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = ? AND is_read = false
    `, [req.user.userId]);

    res.json({ message: '所有通知已标记为已读' });
  } catch (error) {
    console.error('全部标记已读错误:', error);
    res.status(500).json({ error: '全部标记已读失败' });
  }
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};