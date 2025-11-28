// 应用配置
const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpccgaming',
    password: process.env.DB_PASSWORD || 'kWc77NmN74AeKymB',
    database: process.env.DB_NAME || 'dpccgaming',
    connectionLimit: 10
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: '24h'
  },

  // 文件路径配置
  paths: {
    uploads: process.env.UPLOADS_PATH || 'uploads',
    games: process.env.GAMES_ROOT_PATH || 'games',
    code: process.env.CODE_ROOT_PATH || 'uploads/code',
    temp: process.env.TEMP_PATH || 'temp'
  },

  // 文件上传配置
  upload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['.zip', '.rar', '.7z'],
    imageTypes: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  },

  // CORS配置
  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : [
        'http://localhost:8000',
        'http://127.0.0.1:8000',
        'http://localhost:3000',
        'https://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://dpccgaming.xyz',
        'https://dpccgaming.xyz'
      ]
  },

  // 管理员白名单
  admin: {
    whitelist: [
      'admin',
      'dpccgamingSunJiaHao',
      'dpccgamingShenRuiYing'
    ]
  },

  // 代码浏览配置
  codeBrowser: {
    maxFiles: 60,
    maxFileSize: 200 * 1024, // 200KB
    allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss', '.less', '.html', '.json', '.md', '.c', '.cpp', '.h', '.cs', '.py']
  }
};

module.exports = config;
