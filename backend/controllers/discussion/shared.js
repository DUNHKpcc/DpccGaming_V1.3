const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const AdmZip = require('adm-zip');
const appConfig = require('../../config/app');
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
  emitRoomSettingsEvent,
  emitRoomSettingsEventToUser,
  emitRoomHistoryClearedEventToUser,
  emitRoomMemoryEvent,
  emitRoomAiProgressEvent
} = require('../../utils/discussionRealtime');
const { createNotification } = require('../../utils/notification');
const {
  AI_REPLY_CHAR_LIMIT,
  AI_PROGRESS_STAGES,
  toInt,
  parseJsonObject,
  safeText,
  safeLongText,
  normalizeCodePath,
  acquireRoomAiExecutionLock,
  releaseRoomAiExecutionLock,
  isRoomAiExecutionLocked,
  estimateTokenCount,
  clampAiReplyContent,
  parseDocumentSource,
  parseTaskStatus,
  parseTaskPriority,
  normalizeOptionalTaskText
} = require('./shared/core');
const {
  buildAiSenderLabel,
  describeMessageForMemory,
  generateAiReply,
  createRequestRoomAiReplyBySlot
} = require('./shared/ai');
const { createRoomMemoryToolkit } = require('./shared/memory');

const MAX_ROOM_MEMBERS = 4;
const FRIEND_INVITE_MIN_MINUTES = 5;
const FRIEND_INVITE_MAX_MINUTES = 7 * 24 * 60;
const FRIEND_INVITE_DEFAULT_MINUTES = 60;
const UPLOADS_ROOT = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
const CODE_BROWSE_EXTS = new Set(appConfig.codeBrowser?.allowedExtensions || ['.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss', '.less', '.html', '.json', '.md', '.c', '.cpp', '.h', '.cs', '.py']);
const CODE_BROWSE_MAX_FILES = Number(appConfig.codeBrowser?.maxFiles || 60);
const CODE_BROWSE_MAX_FILE_SIZE = Number(appConfig.codeBrowser?.maxFileSize || (200 * 1024));
const CODE_BROWSE_SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.output', '.cache']);
const ROOM_MEMORY_CODE_LIMIT = 8;
const ROOM_MEMORY_DOCUMENT_LIMIT = 6;
const ROOM_MEMORY_CONTEXT_LIMIT = 4;
const ROOM_MEMORY_FILE_MAX_LENGTH = 6000;

let friendInviteLinksTableReady = false;
let friendInviteLinksTableInitPromise = null;
let roomInviteLinksTableReady = false;
let roomInviteLinksTableInitPromise = null;
let roomDocumentsTableReady = false;
let roomDocumentsTableInitPromise = null;
let roomDocumentStateTableReady = false;
let roomDocumentStateTableInitPromise = null;
let roomTasksTableReady = false;
let roomTasksTableInitPromise = null;
let roomSettingsTableReady = false;
let roomSettingsTableInitPromise = null;
let roomMemberPreferencesTableReady = false;
let roomMemberPreferencesTableInitPromise = null;
let roomSummaryTableReady = false;
let roomSummaryTableInitPromise = null;
let roomMemoryTableReady = false;
let roomMemoryTableInitPromise = null;

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

