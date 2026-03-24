// 加载环境变量（如果dotenv可用）
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not available, using default configuration');
}

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 信任代理设置（重要：用于Nginx代理环境）
app.set('trust proxy', true);

// 中间件配置 - 宝塔面板环境
app.use(cors({
  origin: [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://dpccgaming.xyz',
    'https://dpccgaming.xyz'
  ],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 文件上传multer配置组
const gameFileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const videoDir = path.join(__dirname, 'uploads', 'video');
    cb(null, videoDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
// 1. multer配置统一用dest目录（去掉原storage: function...相关内容）
const upload = multer({
  dest: path.join(__dirname, 'uploads'), // 临时文件存储在项目目录的uploads中
  limits: { fileSize: 400 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    console.log('🔍 multer文件过滤器检查:', file.fieldname, file.originalname, file.mimetype);

    if (file.fieldname === 'gameFile') {
      if (file.mimetype === 'application/zip' || path.extname(file.originalname).toLowerCase() === '.zip') {
        cb(null, true);
      } else {
        cb(new Error('只允许上传ZIP文件'), false);
      }
    } else if (file.fieldname === 'video') {
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('只允许上传视频文件'), false);
      }
    } else if (file.fieldname === 'codeArchive') {
      // 允许源码压缩包：zip, tar, tar.gz, rar
      const allowedTypes = [
        'application/zip',
        'application/x-zip-compressed',
        'application/x-tar',
        'application/gzip',
        'application/x-rar-compressed'
      ];
      const allowedExts = ['.zip', '.tar', '.tar.gz', '.gz', '.rar'];

      if (allowedTypes.includes(file.mimetype) ||
        allowedExts.includes(path.extname(file.originalname).toLowerCase())) {
        console.log('✅ 源码文件过滤器: 允许上传', file.originalname);
        cb(null, true);
      } else {
        console.log('❌ 源码文件过滤器: 拒绝', file.originalname, 'MIME:', file.mimetype);
        cb(new Error('只允许上传ZIP/TAR/RAR源码压缩包'), false);
      }
    } else {
      console.log('❌ 未知文件字段:', file.fieldname);
      cb(null, false);
    }
  }
});

// 环境检测：必须在所有路径配置之前
const isWindows = process.platform === 'win32';
console.log('🔍 环境检测:', isWindows ? 'Windows开发环境' : 'Linux生产环境');

const SITE_ROOT_PATH = isWindows ? path.join(__dirname, 'uploads') : '/www/wwwroot/dpccgaming.xyz/uploads';
console.log('📁 Upload root resolved to:', SITE_ROOT_PATH);

// uploads目录：Windows使用项目目录，Linux固定使用dpccgaming.xyz域名目录
const uploadsPath = isWindows ? path.join(__dirname, 'uploads') : '/www/wwwroot/dpccgaming.xyz/uploads';

// code目录：与uploads目录保持一致的环境适配
const codeRootPath = isWindows ? path.join(uploadsPath, 'code') : '/www/wwwroot/dpccgaming.xyz/uploads/code';

const CODE_ROOT_PATH = codeRootPath;
console.log('🧩 Code root resolved to:', CODE_ROOT_PATH);

const GAMES_ROOT_PATH = resolveGamesRootPath();
console.log('🎮 Games root resolved to:', GAMES_ROOT_PATH);

app.use('/uploads', express.static(uploadsPath));

// games目录：保持原有的环境自适应逻辑
app.use('/games', express.static(GAMES_ROOT_PATH));

function resolveSiteRootPath() {
  const candidates = [];

  if (process.env.SITE_ROOT_PATH) {
    candidates.push(process.env.SITE_ROOT_PATH);
  }

  // 检测操作系统，在Windows开发环境中优先使用当前项目目录
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Windows开发环境：优先使用当前项目目录
    candidates.push(
      __dirname, // 当前项目目录
      path.resolve(__dirname) // 确保绝对路径
    );
  } else {
    // Linux生产环境：使用宝塔面板路径
    candidates.push(
      '/www/wwwroot/dpccgaming.xyz',
      path.join('/www', 'wwwroot', 'dpccgaming.xyz'),
      '/www/wwwroot/dpccgaming.xyz'
    );
  }

  // 通用备选方案
  candidates.push(
    path.join(__dirname, '..'), // 上级目录
    path.resolve(__dirname, '..', 'DpccGaming') // 查找上级目录的DpccGaming
  );

  for (const candidate of candidates) {
    try {
      if (candidate && fsSync.existsSync(candidate)) {
        console.log(`✅ 使用站点根目录: ${candidate}`);
        return candidate;
      }
    } catch (error) {
      console.warn(`⚠️ 站点目录检查失败: ${candidate}`, error.message);
    }
  }

  console.log('⚠️ 未找到合适的站点根目录，使用当前目录:', __dirname);
  return __dirname;
}

function resolveGamesRootPath() {
  const candidates = [];

  if (process.env.GAMES_ROOT_PATH) {
    candidates.push(process.env.GAMES_ROOT_PATH);
  }

  // 检测操作系统，在Windows开发环境中优先使用当前项目目录
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Windows开发环境：优先使用当前项目的games目录
    candidates.push(
      path.join(__dirname, 'games'), // 当前项目的games目录
      path.resolve(__dirname, 'games') // 确保绝对路径
    );
  } else {
    // Linux生产环境：使用宝塔面板路径
    candidates.push(
      path.join('/www', 'wwwroot', 'dpccgaming.xyz', 'games'),
      '/www/wwwroot/dpccgaming.xyz/games'
    );
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    try {
      fsSync.mkdirSync(resolved, { recursive: true });
      console.log(`✅ 游戏目录解析为: ${resolved}`);
      return resolved;
    } catch (error) {
      console.warn(`🎮 游戏目录创建失败: ${resolved}`, error.message);
    }
  }

  const fallback = path.join(__dirname, 'games');
  fsSync.mkdirSync(fallback, { recursive: true });
  console.log(`⚠️ 使用本地games目录作为备选: ${fallback}`);
  return fallback;
}

