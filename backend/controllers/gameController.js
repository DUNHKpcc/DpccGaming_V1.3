const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const AdmZip = require('adm-zip');
const { getPool } = require('../config/database');
const { createNotification } = require('../utils/notification');

const DEFAULT_AVATAR_URL = '/avatars/default-avatar.svg';
let avatarColumnAvailableCache = null;
let libraryTableReady = false;
let libraryTableInitPromise = null;

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
    console.warn('检查游戏上传者头像字段失败，回退默认头像:', error.message);
    avatarColumnAvailableCache = false;
  }

  return avatarColumnAvailableCache;
};

const ensureLibraryTable = async (pool) => {
  if (libraryTableReady) return;
  if (libraryTableInitPromise) {
    await libraryTableInitPromise;
    return;
  }

  libraryTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS user_game_library (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      game_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_user_game (user_id, game_id),
      KEY idx_user_created (user_id, created_at),
      KEY idx_game (game_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await libraryTableInitPromise;
    libraryTableReady = true;
  } finally {
    libraryTableInitPromise = null;
  }
};

// 获取游戏列表
const getGamesList = async (req, res) => {
  try {
    const pool = getPool();
    const hasAvatarColumn = await isAvatarColumnAvailable(pool);
    const [games] = await pool.execute(
      hasAvatarColumn
        ? `SELECT 
             g.*,
             COALESCE(AVG(CASE WHEN c.rating > 0 THEN c.rating END), 0) as average_rating,
             COUNT(DISTINCT CASE WHEN c.rating > 0 THEN c.id END) as comment_count,
             u.username AS uploaded_by_username,
             COALESCE(u.avatar_url, ?) AS uploaded_by_avatar_url
           FROM games g
           LEFT JOIN comments c ON g.game_id = c.game_id
           LEFT JOIN users u ON g.uploaded_by = u.id
           WHERE g.status = 'approved'
           GROUP BY g.id, u.username, u.avatar_url
           ORDER BY g.created_at DESC`
        : `SELECT 
             g.*,
             COALESCE(AVG(CASE WHEN c.rating > 0 THEN c.rating END), 0) as average_rating,
             COUNT(DISTINCT CASE WHEN c.rating > 0 THEN c.id END) as comment_count,
             u.username AS uploaded_by_username,
             ? AS uploaded_by_avatar_url
           FROM games g
           LEFT JOIN comments c ON g.game_id = c.game_id
           LEFT JOIN users u ON g.uploaded_by = u.id
           WHERE g.status = 'approved'
           GROUP BY g.id, u.username
           ORDER BY g.created_at DESC`,
      [DEFAULT_AVATAR_URL]
    );

    // 格式化游戏数据并检查源码状态
    const formattedGames = await Promise.all(games.map(async (game) => {
      const codeZipPath = path.join(process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code'), `${game.game_id}.zip`);
      const codePackageUrl = fsSync.existsSync(codeZipPath)
        ? `/uploads/code/${game.game_id}.zip`
        : null;

      // 检查源码是否存在
      let codeExists = false;
      try {
        const codeDir = path.join(process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code'), game.game_id);
        if (fsSync.existsSync(codeDir) && fsSync.lstatSync(codeDir).isDirectory()) {
          const dirItems = fsSync.readdirSync(codeDir);
          codeExists = dirItems.length > 0;
        }
      } catch (codeCheckErr) {
        console.warn('⚠️ 源码状态检查失败:', codeCheckErr.message);
        codeExists = false;
      }

      return {
        id: game.id,
        game_id: game.game_id,
        title: game.title,
        description: game.description,
        category: game.category,
        engine: game.engine,
        code_type: game.code_type,
        video_url: game.video_url,
        image_url: game.image_url,
        game_url: game.game_url,
        created_at: game.created_at,
        average_rating: parseFloat(game.average_rating).toFixed(1),
        comment_count: game.comment_count,
        play_count: game.play_count || 0,
        uploaded_by_id: game.uploaded_by || null,
        uploaded_by_username: game.uploaded_by_username || '匿名开发者',
        uploaded_by_avatar_url: game.uploaded_by_avatar_url || DEFAULT_AVATAR_URL,
        code_package_url: codePackageUrl,
        code_exists: codeExists
      };
    }));

    res.json({ games: formattedGames });
  } catch (error) {
    console.error('获取游戏列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取单个游戏详情
const getGameDetail = async (req, res) => {
  try {
    const pool = getPool();
    const { gameId } = req.params;
    const [rows] = await pool.execute(`
      SELECT 
        g.*,
        COALESCE(AVG(CASE WHEN c.rating > 0 THEN c.rating END), 0) as average_rating,
        COUNT(DISTINCT CASE WHEN c.rating > 0 THEN c.id END) as comment_count
      FROM games g
      LEFT JOIN comments c ON g.game_id = c.game_id
      WHERE g.game_id = ?
    `, [gameId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    const game = rows[0];

    // 检查源码是否存在 - 既检查压缩包也检查解压后的目录
    let codeExists = false;
    let codePackageUrl = null;

    try {
      const codeZipPath = path.join(process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code'), `${game.game_id}.zip`);
      const codeDir = path.join(process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code'), game.game_id);

      // 检查压缩包是否存在
      const zipExists = fsSync.existsSync(codeZipPath);

      // 检查解压后的源码目录是否存在且不为空
      let dirExists = false;
      let dirHasContent = false;

      if (fsSync.existsSync(codeDir) && fsSync.lstatSync(codeDir).isDirectory()) {
        const dirItems = fsSync.readdirSync(codeDir);
        dirHasContent = dirItems.length > 0;
        dirExists = true;
      }

      // 源码存在的条件：有压缩包或解压后的目录有内容
      codeExists = zipExists || dirHasContent;

      // 只有在压缩包存在时才提供下载链接
      if (zipExists) {
        codePackageUrl = `/uploads/code/${game.game_id}.zip`;
      }

      console.log(`🔍 检查游戏 ${game.game_id} 源码状态:`, {
        codeZipExists: zipExists,
        codeDirExists: dirExists,
        dirHasContent: dirHasContent,
        codeExists: codeExists,
        codePackageAvailable: !!codePackageUrl
      });

    } catch (codeCheckErr) {
      console.warn('⚠️ 源码状态检查失败:', codeCheckErr.message);
      codeExists = false;
      codePackageUrl = null;
    }

    res.json({
      game: {
        id: game.id,
        game_id: game.game_id,
        title: game.title,
        description: game.description,
        category: game.category,
        engine: game.engine,
        code_type: game.code_type,
        video_url: game.video_url,
        image_url: game.image_url,
        game_url: game.game_url,
        created_at: game.created_at,
        average_rating: parseFloat(game.average_rating || 0).toFixed(1),
        comment_count: game.comment_count || 0,
        play_count: game.play_count || 0,
        code_package_url: codePackageUrl,
        code_exists: codeExists
      }
    });
  } catch (error) {
    console.error('获取游戏详情错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const CODE_BROWSE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss', '.less', '.html', '.json', '.md', '.c', '.cpp', '.h', '.cs', '.py']);
const CODE_BROWSE_MAX_FILES = 60;
const CODE_BROWSE_MAX_FILE_SIZE = 200 * 1024; // 200KB
const CODE_BROWSE_SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.output', '.cache']);

const normalizeCodePath = (value = '') => String(value).replace(/\\/g, '/').replace(/^\/+/, '');
const resolveCodeArtifacts = (codeRootPath, gameId) => {
  const codeDir = path.join(codeRootPath, gameId);
  const codeZipPath = path.join(codeRootPath, `${gameId}.zip`);
  const dirExists = fsSync.existsSync(codeDir) && fsSync.lstatSync(codeDir).isDirectory();
  const zipExists = fsSync.existsSync(codeZipPath);
  return { codeDir, codeZipPath, dirExists, zipExists };
};

async function collectCodeFilesFromDirectory(targetDir) {
  const files = [];

  async function walk(dir) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (files.length >= CODE_BROWSE_MAX_FILES) return;
      const full = path.join(dir, item.name);

      if (item.isDirectory()) {
        if (CODE_BROWSE_SKIP_DIRS.has(item.name)) continue;
        await walk(full);
        continue;
      }

      const ext = path.extname(item.name).toLowerCase();
      if (!CODE_BROWSE_EXTS.has(ext)) continue;

      const rel = normalizeCodePath(path.relative(targetDir, full));
      if (!rel || rel.startsWith('..')) continue;

      try {
        const stat = await fs.lstat(full);
        if (stat.size > CODE_BROWSE_MAX_FILE_SIZE) continue;
        const content = await fs.readFile(full, 'utf8');
        files.push({ path: rel, content });
      } catch (e) {
        // 忽略无法读取的文件
      }
    }
  }

  await walk(targetDir);
  return files;
}

function collectCodeFilesFromZip(zipPath) {
  try {
    const files = [];
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries() || [];

    for (const entry of entries) {
      if (files.length >= CODE_BROWSE_MAX_FILES) break;
      if (entry.isDirectory) continue;

      const rel = normalizeCodePath(entry.entryName || '');
      if (!rel || rel.includes('../')) continue;

      const ext = path.extname(rel).toLowerCase();
      if (!CODE_BROWSE_EXTS.has(ext)) continue;

      const rawSize = Number(entry.header?.size || 0);
      if (Number.isFinite(rawSize) && rawSize > CODE_BROWSE_MAX_FILE_SIZE) continue;

      try {
        const content = entry.getData().toString('utf8');
        if (Buffer.byteLength(content, 'utf8') > CODE_BROWSE_MAX_FILE_SIZE) continue;
        files.push({ path: rel, content });
      } catch (e) {
        // 忽略无法读取/解码的文件
      }
    }

    return files;
  } catch (error) {
    console.warn('⚠️ 读取源码压缩包失败:', error.message);
    return [];
  }
}

// 代码浏览：优先读取 uploads/code/<gameId> 目录，不存在时回退读取 uploads/code/<gameId>.zip
const getGameCode = async (req, res) => {
  try {
    const requestedGameId = String(req.params.gameId || '').trim();
    if (!requestedGameId) {
      return res.status(400).json({ error: '缺少游戏ID' });
    }

    const codeRootPath = process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code');
    let resolvedGameId = requestedGameId;
    let { codeDir, codeZipPath, dirExists, zipExists } = resolveCodeArtifacts(codeRootPath, resolvedGameId);

    if (!dirExists && !zipExists) {
      const pool = getPool();
      const [rows] = await pool.execute(
        'SELECT game_id FROM games WHERE game_id = ? OR CAST(id AS CHAR) = ? LIMIT 1',
        [requestedGameId, requestedGameId]
      );

      const mappedGameId = rows?.[0]?.game_id ? String(rows[0].game_id).trim() : '';
      if (mappedGameId) {
        resolvedGameId = mappedGameId;
        ({ codeDir, codeZipPath, dirExists, zipExists } = resolveCodeArtifacts(codeRootPath, resolvedGameId));
      }
    }

    if (!dirExists && !zipExists) {
      return res.status(404).json({ error: '源码尚未上传或目录不存在', game_id: resolvedGameId });
    }

    let files = [];

    if (dirExists) {
      files = await collectCodeFilesFromDirectory(codeDir);
    }

    if (!files.length && zipExists) {
      files = collectCodeFilesFromZip(codeZipPath);
    }

    res.json({ files });
  } catch (error) {
    console.error('读取源码失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 源码下载：返回代码压缩包（优先已保存的 zip，否则现打包 uploads/code/<gameId>）
const downloadGameCode = async (req, res) => {
  try {
    const { gameId } = req.params;
    const codeRootPath = process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code');
    const predefinedZip = path.join(codeRootPath, `${gameId}.zip`);

    if (fsSync.existsSync(predefinedZip)) {
      return res.sendFile(predefinedZip);
    }

    // 尝试现打包 _code 目录
    const codeDir = path.join(codeRootPath, gameId);
    if (!fsSync.existsSync(codeDir)) {
      return res.status(404).json({ error: '未找到可下载的源码' });
    }
    const zip = new AdmZip();
    zip.addLocalFolder(codeDir);
    const buffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${gameId}.zip`);
    return res.end(buffer);
  } catch (error) {
    console.error('下载源码失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 上传游戏
const uploadGame = async (req, res) => {
  try {
    const { title, category, description, engine, codeType } = req.body;
    const userId = req.user.userId;
    const pool = getPool();
    const files = req.files;
    const gameFile = files.gameFile && files.gameFile[0];
    const videoFile = files.video && files.video[0];
    const codeArchiveFile = files.codeArchive && files.codeArchive[0];

    // 🔍 调试日志：检查文件上传情况
    console.log('🔍 文件上传调试信息:');
    console.log('📄 游戏文件:', gameFile ? `${gameFile.originalname} (${gameFile.size} bytes)` : '未上传');
    console.log('🎥 视频文件:', videoFile ? `${videoFile.originalname} (${videoFile.size} bytes)` : '未上传');
    console.log('📦 源码文件:', codeArchiveFile ? `${codeArchiveFile.originalname} (${codeArchiveFile.size} bytes)` : '未上传');
    console.log('📋 收到的所有字段:', Object.keys(req.body || {}));
    console.log('📁 文件对象结构:', Object.keys(files || {}));

    let videoUrl = null;
    if (videoFile) {
      try {
        // 使用统一的uploads路径（环境适配）
        const uploadsPath = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
        const videoDir = path.join(uploadsPath, 'video');
        await fs.mkdir(videoDir, { recursive: true });
        if (process.platform !== 'win32') {
          await fs.chmod(videoDir, 0o755);
        }

        // 生成唯一的文件名
        const videoExt = path.extname(videoFile.originalname);
        const destPath = path.join(videoDir, Date.now() + '-' + Math.round(Math.random() * 1E9) + videoExt);

        // 确保文件正确保存
        try {
          // 使用copyFile代替rename，确保跨设备移动也能工作
          await fs.copyFile(videoFile.path, destPath);
          // 复制成功后删除原临时文件
          await fs.unlink(videoFile.path);
          console.log('视频文件复制成功:', destPath);
        } catch (copyError) {
          console.warn('视频文件复制失败，尝试使用rename:', copyError.message);
          // 如果copyFile失败，尝试使用rename作为备选方案
          await fs.rename(videoFile.path, destPath);
          console.log('视频文件重命名成功:', destPath);
        }

        // 验证文件是否存在
        try {
          await fs.access(destPath);
        } catch {
          throw new Error('视频文件保存失败，目标文件不存在');
        }

        // 设置文件权限为755，确保文件可读写执行
        await fs.chmod(destPath, 0o755);

        // 生成正确的URL路径
        videoUrl = '/uploads/video/' + path.basename(destPath);
      } catch (videoError) {
        console.warn('⚠️ 视频处理失败:', videoError.message);
        videoUrl = null; // 上传失败允许无视频
      }
    }

    if (!title || !category || !description || !engine || !codeType) {
      return res.status(400).json({ error: '信息不完整' });
    }
    if (!gameFile) {
      return res.status(400).json({ error: '未上传游戏包' });
    }

    // 生成唯一的游戏ID
    const gameId = 'game-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // 创建游戏目录
    const gamesRootPath = process.env.GAMES_ROOT_PATH || path.join(process.cwd(), 'games');
    const gameDir = path.join(gamesRootPath, gameId);
    await fs.mkdir(gameDir, { recursive: true });

    try {
      // 解压ZIP文件
      const zip = new AdmZip(gameFile.path);
      zip.extractAllTo(gameDir, true);

      // 查找index.html文件
      const extractedFiles = await fs.readdir(gameDir, { recursive: true });
      let indexHtmlPath = null;

      // 递归查找index.html
      async function findIndexHtml(dir) {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            await findIndexHtml(fullPath);
          } else if (item.name.toLowerCase() === 'index.html') {
            indexHtmlPath = fullPath;
            return;
          }
        }
      }

      await findIndexHtml(gameDir);

      if (!indexHtmlPath) {
        // 清理文件
        await fs.rm(gameDir, { recursive: true, force: true });
        await fs.rm(path.join(process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code'), gameId), { recursive: true, force: true }).catch(() => { });
        await fs.unlink(gameFile.path);
        return res.status(400).json({ error: 'ZIP文件中未找到index.html文件' });
      }

      // 计算相对路径
      const relativePath = path.relative(gamesRootPath, indexHtmlPath);
      const gameUrl = `games/${relativePath.replace(/\\/g, '/')}`;

      // 查找缩略图
      let thumbnailUrl = null;
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

      async function findThumbnail(dir) {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            await findThumbnail(fullPath);
          } else {
            const ext = path.extname(item.name).toLowerCase();
            if (imageExtensions.includes(ext)) {
              thumbnailUrl = `games/${path.relative(gamesRootPath, fullPath).replace(/\\/g, '/')}`;
              return;
            }
          }
        }
      }

      await findThumbnail(gameDir);

      // 如果上传了源码压缩包：保存到 uploads/code，并解压到 uploads/code/<gameId> 供 Coding 页面浏览
      let codeProcessingSuccess = false;
      if (codeArchiveFile) {
        try {
          console.log('🧩 开始处理源码压缩包:', codeArchiveFile.originalname);

          const codeRootPath = process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code');
          await fs.mkdir(codeRootPath, { recursive: true });
          const codeZipTarget = path.join(codeRootPath, `${gameId}.zip`);

          // 复制文件到目标位置
          try {
            await fs.copyFile(codeArchiveFile.path, codeZipTarget);
            await fs.unlink(codeArchiveFile.path).catch(() => { });
            console.log('✅ 源码压缩包复制成功:', codeZipTarget);
          } catch (copyError) {
            console.warn('⚠️ 源码压缩包复制失败，尝试重命名:', copyError.message);
            await fs.rename(codeArchiveFile.path, codeZipTarget);
            console.log('✅ 源码压缩包重命名成功:', codeZipTarget);
          }

          // 设置文件权限
          await fs.chmod(codeZipTarget, 0o644);

          // 创建解压目录
          const codeExtractDir = path.join(codeRootPath, gameId);
          await fs.rm(codeExtractDir, { recursive: true, force: true }).catch(() => { });
          await fs.mkdir(codeExtractDir, { recursive: true });
          await fs.chmod(codeExtractDir, 0o755);

          // 验证压缩包文件
          const codeZip = new AdmZip(codeZipTarget);
          const zipEntries = codeZip.getEntries();

          if (!zipEntries || zipEntries.length === 0) {
            throw new Error('源码压缩包为空或格式不正确');
          }

          console.log(`📦 压缩包包含 ${zipEntries.length} 个文件/目录`);

          // 解压源码文件
          codeZip.extractAllTo(codeExtractDir, true);

          // 验证解压结果
          const extractedItems = await fs.readdir(codeExtractDir);
          if (extractedItems.length === 0) {
            throw new Error('解压后目录为空，源码文件可能损坏');
          }

          console.log('✅ 源码解压成功，解压后包含:', extractedItems.length, '个项目');
          console.log('✅ 源码处理完成:', gameId);

          codeProcessingSuccess = true;

        } catch (codeErr) {
          console.error('❌ 代码压缩包处理失败:', codeErr.message);
          console.error('❌ 源码处理详细错误:', codeErr.stack);

          // 不影响游戏上传，但记录源码处理失败
          codeProcessingSuccess = false;
        }
      } else {
        console.log('ℹ️ 未上传源码压缩包');
      }

      // 设置 code_package_url（如果源码处理成功）
      const codePackageUrl = codeProcessingSuccess ? `/uploads/code/${gameId}.zip` : null;

      // 保存游戏信息到数据库
      await pool.execute(
        `INSERT INTO games (game_id, title, description, category, engine, code_type, thumbnail_url, video_url, game_url, code_package_url, status, uploaded_by, uploaded_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
        [gameId, title, description, category, engine, codeType, thumbnailUrl, videoUrl, gameUrl, codePackageUrl, userId]
      );

      // 清理上传的临时文件
      await fs.unlink(gameFile.path);

      console.log(`用户 ${userId} 上传了游戏: ${title} (${gameId})`);

      res.json({ message: '游戏上传成功，正在审核中', gameId, status: 'pending' });

    } catch (extractError) {
      console.error('解压文件错误:', extractError);
      // 清理文件
      await fs.rm(gameDir, { recursive: true, force: true });
      await fs.rm(path.join(process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code'), gameId), { recursive: true, force: true }).catch(() => { });
      await fs.unlink(gameFile.path);
      res.status(500).json({ error: '文件解压失败，请检查ZIP文件格式' });
    }

  } catch (error) {
    console.error('上传游戏错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 记录游戏被玩过
const recordGamePlay = async (req, res) => {
  try {
    const { gameId } = req.params;
    const pool = getPool();

    // 检查游戏是否存在
    const [games] = await pool.execute(
      'SELECT id FROM games WHERE game_id = ?',
      [gameId]
    );

    if (games.length === 0) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    // 直接更新games表中的play_count字段
    await pool.execute(
      'UPDATE games SET play_count = play_count + 1 WHERE game_id = ?',
      [gameId]
    );

    console.log(`游戏 ${gameId} 的玩过次数增加1`);
    res.json({ message: '游戏玩过记录成功' });
  } catch (error) {
    console.error('记录游戏玩过错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取我的游戏库
const getMyLibrary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();
    await ensureLibraryTable(pool);

    const [rows] = await pool.execute(
      `SELECT l.game_id, l.created_at AS saved_at,
              g.title, g.category, g.engine, g.code_type,
              g.thumbnail_url, g.video_url, g.play_count, g.game_url
       FROM user_game_library l
       JOIN games g ON g.game_id = l.game_id
       WHERE l.user_id = ? AND g.status = 'approved'
       ORDER BY l.created_at DESC`,
      [userId]
    );

    res.json({ games: rows });
  } catch (error) {
    console.error('获取用户游戏库失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 添加游戏到我的库
const addToLibrary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { gameId } = req.params;
    if (!gameId) {
      return res.status(400).json({ error: '缺少 gameId' });
    }

    const pool = getPool();
    await ensureLibraryTable(pool);

    const [games] = await pool.execute(
      `SELECT game_id, title
       FROM games
       WHERE game_id = ? AND status = 'approved'
       LIMIT 1`,
      [gameId]
    );

    if (!games.length) {
      return res.status(404).json({ error: '游戏不存在或未通过审核' });
    }

    const [result] = await pool.execute(
      `INSERT IGNORE INTO user_game_library (user_id, game_id)
       VALUES (?, ?)`,
      [userId, gameId]
    );

    res.json({
      added: result.affectedRows > 0,
      game_id: gameId,
      message: result.affectedRows > 0 ? '已加入游戏库' : '该游戏已在你的库中'
    });
  } catch (error) {
    console.error('加入游戏库失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

module.exports = {
  getGamesList,
  getGameDetail,
  getGameCode,
  downloadGameCode,
  uploadGame,
  recordGamePlay,
  getMyLibrary,
  addToLibrary
};
