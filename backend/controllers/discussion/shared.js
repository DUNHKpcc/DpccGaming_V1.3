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
  emitRoomMemoryEvent,
  emitRoomAiProgressEvent
} = require('../../utils/discussionRealtime');
const { createNotification } = require('../../utils/notification');
const { ARK_CONFIG } = require('../aiController');

const MAX_ROOM_MEMBERS = 4;
const DEFAULT_MODEL = ARK_CONFIG.defaultModel;
const DEFAULT_ENDPOINT = ARK_CONFIG.defaultEndpoint;
const DEFAULT_REASONING = ARK_CONFIG.defaultReasoning;
const DEFAULT_ARK_API_KEY = ARK_CONFIG.defaultApiKey;
const FRIEND_INVITE_MIN_MINUTES = 5;
const FRIEND_INVITE_MAX_MINUTES = 7 * 24 * 60;
const FRIEND_INVITE_DEFAULT_MINUTES = 60;
const UPLOADS_ROOT = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
const DEFAULT_QWEN_CODEMAX_ENDPOINT = 'https://coding.dashscope.aliyuncs.com/v1';
const DEFAULT_QWEN_CODEMAX_API_KEY = 'sk-sp-9a16d7d7aa4740b7aeffccaeb07a80ce';
const DEFAULT_QWEN_CODEMAX_MODEL = 'qwen3.5-plus';
const CODE_BROWSE_EXTS = new Set(appConfig.codeBrowser?.allowedExtensions || ['.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss', '.less', '.html', '.json', '.md', '.c', '.cpp', '.h', '.cs', '.py']);
const CODE_BROWSE_MAX_FILES = Number(appConfig.codeBrowser?.maxFiles || 60);
const CODE_BROWSE_MAX_FILE_SIZE = Number(appConfig.codeBrowser?.maxFileSize || (200 * 1024));
const CODE_BROWSE_SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.output', '.cache']);
const ROOM_MEMORY_CODE_LIMIT = 8;
const ROOM_MEMORY_DOCUMENT_LIMIT = 6;
const ROOM_MEMORY_CONTEXT_LIMIT = 4;
const ROOM_MEMORY_FILE_MAX_LENGTH = 6000;
const AI_REPLY_CHAR_LIMIT = 80;
const AI_PROGRESS_STAGES = Object.freeze({
  queued: 'queued',
  memory: 'memory',
  generating: 'generating',
  finalizing: 'finalizing',
  error: 'error'
});

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
let roomSummaryTableReady = false;
let roomSummaryTableInitPromise = null;
let roomMemoryTableReady = false;
let roomMemoryTableInitPromise = null;
const roomAiExecutionLocks = new Map();

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseJsonObject = (rawValue) => {
  if (!rawValue) return null;
  if (typeof rawValue === 'object' && !Array.isArray(rawValue)) return rawValue;
  if (typeof rawValue !== 'string') return null;
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const safeText = (value, maxLength = 255) => String(value || '').trim().slice(0, maxLength);
const safeLongText = (value, maxLength = 12000) => String(value || '').replace(/\r/g, '').trim().slice(0, maxLength);
const normalizeCodePath = (value = '') => String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
const normalizeRoomLockKey = (roomId) => String(Number(roomId || 0) || '').trim();

const acquireRoomAiExecutionLock = (roomId) => {
  const roomKey = normalizeRoomLockKey(roomId);
  if (!roomKey) return false;
  if (roomAiExecutionLocks.get(roomKey)) return false;
  roomAiExecutionLocks.set(roomKey, true);
  return true;
};

const releaseRoomAiExecutionLock = (roomId) => {
  const roomKey = normalizeRoomLockKey(roomId);
  if (!roomKey) return;
  roomAiExecutionLocks.delete(roomKey);
};

const isRoomAiExecutionLocked = (roomId) => {
  const roomKey = normalizeRoomLockKey(roomId);
  if (!roomKey) return false;
  return roomAiExecutionLocks.get(roomKey) === true;
};

const estimateTokenCount = (text = '') => {
  const source = String(text || '').trim();
  if (!source) return 0;
  const asciiMatches = source.match(/[A-Za-z0-9_.-]+/g) || [];
  const nonAsciiLength = source.replace(/[A-Za-z0-9_.-\s]/g, '').length;
  const asciiTokenCount = asciiMatches.reduce((sum, item) => sum + Math.max(1, Math.ceil(item.length / 4)), 0);
  return asciiTokenCount + nonAsciiLength;
};

const clampAiReplyContent = (text = '', limit = AI_REPLY_CHAR_LIMIT) => {
  const source = safeLongText(text || '', 4000);
  if (!source) {
    return {
      content: '',
      charCount: 0,
      tokenCount: 0
    };
  }
  const nextLimit = Math.max(1, Number(limit || AI_REPLY_CHAR_LIMIT) || AI_REPLY_CHAR_LIMIT);
  const normalized = source.replace(/\s+/g, ' ').trim();
  const limited = normalized.length > nextLimit
    ? `${normalized.slice(0, Math.max(1, nextLimit - 1)).trim()}…`
    : normalized;
  return {
    content: limited,
    charCount: limited.length,
    tokenCount: estimateTokenCount(limited)
  };
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

const parseTextMessageContent = (content) => {
  if (!content) return '';
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || '')
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
  return String(content).trim();
};

const formatRoomMessageForAi = (message = {}) => {
  const senderLabel = buildAiSenderLabel(message);
  const senderType = safeText(message.sender_type || 'user', 20) || 'user';
  const metadata = parseJsonObject(message.metadata_json) || {};
  const attachment = metadata.attachment && typeof metadata.attachment === 'object' ? metadata.attachment : null;
  const codePreview = metadata.code_preview && typeof metadata.code_preview === 'object' ? metadata.code_preview : null;
  const documentPreview = metadata.document_preview && typeof metadata.document_preview === 'object' ? metadata.document_preview : null;
  const detailParts = [];

  if (attachment?.name) {
    detailParts.push(`附件：${safeText(attachment.name, 180)}`);
  }
  if (codePreview?.path) {
    detailParts.push(`代码：${safeText(codePreview.path, 220)}`);
  }
  if (documentPreview?.name) {
    detailParts.push(`文档：${safeText(documentPreview.name, 180)}`);
  }

  const content = describeMessageForMemory(message);
  return `[${senderType}] ${senderLabel}${detailParts.length ? `（${detailParts.join('，')}）` : ''}：${content}`;
};

const buildPromptFromAiContext = ({
  prompt,
  gameTitle,
  recentMessages = [],
  roomSummary = null,
  memoryEntries = [],
  systemDirective = ''
}) => {
  const recentText = recentMessages
    .map((message) => formatRoomMessageForAi(message))
    .join('\n')
    .slice(-6000);
  const summaryText = safeLongText(roomSummary?.summaryText || '', 2400);
  const memoryText = memoryEntries
    .map((entry) => {
      const label = entry.memoryType === 'code'
        ? '源码记忆'
        : entry.memoryType === 'document'
          ? '文档记忆'
          : entry.memoryType === 'profile'
            ? '房间配置'
            : '房间记忆';
      return `【${label}】${entry.title}\n${safeLongText(entry.content || '', 1800)}`;
    })
    .join('\n\n')
    .slice(-7200);

  return [
    systemDirective,
    summaryText ? `房间摘要：\n${summaryText}` : '',
    memoryText ? `检索到的房间记忆：\n${memoryText}` : '',
    recentText ? `最近对话：\n${recentText}` : '',
    `当前请求：\n${safeLongText(prompt || '', 2200)}`
  ].filter(Boolean).join('\n\n');
};

const requestArkAiReply = async ({ prompt, gameTitle, roomMessages, roomSummary, memoryEntries, systemDirective }) => {
  const apiKey = process.env.ARK_API_KEY || DEFAULT_ARK_API_KEY;
  if (!apiKey) {
    return 'AI 机器人暂未配置 ARK_API_KEY，当前先由系统占位回复。请配置后启用真实 AI 对话。';
  }

  const payload = {
    model: process.env.ARK_MODEL_ID || DEFAULT_MODEL,
    max_completion_tokens: Number(process.env.ARK_MAX_TOKENS) || 1200,
    reasoning_effort: process.env.ARK_REASONING_LEVEL || DEFAULT_REASONING,
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: systemDirective || '你是 DpccGaming 讨论房间内的 AI 协作成员。请结合房间消息、共享记忆、文档和代码内容，自然、清晰地回应当前讨论。'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildPromptFromAiContext({
              prompt,
              gameTitle,
              recentMessages: roomMessages,
              roomSummary,
              memoryEntries,
              systemDirective
            })
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
  return parseTextMessageContent(content) || 'AI 未返回有效文本内容。';
};

const requestQwenCodeMaxReply = async ({ prompt, gameTitle, roomMessages, roomSummary, memoryEntries, systemDirective }) => {
  const apiKey = process.env.QWEN_CODEMAX_API_KEY || DEFAULT_QWEN_CODEMAX_API_KEY;
  const endpoint = (process.env.QWEN_CODEMAX_BASE_URL || DEFAULT_QWEN_CODEMAX_ENDPOINT).replace(/\/+$/, '');
  const model = process.env.QWEN_CODEMAX_MODEL || DEFAULT_QWEN_CODEMAX_MODEL;
  if (!apiKey) {
    return 'Qwen3-CodeMax 暂未配置 API KEY，当前先由系统占位回复。';
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: systemDirective || '你是 DpccGaming 讨论房间内的 AI 协作成员。请结合房间消息、共享记忆、文档和代码内容，给出清晰、自然、可执行的中文回复。'
        },
        {
          role: 'user',
          content: buildPromptFromAiContext({
            prompt,
            gameTitle,
            recentMessages: roomMessages,
            roomSummary,
            memoryEntries,
            systemDirective
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Qwen3-CodeMax 调用失败，状态码 ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return 'Qwen3-CodeMax 未返回有效内容，请稍后重试。';
  return parseTextMessageContent(content) || 'Qwen3-CodeMax 未返回有效文本内容。';
};

const generateAiReply = async ({ prompt, gameTitle, roomMessages, builtinModel = '', roomSummary = null, memoryEntries = [], systemDirective = '' }) => {
  const modelName = String(builtinModel || '').trim();
  if (modelName === 'Qwen3-CodeMax') {
    return requestQwenCodeMaxReply({ prompt, gameTitle, roomMessages, roomSummary, memoryEntries, systemDirective });
  }
  return requestArkAiReply({ prompt, gameTitle, roomMessages, roomSummary, memoryEntries, systemDirective });
};

const buildRoomScopedAiPrompt = ({
  slot = {},
  room = {},
  loopPrompt = '',
  prompt = '',
  targetUserName = '',
  roomSummary = null,
  recentMessages = []
}) => {
  const effectivePrompt = safeLongText(loopPrompt || prompt || '请结合当前讨论继续推进并给出下一步建议。', 1600);
  return [
    `当前 AI 名称：${safeText(slot.name || 'AI 助手', 80)}`,
    slot.context ? `AI 上下文：${safeLongText(slot.context, 1200)}` : '',
    targetUserName ? `本次优先回复对象：${safeText(targetUserName, 80)}` : '',
    prompt ? `调用指令：${safeLongText(prompt, 1200)}` : '',
    loopPrompt ? `轮询目标：${safeLongText(loopPrompt, 1200)}` : '',
    roomSummary?.summaryText ? `已有摘要：\n${safeLongText(roomSummary.summaryText, 1800)}` : '',
    recentMessages.length ? '请基于当前房间成员最近的真实对话、共享文档和源码记忆接续发言。' : '',
    targetUserName && prompt ? '请优先围绕这位用户最近一次消息展开协作，不要脱离用户问题让 AI 之间无限互相追问。' : '',
    '最终回复必须使用简体中文，并严格控制在 80 字以内。',
    effectivePrompt
  ].filter(Boolean).join('\n\n');
};

const requestCustomAiReply = async ({ slot, prompt }) => {
  const endpoint = safeText(slot.customEndpoint || '', 500);
  const apiKey = safeText(slot.apiKey || '', 400);
  const model = safeText(slot.customModel || '', 120);
  if (!endpoint || !apiKey || !model) {
    throw new Error('自定义 AI 缺少 endpoint / model / apiKey');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: '你是多人协作聊天中的 AI 成员，请结合房间记忆、文件和历史对话，自然接续上下文发言。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.35
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `自定义 AI 请求失败（${response.status}）`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('自定义 AI 未返回有效内容');
  }
  return parseTextMessageContent(content) || '自定义 AI 未返回有效文本内容。';
};

const requestRoomAiReplyBySlot = async ({
  pool,
  roomId,
  room = null,
  slot = {},
  prompt = '',
  loopPrompt = '',
  recentMessages = [],
  targetUserName = ''
}) => {
  const parsedRoomId = Number(roomId || 0);
  if (!parsedRoomId) throw new Error('无效的 roomId');
  const roomContext = room || (await getRoomNotificationContext(pool, parsedRoomId));
  if (!roomContext) throw new Error('房间不存在');

  const roomMemory = await refreshRoomMemoryArtifacts(pool, parsedRoomId);
  const summary = roomMemory.summary || await getRoomSummary(pool, parsedRoomId);
  const useMemory = slot.memoryEnabled !== false;
  const relevantEntries = useMemory
    ? retrieveRelevantMemoryEntries(roomMemory.memory || [], `${prompt}\n${loopPrompt}`, summary?.summaryText || '')
    : [];
  const linkedEntries = useMemory
    ? findRecentMessageLinkedMemoryEntries(roomMemory.memory || [], recentMessages)
    : [];
  const memoryEntries = [...new Map(
    [...linkedEntries, ...relevantEntries].map((entry) => [entry.sourceKey || entry.id, entry])
  ).values()].slice(0, Math.max(ROOM_MEMORY_CONTEXT_LIMIT, linkedEntries.length));
  const scopedPrompt = buildRoomScopedAiPrompt({
    slot,
    room: roomContext,
    loopPrompt,
    prompt,
    targetUserName,
    roomSummary: summary,
    recentMessages
  });

  let rawReply = '';
  if (slot.provider === 'custom' && slot.customEndpoint && slot.customModel && slot.apiKey) {
    rawReply = await requestCustomAiReply({
      slot, prompt: buildPromptFromAiContext({
        prompt: scopedPrompt,
        gameTitle: roomContext.game_title,
        recentMessages,
        roomSummary: summary,
        memoryEntries,
        systemDirective: '你是 DpccGaming 讨论房间内的自定义 AI 助手，请结合房间记忆、文档与代码记忆，用简体中文自然接续发言。最终回复严格控制在80字以内。'
      })
    });
  } else {
    rawReply = await generateAiReply({
      prompt: scopedPrompt,
      gameTitle: roomContext.game_title,
      roomMessages: recentMessages,
      builtinModel: slot.builtinModel || 'DouBaoSeed1.6',
      roomSummary: summary,
      memoryEntries,
      systemDirective: '你是 DpccGaming 讨论房间内的 AI 协作成员。你会看到成员消息、文件发送信息、房间摘要和共享记忆。请明确区分是谁发了什么，并基于当前讨论自然、可执行地回复。最终回复严格控制在80字以内。'
    });
  }

  return clampAiReplyContent(rawReply, AI_REPLY_CHAR_LIMIT);
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

const buildAiSenderLabel = (message = {}) => {
  const senderType = safeText(message.sender_type || 'user', 20) || 'user';
  const metadata = parseJsonObject(message.metadata_json) || {};
  if (senderType === 'ai') {
    return safeText(metadata.local_ai_name || message.username || 'AI 助手', 60) || 'AI 助手';
  }
  if (senderType === 'system') return '系统';
  return safeText(message.username || `用户${message.sender_user_id || ''}`, 60) || '成员';
};

const describeMessageForMemory = (message = {}) => {
  const metadata = parseJsonObject(message.metadata_json) || {};
  const content = safeLongText(message.content || '', 600);
  const attachment = metadata.attachment && typeof metadata.attachment === 'object' ? metadata.attachment : null;
  const codePreview = metadata.code_preview && typeof metadata.code_preview === 'object' ? metadata.code_preview : null;
  const documentPreview = metadata.document_preview && typeof metadata.document_preview === 'object' ? metadata.document_preview : null;

  if (attachment?.type && attachment?.name) {
    return `${content || '发送了附件'}（${attachment.type}：${attachment.name}）`;
  }
  if (codePreview?.path) {
    return `${content || '分享了代码预览'}：${codePreview.path}\n${safeLongText(codePreview.snippet || '', 600)}`;
  }
  if (documentPreview?.name) {
    return `${content || '分享了文档预览'}：${documentPreview.name}\n${safeLongText(documentPreview.preview_text || '', 600)}`;
  }
  return content;
};

const extractMemorySearchTokens = (...parts) => {
  const joined = parts
    .map((item) => safeLongText(item || '', 1000))
    .filter(Boolean)
    .join('\n');
  const matches = joined.match(/[\u4e00-\u9fa5]{2,12}|[a-zA-Z0-9_.-]{2,32}/g) || [];
  return [...new Set(matches.map((item) => item.toLowerCase()))].slice(0, 24);
};

const scoreMemoryContent = (text = '', tokens = []) => {
  if (!text || !tokens.length) return 0;
  const haystack = String(text || '').toLowerCase();
  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) score += token.length > 6 ? 3 : 2;
  });
  return score;
};

const buildRoomSummaryText = ({
  room = {},
  members = [],
  settings = {},
  recentMessages = [],
  documents = [],
  codeFiles = []
}) => {
  const joinedMembers = members
    .filter((item) => item?.status === 'joined')
    .map((item) => safeText(item.username || `用户${item.user_id || ''}`, 40))
    .filter(Boolean);
  const enabledAiNames = (Array.isArray(settings.aiSlots) ? settings.aiSlots : [])
    .filter((slot) => slot?.enabled)
    .map((slot) => safeText(slot.name || slot.builtinModel || slot.customModel || slot.id, 40))
    .filter(Boolean);
  const messageLines = recentMessages.slice(-10).map((message) => `- ${buildAiSenderLabel(message)}：${describeMessageForMemory(message)}`);
  const documentLines = documents.slice(0, ROOM_MEMORY_DOCUMENT_LIMIT).map((doc) => `- ${safeText(doc.file_name || '', 120)}（上传者：${safeText(doc.uploader_name || '', 40) || '未知'}）`);
  const codeLines = codeFiles.slice(0, ROOM_MEMORY_CODE_LIMIT).map((file) => `- ${safeText(file.path || '', 180)}`);

  return [
    '# 房间滚动摘要',
    `房间：${safeText(room.title || room.game_title || '未命名房间', 120)}`,
    `游戏：${safeText(room.game_title || settings.sourceGameTitle || '未命名游戏', 120)}`,
    `协作状态：${safeText(settings.collaborationStatus || 'private-chat', 60)}`,
    settings.collaborationNote ? `协作备注：${safeLongText(settings.collaborationNote, 240)}` : '',
    settings.peerRolePreset ? `当前角色预设：${safeText(settings.peerRolePreset, 60)}` : '',
    joinedMembers.length ? `当前成员：${joinedMembers.join('、')}` : '',
    enabledAiNames.length ? `当前 AI：${enabledAiNames.join('、')}` : '',
    '',
    '## 最近对话',
    ...(messageLines.length ? messageLines : ['- 暂无消息']),
    '',
    '## 相关文档',
    ...(documentLines.length ? documentLines : ['- 暂无文档记忆']),
    '',
    '## 相关源码',
    ...(codeLines.length ? codeLines : ['- 暂无源码记忆'])
  ].filter(Boolean).join('\n');
};

const upsertRoomMemoryEntry = async (pool, entry = {}) => {
  await ensureRoomMemoryTable(pool);
  await pool.execute(
    `INSERT INTO discussion_room_memory
     (room_id, memory_type, source_key, title, content, metadata_json, source_user_id, source_message_id, source_document_id, source_game_id, source_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       memory_type = VALUES(memory_type),
       title = VALUES(title),
       content = VALUES(content),
       metadata_json = VALUES(metadata_json),
       source_user_id = VALUES(source_user_id),
       source_message_id = VALUES(source_message_id),
       source_document_id = VALUES(source_document_id),
       source_game_id = VALUES(source_game_id),
       source_path = VALUES(source_path),
       updated_at = CURRENT_TIMESTAMP`,
    [
      entry.roomId,
      safeText(entry.memoryType || 'note', 32) || 'note',
      safeText(entry.sourceKey || '', 160),
      safeText(entry.title || '未命名记忆', 255) || '未命名记忆',
      safeLongText(entry.content || '', ROOM_MEMORY_FILE_MAX_LENGTH),
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      Number(entry.sourceUserId || 0) || null,
      Number(entry.sourceMessageId || 0) || null,
      Number(entry.sourceDocumentId || 0) || null,
      safeText(entry.sourceGameId || '', 120) || null,
      safeText(entry.sourcePath || '', 320) || null
    ]
  );
};

const mapRoomMemoryRow = (row = {}) => ({
  id: Number(row.id || 0) || null,
  roomId: Number(row.room_id || 0) || null,
  memoryType: safeText(row.memory_type || '', 32),
  sourceKey: safeText(row.source_key || '', 160),
  title: safeText(row.title || '', 255),
  content: safeLongText(row.content || '', ROOM_MEMORY_FILE_MAX_LENGTH),
  metadata: parseJsonObject(row.metadata_json) || null,
  sourceUserId: Number(row.source_user_id || 0) || null,
  sourceMessageId: Number(row.source_message_id || 0) || null,
  sourceDocumentId: Number(row.source_document_id || 0) || null,
  sourceGameId: safeText(row.source_game_id || '', 120),
  sourcePath: safeText(row.source_path || '', 320),
  updatedAt: row.updated_at || null,
  createdAt: row.created_at || null
});

const normalizeMemoryTitleForDedupe = (title = '') => (
  safeText(title || '', 255)
    .replace(/^(消息源码|源码|消息文档|文档)\//, '')
    .trim()
    .toLowerCase()
);

const buildRoomMemoryDedupeKey = (entry = {}) => {
  const memoryType = safeText(entry.memoryType || '', 32);
  if (!memoryType || memoryType === 'summary' || memoryType === 'profile' || memoryType === 'message' || memoryType === 'note') {
    return `unique:${safeText(entry.sourceKey || entry.id || '', 160)}`;
  }

  if (memoryType === 'document') {
    const sourceDocumentId = Number(entry.sourceDocumentId || 0) || 0;
    if (sourceDocumentId > 0) return `document:id:${sourceDocumentId}`;
    const titleKey = normalizeMemoryTitleForDedupe(entry.title || '');
    if (titleKey) return `document:title:${titleKey}`;
  }

  if (memoryType === 'code') {
    const sourceGameId = safeText(entry.sourceGameId || '', 120);
    const sourcePath = safeText(entry.sourcePath || '', 320).toLowerCase();
    if (sourceGameId && sourcePath) return `code:path:${sourceGameId}:${sourcePath}`;
    const titleKey = normalizeMemoryTitleForDedupe(entry.title || '');
    if (titleKey) return `code:title:${titleKey}`;
  }

  return `unique:${safeText(entry.sourceKey || entry.id || '', 160)}`;
};

const pickPreferredMemoryEntry = (currentEntry = null, nextEntry = null) => {
  if (!currentEntry) return nextEntry;
  if (!nextEntry) return currentEntry;

  const currentHasMessageLink = Number(currentEntry.sourceMessageId || 0) > 0;
  const nextHasMessageLink = Number(nextEntry.sourceMessageId || 0) > 0;
  if (currentHasMessageLink !== nextHasMessageLink) {
    return nextHasMessageLink ? nextEntry : currentEntry;
  }

  const currentUpdatedAt = new Date(currentEntry.updatedAt || currentEntry.createdAt || 0).getTime();
  const nextUpdatedAt = new Date(nextEntry.updatedAt || nextEntry.createdAt || 0).getTime();
  if (currentUpdatedAt !== nextUpdatedAt) {
    return nextUpdatedAt > currentUpdatedAt ? nextEntry : currentEntry;
  }

  const currentContentLength = String(currentEntry.content || '').length;
  const nextContentLength = String(nextEntry.content || '').length;
  if (currentContentLength !== nextContentLength) {
    return nextContentLength > currentContentLength ? nextEntry : currentEntry;
  }

  return (Number(nextEntry.id || 0) || 0) > (Number(currentEntry.id || 0) || 0) ? nextEntry : currentEntry;
};

const dedupeRoomMemoryEntries = (entries = []) => {
  if (!Array.isArray(entries) || !entries.length) return [];
  const dedupedMap = new Map();
  entries.forEach((entry) => {
    const dedupeKey = buildRoomMemoryDedupeKey(entry);
    const existingEntry = dedupedMap.get(dedupeKey);
    dedupedMap.set(dedupeKey, pickPreferredMemoryEntry(existingEntry, entry));
  });

  return [...dedupedMap.values()].sort((left, right) => {
    const typeOrder = ['summary', 'profile', 'document', 'code', 'message', 'note'];
    const leftIndex = Math.max(0, typeOrder.indexOf(String(left.memoryType || '')));
    const rightIndex = Math.max(0, typeOrder.indexOf(String(right.memoryType || '')));
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;

    const leftUpdatedAt = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightUpdatedAt = new Date(right.updatedAt || right.createdAt || 0).getTime();
    if (leftUpdatedAt !== rightUpdatedAt) return rightUpdatedAt - leftUpdatedAt;

    return (Number(right.id || 0) || 0) - (Number(left.id || 0) || 0);
  });
};

const listRoomMemoryEntries = async (pool, roomId) => {
  await ensureRoomMemoryTable(pool);
  const [rows] = await pool.execute(
    `SELECT id, room_id, memory_type, source_key, title, content, metadata_json,
            source_user_id, source_message_id, source_document_id, source_game_id, source_path,
            created_at, updated_at
     FROM discussion_room_memory
     WHERE room_id = ?
     ORDER BY
       FIELD(memory_type, 'summary', 'profile', 'document', 'code', 'message', 'note'),
       updated_at DESC,
       id DESC`,
    [roomId]
  );
  return dedupeRoomMemoryEntries(rows.map((row) => mapRoomMemoryRow(row)));
};

const getRoomSummary = async (pool, roomId) => {
  await ensureRoomSummaryTable(pool);
  const [rows] = await pool.execute(
    `SELECT room_id, summary_text, summary_json, last_message_id, updated_by_user_id, created_at, updated_at
     FROM discussion_room_summary
     WHERE room_id = ?
     LIMIT 1`,
    [roomId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    roomId: Number(row.room_id || 0) || null,
    summaryText: safeLongText(row.summary_text || '', ROOM_MEMORY_FILE_MAX_LENGTH),
    summaryMeta: parseJsonObject(row.summary_json) || null,
    lastMessageId: Number(row.last_message_id || 0) || null,
    updatedByUserId: Number(row.updated_by_user_id || 0) || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
};

const refreshRoomMemoryArtifacts = async (pool, roomId, options = {}) => {
  const parsedRoomId = Number(roomId || 0);
  if (!parsedRoomId) {
    return { summary: null, memory: [] };
  }

  await ensureRoomSummaryTable(pool);
  await ensureRoomMemoryTable(pool);
  await ensureRoomDocumentsTable(pool);

  const [roomRows] = await pool.execute(
    `SELECT r.id, r.title, r.game_id, r.mode, g.title AS game_title
     FROM discussion_rooms r
     JOIN games g ON g.game_id = r.game_id
     WHERE r.id = ?
     LIMIT 1`,
    [parsedRoomId]
  );
  const room = roomRows[0];
  if (!room) {
    return { summary: null, memory: [] };
  }

  const settings = options.settings || await getRuntimeRoomSettings(pool, parsedRoomId);
  const [members] = await pool.execute(
    `SELECT m.user_id, m.status, u.username
     FROM discussion_room_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.room_id = ?
     ORDER BY m.joined_at ASC`,
    [parsedRoomId]
  );
  const [recentMessages] = await pool.execute(
    `SELECT m.id, m.sender_type, m.sender_user_id, m.content, m.metadata_json, m.created_at, u.username
     FROM discussion_messages m
     LEFT JOIN users u ON u.id = m.sender_user_id
     WHERE m.room_id = ?
     ORDER BY m.id DESC
     LIMIT 30`,
    [parsedRoomId]
  );
  const recentMessagesAsc = recentMessages.reverse();
  const [documents] = await pool.execute(
    `SELECT d.id, d.file_name, d.file_url, d.preview_text, d.mime_type, d.page_count, d.uploader_user_id, d.updated_at, u.username AS uploader_name
     FROM discussion_room_documents d
     LEFT JOIN users u ON u.id = d.uploader_user_id
     WHERE d.room_id = ?
     ORDER BY d.updated_at DESC, d.id DESC
     LIMIT ${ROOM_MEMORY_DOCUMENT_LIMIT}`,
    [parsedRoomId]
  );

  const sourceGameId = safeText(settings.sourceGameId || room.game_id || '', 120) || safeText(room.game_id || '', 120);
  const sourceGameTitle = safeText(settings.sourceGameTitle || room.game_title || '', 255) || safeText(room.game_title || '', 255);
  const codeFiles = await loadGameCodeFilesForMemory(sourceGameId, ROOM_MEMORY_CODE_LIMIT);
  const latestMessageId = Number(recentMessagesAsc[recentMessagesAsc.length - 1]?.id || 0) || null;
  const summaryText = buildRoomSummaryText({
    room: {
      ...room,
      game_title: sourceGameTitle || room.game_title
    },
    members,
    settings,
    recentMessages: recentMessagesAsc,
    documents,
    codeFiles
  });

  const summaryMeta = {
    memberCount: members.filter((item) => item?.status === 'joined').length,
    documentCount: documents.length,
    codeFileCount: codeFiles.length,
    sourceGameId,
    sourceGameTitle
  };

  await pool.execute(
    `INSERT INTO discussion_room_summary (room_id, summary_text, summary_json, last_message_id, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       summary_text = VALUES(summary_text),
       summary_json = VALUES(summary_json),
       last_message_id = VALUES(last_message_id),
       updated_by_user_id = VALUES(updated_by_user_id),
       updated_at = CURRENT_TIMESTAMP`,
    [parsedRoomId, summaryText, JSON.stringify(summaryMeta), latestMessageId, Number(options.updatedByUserId || 0) || null]
  );

  await pool.execute(
    `DELETE FROM discussion_room_memory
     WHERE room_id = ?
       AND (
       source_key = 'summary:latest'
         OR source_key = 'profile:room'
         OR source_key LIKE 'document:%'
         OR source_key LIKE 'code-file:%'
         OR source_key LIKE 'message-code-preview:%'
         OR source_key LIKE 'message-document-preview:%'
       )`,
    [parsedRoomId]
  );

  await upsertRoomMemoryEntry(pool, {
    roomId: parsedRoomId,
    memoryType: 'summary',
    sourceKey: 'summary:latest',
    title: '房间滚动摘要.md',
    content: summaryText,
    metadata: {
      fileType: 'markdown',
      updatedByUserId: Number(options.updatedByUserId || 0) || null
    }
  });

  await upsertRoomMemoryEntry(pool, {
    roomId: parsedRoomId,
    memoryType: 'profile',
    sourceKey: 'profile:room',
    title: '房间记忆配置.json',
    content: JSON.stringify({
      roomId: parsedRoomId,
      roomTitle: safeText(room.title || room.game_title || '未命名房间', 120),
      gameId: sourceGameId,
      gameTitle: sourceGameTitle,
      collaborationStatus: settings.collaborationStatus || 'private-chat',
      collaborationNote: settings.collaborationNote || '',
      peerRolePreset: settings.peerRolePreset || '',
      members: members
        .filter((item) => item?.status === 'joined')
        .map((item) => ({
          userId: Number(item.user_id || 0) || null,
          username: safeText(item.username || '', 40)
        })),
      aiSlots: (Array.isArray(settings.aiSlots) ? settings.aiSlots : []).map((slot) => ({
        id: slot.id,
        enabled: Boolean(slot.enabled),
        provider: slot.provider,
        model: slot.provider === 'custom' ? slot.customModel : slot.builtinModel,
        name: slot.name,
        memoryEnabled: slot.memoryEnabled !== false
      }))
    }, null, 2),
    metadata: {
      fileType: 'json'
    }
  });

  for (const doc of documents) {
    const documentFullText = await loadDocumentFullText(
      resolveUploadedFilePath(doc.file_url || ''),
      doc.file_name || '',
      doc.mime_type || '',
      doc.preview_text || ''
    );
    await upsertRoomMemoryEntry(pool, {
      roomId: parsedRoomId,
      memoryType: 'document',
      sourceKey: `document:${doc.id}`,
      title: `文档/${safeText(doc.file_name || `document-${doc.id}`, 180)}`,
      content: [
        `文档名称：${safeText(doc.file_name || '', 180)}`,
        `上传者：${safeText(doc.uploader_name || '', 40) || '未知'}`,
        doc.page_count ? `页数：${Number(doc.page_count)}` : '',
        doc.mime_type ? `类型：${safeText(doc.mime_type, 120)}` : '',
        '',
        safeLongText(documentFullText || doc.preview_text || '当前文档暂无可用文本内容。', ROOM_MEMORY_FILE_MAX_LENGTH - 256)
      ].filter(Boolean).join('\n'),
      metadata: {
        fileType: 'document',
        uploaderName: safeText(doc.uploader_name || '', 40),
        previewText: safeLongText(doc.preview_text || '', 1200)
      },
      sourceUserId: Number(doc.uploader_user_id || 0) || null,
      sourceDocumentId: Number(doc.id || 0) || null
    });
  }

  for (const file of codeFiles) {
    await upsertRoomMemoryEntry(pool, {
      roomId: parsedRoomId,
      memoryType: 'code',
      sourceKey: `code-file:${safeText(file.path || '', 280)}`,
      title: `源码/${safeText(file.path || '', 220)}`,
      content: safeLongText(file.content || '', ROOM_MEMORY_FILE_MAX_LENGTH),
      metadata: {
        fileType: 'code',
        gameId: sourceGameId,
        gameTitle: sourceGameTitle
      },
      sourceGameId,
      sourcePath: safeText(file.path || '', 320)
    });
  }

  const codeFileMap = new Map(
    codeFiles.map((file) => [safeText(file.path || '', 320), file])
  );
  const documentMap = new Map(
    documents.map((doc) => [Number(doc.id || 0), doc])
  );

  for (const message of recentMessagesAsc) {
    const metadata = parseJsonObject(message.metadata_json) || {};
    const codePreview = metadata.code_preview && typeof metadata.code_preview === 'object' ? metadata.code_preview : null;
    const documentPreview = metadata.document_preview && typeof metadata.document_preview === 'object' ? metadata.document_preview : null;
    const senderName = buildAiSenderLabel(message);

    if (codePreview?.path) {
      const linkedGameId = safeText(codePreview.game_id || sourceGameId || '', 120) || sourceGameId;
      let fileContent = '';
      let resolvedPath = safeText(codePreview.path || '', 320);
      if (linkedGameId === sourceGameId && codeFileMap.has(resolvedPath)) {
        fileContent = safeLongText(codeFileMap.get(resolvedPath)?.content || '', ROOM_MEMORY_FILE_MAX_LENGTH);
      } else if (linkedGameId) {
        const linkedFiles = await loadGameCodeFilesForMemory(linkedGameId, Math.max(ROOM_MEMORY_CODE_LIMIT, 24));
        const matchedFile = linkedFiles.find((file) => safeText(file.path || '', 320) === resolvedPath);
        fileContent = safeLongText(matchedFile?.content || '', ROOM_MEMORY_FILE_MAX_LENGTH);
      }

      await upsertRoomMemoryEntry(pool, {
        roomId: parsedRoomId,
        memoryType: 'code',
        sourceKey: `message-code-preview:${message.id}`,
        title: `消息源码/${safeText(codePreview.path || `message-${message.id}`, 220)}`,
        content: [
          `发送者：${safeText(senderName, 60)}`,
          `消息ID：${Number(message.id || 0) || ''}`,
          `源码路径：${safeText(codePreview.path || '', 220)}`,
          linkedGameId ? `源码游戏：${linkedGameId}` : '',
          '',
          safeLongText(fileContent || codePreview.snippet || '当前源码未找到完整内容，已回退为预览片段。', ROOM_MEMORY_FILE_MAX_LENGTH - 256)
        ].filter(Boolean).join('\n'),
        metadata: {
          fileType: 'code',
          senderName: safeText(senderName, 60),
          linkedFromMessage: true,
          previewSnippet: safeLongText(codePreview.snippet || '', 1200)
        },
        sourceUserId: Number(message.sender_user_id || 0) || null,
        sourceMessageId: Number(message.id || 0) || null,
        sourceGameId: linkedGameId,
        sourcePath: safeText(codePreview.path || '', 320)
      });
    }

    if (documentPreview?.document_id) {
      const documentId = Number(documentPreview.document_id || 0) || null;
      const linkedDoc = documentId ? documentMap.get(documentId) : null;
      const documentFullText = linkedDoc
        ? await loadDocumentFullText(
          resolveUploadedFilePath(linkedDoc.file_url || ''),
          linkedDoc.file_name || '',
          linkedDoc.mime_type || '',
          linkedDoc.preview_text || documentPreview.preview_text || ''
        )
        : safeLongText(documentPreview.preview_text || '当前文档未找到完整内容，已回退为预览内容。', ROOM_MEMORY_FILE_MAX_LENGTH);

      await upsertRoomMemoryEntry(pool, {
        roomId: parsedRoomId,
        memoryType: 'document',
        sourceKey: `message-document-preview:${message.id}`,
        title: `消息文档/${safeText(documentPreview.name || `document-${documentId || message.id}`, 220)}`,
        content: [
          `发送者：${safeText(senderName, 60)}`,
          `消息ID：${Number(message.id || 0) || ''}`,
          `文档名称：${safeText(documentPreview.name || '', 220)}`,
          documentId ? `文档ID：${documentId}` : '',
          '',
          safeLongText(documentFullText || documentPreview.preview_text || '当前文档未找到可用内容。', ROOM_MEMORY_FILE_MAX_LENGTH - 256)
        ].filter(Boolean).join('\n'),
        metadata: {
          fileType: 'document',
          senderName: safeText(senderName, 60),
          linkedFromMessage: true,
          previewText: safeLongText(documentPreview.preview_text || '', 1200)
        },
        sourceUserId: Number(message.sender_user_id || 0) || null,
        sourceMessageId: Number(message.id || 0) || null,
        sourceDocumentId: documentId
      });
    }
  }

  const memory = await listRoomMemoryEntries(pool, parsedRoomId);
  const summary = await getRoomSummary(pool, parsedRoomId);
  return { summary, memory };
};

const retrieveRelevantMemoryEntries = (entries = [], prompt = '', summaryText = '') => {
  const tokens = extractMemorySearchTokens(prompt, summaryText);
  const weighted = entries
    .map((entry) => {
      const typeWeight = entry.memoryType === 'summary'
        ? 6
        : entry.memoryType === 'profile'
          ? 5
          : entry.memoryType === 'document'
            ? 4
            : entry.memoryType === 'code'
              ? 4
              : 2;
      return {
        entry,
        score: typeWeight
          + scoreMemoryContent(entry.title, tokens) * 2
          + scoreMemoryContent(entry.content, tokens)
      };
    })
    .sort((left, right) => right.score - left.score || String(right.entry.updatedAt || '').localeCompare(String(left.entry.updatedAt || '')));

  return weighted.slice(0, ROOM_MEMORY_CONTEXT_LIMIT).map((item) => item.entry);
};

const findRecentMessageLinkedMemoryEntries = (entries = [], recentMessages = []) => {
  const recentIds = new Set(
    recentMessages
      .map((item) => Number(item?.id || 0))
      .filter((id) => id > 0)
  );
  if (!recentIds.size) return [];

  return entries
    .filter((entry) => recentIds.has(Number(entry?.sourceMessageId || 0)))
    .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
    .slice(0, ROOM_MEMORY_CONTEXT_LIMIT);
};

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
  getRoomPayload,
  generateAiReply,
  notifyRoomMembers,
  removeUploadedFile,
  ensureFriendInviteLinksTable,
  ensureRoomDocumentsTable,
  ensureRoomDocumentStateTable,
  ensureRoomTasksTable,
  ensureRoomSettingsTable,
  ensureRoomSummaryTable,
  ensureRoomMemoryTable,
  mapRoomTaskRow,
  generateFriendInviteCode,
  parseInviteCode,
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
