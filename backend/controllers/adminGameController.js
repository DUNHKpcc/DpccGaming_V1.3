const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { getPool } = require('../config/database');
const { createNotification } = require('../utils/notification');

// 管理员审核游戏
const reviewGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { status, reviewNotes } = req.body;
    const reviewerId = req.user.userId;

    // 验证状态
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效的审核状态' });
    }

    // 获取数据库连接池
    const pool = getPool();

    // 检查游戏是否存在
    const [games] = await pool.execute(
      'SELECT id, status FROM games WHERE game_id = ?',
      [gameId]
    );

    if (games.length === 0) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    const game = games[0];

    // 更新游戏状态
    await pool.execute(
      `UPDATE games 
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
       WHERE game_id = ?`,
      [status, reviewerId, reviewNotes || null, gameId]
    );

    // 获取游戏信息用于通知
    const [gameInfo] = await pool.execute(
      'SELECT uploaded_by, title FROM games WHERE game_id = ?',
      [gameId]
    );

    if (gameInfo.length > 0) {
      const game = gameInfo[0];
      const notificationType = status === 'approved' ? 'game_approved' : 'game_rejected';
      const notificationTitle = status === 'approved' ? '游戏审核通过' : '游戏审核未通过';
      const notificationContent = status === 'approved'
        ? `您上传的游戏"${game.title}"已通过审核并成功上架！`
        : `您上传的游戏"${game.title}"未通过审核${reviewNotes ? '，原因：' + reviewNotes : ''}`;

      // 创建通知 - 传递游戏ID字符串
      await createNotification(
        game.uploaded_by,
        notificationType,
        notificationTitle,
        notificationContent,
        gameId  // 这里传递的是字符串格式的游戏ID
      );
    }

    console.log(`管理员 ${reviewerId} ${status === 'approved' ? '通过' : '拒绝'}了游戏: ${gameId}`);

    res.json({
      message: `游戏${status === 'approved' ? '审核通过' : '审核拒绝'}成功`,
      gameId: gameId,
      status: status
    });

  } catch (error) {
    console.error('审核游戏错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取待审核游戏列表（管理员用）
const getPendingGames = async (req, res) => {
  try {
    const pool = getPool();
    const [games] = await pool.execute(`
      SELECT 
        g.*,
        u.username as uploaded_by_username
      FROM games g
      LEFT JOIN users u ON g.uploaded_by = u.id
      WHERE g.status = 'pending'
      ORDER BY g.uploaded_at ASC
    `);

    res.json({ games });
  } catch (error) {
    console.error('获取待审核游戏错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取所有已审核游戏列表（管理员用）
const getAllGames = async (req, res) => {
  try {
    const pool = getPool();
    const [games] = await pool.execute(`
      SELECT 
        g.*,
        COALESCE(AVG(CASE WHEN c.rating > 0 THEN c.rating END), 0) as average_rating,
        COUNT(DISTINCT CASE WHEN c.rating > 0 THEN c.id END) as comment_count
      FROM games g
      LEFT JOIN comments c ON g.game_id = c.game_id
      WHERE g.status = 'approved'
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);

    // 格式化游戏数据
    const formattedGames = games.map(game => {
      const codeZipPath = path.join(process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code'), `${game.game_id}.zip`);
      const codePackageUrl = fsSync.existsSync(codeZipPath)
        ? `/uploads/code/${game.game_id}.zip`
        : null;
      return {
        id: game.id,
        game_id: game.game_id,
        title: game.title,
        description: game.description,
        category: game.category,
        thumbnail_url: game.thumbnail_url,
        game_url: game.game_url,
        created_at: game.created_at,
        average_rating: parseFloat(game.average_rating).toFixed(1),
        comment_count: game.comment_count,
        play_count: game.play_count || 0,
        code_package_url: codePackageUrl
      };
    });

    res.json({ games: formattedGames });
  } catch (error) {
    console.error('获取所有游戏错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 删除游戏（管理员用）
const deleteGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const adminId = req.user.userId;

    // 获取数据库连接池
    const pool = getPool();

    // 检查游戏是否存在
    const [games] = await pool.execute(
      'SELECT id, title, game_url FROM games WHERE game_id = ?',
      [gameId]
    );

    if (games.length === 0) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    const game = games[0];

    // 开始事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 删除游戏相关的评论
      await connection.execute(
        'DELETE FROM comments WHERE game_id = ?',
        [gameId]
      );

      // 2. 删除游戏相关的通知
      await connection.execute(
        'DELETE FROM notifications WHERE related_game_id = ?',
        [gameId]
      );

      // 3. 删除游戏记录
      await connection.execute(
        'DELETE FROM games WHERE game_id = ?',
        [gameId]
      );

      // 4. 删除游戏文件
      try {
        const gamesRootPath = process.env.GAMES_ROOT_PATH || path.join(process.cwd(), 'games');
        const codeRootPath = process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code');
        
        const gameDir = path.join(gamesRootPath, gameId);
        await fs.rm(gameDir, { recursive: true, force: true });
        await fs.rm(path.join(codeRootPath, gameId), { recursive: true, force: true }).catch(() => { });
        console.log(`游戏文件已删除: ${gameDir}`);
      } catch (fileError) {
        console.warn('删除游戏文件失败:', fileError.message);
        // 文件删除失败不影响数据库操作
      }

      // 提交事务
      await connection.commit();

      console.log(`管理员 ${adminId} 删除了游戏: ${game.title} (${gameId})`);

      res.json({
        message: '游戏删除成功',
        gameId: gameId,
        title: game.title
      });

    } catch (error) {
      // 回滚事务
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('删除游戏错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

module.exports = {
  reviewGame,
  getPendingGames,
  getAllGames,
  deleteGame
};