// 确保上传目录存在
async function ensureUploadDir() {
  try {
    // 使用统一的uploads路径（环境适配）
    const uploadsBaseDir = uploadsPath;

    await fs.mkdir(uploadsBaseDir, { recursive: true });
    if (!isWindows) {
      await fs.chmod(uploadsBaseDir, 0o755);
    }

    // 创建video子目录
    const videoDir = path.join(uploadsBaseDir, 'video');
    await fs.mkdir(videoDir, { recursive: true });
    if (!isWindows) {
      await fs.chmod(videoDir, 0o755);
    }

    // 创建code子目录
    const codeDir = path.join(uploadsBaseDir, 'code');
    await fs.mkdir(codeDir, { recursive: true });
    if (!isWindows) {
      await fs.chmod(codeDir, 0o755);
    }

    console.log('✅ 上传目录创建成功:', videoDir);
    console.log('✅ 源码目录创建成功:', codeDir);

    // 确保游戏根目录存在（保持原有逻辑）
    await fs.mkdir(GAMES_ROOT_PATH, { recursive: true });
    if (!isWindows) {
      await fs.chmod(GAMES_ROOT_PATH, 0o755);
    }

  } catch (error) {
    console.error('❌ 创建上传目录失败:', error.message);
  }
}

// 速率限制（针对代理环境优化）
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: {
    error: '请求过于频繁',
    message: '请稍后再试'
  },
  standardHeaders: true, // 返回速率限制信息到 `RateLimit-*` headers
  legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
  // 在代理环境下使用正确的IP识别
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});
app.use('/api/', limiter);

// 数据库连接配置 - 宝塔面板环境
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'dpccgaming', // 宝塔面板数据库用户名
  password: process.env.DB_PASSWORD || '', // 不再使用硬编码密码
  database: process.env.DB_NAME || 'dpccgaming',
  charset: 'utf8mb4'
};

// JWT密钥（开发环境未配置时使用临时随机值）
const JWT_SECRET = process.env.JWT_SECRET || `dev-${require('crypto').randomBytes(32).toString('hex')}`;

// 数据库连接池
let pool;

// 初始化数据库连接
async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);

    // 测试连接
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功');
    connection.release();
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  }
}

