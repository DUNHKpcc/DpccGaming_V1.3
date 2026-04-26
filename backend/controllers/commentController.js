const { getPool } = require('../config/database');
const { createNotification } = require('../utils/notification');
const { normalizeCommentTargetId } = require('../utils/commentTarget');

const DEFAULT_AVATAR_URL = '/avatars/default-avatar.svg';
let avatarColumnAvailableCache = null;

const normalizeGameRating = (rating) => {
  const normalizedRating = Number(rating);
  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    return null;
  }
  return normalizedRating;
};

const normalizeOptionalUserId = (userId) => {
  if (userId === null || userId === undefined || String(userId).trim() === '') {
    return null;
  }

  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return null;
  }

  return normalizedUserId;
};

const isAvatarColumnAvailable = async (pool) => {
  if (avatarColumnAvailableCache !== null) {
    return avatarColumnAvailableCache;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'avatar_url'`
    );
    avatarColumnAvailableCache = Number(rows?.[0]?.count || 0) > 0;
  } catch (error) {
    console.warn('检查 comments 头像字段失败，回退为无头像模式:', error.message);
    avatarColumnAvailableCache = false;
  }

  return avatarColumnAvailableCache;
};

const ensureDocCommentsTable = async (pool) => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS doc_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      doc_id VARCHAR(120) NOT NULL,
      rating INT NULL,
      comment_text TEXT NOT NULL,
      parent_id INT NULL,
      reply_to_user_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES doc_comments(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_doc_comments_doc_id (doc_id),
      INDEX idx_doc_comments_user_id (user_id),
      INDEX idx_doc_comments_parent_id (parent_id),
      INDEX idx_doc_comments_reply_to_user_id (reply_to_user_id)
    )
  `);
};