const loadDocumentFullText = async (uploadedPath, fileName = '', mimeType = '', fallbackPreview = '') => {
  const lowerName = String(fileName || '').toLowerCase();
  const lowerMime = String(mimeType || '').toLowerCase();
  const canReadAsText = lowerName.endsWith('.md')
    || lowerName.endsWith('.txt')
    || lowerMime.startsWith('text/');

  if (canReadAsText && uploadedPath) {
    try {
      const raw = await fs.readFile(uploadedPath, 'utf8');
      const normalized = String(raw || '').replace(/\r/g, '').trim();
      if (normalized) return normalized.slice(0, ROOM_MEMORY_FILE_MAX_LENGTH);
    } catch {
      // ignore and fallback
    }
  }

  return safeLongText(fallbackPreview || '当前文档暂不可提取全文，已回退为预览内容。', ROOM_MEMORY_FILE_MAX_LENGTH);
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

      const gameId = safeText(rawCodePreview.game_id || rawCodePreview.gameId || '', 120);
      if (gameId) codePreview.game_id = gameId;

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

const normalizeRoomMemberPreferences = (rawPreferences = {}) => ({
  customNickname: safeText(rawPreferences.customNickname || rawPreferences.custom_nickname || '', 40),
  clearedBeforeMessageId: Math.max(0, Number(
    rawPreferences.clearedBeforeMessageId
      ?? rawPreferences.cleared_before_message_id
      ?? 0
  ) || 0),
  clearedAt: rawPreferences.clearedAt || rawPreferences.cleared_at || null
});

const getRoomMemberPreferences = async (connection, roomId, userId) => {
  await ensureRoomMemberPreferencesTable(connection);
  const [rows] = await connection.execute(
    `SELECT room_id, user_id, custom_nickname, cleared_before_message_id, cleared_at, updated_at
     FROM discussion_room_member_preferences
     WHERE room_id = ? AND user_id = ?
     LIMIT 1`,
    [roomId, userId]
  );
  return normalizeRoomMemberPreferences(rows[0] || {});
};

const saveRoomMemberPreferences = async (connection, roomId, userId, rawPreferences = {}) => {
  const existingPreferences = await getRoomMemberPreferences(connection, roomId, userId);
  const sanitizedPreferences = {};
  if (Object.prototype.hasOwnProperty.call(rawPreferences, 'customNickname')) {
    sanitizedPreferences.customNickname = rawPreferences.customNickname;
  }
  if (Object.prototype.hasOwnProperty.call(rawPreferences, 'custom_nickname')) {
    sanitizedPreferences.custom_nickname = rawPreferences.custom_nickname;
  }
  if (Object.prototype.hasOwnProperty.call(rawPreferences, 'clearedBeforeMessageId')) {
    sanitizedPreferences.clearedBeforeMessageId = rawPreferences.clearedBeforeMessageId;
  }
  if (Object.prototype.hasOwnProperty.call(rawPreferences, 'cleared_before_message_id')) {
    sanitizedPreferences.cleared_before_message_id = rawPreferences.cleared_before_message_id;
  }
  if (Object.prototype.hasOwnProperty.call(rawPreferences, 'clearedAt')) {
    sanitizedPreferences.clearedAt = rawPreferences.clearedAt;
  }
  if (Object.prototype.hasOwnProperty.call(rawPreferences, 'cleared_at')) {
    sanitizedPreferences.cleared_at = rawPreferences.cleared_at;
  }
  const mergedPreferences = normalizeRoomMemberPreferences({
    ...existingPreferences,
    ...sanitizedPreferences
  });

  await connection.execute(
    `INSERT INTO discussion_room_member_preferences
     (room_id, user_id, custom_nickname, cleared_before_message_id, cleared_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       custom_nickname = VALUES(custom_nickname),
       cleared_before_message_id = VALUES(cleared_before_message_id),
       cleared_at = VALUES(cleared_at),
       updated_at = CURRENT_TIMESTAMP`,
    [
      roomId,
      userId,
      mergedPreferences.customNickname,
      mergedPreferences.clearedBeforeMessageId,
      mergedPreferences.clearedAt || null
    ]
  );

  return mergedPreferences;
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
    `SELECT m.user_id, m.role, m.status, m.join_source, m.joined_at, m.left_at,
            u.username, u.avatar_url,
            mp.custom_nickname AS member_custom_nickname
     FROM discussion_room_members m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN discussion_room_member_preferences mp
       ON mp.room_id = m.room_id
      AND mp.user_id = m.user_id
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
    members: members.map((member) => ({
      ...member,
      display_name: rooms[0]?.mode === 'room'
        ? (safeText(member.member_custom_nickname || '', 40) || safeText(member.username || '', 80))
        : safeText(member.username || '', 80)
    }))
  };
};

const createRuntimeAiSlot = (rawSlot = {}, index = 0) => ({
  id: safeText(rawSlot.id || `slot-${index + 1}`, 40) || `slot-${index + 1}`,
  enabled: Boolean(rawSlot.enabled),
  provider: rawSlot.provider === 'custom' ? 'custom' : 'builtin',
  builtinModel: safeText(rawSlot.builtinModel || 'DouBaoSeed1.6', 120) || 'DouBaoSeed1.6',
  customModel: safeText(rawSlot.customModel || '', 120),
  customEndpoint: safeText(rawSlot.customEndpoint || '', 500),
  apiKey: safeText(rawSlot.apiKey || '', 400),
  name: safeText(rawSlot.name || `AI ${index + 1}`, 40) || `AI ${index + 1}`,
  context: safeLongText(rawSlot.context || '', 2000),
  avatarUrl: safeText(rawSlot.avatarUrl || '', 200000),
  avatarUpdatedAt: Number(rawSlot.avatarUpdatedAt || 0) || 0,
  memoryEnabled: rawSlot.memoryEnabled !== false
});

const getRuntimeRoomSettings = async (pool, roomId) => {
  await ensureRoomSettingsTable(pool);
  const [rows] = await pool.execute(
    `SELECT settings_json
     FROM discussion_room_settings
     WHERE room_id = ?
     LIMIT 1`,
    [roomId]
  );
  const parsed = parseJsonObject(rows[0]?.settings_json) || {};
  const rawSlots = Array.isArray(parsed.aiSlots) ? parsed.aiSlots : [];
  return {
    sourceGameId: safeText(parsed.sourceGameId || '', 120),
    sourceGameTitle: safeText(parsed.sourceGameTitle || '', 255),
    roomTitle: safeText(parsed.roomTitle || '', 120),
    roomAvatarUrl: safeText(parsed.roomAvatarUrl || '', 200000),
    roomMaxMembers: Math.max(2, Math.min(MAX_ROOM_MEMBERS, Number(parsed.roomMaxMembers || MAX_ROOM_MEMBERS) || MAX_ROOM_MEMBERS)),
    invitePermission: safeText(parsed.invitePermission || 'host-only', 40) || 'host-only',
    collaborationStatus: safeText(parsed.collaborationStatus || 'private-chat', 60) || 'private-chat',
    collaborationNote: safeLongText(parsed.collaborationNote || '', 1000),
    peerRolePreset: safeText(parsed.peerRolePreset || '', 80),
    dualAiLoopEnabled: Boolean(parsed.dualAiLoopEnabled),
    dualAiLoopPrompt: safeLongText(parsed.dualAiLoopPrompt || '', 1000),
    dualAiLoopTurnCount: Number(parsed.dualAiLoopTurnCount || 0) || 0,
    dualAiLoopAnchorMessageId: Math.max(0, Number(parsed.dualAiLoopAnchorMessageId || 0) || 0),
    dualAiLoopRepliesForAnchor: Math.max(0, Number(parsed.dualAiLoopRepliesForAnchor || 0) || 0),
    aiSlots: [0, 1].map((index) => createRuntimeAiSlot(rawSlots[index], index))
  };
};

const resolveCodeArtifacts = (codeRootPath, gameId) => {
  const codeDir = path.join(codeRootPath, gameId);
  const codeZipPath = path.join(codeRootPath, `${gameId}.zip`);
  const dirExists = fsSync.existsSync(codeDir) && fsSync.lstatSync(codeDir).isDirectory();
  const zipExists = fsSync.existsSync(codeZipPath);
  return { codeDir, codeZipPath, dirExists, zipExists };
};

const collectCodeFilesFromDirectory = async (targetDir, limit = CODE_BROWSE_MAX_FILES) => {
  const files = [];

  async function walk(dir) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (files.length >= limit) return;
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
        files.push({ path: rel, content: safeLongText(content, ROOM_MEMORY_FILE_MAX_LENGTH) });
      } catch {
        // ignore unreadable files
      }
    }
  }

  await walk(targetDir);
  return files;
};

const collectCodeFilesFromZip = (zipPath, limit = CODE_BROWSE_MAX_FILES) => {
  try {
    const files = [];
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries() || [];

    for (const entry of entries) {
      if (files.length >= limit) break;
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
        files.push({ path: rel, content: safeLongText(content, ROOM_MEMORY_FILE_MAX_LENGTH) });
      } catch {
        // ignore bad zip entry
      }
    }

    return files;
  } catch (error) {
    console.warn('读取房间记忆源码压缩包失败:', error.message);
    return [];
  }
};

const loadGameCodeFilesForMemory = async (requestedGameId, limit = ROOM_MEMORY_CODE_LIMIT) => {
  const gameId = safeText(requestedGameId || '', 120);
  if (!gameId) return [];

  const codeRootPath = process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code');
  let resolvedGameId = gameId;
  let { codeDir, codeZipPath, dirExists, zipExists } = resolveCodeArtifacts(codeRootPath, resolvedGameId);

  if (!dirExists && !zipExists) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT game_id FROM games WHERE game_id = ? OR CAST(id AS CHAR) = ? LIMIT 1',
      [gameId, gameId]
    );
    const mappedGameId = safeText(rows?.[0]?.game_id || '', 120);
    if (mappedGameId) {
      resolvedGameId = mappedGameId;
      ({ codeDir, codeZipPath, dirExists, zipExists } = resolveCodeArtifacts(codeRootPath, resolvedGameId));
    }
  }

  if (!dirExists && !zipExists) return [];

  let files = [];
  if (dirExists) {
    files = await collectCodeFilesFromDirectory(codeDir, limit);
  }
  if (!files.length && zipExists) {
    files = collectCodeFilesFromZip(codeZipPath, limit);
  }
  return files;
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

const ensureRoomInviteLinksTable = async (pool) => {
  if (roomInviteLinksTableReady) return;

  if (roomInviteLinksTableInitPromise) {
    await roomInviteLinksTableInitPromise;
    return;
  }

  roomInviteLinksTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS discussion_room_invite_links (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      room_id BIGINT NOT NULL,
      link_code VARCHAR(96) NOT NULL,
      creator_user_id INT NOT NULL,
      expires_at DATETIME NOT NULL,
      status ENUM('active', 'expired', 'revoked') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_discussion_room_invite_links_code (link_code),
      KEY idx_discussion_room_invite_links_room_status (room_id, status),
      KEY idx_discussion_room_invite_links_creator_status (creator_user_id, status),
      KEY idx_discussion_room_invite_links_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await roomInviteLinksTableInitPromise;
    roomInviteLinksTableReady = true;
  } finally {
    roomInviteLinksTableInitPromise = null;
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

async function ensureRoomMemberPreferencesTable(pool) {
  if (roomMemberPreferencesTableReady) return;

  if (roomMemberPreferencesTableInitPromise) {
    await roomMemberPreferencesTableInitPromise;
    return;
  }

  roomMemberPreferencesTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS discussion_room_member_preferences (
      room_id BIGINT NOT NULL,
      user_id INT NOT NULL,
      custom_nickname VARCHAR(40) NOT NULL DEFAULT '',
      cleared_before_message_id BIGINT NOT NULL DEFAULT 0,
      cleared_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (room_id, user_id),
      KEY idx_discussion_room_member_preferences_user_updated (user_id, updated_at),
      KEY idx_discussion_room_member_preferences_room_cleared (room_id, cleared_before_message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await roomMemberPreferencesTableInitPromise;
    roomMemberPreferencesTableReady = true;
  } finally {
    roomMemberPreferencesTableInitPromise = null;
  }
}

async function ensureRoomSummaryTable(pool) {
  if (roomSummaryTableReady) return;

  if (roomSummaryTableInitPromise) {
    await roomSummaryTableInitPromise;
    return;
  }

  roomSummaryTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS discussion_room_summary (
      room_id BIGINT NOT NULL PRIMARY KEY,
      summary_text LONGTEXT NOT NULL,
      summary_json LONGTEXT NULL,
      last_message_id BIGINT NULL,
      updated_by_user_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_discussion_room_summary_updated_by (updated_by_user_id),
      KEY idx_discussion_room_summary_last_message (last_message_id),
      KEY idx_discussion_room_summary_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await roomSummaryTableInitPromise;
    roomSummaryTableReady = true;
  } finally {
    roomSummaryTableInitPromise = null;
  }
}

async function ensureRoomMemoryTable(pool) {
  if (roomMemoryTableReady) return;

  if (roomMemoryTableInitPromise) {
    await roomMemoryTableInitPromise;
    return;
  }

  roomMemoryTableInitPromise = pool.execute(
    `CREATE TABLE IF NOT EXISTS discussion_room_memory (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      room_id BIGINT NOT NULL,
      memory_type VARCHAR(32) NOT NULL,
      source_key VARCHAR(160) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      metadata_json LONGTEXT NULL,
      source_user_id INT NULL,
      source_message_id BIGINT NULL,
      source_document_id BIGINT NULL,
      source_game_id VARCHAR(120) NULL,
      source_path VARCHAR(320) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_discussion_room_memory_room_source (room_id, source_key),
      KEY idx_discussion_room_memory_room_type (room_id, memory_type),
      KEY idx_discussion_room_memory_room_updated (room_id, updated_at),
      KEY idx_discussion_room_memory_source_user (source_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  try {
    await roomMemoryTableInitPromise;
    roomMemoryTableReady = true;
  } finally {
    roomMemoryTableInitPromise = null;
  }
}

const {
  getRoomSummary,
  listRoomMemoryEntries,
  refreshRoomMemoryArtifacts,
  retrieveRelevantMemoryEntries,
  findRecentMessageLinkedMemoryEntries
} = createRoomMemoryToolkit({
  ensureRoomSummaryTable,
  ensureRoomMemoryTable,
  ensureRoomDocumentsTable,
  getRuntimeRoomSettings,
  loadGameCodeFilesForMemory,
  loadDocumentFullText,
  resolveUploadedFilePath,
  buildAiSenderLabel,
  describeMessageForMemory,
  roomMemoryCodeLimit: ROOM_MEMORY_CODE_LIMIT,
  roomMemoryDocumentLimit: ROOM_MEMORY_DOCUMENT_LIMIT,
  roomMemoryContextLimit: ROOM_MEMORY_CONTEXT_LIMIT,
  roomMemoryFileMaxLength: ROOM_MEMORY_FILE_MAX_LENGTH
});

const requestRoomAiReplyBySlot = createRequestRoomAiReplyBySlot({
  getRoomNotificationContext,
  refreshRoomMemoryArtifacts,
  getRoomSummary,
  retrieveRelevantMemoryEntries,
  findRecentMessageLinkedMemoryEntries,
  roomMemoryContextLimit: ROOM_MEMORY_CONTEXT_LIMIT
});

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
const generateRoomInviteCode = () => crypto.randomBytes(18).toString('hex');

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
      validCode(url.searchParams.get('roomInvite'))
      || validCode(url.searchParams.get('friendInvite'))
      || validCode(url.searchParams.get('invite'))
      || validCode(url.searchParams.get('code'))
      || ''
    );
  } catch {
    return '';
  }
};