// 临时调试路由 - 修复游戏记录的code_package_url字段
app.get('/api/debug/fix-code-urls', authenticateToken, checkAdminPermission, async (req, res) => {
  try {
    console.log('🔧 开始修复游戏记录的 code_package_url 字段...');

    // 获取所有游戏记录
    const [games] = await pool.execute('SELECT game_id, code_package_url FROM games');

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const game of games) {
      const gameId = game.game_id;
      const codeZipPath = path.join(CODE_ROOT_PATH, `${gameId}.zip`);

      // 检查源码压缩包是否存在
      if (fsSync.existsSync(codeZipPath)) {
        const newCodePackageUrl = `/uploads/code/${gameId}.zip`;

        // 只有当当前记录为空或不相同时才更新
        if (!game.code_package_url || game.code_package_url !== newCodePackageUrl) {
          await pool.execute(
            'UPDATE games SET code_package_url = ? WHERE game_id = ?',
            [newCodePackageUrl, gameId]
          );
          console.log(`✅ 已更新游戏 ${gameId} 的 code_package_url`);
          updatedCount++;
        }
      } else {
        console.log(`⚠️ 游戏 ${gameId} 的源码压缩包不存在`);
        notFoundCount++;
      }
    }

    const result = {
      message: '修复完成',
      totalGames: games.length,
      updatedGames: updatedCount,
      notFound: notFoundCount,
      details: '已为所有存在源码压缩包的游戏记录更新 code_package_url 字段'
    };

    console.log('🔧 修复结果:', result);
    res.json(result);

  } catch (error) {
    console.error('❌ 修复 code_package_url 字段失败:', error);
    res.status(500).json({ error: '修复失败: ' + error.message });
  }
});

// 临时调试路由 - 显示数据库中的游戏记录
app.get('/api/debug/games', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ error: '数据库连接未初始化' });
    }

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
      games: games
    });

  } catch (error) {
    console.error('调试查询失败:', error);
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

// JWT中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: '访问令牌缺失',
      message: '请先登录后再进行操作'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT验证失败:', err.message);
      return res.status(403).json({
        error: '无效的访问令牌',
        message: '登录已过期，请重新登录'
      });
    }
    req.user = user;
    next();
  });
}

// API路由

