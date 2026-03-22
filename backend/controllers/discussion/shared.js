const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const {
  getPool,
  beginTransaction,
  commitTransaction,
  rollbackTransaction
} = require('../../config/database');
const {
  emitRoomMessage,
  emitRoomDocumentsEvent,
  emitRoomTasksEvent,
  emitRoomSettingsEvent
} = require('../../utils/discussionRealtime');
const { createNotification } = require('../../utils/notification');

const MAX_ROOM_MEMBERS = 4;
const DEFAULT_MODEL = 'doubao-seed-1-6-251015';
const DEFAULT_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const FRIEND_INVITE_MIN_MINUTES = 5;
const FRIEND_INVITE_MAX_MINUTES = 7 * 24 * 60;
const FRIEND_INVITE_DEFAULT_MINUTES = 60;
const UPLOADS_ROOT = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');

let friendInviteLinksTableReady = false;
let friendInviteLinksTableInitPromise = null;
let roomDocumentsTableReady = false;
let roomDocumentsTableInitPromise = null;
let roomDocumentStateTableReady = false;
let roomDocumentStateTableInitPromise = null;
let roomTasksTableReady = false;
let roomTasksTableInitPromise = null;
let roomSettingsTableReady = false;
let roomSettingsTableInitPromise = null;

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseDocumentSource = (rawSource) => {
  const value = String(rawSource || '').trim().toLowerCase();
  if (value === 'official') return 'official';
  return 'upload';
};

const parseTaskStatus = (rawStatus) => {
  const value = String(rawStatus || '').trim().toLowerCase();
  if (['pending', 'in_progress', 'completed'].includes(value)) return value;
  return 'pending';
};

const parseTaskPriority = (rawPriority) => {
  const value = String(rawPriority || '').trim().toLowerCase();
  if (['normal', 'urgent'].includes(value)) return value;
  return 'normal';
};

const normalizeOptionalTaskText = (value, maxLength = 255) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : null;
};

const buildUploadedFileUrl = (uploadedPath, fallbackPath = '') => {
  const relativePath = path.relative(UPLOADS_ROOT, uploadedPath || '')
    .split(path.sep)
    .join('/');
  if (relativePath && !relativePath.startsWith('..')) {
    return `/uploads/${relativePath}`;
  }
  return fallbackPath ? `/uploads/${fallbackPath}` : '';
};

