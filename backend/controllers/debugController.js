const path = require('path');
const fs = require('fs');
const { getPool } = require('../config/database');

const resolveCodeRoot = () => process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code');

async function fixCodePackageUrls(req, res) {
  try {
    const pool = getPool();
    const [games] = await pool.execute('SELECT game_id, code_package_url FROM games');

    const codeRootPath = resolveCodeRoot();
    let updatedCount = 0;
    let missingCount = 0;

    for (const game of games) {
      const zipPath = path.join(codeRootPath, `${game.game_id}.zip`);

      if (fs.existsSync(zipPath)) {
        const newUrl = `/uploads/code/${game.game_id}.zip`;

        if (!game.code_package_url || game.code_package_url !== newUrl) {
          await pool.execute(
            'UPDATE games SET code_package_url = ? WHERE game_id = ?',
            [newUrl, game.game_id]
          );
          updatedCount++;
        }
      } else {
        missingCount++;
      }
    }

    res.json({
      message: '修复完成',
      totalGames: games.length,
      updatedGames: updatedCount,
      notFound: missingCount,
      details: '已为存在源码压缩包的游戏更新 code_package_url 字段'
    });
  } catch (error) {
    console.error('修复 code_package_url 字段失败:', error);
    res.status(500).json({ error: '修复失败: ' + error.message });
  }
}

async function listRecentGames(req, res) {
  try {
    const pool = getPool();
    const [games] = await pool.execute(`
      SELECT 
        id,
        game_id,
        title,
        status,
        uploaded_by,
        created_at,
        updated_at
      FROM games
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      message: '数据库游戏记录查询成功',
      count: games.length,
      games
    });
  } catch (error) {
    console.error('调试查询失败:', error);
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
}

module.exports = {
  fixCodePackageUrls,
  listRecentGames
};
