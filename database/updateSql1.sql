-- ===========================================
-- DPCC Gaming 游戏表单表升级补丁
-- 目标：为 games 表新增 engine, code_type, video_url 字段
-- 可多次安全执行，已存在字段会自动跳过
-- ===========================================

-- 新增 engine 字段
SET @sql =
IF (
  (
    SELECT
      COUNT(*)
    FROM
      INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = 'dpccgaming'
      AND TABLE_NAME = 'games'
      AND COLUMN_NAME = 'engine'
  ) = 0
  , 'ALTER TABLE games ADD COLUMN engine VARCHAR(50) NULL AFTER category'
  , 'SELECT "engine column already exists" as message'
);
PREPARE stmt
FROM
  @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 新增 code_type 字段
SET @sql =
IF (
  (
    SELECT
      COUNT(*)
    FROM
      INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = 'dpccgaming'
      AND TABLE_NAME = 'games'
      AND COLUMN_NAME = 'code_type'
  ) = 0
  , 'ALTER TABLE games ADD COLUMN code_type VARCHAR(50) NULL AFTER engine'
  , 'SELECT "code_type column already exists" as message'
);
PREPARE stmt
FROM
  @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 新增 video_url 字段
SET @sql =
IF (
  (
    SELECT
      COUNT(*)
    FROM
      INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = 'dpccgaming'
      AND TABLE_NAME = 'games'
      AND COLUMN_NAME = 'video_url'
  ) = 0
  , 'ALTER TABLE games ADD COLUMN video_url VARCHAR(255) NULL AFTER thumbnail_url'
  , 'SELECT "video_url column already exists" as message'
);
PREPARE stmt
FROM
  @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===========================================
-- 升级结束
-- ===========================================