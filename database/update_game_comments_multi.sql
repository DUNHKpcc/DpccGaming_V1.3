-- 允许同一用户为同一游戏发布多条评论。
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'comments'
     AND INDEX_NAME = 'unique_user_game') > 0,
  'ALTER TABLE comments DROP INDEX unique_user_game',
  'SELECT "unique_user_game index already absent" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'comments'
     AND INDEX_NAME = 'idx_comments_user_game') = 0,
  'CREATE INDEX idx_comments_user_game ON comments(user_id, game_id)',
  'SELECT "idx_comments_user_game index already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
