-- ===========================================
-- DPCC Gaming 用户头像升级补丁
-- 目标：
-- 1) users 表增加 avatar_url 字段
-- 2) 新老用户统一默认头像
-- 可重复执行（幂等）
-- ===========================================

USE dpccgaming;

SET @default_avatar := '/avatars/default-avatar.svg';

-- 添加头像字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = 'dpccgaming'
     AND TABLE_NAME = 'users'
     AND COLUMN_NAME = 'avatar_url') = 0,
  'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT ''/avatars/default-avatar.svg'' AFTER email',
  'SELECT "avatar_url column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 为历史用户补默认头像
UPDATE users
SET avatar_url = @default_avatar
WHERE avatar_url IS NULL OR TRIM(avatar_url) = '';

-- 可选索引（便于未来按头像字段统计）
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = 'dpccgaming'
     AND TABLE_NAME = 'users'
     AND INDEX_NAME = 'idx_users_avatar_url') = 0,
  'CREATE INDEX idx_users_avatar_url ON users(avatar_url)',
  'SELECT "idx_users_avatar_url already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