// 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: '用户名至少需要3个字符' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6个字符' });
    }

    // 检查用户名是否已存在
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    // 加密密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, email, role, status) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, email || null, 'user', 'active']
    );

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: result.insertId, username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: result.insertId,
        username,
        email
      }
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 查找用户
    const [users] = await pool.execute(
      'SELECT id, username, password_hash, email FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取游戏列表
app.get('/api/games', async (req, res) => {
  try {
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
      // 检查源码是否存在 - 既检查压缩包也检查解压后的目录
      let codeExists = false;
      let codePackageUrl = null;

      try {
        const codeZipPath = path.join(CODE_ROOT_PATH, `${game.game_id}.zip`);
        const codeDir = path.join(CODE_ROOT_PATH, game.game_id);

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

        console.log(`🔍 检查游戏列表中游戏 ${game.game_id} 源码状态:`, {
          codeZipExists: zipExists,
          codeDirExists: dirExists,
          dirHasContent: dirHasContent,
          codeExists: codeExists,
          codePackageAvailable: !!codePackageUrl
        });

      } catch (codeCheckErr) {
        console.warn('⚠️ 游戏列表源码状态检查失败:', codeCheckErr.message);
        codeExists = false;
        codePackageUrl = null;
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
        code_package_url: codePackageUrl,
        code_exists: codeExists
      };
    });

    res.json({ games: formattedGames });
  } catch (error) {
    console.error('获取游戏列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个游戏详情
app.get('/api/games/:gameId', async (req, res) => {
  try {
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
      const codeZipPath = path.join(CODE_ROOT_PATH, `${game.game_id}.zip`);
      const codeDir = path.join(CODE_ROOT_PATH, game.game_id);

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
});

// 代码浏览：返回 uploads/code/<gameId> 下已上传源码的部分文件内容
app.get('/api/games/:gameId/code', authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const codeDir = path.join(CODE_ROOT_PATH, gameId);

    // coding 模式只读取 uploads/code 下解压的源码
    if (!fsSync.existsSync(codeDir) || !fsSync.lstatSync(codeDir).isDirectory()) {
      return res.status(404).json({ error: '源码尚未上传或目录不存在' });
    }

    const targetDir = codeDir;

    // 扫描与过滤
    const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss', '.less', '.html', '.json', '.md', '.c', '.cpp', '.h', '.cs', '.py']);
    const MAX_FILES = 60;
    const MAX_FILE_SIZE = 200 * 1024; // 200KB

    const files = [];
    async function walk(dir) {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (files.length >= MAX_FILES) return; // 控制数量
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          // 跳过庞大目录
          if (['node_modules', 'dist', 'build', '.git', '.output', '.cache'].includes(item.name)) continue;
          await walk(full);
        } else {
          const ext = path.extname(item.name).toLowerCase();
          if (!exts.has(ext)) continue;
          const rel = path.relative(targetDir, full).replace(/\\/g, '/');
          try {
            const stat = await fs.lstat(full);
            if (stat.size > MAX_FILE_SIZE) continue;
            const content = await fs.readFile(full, 'utf8');
            files.push({ path: rel, content });
          } catch (e) {
            // 忽略无法读取的文件
          }
        }
      }
    }
    await walk(targetDir);

    res.json({ files });
  } catch (error) {
    console.error('读取源码失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 源码下载：返回代码压缩包（优先已保存的 zip，否则现打包 uploads/code/<gameId>）
app.get('/api/games/:gameId/code.zip', authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const predefinedZip = path.join(CODE_ROOT_PATH, `${gameId}.zip`);
    if (fsSync.existsSync(predefinedZip)) {
      return res.sendFile(predefinedZip);
    }

    // 尝试现打包 _code 目录
    const codeDir = path.join(CODE_ROOT_PATH, gameId);
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
});

// 上传游戏
app.post('/api/games', authenticateToken, upload.fields([
  { name: 'gameFile', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'codeArchive', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, category, description, engine, codeType } = req.body;
    const userId = req.user.userId;
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
        const videoDir = path.join(uploadsPath, 'video');
        await fs.mkdir(videoDir, { recursive: true });
        if (!isWindows) {
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
    const gameDir = path.join(GAMES_ROOT_PATH, gameId);
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
        await fs.rm(path.join(CODE_ROOT_PATH, gameId), { recursive: true, force: true }).catch(() => { });
        await fs.unlink(gameFile.path);
        return res.status(400).json({ error: 'ZIP文件中未找到index.html文件' });
      }

      // 计算相对路径
      const relativePath = path.relative(GAMES_ROOT_PATH, indexHtmlPath);
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
              thumbnailUrl = `games/${path.relative(GAMES_ROOT_PATH, fullPath).replace(/\\/g, '/')}`;
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

          await fs.mkdir(CODE_ROOT_PATH, { recursive: true });
          const codeZipTarget = path.join(CODE_ROOT_PATH, `${gameId}.zip`);

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
          const codeExtractDir = path.join(CODE_ROOT_PATH, gameId);
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
      await fs.rm(path.join(CODE_ROOT_PATH, gameId), { recursive: true, force: true }).catch(() => { });
      await fs.unlink(gameFile.path);
      res.status(500).json({ error: '文件解压失败，请检查ZIP文件格式' });
    }

  } catch (error) {
    console.error('上传游戏错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员审核游戏
app.post('/api/admin/games/:gameId/review', authenticateToken, checkAdminPermission, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { status, reviewNotes } = req.body;
    const reviewerId = req.user.userId;

    // 验证状态
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效的审核状态' });
    }

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
});

// 获取待审核游戏列表（管理员用）
app.get('/api/admin/games/pending', authenticateToken, checkAdminPermission, async (req, res) => {
  try {
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
});

// 获取所有已审核游戏列表（管理员用）
app.get('/api/admin/games/all', authenticateToken, checkAdminPermission, async (req, res) => {
  try {
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
      const codeZipPath = path.join(CODE_ROOT_PATH, `${game.game_id}.zip`);
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
});

// 删除游戏（管理员用）
app.delete('/api/admin/games/:gameId/delete', authenticateToken, checkAdminPermission, async (req, res) => {
  try {
    const { gameId } = req.params;
    const adminId = req.user.userId;

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
        const gameDir = path.join(GAMES_ROOT_PATH, gameId);
        await fs.rm(gameDir, { recursive: true, force: true });
        await fs.rm(path.join(CODE_ROOT_PATH, gameId), { recursive: true, force: true }).catch(() => { });
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
});

// 获取游戏评论（包含回复）
app.get('/api/games/:gameId/comments', async (req, res) => {
  try {
    const { gameId } = req.params;

    // 获取主评论
    const [comments] = await pool.execute(`
      SELECT c.*, u.username 
      FROM comments c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.game_id = ? AND c.parent_id IS NULL
      ORDER BY c.created_at DESC
    `, [gameId]);

    // 为每个主评论获取回复
    for (let comment of comments) {
      const [replies] = await pool.execute(`
        SELECT c.*, u.username, ru.username as reply_to_username
        FROM comments c 
        JOIN users u ON c.user_id = u.id 
        LEFT JOIN users ru ON c.reply_to_user_id = ru.id
        WHERE c.parent_id = ?
        ORDER BY c.created_at ASC
      `, [comment.id]);

      comment.replies = replies;
    }

    res.json(comments);
  } catch (error) {
    console.error('获取评论错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 提交评论
app.post('/api/games/:gameId/comments', authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { rating, commentText } = req.body;
    const userId = req.user.userId;

    // 验证输入
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: '评分必须在1-5之间' });
    }

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

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
      [userId, gameId, rating, commentText.trim()]
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
});

// 回复评论
app.post('/api/games/:gameId/comments/:commentId/reply', authenticateToken, async (req, res) => {
  try {
    const { gameId, commentId } = req.params;
    const { commentText, replyToUserId } = req.body;
    const userId = req.user.userId;

    // 验证输入
    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: '回复内容不能为空' });
    }

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
      'SELECT id FROM comments WHERE id = ? AND game_id = ?',
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

    // 创建回复评论并获取新创建的回复ID
    const [result] = await pool.execute(
      'INSERT INTO comments (user_id, game_id, parent_id, reply_to_user_id, comment_text) VALUES (?, ?, ?, ?, ?)',
      [userId, gameId, commentId, replyToUserId || null, commentText.trim()]
    );

    const newReplyId = result.insertId;

    // 如果回复的是其他用户，创建通知
    if (replyToUserId && replyToUserId !== userId) {
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
          replyToUserId,
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
});

// 记录游戏被玩过
app.post('/api/games/:gameId/play', async (req, res) => {
  try {
    const { gameId } = req.params;

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
});

// 获取用户信息
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [users] = await pool.execute(
      'SELECT id, username, email, role, status, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员用户名白名单（请修改为您的用户名）
const ADMIN_USERS = [
  'admin',        // 默认管理员用户名
  'dpccgamingSunJiaHao',   // 您的用户名（请修改）
  'dpccgamingShenRuiYing'      // 其他管理员用户名
];

// 检查管理员权限的中间件（基于数据库角色）
async function checkAdminPermission(req, res, next) {
  try {
    const userId = req.user.userId;

    // 从数据库查询用户角色
    const [users] = await pool.execute(
      'SELECT role, status FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(403).json({
        error: '用户不存在',
        message: '用户信息无效'
      });
    }

    const user = users[0];

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(403).json({
        error: '账户已禁用',
        message: '您的账户已被禁用，无法访问管理功能'
      });
    }

    // 检查用户角色
    if (!['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({
        error: '权限不足',
        message: '只有管理员才能访问此功能'
      });
    }

    // 将用户角色信息添加到请求对象中
    req.user.role = user.role;
    req.user.status = user.status;

    next();
  } catch (error) {
    console.error('权限检查错误:', error);
    res.status(500).json({ error: '权限检查失败' });
  }
}

// 验证令牌
app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.userId,
      username: req.user.username
    }
  });
});

