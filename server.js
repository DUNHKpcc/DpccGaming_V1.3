try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not available, using default configuration');
}

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const appConfig = require('./backend/config/app');
const { initDatabase } = require('./backend/config/database');
const { errorHandler } = require('./backend/middleware/auth');

const authRoutes = require('./backend/routes/auth');
const gameRoutes = require('./backend/routes/games');
const adminRoutes = require('./backend/routes/admin');
const commentRoutes = require('./backend/routes/comments');
const notificationRoutes = require('./backend/routes/notifications');
const aiRoutes = require('./backend/routes/ai');
const debugRoutes = require('./backend/routes/debug');
const cookieRoutes = require('./backend/routes/cookies');

const app = express();

const isWindows = process.platform === 'win32';
console.log('🔍 环境检测:', isWindows ? 'Windows开发环境' : 'Linux生产环境');

app.set('trust proxy', true);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: '请求过于频繁，请稍后再试',
  keyGenerator: (req) => {
    if (isWindows) {
      return req.ip || req.connection.remoteAddress;
    }
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection.remoteAddress;
  }
});

const uploadsPath = isWindows
  ? path.join(__dirname, 'uploads')
  : '/www/wwwroot/dpccgaming.xyz/uploads';

const gamesPath = isWindows
  ? path.join(__dirname, 'games')
  : path.join('/www', 'wwwroot', 'dpccgaming.xyz', 'games');

const codePath = path.join(uploadsPath, 'code');

process.env.UPLOADS_PATH = process.env.UPLOADS_PATH || uploadsPath;
process.env.GAMES_ROOT_PATH = process.env.GAMES_ROOT_PATH || gamesPath;
process.env.CODE_ROOT_PATH = process.env.CODE_ROOT_PATH || codePath;

console.log('Upload root:', process.env.UPLOADS_PATH);
console.log('Games root:', process.env.GAMES_ROOT_PATH);
console.log('Code root:', process.env.CODE_ROOT_PATH);

app.use(cors({
  origin: appConfig.cors.origins,
  credentials: true
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(process.env.UPLOADS_PATH));
app.use('/games', express.static(process.env.GAMES_ROOT_PATH));

app.use('/api/', generalLimiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: isWindows ? 'Windows开发环境' : 'Linux生产环境'
  });
});

console.log('注册API路由...');

app.use('/api', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/cookies', cookieRoutes);

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({ message: '请求的资源未找到' });
});

async function startServer() {
  try {
    console.log('初始化数据库连接...');
    await initDatabase();
    console.log('数据库连接初始化成功');

    const server = app.listen(appConfig.server.port, () => {
      const port = appConfig.server.port;

      console.log('\nDpccGaming服务器启动成功');
      console.log('='.repeat(50));
      console.log(`服务器地址: http://localhost:${port}`);
      console.log(`环境模式: ${appConfig.server.nodeEnv}`);
      console.log(`操作系统: ${isWindows ? 'Windows开发环境' : 'Linux生产环境'}`);
      console.log(`文件上传目录: ${process.env.UPLOADS_PATH}`);
      console.log(`游戏文件目录: ${process.env.GAMES_ROOT_PATH}`);
      console.log(`源码目录: ${process.env.CODE_ROOT_PATH}`);
      console.log('='.repeat(50));
      console.log('已注册的路由:');
      console.log('   - /api/login, /api/register, /api/verify-token (用户认证)');
      console.log('   - /api/games/* (游戏管理与上传)');
      console.log('   - /api/games/:id/comments (评论系统)');
      console.log('   - /api/notifications/* (通知系统)');
      console.log('   - /api/ai/* (AI助手)');
      console.log('   - /api/admin/* (管理员功能)');
      console.log('   - /api/debug/* (调试工具)');
      console.log('   - /uploads/* (静态文件)');
      console.log('   - /games/* (游戏文件)');
      console.log('='.repeat(50));
    });

    process.on('SIGTERM', () => {
      console.log('收到SIGTERM信号，正在关闭服务器...');
      server.close(() => {
        console.log('服务器已安全关闭');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('收到SIGINT信号，正在关闭服务器...');
      server.close(() => {
        console.log('服务器已安全关闭');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
