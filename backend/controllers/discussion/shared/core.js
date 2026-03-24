const AI_REPLY_CHAR_LIMIT = 80;
const AI_PROGRESS_STAGES = Object.freeze({
  queued: 'queued',
  memory: 'memory',
  generating: 'generating',
  finalizing: 'finalizing',
  error: 'error'
});

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

module.exports = {
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
};
