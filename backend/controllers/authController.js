const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');
const { generateToken } = require('../middleware/auth');

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

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: result.insertId,
        username,
        email: email || null
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

    const users = await executeQuery(
      'SELECT id, username, password_hash, email FROM users WHERE username = ?',
      [username]
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
}

async function getCurrentUser(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const users = await executeQuery(
      'SELECT id, username, email, role, status, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user: users[0] });
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

    const users = await executeQuery(
      'SELECT id, username, email, role, status, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('获取用户资料错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

function verifyTokenEndpoint(req, res) {
  res.json({
    valid: true,
    user: {
      id: req.user.userId,
      username: req.user.username
    }
  });
}

module.exports = {
  register,
  login,
  getCurrentUser,
  getUserProfile,
  verifyTokenEndpoint
};
