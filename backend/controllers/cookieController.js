const { randomUUID } = require('crypto');
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const VALID_STATUSES = ['accepted', 'rejected', 'customized'];
const defaultPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  functional: false,
  theme: 'dark'
};

const normalizeTheme = (value) => (value === 'light' ? 'light' : 'dark');

const sanitizePreferences = (preferences = {}) => {
  const normalized = { ...defaultPreferences };
  Object.entries(preferences || {}).forEach(([key, value]) => {
    if (key === 'theme') {
      normalized.theme = normalizeTheme(value);
    } else {
      normalized[key] = Boolean(value);
    }
  });
  normalized.necessary = true;
  return normalized;
};

const extractUserId = (headers = {}) => {
  try {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return null;
    }

    const payload = verifyToken(token);
    return payload?.userId || null;
  } catch (error) {
    console.warn('验证 cookie 同意记录中的 token 失败，已忽略用户 ID：', error.message);
    return null;
  }
};

const recordCookieConsent = async (req, res) => {
  try {
    const { consentStatus, preferences = {}, cookieId } = req.body || {};
    if (!consentStatus || !VALID_STATUSES.includes(consentStatus)) {
      return res.status(400).json({ error: '无效的 Cookie 同意状态' });
    }

    const normalizedPreferences = sanitizePreferences(preferences);
    const pool = getPool();
    const idForRecord = cookieId || randomUUID();
    const ipAddress = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null;
    const userAgent = req.headers['user-agent'] ? req.headers['user-agent'].slice(0, 255) : null;
    const userId = extractUserId(req.headers);

    const [existing] = await pool.execute(
      'SELECT id FROM cookie_consents WHERE cookie_id = ? LIMIT 1',
      [idForRecord]
    );

    const payload = [
      consentStatus,
      JSON.stringify(normalizedPreferences),
      userId,
      ipAddress,
      userAgent,
      idForRecord
    ];

    if (existing.length > 0) {
      await pool.execute(
        `UPDATE cookie_consents
         SET consent_status = ?, preferences = ?, user_id = ?, ip_address = ?, user_agent = ?
         WHERE cookie_id = ?`,
        payload
      );
    } else {
      await pool.execute(
        `INSERT INTO cookie_consents
          (consent_status, preferences, user_id, ip_address, user_agent, cookie_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        payload
      );
    }

    res.json({
      cookieId: idForRecord,
      consentStatus,
      preferences: normalizedPreferences,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('记录 Cookie 同意信息失败:', error);
    res.status(500).json({ error: '无法保存 Cookie 同意信息' });
  }
};

module.exports = {
  recordCookieConsent
};