const getDiscussionInviteLinkBase = (req) => {
  const fromEnv = String(process.env.APP_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;

  const fromOrigin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (fromOrigin) return fromOrigin;

  return '';
};

const getFriendInviteLinkBase = (req) => getDiscussionInviteLinkBase(req);

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
  emitRoomSettingsEventToUser,
  emitRoomHistoryClearedEventToUser,
  emitRoomMemoryEvent,
  emitRoomAiProgressEvent,
  createNotification,
  toInt,
  AI_REPLY_CHAR_LIMIT,
  AI_PROGRESS_STAGES,
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
  getRoomMemberPreferences,
  saveRoomMemberPreferences,
  getRoomPayload,
  generateAiReply,
  notifyRoomMembers,
  removeUploadedFile,
  ensureFriendInviteLinksTable,
  ensureRoomInviteLinksTable,
  ensureRoomDocumentsTable,
  ensureRoomDocumentStateTable,
  ensureRoomTasksTable,
  ensureRoomSettingsTable,
  ensureRoomMemberPreferencesTable,
  ensureRoomSummaryTable,
  ensureRoomMemoryTable,
  mapRoomTaskRow,
  generateFriendInviteCode,
  generateRoomInviteCode,
  parseInviteCode,
  getDiscussionInviteLinkBase,
  getFriendInviteLinkBase,
  getRuntimeRoomSettings,
  getRoomSummary,
  listRoomMemoryEntries,
  refreshRoomMemoryArtifacts,
  requestRoomAiReplyBySlot,
  acquireRoomAiExecutionLock,
  releaseRoomAiExecutionLock,
  isRoomAiExecutionLocked,
  estimateTokenCount,
  clampAiReplyContent
};