// 检查管理员权限
app.get('/api/admin/check-permission', authenticateToken, checkAdminPermission, (req, res) => {
  res.json({
    isAdmin: true,
    message: '管理员权限验证成功',
    user: {
      id: req.user.userId,
      username: req.user.username,
      role: req.user.role
    }
  });
});

// 管理员角色管理API
app.post('/api/admin/users/:userId/role', authenticateToken, checkAdminPermission, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminId = req.user.userId;

    // 验证角色
    if (!['user', 'admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ error: '无效的用户角色' });
    }

    // 检查目标用户是否存在
    const [users] = await pool.execute(
      'SELECT id, username FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 更新用户角色
    await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    );

    console.log(`管理员 ${adminId} 将用户 ${users[0].username} 的角色更改为 ${role}`);

    res.json({
      message: '用户角色更新成功',
      user: {
        id: userId,
        username: users[0].username,
        role: role
      }
    });

  } catch (error) {
    console.error('更新用户角色错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取所有用户列表（管理员用）
app.get('/api/admin/users', authenticateToken, checkAdminPermission, async (req, res) => {
  try {
    const [users] = await pool.execute(`
      SELECT 
        id, username, email, role, status, created_at,
        CASE 
          WHEN role = 'super_admin' THEN '超级管理员'
          WHEN role = 'admin' THEN '管理员'
          ELSE '普通用户'
        END as role_name,
        CASE 
          WHEN status = 'active' THEN '正常'
          WHEN status = 'inactive' THEN '未激活'
          ELSE '已禁用'
        END as status_name
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({ users });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户禁言/解禁（管理员用）
app.post('/api/admin/users/:userId/ban', authenticateToken, checkAdminPermission, async (req, res) => {
  try {
    const { userId } = req.params;
    const { action } = req.body; // 'ban' 或 'unban'
    const adminId = req.user.userId;

    // 验证操作类型
    if (!['ban', 'unban'].includes(action)) {
      return res.status(400).json({ error: '无效的操作类型' });
    }

    // 检查目标用户是否存在
    const [users] = await pool.execute(
      'SELECT id, username, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];

    // 防止管理员禁言自己
    if (userId == adminId) {
      return res.status(400).json({ error: '不能禁言自己' });
    }

    // 防止禁言其他管理员（除非是超级管理员）
    if (action === 'ban' && ['admin', 'super_admin'].includes(user.role)) {
      const [adminUser] = await pool.execute(
        'SELECT role FROM users WHERE id = ?',
        [adminId]
      );

      if (adminUser[0].role !== 'super_admin') {
        return res.status(403).json({ error: '只有超级管理员才能禁言其他管理员' });
      }
    }

    // 更新用户状态
    const newStatus = action === 'ban' ? 'banned' : 'active';
    await pool.execute(
      'UPDATE users SET status = ? WHERE id = ?',
      [newStatus, userId]
    );

    console.log(`管理员 ${adminId} ${action === 'ban' ? '禁言' : '解禁'}了用户 ${user.username} (${userId})`);

    res.json({
      message: `用户${action === 'ban' ? '禁言' : '解禁'}成功`,
      user: {
        id: userId,
        username: user.username,
        status: newStatus
      }
    });

  } catch (error) {
    console.error('用户禁言/解禁错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 彻底删除用户（管理员用）
app.delete('/api/admin/users/:userId/delete', authenticateToken, checkAdminPermission, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.userId;

    // 检查目标用户是否存在
    const [users] = await pool.execute(
      'SELECT id, username, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];

    // 防止删除自己
    if (userId == adminId) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    // 防止删除其他管理员（除非是超级管理员）
    if (['admin', 'super_admin'].includes(user.role)) {
      const [adminUser] = await pool.execute(
        'SELECT role FROM users WHERE id = ?',
        [adminId]
      );

      if (adminUser[0].role !== 'super_admin') {
        return res.status(403).json({ error: '只有超级管理员才能删除其他管理员' });
      }
    }

    // 开始事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 删除用户相关的评论
      await connection.execute(
        'DELETE FROM comments WHERE user_id = ?',
        [userId]
      );

      // 2. 删除用户相关的通知
      await connection.execute(
        'DELETE FROM notifications WHERE user_id = ?',
        [userId]
      );

      // 3. 删除用户上传的游戏（如果用户是游戏上传者）
      const [userGames] = await connection.execute(
        'SELECT game_id FROM games WHERE uploaded_by = ?',
        [userId]
      );

      // 删除用户上传的游戏文件
      for (const game of userGames) {
        try {
          const gameDir = path.join(GAMES_ROOT_PATH, game.game_id);
          await fs.rm(gameDir, { recursive: true, force: true });
          await fs.rm(path.join(CODE_ROOT_PATH, game.game_id), { recursive: true, force: true }).catch(() => { });
          console.log(`用户上传的游戏文件已删除: ${gameDir}`);
        } catch (fileError) {
          console.warn('删除游戏文件失败:', fileError.message);
        }
      }

      // 删除用户上传的游戏记录
      await connection.execute(
        'DELETE FROM games WHERE uploaded_by = ?',
        [userId]
      );

      // 4. 删除用户记录
      await connection.execute(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );

      // 提交事务
      await connection.commit();

      console.log(`管理员 ${adminId} 彻底删除了用户: ${user.username} (${userId})`);

      res.json({
        message: '用户删除成功',
        user: {
          id: userId,
          username: user.username
        }
      });

    } catch (error) {
      // 回滚事务
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 通知相关API
// 获取用户通知列表
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const offset = (page - 1) * limit

    const [notifications] = await pool.execute(`
      SELECT n.*, g.title as game_title
      FROM notifications n
      LEFT JOIN games g ON n.related_game_id = g.game_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.userId, parseInt(limit), parseInt(offset)])

    // 获取总数
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM notifications WHERE user_id = ?
    `, [req.user.userId])

    const total = countResult[0].total
    const hasMore = offset + notifications.length < total

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore
      }
    })
  } catch (error) {
    console.error('获取通知列表错误:', error)
    res.status(500).json({ error: '获取通知列表失败' })
  }
})

// 标记通知为已读
app.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    await pool.execute(`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = ? AND user_id = ?
    `, [id, req.user.userId])

    res.json({ message: '通知已标记为已读' })
  } catch (error) {
    console.error('标记通知已读错误:', error)
    res.status(500).json({ error: '标记通知已读失败' })
  }
})

// 全部标记为已读
app.post('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await pool.execute(`
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = ? AND is_read = false
    `, [req.user.userId])

    res.json({ message: '所有通知已标记为已读' })
  } catch (error) {
    console.error('全部标记已读错误:', error)
    res.status(500).json({ error: '全部标记已读失败' })
  }
})

// 创建通知的辅助函数
async function createNotification(userId, type, title, content, relatedGameId = null, relatedCommentId = null) {
  try {
    await pool.execute(`
      INSERT INTO notifications (user_id, type, title, content, related_game_id, related_comment_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, type, title, content, relatedGameId, relatedCommentId])
  } catch (error) {
    console.error('创建通知失败:', error)
  }
}

// 错误处理中间件
// 简易 AI 占位接口：回显问题，并结合上下文返回提示
app.post('/api/ai/code-assistant', async (req, res) => {
  try {
    const { prompt, selectedFile, files = [] } = req.body || {};
    const fileHint = selectedFile ? `针对文件 ${selectedFile}` : '针对当前项目';
    const fileList = Array.isArray(files) && files.length
      ? `（收到 ${files.length} 个文件索引）`
      : '';
    const answer = `已收到你的问题："${(prompt || '').toString().slice(0, 200)}"。${fileHint}${fileList}。\n\n暂未接入真实 AI 服务，此为占位回复。建议：\n- 明确期望行为与错误现象\n- 附上相关文件与关键代码片段\n- 指明引擎/框架版本，便于定位问题。`;
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ message: 'AI 服务暂不可用' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 启动服务器
async function startServer() {
  await initDatabase();
  await ensureUploadDir();

  app.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 API文档: http://localhost:${PORT}/api/`);
    console.log(`🎮 游戏平台: http://localhost:${PORT}/`);
  });
}

startServer().catch(console.error);