// 获取游戏评论（包含回复）
const getGameComments = async (req, res) => {
  try {
    const { gameId } = req.params;

    // 获取数据库连接池
    const pool = getPool();
    const hasAvatarColumn = await isAvatarColumnAvailable(pool);

    // 获取主评论
    const [comments] = await pool.execute(
      hasAvatarColumn
        ? `SELECT c.*, u.username, COALESCE(u.avatar_url, ?) AS avatar_url
           FROM comments c
           JOIN users u ON c.user_id = u.id
           WHERE c.game_id = ? AND c.parent_id IS NULL
           ORDER BY c.created_at DESC`
        : `SELECT c.*, u.username
           FROM comments c
           JOIN users u ON c.user_id = u.id
           WHERE c.game_id = ? AND c.parent_id IS NULL
           ORDER BY c.created_at DESC`,
      hasAvatarColumn ? [DEFAULT_AVATAR_URL, gameId] : [gameId]
    );

    // 为每个主评论获取回复
    for (let comment of comments) {
      const [replies] = await pool.execute(
        hasAvatarColumn
          ? `SELECT c.*, u.username, COALESCE(u.avatar_url, ?) AS avatar_url,
                    ru.username AS reply_to_username,
                    COALESCE(ru.avatar_url, ?) AS reply_to_avatar_url
             FROM comments c
             JOIN users u ON c.user_id = u.id
             LEFT JOIN users ru ON c.reply_to_user_id = ru.id
             WHERE c.parent_id = ?
             ORDER BY c.created_at ASC`
          : `SELECT c.*, u.username, ru.username as reply_to_username
             FROM comments c
             JOIN users u ON c.user_id = u.id
             LEFT JOIN users ru ON c.reply_to_user_id = ru.id
             WHERE c.parent_id = ?
             ORDER BY c.created_at ASC`,
        hasAvatarColumn
          ? [DEFAULT_AVATAR_URL, DEFAULT_AVATAR_URL, comment.id]
          : [comment.id]
      );

      comment.replies = replies;
    }

    res.json(comments);
  } catch (error) {
    console.error('获取评论错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 提交评论
const submitComment = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { rating, commentText } = req.body;
    const userId = req.user.userId;

    // 验证输入
    const normalizedRating = normalizeGameRating(rating);
    if (normalizedRating === null) {
      return res.status(400).json({ error: '评分必须在1-5之间' });
    }

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    // 获取数据库连接池
    const pool = getPool();

    // 检查游戏是否存在
    const [games] = await pool.execute(
      'SELECT id FROM games WHERE game_id = ?',
      [gameId]
    );

    if (games.length === 0) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    // 验证用户是否存在
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      console.error('用户不存在:', userId);
      return res.status(400).json({ error: '用户不存在' });
    }

    console.log('用户验证成功:', userId);

    // 总是创建新评论，允许用户对同一游戏发表多条评论
    await pool.execute(
      'INSERT INTO comments (user_id, game_id, rating, comment_text) VALUES (?, ?, ?, ?)',
      [userId, gameId, normalizedRating, commentText.trim()]
    );

    const message = '评论发布成功';
    console.log(`用户 ${userId} 为游戏 ${gameId} 创建了新评论`);

    // 更新游戏的平均评分
    const [avgResult] = await pool.execute(
      'SELECT AVG(rating) as avg_rating FROM comments WHERE game_id = ? AND rating > 0',
      [gameId]
    );

    const avgRating = avgResult[0].avg_rating || 0;
    await pool.execute(
      'UPDATE games SET rating_avg = ? WHERE game_id = ?',
      [avgRating, gameId]
    );

    console.log(`游戏 ${gameId} 的平均评分更新为: ${avgRating}`);

    res.json({ message });

  } catch (error) {
    console.error('提交评论错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 回复评论
const replyToComment = async (req, res) => {
  try {
    const { gameId, commentId } = req.params;
    const { commentText, replyToUserId } = req.body;
    const userId = req.user.userId;

    // 验证输入
    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: '回复内容不能为空' });
    }

    const explicitReplyToUserId = normalizeOptionalUserId(replyToUserId);
    if (
      replyToUserId !== null
      && replyToUserId !== undefined
      && String(replyToUserId).trim() !== ''
      && explicitReplyToUserId === null
    ) {
      return res.status(400).json({ error: '回复目标用户无效' });
    }

    // 获取数据库连接池
    const pool = getPool();

    // 检查游戏是否存在
    const [games] = await pool.execute(
      'SELECT id FROM games WHERE game_id = ?',
      [gameId]
    );

    if (games.length === 0) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    // 检查要回复的评论是否存在
    const [parentComments] = await pool.execute(
      'SELECT id, user_id FROM comments WHERE id = ? AND game_id = ? AND parent_id IS NULL',
      [commentId, gameId]
    );

    if (parentComments.length === 0) {
      return res.status(404).json({ error: '要回复的评论不存在' });
    }

    // 验证用户是否存在
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: '用户不存在' });
    }

    const parentAuthorId = normalizeOptionalUserId(parentComments[0].user_id);
    const resolvedReplyToUserId = explicitReplyToUserId || parentAuthorId;

    // 创建回复评论并获取新创建的回复ID
    const [result] = await pool.execute(
      'INSERT INTO comments (user_id, game_id, parent_id, reply_to_user_id, comment_text) VALUES (?, ?, ?, ?, ?)',
      [userId, gameId, commentId, resolvedReplyToUserId, commentText.trim()]
    );

    const newReplyId = result.insertId;

    // 如果回复的是其他用户，创建通知
    if (resolvedReplyToUserId && Number(resolvedReplyToUserId) !== Number(userId)) {
      // 获取游戏信息
      const [gameInfo] = await pool.execute(
        'SELECT title FROM games WHERE game_id = ?',
        [gameId]
      );

      // 获取回复者信息
      const [replierInfo] = await pool.execute(
        'SELECT username FROM users WHERE id = ?',
        [userId]
      );

      if (gameInfo.length > 0 && replierInfo.length > 0) {
        const gameTitle = gameInfo[0].title;
        const replierName = replierInfo[0].username;

        // 创建评论回复通知 - 传递新创建的回复ID
        await createNotification(
          resolvedReplyToUserId,
          'comment_reply',
          '收到评论回复',
          `${replierName} 在游戏"${gameTitle}"中回复了您的评论`,
          gameId,
          newReplyId  // 使用新创建的回复ID而不是主评论ID
        );
      }
    }

    const message = '回复发布成功';
    console.log(`用户 ${userId} 回复了评论 ${commentId}`);

    res.json({ message });

  } catch (error) {
    console.error('回复评论错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取文档评论（包含回复）
const getDocComments = async (req, res) => {
  try {
    const docId = normalizeCommentTargetId(req.params.docId);
    const pool = getPool();
    await ensureDocCommentsTable(pool);
    const hasAvatarColumn = await isAvatarColumnAvailable(pool);

    const [comments] = await pool.execute(
      hasAvatarColumn
        ? `SELECT c.*, u.username, COALESCE(u.avatar_url, ?) AS avatar_url
           FROM doc_comments c
           JOIN users u ON c.user_id = u.id
           WHERE c.doc_id = ? AND c.parent_id IS NULL
           ORDER BY c.created_at DESC`
        : `SELECT c.*, u.username
           FROM doc_comments c
           JOIN users u ON c.user_id = u.id
           WHERE c.doc_id = ? AND c.parent_id IS NULL
           ORDER BY c.created_at DESC`,
      hasAvatarColumn ? [DEFAULT_AVATAR_URL, docId] : [docId]
    );

    for (let comment of comments) {
      const [replies] = await pool.execute(
        hasAvatarColumn
          ? `SELECT c.*, u.username, COALESCE(u.avatar_url, ?) AS avatar_url,
                    ru.username AS reply_to_username,
                    COALESCE(ru.avatar_url, ?) AS reply_to_avatar_url
             FROM doc_comments c
             JOIN users u ON c.user_id = u.id
             LEFT JOIN users ru ON c.reply_to_user_id = ru.id
             WHERE c.parent_id = ?
             ORDER BY c.created_at ASC`
          : `SELECT c.*, u.username, ru.username as reply_to_username
             FROM doc_comments c
             JOIN users u ON c.user_id = u.id
             LEFT JOIN users ru ON c.reply_to_user_id = ru.id
             WHERE c.parent_id = ?
             ORDER BY c.created_at ASC`,
        hasAvatarColumn
          ? [DEFAULT_AVATAR_URL, DEFAULT_AVATAR_URL, comment.id]
          : [comment.id]
      );

      comment.replies = replies;
    }

    res.json(comments);
  } catch (error) {
    console.error('获取文档评论错误:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
};

const submitDocComment = async (req, res) => {
  try {
    const docId = normalizeCommentTargetId(req.params.docId);
    const { commentText } = req.body;
    const userId = req.user.userId;

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    const pool = getPool();
    await ensureDocCommentsTable(pool);

    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(400).json({ error: '用户不存在' });
    }

    await pool.execute(
      'INSERT INTO doc_comments (user_id, doc_id, comment_text) VALUES (?, ?, ?)',
      [userId, docId, commentText.trim()]
    );

    res.json({ message: '评论发布成功' });
  } catch (error) {
    console.error('提交文档评论错误:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
};

const replyToDocComment = async (req, res) => {
  try {
    const docId = normalizeCommentTargetId(req.params.docId);
    const { commentId } = req.params;
    const { commentText, replyToUserId } = req.body;
    const userId = req.user.userId;

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: '回复内容不能为空' });
    }

    const explicitReplyToUserId = normalizeOptionalUserId(replyToUserId);
    if (
      replyToUserId !== null
      && replyToUserId !== undefined
      && String(replyToUserId).trim() !== ''
      && explicitReplyToUserId === null
    ) {
      return res.status(400).json({ error: '回复目标用户无效' });
    }

    const pool = getPool();
    await ensureDocCommentsTable(pool);

    const [parentComments] = await pool.execute(
      'SELECT id, user_id FROM doc_comments WHERE id = ? AND doc_id = ? AND parent_id IS NULL',
      [commentId, docId]
    );
    if (parentComments.length === 0) {
      return res.status(404).json({ error: '要回复的评论不存在' });
    }

    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(400).json({ error: '用户不存在' });
    }

    const parentAuthorId = normalizeOptionalUserId(parentComments[0].user_id);
    const resolvedReplyToUserId = explicitReplyToUserId || parentAuthorId;

    await pool.execute(
      'INSERT INTO doc_comments (user_id, doc_id, parent_id, reply_to_user_id, comment_text) VALUES (?, ?, ?, ?, ?)',
      [userId, docId, commentId, resolvedReplyToUserId, commentText.trim()]
    );

    res.json({ message: '回复发布成功' });
  } catch (error) {
    console.error('回复文档评论错误:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
};

module.exports = {
  getGameComments,
  submitComment,
  replyToComment,
  getDocComments,
  submitDocComment,
  replyToDocComment
};
