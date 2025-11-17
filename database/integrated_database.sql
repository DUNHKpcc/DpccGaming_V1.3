-- ===========================================
-- DPCC Gaming 数据库完整整合脚本
-- 包含所有数据库结构、更新和功能
-- ===========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS dpccgaming CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE dpccgaming;

-- ===========================================
-- 1. 基础表结构创建
-- ===========================================

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建游戏表
CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    thumbnail_url VARCHAR(255),
    game_url VARCHAR(255),
    play_count INT DEFAULT 0,
    rating_avg DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建评论表
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    game_id VARCHAR(50) NOT NULL,
    rating INT DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    comment_text TEXT,
    play_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_game (user_id, game_id)
);

-- ===========================================
-- 2. 用户角色权限系统
-- ===========================================

-- 添加用户角色字段
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'users' 
     AND COLUMN_NAME = 'role') = 0,
    'ALTER TABLE users ADD COLUMN role ENUM(''user'', ''admin'', ''super_admin'') DEFAULT ''user'' AFTER email',
    'SELECT "role column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加用户状态字段（可选，用于禁用用户）
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'users' 
     AND COLUMN_NAME = 'status') = 0,
    'ALTER TABLE users ADD COLUMN status ENUM(''active'', ''inactive'', ''banned'') DEFAULT ''active'' AFTER role',
    'SELECT "status column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 创建用户角色索引
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ===========================================
-- 3. 游戏上传和审核系统
-- ===========================================

-- 添加游戏审核状态字段
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND COLUMN_NAME = 'status') = 0,
    'ALTER TABLE games ADD COLUMN status ENUM(''pending'', ''approved'', ''rejected'') DEFAULT ''pending'' AFTER rating_avg',
    'SELECT "status column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 uploaded_by 字段
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND COLUMN_NAME = 'uploaded_by') = 0,
    'ALTER TABLE games ADD COLUMN uploaded_by INT NULL AFTER status',
    'SELECT "uploaded_by column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 uploaded_at 字段
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND COLUMN_NAME = 'uploaded_at') = 0,
    'ALTER TABLE games ADD COLUMN uploaded_at TIMESTAMP NULL AFTER uploaded_by',
    'SELECT "uploaded_at column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 reviewed_by 字段
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND COLUMN_NAME = 'reviewed_by') = 0,
    'ALTER TABLE games ADD COLUMN reviewed_by INT NULL AFTER uploaded_at',
    'SELECT "reviewed_by column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 reviewed_at 字段
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND COLUMN_NAME = 'reviewed_at') = 0,
    'ALTER TABLE games ADD COLUMN reviewed_at TIMESTAMP NULL AFTER reviewed_by',
    'SELECT "reviewed_at column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 review_notes 字段
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND COLUMN_NAME = 'review_notes') = 0,
    'ALTER TABLE games ADD COLUMN review_notes TEXT NULL AFTER reviewed_at',
    'SELECT "review_notes column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加游戏审核外键约束
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND CONSTRAINT_NAME = 'fk_games_uploaded_by') = 0,
    'ALTER TABLE games ADD CONSTRAINT fk_games_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT "fk_games_uploaded_by constraint already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND CONSTRAINT_NAME = 'fk_games_reviewed_by') = 0,
    'ALTER TABLE games ADD CONSTRAINT fk_games_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT "fk_games_reviewed_by constraint already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 创建游戏审核索引
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND INDEX_NAME = 'idx_games_status') = 0,
    'CREATE INDEX idx_games_status ON games(status)',
    'SELECT "idx_games_status index already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND INDEX_NAME = 'idx_games_uploaded_by') = 0,
    'CREATE INDEX idx_games_uploaded_by ON games(uploaded_by)',
    'SELECT "idx_games_uploaded_by index already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'games' 
     AND INDEX_NAME = 'idx_games_reviewed_by') = 0,
    'CREATE INDEX idx_games_reviewed_by ON games(reviewed_by)',
    'SELECT "idx_games_reviewed_by index already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===========================================
