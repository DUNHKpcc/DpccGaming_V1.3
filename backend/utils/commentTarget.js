const COMMENT_TARGETS = {
  game: {
    tableName: 'comments',
    targetColumn: 'game_id',
    requiresRating: true,
    endpoint: targetId => `/games/${targetId}/comments`
  },
  doc: {
    tableName: 'doc_comments',
    targetColumn: 'doc_id',
    requiresRating: false,
    endpoint: targetId => `/docs/${targetId}/comments`
  }
};

const normalizeCommentTargetId = (targetId) => {
  const normalized = String(targetId || '').trim();
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(normalized)) {
    throw new Error('无效的评论目标');
  }
  return normalized;
};

const getCommentTargetConfig = (targetType) => {
  const key = String(targetType || '').trim().toLowerCase();
  const config = COMMENT_TARGETS[key];
  if (!config) {
    throw new Error('不支持的评论目标');
  }
  return config;
};

module.exports = {
  COMMENT_TARGETS,
  getCommentTargetConfig,
  normalizeCommentTargetId
};