const resolveUploadedFilePath = (fileUrl = '') => {
  const normalized = String(fileUrl || '').trim();
  if (!normalized.startsWith('/uploads/')) return '';
  const relativePath = normalized.replace(/^\/uploads\//, '');
  return path.join(UPLOADS_ROOT, ...relativePath.split('/'));
};

const inferDocumentPageCount = (fileName = '') => {
  const lowerName = String(fileName || '').toLowerCase();
  if (!lowerName.endsWith('.pdf')) return null;
  return 12;
};

const loadDocumentPreviewText = async (uploadedPath, fileName = '', mimeType = '') => {
  const lowerName = String(fileName || '').toLowerCase();
  const lowerMime = String(mimeType || '').toLowerCase();
  const canReadAsText = lowerName.endsWith('.md')
    || lowerName.endsWith('.txt')
    || lowerMime.startsWith('text/');

  if (!canReadAsText || !uploadedPath) return '';

  try {
    const raw = await fs.readFile(uploadedPath, 'utf8');
    return String(raw || '')
      .replace(/\r/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 380);
  } catch {
    return '';
  }
};

const sanitizeMessageMetadata = (rawMetadata) => {
  if (!rawMetadata || typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    return null;
  }

  const next = {};
  const rawCodePreview = rawMetadata.code_preview;
  if (rawCodePreview && typeof rawCodePreview === 'object' && !Array.isArray(rawCodePreview)) {
    const pathValue = String(rawCodePreview.path || '').trim().slice(0, 320);
    const snippetValue = String(rawCodePreview.snippet || '')
      .replace(/\r/g, '')
      .slice(0, 2200);

    if (pathValue && snippetValue) {
      const codePreview = {
        path: pathValue,
        snippet: snippetValue
      };

      const language = String(rawCodePreview.language || '').trim().slice(0, 40);
      if (language) codePreview.language = language;

      const totalLines = toInt(rawCodePreview.total_lines);
      if (totalLines && totalLines > 0) codePreview.total_lines = totalLines;

      next.code_preview = codePreview;
    }
  }

  const rawDocumentPreview = rawMetadata.document_preview;
  if (rawDocumentPreview && typeof rawDocumentPreview === 'object' && !Array.isArray(rawDocumentPreview)) {
    const documentId = toInt(rawDocumentPreview.document_id);
    const nameValue = String(rawDocumentPreview.name || '').trim().slice(0, 255);
    const previewTextValue = String(rawDocumentPreview.preview_text || '')
      .replace(/\r/g, '')
      .trim()
      .slice(0, 600);

    if (documentId && nameValue) {
      const documentPreview = {
        document_id: documentId,
        name: nameValue
      };

      if (previewTextValue) documentPreview.preview_text = previewTextValue;

      const pageCount = toInt(rawDocumentPreview.page_count);
      if (pageCount && pageCount > 0) documentPreview.page_count = pageCount;

      const mimeType = String(rawDocumentPreview.mime_type || '').trim().slice(0, 120);
      if (mimeType) documentPreview.mime_type = mimeType;

      next.document_preview = documentPreview;
    }
  }

  return Object.keys(next).length ? next : null;
};

const buildRoomCode = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const createUniqueRoomCode = async (connection, retries = 8) => {
  for (let i = 0; i < retries; i += 1) {
    const code = buildRoomCode(6);
    const [rows] = await connection.execute(
      'SELECT id FROM discussion_rooms WHERE room_code = ? LIMIT 1',
      [code]
    );
    if (!rows.length) return code;
  }
  return null;
};

const getGameBasic = async (connection, gameId) => {
  const [games] = await connection.execute(
    `SELECT game_id, title, status
     FROM games
     WHERE game_id = ?
     LIMIT 1`,
    [gameId]
  );
  return games[0] || null;
};

const getRoomByIdForUpdate = async (connection, roomId) => {
  const [rows] = await connection.execute(
    `SELECT *
     FROM discussion_rooms
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [roomId]
  );
  return rows[0] || null;
};

const getJoinedMemberCount = async (connection, roomId) => {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count
     FROM discussion_room_members
     WHERE room_id = ? AND status = 'joined'`,
    [roomId]
  );
  return Number(rows[0]?.count || 0);
};

const getJoinedMember = async (connection, roomId, userId, forUpdate = false) => {
  const sql = `
    SELECT *
    FROM discussion_room_members
    WHERE room_id = ? AND user_id = ?
    LIMIT 1
    ${forUpdate ? 'FOR UPDATE' : ''}
  `;
  const [rows] = await connection.execute(sql, [roomId, userId]);
  return rows[0] || null;
};

const getRoomPayload = async (connection, roomId, currentUserId = null) => {
  await ensureRoomSettingsTable(connection);
  const [rooms] = await connection.execute(
    `SELECT r.*,
            g.title AS game_title,
            g.thumbnail_url AS game_thumbnail,
            rs.settings_json AS room_settings_json,
            rs.updated_by_user_id AS room_settings_updated_by_user_id,
            rs.updated_at AS room_settings_updated_at
     FROM discussion_rooms r
     JOIN games g ON g.game_id = r.game_id
     LEFT JOIN discussion_room_settings rs ON rs.room_id = r.id
     WHERE r.id = ?
     LIMIT 1`,
    [roomId]
  );

  if (!rooms.length) return null;

  const [members] = await connection.execute(
    `SELECT m.user_id, m.role, m.status, m.join_source, m.joined_at, m.left_at, u.username
     FROM discussion_room_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.room_id = ?
     ORDER BY m.joined_at ASC`,
    [roomId]
  );

  const joinedCount = members.filter((member) => member.status === 'joined').length;
  const amIMember = currentUserId
    ? members.some((member) => member.user_id === currentUserId && member.status === 'joined')
    : false;

  return {
    ...rooms[0],
    joined_count: joinedCount,
    am_i_member: amIMember,
    members
  };
};

const generateAiReply = async ({ prompt, gameTitle, roomMessages }) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return 'AI 机器人暂未配置 ARK_API_KEY，当前先由系统占位回复。请配置后启用真实 AI 对话。';
  }

  const contextText = roomMessages
    .map((msg) => `[${msg.sender_type}] ${msg.content}`)
    .join('\n')
    .slice(-4000);

  const payload = {
    model: process.env.ARK_MODEL_ID || DEFAULT_MODEL,
    max_completion_tokens: Number(process.env.ARK_MAX_TOKENS) || 1200,
    reasoning_effort: process.env.ARK_REASONING_LEVEL || 'medium',
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: '你是 DpccGaming 讨论房间内的 AI 制作顾问。请围绕当前游戏制作流程给出结构化、可执行的建议。'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `当前讨论游戏：${gameTitle}\n\n最近讨论内容：\n${contextText}\n\n用户新问题：\n${prompt}`
          }
        ]
      }
    ]
  };

  const response = await fetch(process.env.ARK_API_URL || DEFAULT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `AI 调用失败，状态码 ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return 'AI 未返回有效内容，请稍后重试。';

  if (Array.isArray(content)) {
    return content
      .filter((item) => item?.type === 'text' && item?.text)
      .map((item) => item.text.trim())
      .join('\n\n')
      .trim() || 'AI 未返回有效文本内容。';
  }

  return String(content).trim();
};

const getRoomNotificationContext = async (pool, roomId) => {
  const [rows] = await pool.execute(
    `SELECT r.id, r.title, r.game_id, g.title AS game_title
     FROM discussion_rooms r
     JOIN games g ON g.game_id = r.game_id
     WHERE r.id = ?
     LIMIT 1`,
    [roomId]
  );
  return rows[0] || null;
};

const notifyRoomMembers = async ({
  pool,
  roomId,
  excludeUserId,
  senderLabel,
  messageContent
}) => {
  const roomContext = await getRoomNotificationContext(pool, roomId);
  if (!roomContext) return;

  const [members] = await pool.execute(
    `SELECT user_id
     FROM discussion_room_members
     WHERE room_id = ? AND status = 'joined'`,
    [roomId]
  );

  const roomName = roomContext.title?.trim() || `${roomContext.game_title || '未命名游戏'} 讨论房`;
  const preview = String(messageContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const content = `[discussion-room:${roomId}] ${senderLabel} 在「${roomName}」发送了新消息：${preview || '（空消息）'}`;

  for (const member of members) {
    const memberUserId = Number(member.user_id);
    if (!memberUserId) continue;
    if (excludeUserId && memberUserId === excludeUserId) continue;

    await createNotification(
      memberUserId,
      'comment_reply',
      '讨论新消息',
      content,
      roomContext.game_id,
      null
    );
  }
};

const removeUploadedFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
};

const ensureFriendInviteLinksTable = async (pool) => {
  if (friendInviteLinksTableReady) return;

  if (friendInviteLinksTableInitPromise) {
    await friendInviteLinksTableInitPromise;
    return;
  }

  friendInviteLinksTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS friend_invite_links (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      link_code VARCHAR(96) NOT NULL,
      creator_user_id INT NOT NULL,
      expires_at DATETIME NOT NULL,
      status ENUM('active', 'used', 'expired', 'revoked') NOT NULL DEFAULT 'active',
      used_by_user_id INT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_friend_invite_links_code (link_code),
      KEY idx_friend_invite_links_creator_status (creator_user_id, status),
      KEY idx_friend_invite_links_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await friendInviteLinksTableInitPromise;
    friendInviteLinksTableReady = true;
  } finally {
    friendInviteLinksTableInitPromise = null;
  }
};

const ensureRoomDocumentsTable = async (pool) => {
  if (roomDocumentsTableReady) return;

  if (roomDocumentsTableInitPromise) {
    await roomDocumentsTableInitPromise;
    return;
  }

  roomDocumentsTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS discussion_room_documents (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      room_id BIGINT NOT NULL,
      uploader_user_id INT NOT NULL,
      source ENUM('upload', 'official') NOT NULL DEFAULT 'upload',
      file_name VARCHAR(255) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
      mime_type VARCHAR(120) NOT NULL DEFAULT '',
      page_count INT NULL,
      preview_text TEXT NULL,
      status ENUM('uploaded', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'uploaded',
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_discussion_room_documents_room_uploaded (room_id, uploaded_at),
      KEY idx_discussion_room_documents_uploader (uploader_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await roomDocumentsTableInitPromise;
    roomDocumentsTableReady = true;
  } finally {
    roomDocumentsTableInitPromise = null;
  }
};

const ensureRoomDocumentStateTable = async (pool) => {
  if (roomDocumentStateTableReady) return;

  if (roomDocumentStateTableInitPromise) {
    await roomDocumentStateTableInitPromise;
    return;
  }

  roomDocumentStateTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS discussion_room_document_state (
      room_id BIGINT NOT NULL PRIMARY KEY,
      selected_document_id BIGINT NULL,
      updated_by_user_id INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_discussion_room_document_state_selected (selected_document_id),
      KEY idx_discussion_room_document_state_updated_by (updated_by_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await roomDocumentStateTableInitPromise;
    roomDocumentStateTableReady = true;
  } finally {
    roomDocumentStateTableInitPromise = null;
  }
};

const ensureRoomTasksTable = async (pool) => {
  if (roomTasksTableReady) return;

  if (roomTasksTableInitPromise) {
    await roomTasksTableInitPromise;
    return;
  }

  roomTasksTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS discussion_room_tasks (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      room_id BIGINT NOT NULL,
      creator_user_id INT NOT NULL,
      title VARCHAR(160) NOT NULL,
      description TEXT NULL,
      status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
      priority ENUM('normal', 'urgent') NOT NULL DEFAULT 'normal',
      deadline_label VARCHAR(120) NULL,
      completed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_discussion_room_tasks_room_updated (room_id, updated_at),
      KEY idx_discussion_room_tasks_status (room_id, status),
      KEY idx_discussion_room_tasks_creator (creator_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await roomTasksTableInitPromise;
    roomTasksTableReady = true;
  } finally {
    roomTasksTableInitPromise = null;
  }
};

async function ensureRoomSettingsTable(pool) {
  if (roomSettingsTableReady) return;

  if (roomSettingsTableInitPromise) {
    await roomSettingsTableInitPromise;
    return;
  }

  roomSettingsTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS discussion_room_settings (
      room_id BIGINT NOT NULL PRIMARY KEY,
      settings_json LONGTEXT NOT NULL,
      updated_by_user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_discussion_room_settings_updated_by (updated_by_user_id),
      KEY idx_discussion_room_settings_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await roomSettingsTableInitPromise;
    roomSettingsTableReady = true;
  } finally {
    roomSettingsTableInitPromise = null;
  }
}

const mapRoomTaskRow = (row = {}) => ({
  id: row.id,
  room_id: row.room_id,
  creator_user_id: row.creator_user_id,
  creator_name: row.creator_name || '',
  title: row.title || '',
  description: row.description || '',
  status: parseTaskStatus(row.status),
  priority: parseTaskPriority(row.priority),
  deadline_label: row.deadline_label || '',
  completed_at: row.completed_at || null,
  created_at: row.created_at || null,
  updated_at: row.updated_at || null
});

const generateFriendInviteCode = () => crypto.randomBytes(16).toString('hex');

const parseInviteCode = (rawValue) => {
  const text = String(rawValue || '').trim();
  if (!text) return '';

  const validCode = (value) => {
    const cleaned = String(value || '').trim();
    return /^[A-Za-z0-9_-]{8,96}$/.test(cleaned) ? cleaned : '';
  };

  const directCode = validCode(text);
  if (directCode) return directCode;

  try {
    const url = new URL(text);
    return (
      validCode(url.searchParams.get('friendInvite'))
      || validCode(url.searchParams.get('invite'))
      || validCode(url.searchParams.get('code'))
      || ''
    );
  } catch {
    return '';
  }
};

const getFriendInviteLinkBase = (req) => {
  const fromEnv = String(process.env.APP_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;

  const fromOrigin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (fromOrigin) return fromOrigin;

  return '';
};

module.exports = {
  MAX_ROOM_MEMBERS,
  FRIEND_INVITE_MIN_MINUTES,
  FRIEND_INVITE_MAX_MINUTES,
  FRIEND_INVITE_DEFAULT_MINUTES,
  getPool,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  emitRoomMessage,
  emitRoomDocumentsEvent,
  emitRoomTasksEvent,
  emitRoomSettingsEvent,
  createNotification,
  toInt,
  parseDocumentSource,
  parseTaskStatus,
  parseTaskPriority,
  normalizeOptionalTaskText,
  buildUploadedFileUrl,
  resolveUploadedFilePath,
  inferDocumentPageCount,
  loadDocumentPreviewText,
  sanitizeMessageMetadata,
  createUniqueRoomCode,
  getGameBasic,
  getRoomByIdForUpdate,
  getJoinedMemberCount,
  getJoinedMember,
  getRoomPayload,
  generateAiReply,
  notifyRoomMembers,
  removeUploadedFile,
  ensureFriendInviteLinksTable,
  ensureRoomDocumentsTable,
  ensureRoomDocumentStateTable,
  ensureRoomTasksTable,
  ensureRoomSettingsTable,
  mapRoomTaskRow,
  generateFriendInviteCode,
  parseInviteCode,
  getFriendInviteLinkBase
};
