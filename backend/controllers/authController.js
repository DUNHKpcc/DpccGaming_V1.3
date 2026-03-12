const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const { executeQuery } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const appConfig = require('../config/app');

const AUTH_COOKIE_NAME = appConfig.jwt.cookieName || 'dpcc_auth_token';
const AUTH_COOKIE_MAX_AGE = Number(appConfig.jwt.cookieDays || 30) * 24 * 60 * 60 * 1000;
const isProduction = appConfig.server.nodeEnv === 'production';
const DEFAULT_AVATAR_URL = '/avatars/default-avatar.svg';

let avatarColumnAvailableCache = null;

async function isAvatarColumnAvailable() {
  if (avatarColumnAvailableCache !== null) {
    return avatarColumnAvailableCache;
  }

  try {
    const result = await executeQuery(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'avatar_url'`
    );
    avatarColumnAvailableCache = Number(result?.[0]?.count || 0) > 0;
  } catch (error) {
    console.warn('检查 avatar_url 字段失败，回退为无头像字段模式:', error.message);
    avatarColumnAvailableCache = false;
  }

  return avatarColumnAvailableCache;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    avatar_url: user.avatar_url || DEFAULT_AVATAR_URL
  };
}

async function fetchUserById(userId) {
  const hasAvatarColumn = await isAvatarColumnAvailable();
  const query = hasAvatarColumn
    ? 'SELECT id, username, email, role, status, created_at, COALESCE(avatar_url, ?) AS avatar_url FROM users WHERE id = ?'
    : 'SELECT id, username, email, role, status, created_at FROM users WHERE id = ?';
  const params = hasAvatarColumn ? [DEFAULT_AVATAR_URL, userId] : [userId];
  const users = await executeQuery(query, params);
  if (!users || users.length === 0) return null;
  return normalizeUser(users[0]);
}

async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
  }
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE
  });
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  });
}

async function register(req, res) {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: '用户名至少需要 3 个字符' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要 6 个字符' });
    }

    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await executeQuery(
      'INSERT INTO users (username, password_hash, email, role, status) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, email || null, 'user', 'active']
    );

    const token = generateToken({ id: result.insertId, username });
    setAuthCookie(res, token);
    const createdUser = await fetchUserById(result.insertId);

    res.status(201).json({
      message: '注册成功',
      token,
      user: createdUser || {
        id: result.insertId,
        username,
        email: email || null,
        avatar_url: DEFAULT_AVATAR_URL
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const hasAvatarColumn = await isAvatarColumnAvailable();
    const users = await executeQuery(
      hasAvatarColumn
        ? 'SELECT id, username, password_hash, email, COALESCE(avatar_url, ?) AS avatar_url FROM users WHERE username = ?'
        : 'SELECT id, username, password_hash, email FROM users WHERE username = ?',
      hasAvatarColumn ? [DEFAULT_AVATAR_URL, username] : [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.json({
      message: '登录成功',
      token,
      user: normalizeUser({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url
      })
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

async function getCurrentUser(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const user = await fetchUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

async function getUserProfile(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const user = await fetchUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(user);
  } catch (error) {
    console.error('获取用户资料错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

async function verifyTokenEndpoint(req, res) {
  try {
    const user = await fetchUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const token = generateToken({
      id: user.id,
      username: user.username
    });
    setAuthCookie(res, token);

    res.json({
      valid: true,
      token,
      user
    });
  } catch (error) {
    console.error('验证令牌错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

async function updateAvatar(req, res) {
  let uploadedFilePath = req.file?.path || null;

  try {
    if (!req.user) {
      await safeUnlink(uploadedFilePath);
      return res.status(401).json({ error: '未认证' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '请上传头像图片' });
    }

    const hasAvatarColumn = await isAvatarColumnAvailable();
    if (!hasAvatarColumn) {
      await safeUnlink(uploadedFilePath);
      return res.status(500).json({ error: '数据库缺少 avatar_url 字段，请先执行更新脚本' });
    }

    const users = await executeQuery(
      'SELECT id, avatar_url FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (!users || users.length === 0) {
      await safeUnlink(uploadedFilePath);
      return res.status(404).json({ error: '用户不存在' });
    }

    const previousAvatarUrl = users[0].avatar_url || DEFAULT_AVATAR_URL;
    const newAvatarUrl = `/uploads/avatars/${req.file.filename}`;

    await executeQuery(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [newAvatarUrl, req.user.userId]
    );

    const uploadsRoot = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
    const isCustomPreviousAvatar =
      previousAvatarUrl &&
      previousAvatarUrl.startsWith('/uploads/avatars/') &&
      previousAvatarUrl !== DEFAULT_AVATAR_URL;

    if (isCustomPreviousAvatar) {
      const previousFilename = path.basename(previousAvatarUrl);
      if (previousFilename && previousFilename !== req.file.filename) {
        const previousAvatarPath = path.join(uploadsRoot, 'avatars', previousFilename);
        await safeUnlink(previousAvatarPath);
      }
    }

    const user = await fetchUserById(req.user.userId);
    uploadedFilePath = null;

    res.json({
      message: '头像更新成功',
      user: user || {
        id: req.user.userId,
        username: req.user.username,
        avatar_url: newAvatarUrl
      }
    });
  } catch (error) {
    console.error('更新头像错误:', error);
    await safeUnlink(uploadedFilePath);
    res.status(500).json({ error: '头像上传失败' });
  }
}

function logout(req, res) {
  clearAuthCookie(res);
  res.json({ message: '退出登录成功' });
}

module.exports = {
  register,
  login,
  getCurrentUser,
  getUserProfile,
  verifyTokenEndpoint,
  updateAvatar,
  logout
};