-- 4. 评论回复功能
-- ===========================================

-- 添加 parent_id 字段
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'comments' 
     AND COLUMN_NAME = 'parent_id') = 0,
    'ALTER TABLE comments ADD COLUMN parent_id INT NULL AFTER comment_text',
    'SELECT "parent_id column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 reply_to_user_id 字段  
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'comments' 
     AND COLUMN_NAME = 'reply_to_user_id') = 0,
    'ALTER TABLE comments ADD COLUMN reply_to_user_id INT NULL AFTER parent_id',
    'SELECT "reply_to_user_id column already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加评论回复外键约束
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'comments' 
     AND CONSTRAINT_NAME = 'fk_comments_parent') = 0,
    'ALTER TABLE comments ADD CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE',
    'SELECT "fk_comments_parent constraint already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'dpccgaming' 
     AND TABLE_NAME = 'comments' 
     AND CONSTRAINT_NAME = 'fk_comments_reply_to_user') = 0,
    'ALTER TABLE comments ADD CONSTRAINT fk_comments_reply_to_user FOREIGN KEY (reply_to_user_id) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT "fk_comments_reply_to_user constraint already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 创建评论回复索引
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_reply_to_user_id ON comments(reply_to_user_id);

-- ===========================================
-- 5. 通知系统
-- ===========================================

-- 创建通知表
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('game_approved', 'game_rejected', 'comment_reply') NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    related_game_id VARCHAR(255) NULL,
    related_comment_id INT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    
    -- 索引
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- ===========================================
-- 6. 基础索引创建
-- ===========================================

-- 创建基础查询索引
CREATE INDEX IF NOT EXISTS idx_comments_game_id ON comments(game_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_games_game_id ON games(game_id);

-- ===========================================
-- 7. 示例数据插入
-- ===========================================

-- 插入示例游戏数据
INSERT IGNORE INTO games (game_id, title, description, category, thumbnail_url, game_url) VALUES
('web-mobile-001', '像素逃生', '骑士挥舞刺刀击败骷髅.', '动作', 'GameImg.jpg', 'games/web-mobile-001/index.html');

-- 插入示例用户数据（如果需要）
INSERT IGNORE INTO users (id, username, password_hash, email, role, status) VALUES
(1, 'testuser', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'test@example.com', 'user', 'active');

-- 插入示例通知数据
INSERT IGNORE INTO notifications (user_id, type, title, content, related_game_id, is_read) VALUES
(1, 'game_approved', '游戏审核通过', '您上传的游戏"超级马里奥"已通过审核并成功上架！', NULL, FALSE),
(1, 'game_rejected', '游戏审核未通过', '您上传的游戏"测试游戏"未通过审核，原因：内容不符合平台规范。', NULL, FALSE),
(1, 'comment_reply', '收到评论回复', '您在游戏"超级马里奥"的评论收到了新的回复', NULL, FALSE);

-- ===========================================
-- 8. 数据更新和清理
-- ===========================================

-- 设置现有管理员用户（请根据实际情况修改）
UPDATE users SET role = 'admin' WHERE username IN ('admin', 'dpccgamingSunJiaHao', 'dpccgamingShenRuiYing');

-- 更新现有游戏状态为已审核
UPDATE games SET status = 'approved', reviewed_at = created_at WHERE status = 'pending';

-- ===========================================
-- 9. 最终验证和显示结果
-- ===========================================

-- 显示创建结果
SELECT 'DPCC Gaming database integrated successfully!' as message;

-- 显示各表统计信息
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Games', COUNT(*) FROM games
UNION ALL
SELECT 'Comments', COUNT(*) FROM comments
UNION ALL
SELECT 'Notifications', COUNT(*) FROM notifications;

-- 显示用户角色分布
SELECT role, COUNT(*) as count FROM users GROUP BY role;

-- 显示游戏状态分布
SELECT status, COUNT(*) as count FROM games GROUP BY status;

-- 显示表结构信息
DESCRIBE users;
DESCRIBE games;
DESCRIBE comments;
DESCRIBE notifications;
