-- ===========================================
-- DPCC Gaming 讨论模式数据库升级补丁
-- 目标：
-- 1) 支持最多4人讨论房间（绑定现有游戏）
-- 2) 支持好友关系与房间邀请
-- 3) 支持房间消息（user/ai/system）
-- 4) 支持按游戏匹配队列
-- 可多次安全执行，已存在对象会自动跳过
-- ===========================================

USE dpccgaming;

-- ===========================================
-- 1. 好友关系表
-- ===========================================
CREATE TABLE IF NOT EXISTS friendships (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    requester_id INT NOT NULL,
    addressee_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'blocked') NOT NULL DEFAULT 'pending',
    responded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- requester -> users FK
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'friendships'
       AND CONSTRAINT_NAME = 'fk_friendships_requester_id') = 0,
    'ALTER TABLE friendships ADD CONSTRAINT fk_friendships_requester_id FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT "fk_friendships_requester_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- addressee -> users FK
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'friendships'
       AND CONSTRAINT_NAME = 'fk_friendships_addressee_id') = 0,
    'ALTER TABLE friendships ADD CONSTRAINT fk_friendships_addressee_id FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT "fk_friendships_addressee_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Unique pair index
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'friendships'
       AND INDEX_NAME = 'uq_friendships_pair') = 0,
    'CREATE UNIQUE INDEX uq_friendships_pair ON friendships(requester_id, addressee_id)',
    'SELECT "uq_friendships_pair exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'friendships'
       AND INDEX_NAME = 'idx_friendships_addressee_status') = 0,
    'CREATE INDEX idx_friendships_addressee_status ON friendships(addressee_id, status)',
    'SELECT "idx_friendships_addressee_status exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'friendships'
       AND INDEX_NAME = 'idx_friendships_requester_status') = 0,
    'CREATE INDEX idx_friendships_requester_status ON friendships(requester_id, status)',
    'SELECT "idx_friendships_requester_status exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===========================================
-- 2. 讨论房间表
-- ===========================================
CREATE TABLE IF NOT EXISTS discussion_rooms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_uuid CHAR(36) NOT NULL,
    room_code VARCHAR(12) NULL,
    game_id VARCHAR(50) NOT NULL,
    host_user_id INT NOT NULL,
    mode ENUM('friend', 'room', 'match') NOT NULL DEFAULT 'room',
    visibility ENUM('private', 'public') NOT NULL DEFAULT 'private',
    status ENUM('waiting', 'active', 'closed') NOT NULL DEFAULT 'waiting',
    max_members TINYINT UNSIGNED NOT NULL DEFAULT 4,
    title VARCHAR(120) NULL,
    started_at TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_rooms'
       AND CONSTRAINT_NAME = 'fk_discussion_rooms_game_id') = 0,
    'ALTER TABLE discussion_rooms ADD CONSTRAINT fk_discussion_rooms_game_id FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE',
    'SELECT "fk_discussion_rooms_game_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_rooms'
       AND CONSTRAINT_NAME = 'fk_discussion_rooms_host_user_id') = 0,
    'ALTER TABLE discussion_rooms ADD CONSTRAINT fk_discussion_rooms_host_user_id FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT "fk_discussion_rooms_host_user_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_rooms'
       AND INDEX_NAME = 'uq_discussion_rooms_room_uuid') = 0,
    'CREATE UNIQUE INDEX uq_discussion_rooms_room_uuid ON discussion_rooms(room_uuid)',
    'SELECT "uq_discussion_rooms_room_uuid exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_rooms'
       AND INDEX_NAME = 'uq_discussion_rooms_room_code') = 0,
    'CREATE UNIQUE INDEX uq_discussion_rooms_room_code ON discussion_rooms(room_code)',
    'SELECT "uq_discussion_rooms_room_code exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_rooms'
       AND INDEX_NAME = 'idx_discussion_rooms_game_status') = 0,
    'CREATE INDEX idx_discussion_rooms_game_status ON discussion_rooms(game_id, status)',
    'SELECT "idx_discussion_rooms_game_status exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_rooms'
       AND INDEX_NAME = 'idx_discussion_rooms_host_status') = 0,
    'CREATE INDEX idx_discussion_rooms_host_status ON discussion_rooms(host_user_id, status)',
    'SELECT "idx_discussion_rooms_host_status exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===========================================
-- 3. 房间成员表
-- ===========================================
CREATE TABLE IF NOT EXISTS discussion_room_members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('host', 'member') NOT NULL DEFAULT 'member',
    join_source ENUM('friend_invite', 'room_code', 'match', 'manual') NOT NULL DEFAULT 'manual',
    status ENUM('joined', 'left', 'kicked') NOT NULL DEFAULT 'joined',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_members'
       AND CONSTRAINT_NAME = 'fk_discussion_room_members_room_id') = 0,
    'ALTER TABLE discussion_room_members ADD CONSTRAINT fk_discussion_room_members_room_id FOREIGN KEY (room_id) REFERENCES discussion_rooms(id) ON DELETE CASCADE',
    'SELECT "fk_discussion_room_members_room_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_members'
       AND CONSTRAINT_NAME = 'fk_discussion_room_members_user_id') = 0,
    'ALTER TABLE discussion_room_members ADD CONSTRAINT fk_discussion_room_members_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT "fk_discussion_room_members_user_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_members'
       AND INDEX_NAME = 'uq_discussion_room_members_room_user') = 0,
    'CREATE UNIQUE INDEX uq_discussion_room_members_room_user ON discussion_room_members(room_id, user_id)',
    'SELECT "uq_discussion_room_members_room_user exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_members'
       AND INDEX_NAME = 'idx_discussion_room_members_user_status') = 0,
    'CREATE INDEX idx_discussion_room_members_user_status ON discussion_room_members(user_id, status)',
    'SELECT "idx_discussion_room_members_user_status exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_members'
       AND INDEX_NAME = 'idx_discussion_room_members_room_status') = 0,
    'CREATE INDEX idx_discussion_room_members_room_status ON discussion_room_members(room_id, status)',
    'SELECT "idx_discussion_room_members_room_status exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===========================================
-- 4. 房间消息表
-- ===========================================
CREATE TABLE IF NOT EXISTS discussion_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    sender_type ENUM('user', 'ai', 'system') NOT NULL,
    sender_user_id INT NULL,
    message_type ENUM('text', 'system') NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    metadata_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_messages'
       AND CONSTRAINT_NAME = 'fk_discussion_messages_room_id') = 0,
    'ALTER TABLE discussion_messages ADD CONSTRAINT fk_discussion_messages_room_id FOREIGN KEY (room_id) REFERENCES discussion_rooms(id) ON DELETE CASCADE',
    'SELECT "fk_discussion_messages_room_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_messages'
       AND CONSTRAINT_NAME = 'fk_discussion_messages_sender_user_id') = 0,
    'ALTER TABLE discussion_messages ADD CONSTRAINT fk_discussion_messages_sender_user_id FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT "fk_discussion_messages_sender_user_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_messages'
       AND INDEX_NAME = 'idx_discussion_messages_room_created') = 0,
    'CREATE INDEX idx_discussion_messages_room_created ON discussion_messages(room_id, created_at)',
    'SELECT "idx_discussion_messages_room_created exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===========================================
-- 5. 房间邀请表（好友邀请）
-- ===========================================
CREATE TABLE IF NOT EXISTS discussion_room_invites (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    inviter_user_id INT NOT NULL,
    invitee_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_invites'
       AND CONSTRAINT_NAME = 'fk_discussion_room_invites_room_id') = 0,
    'ALTER TABLE discussion_room_invites ADD CONSTRAINT fk_discussion_room_invites_room_id FOREIGN KEY (room_id) REFERENCES discussion_rooms(id) ON DELETE CASCADE',
    'SELECT "fk_discussion_room_invites_room_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_invites'
       AND CONSTRAINT_NAME = 'fk_discussion_room_invites_inviter_user_id') = 0,
    'ALTER TABLE discussion_room_invites ADD CONSTRAINT fk_discussion_room_invites_inviter_user_id FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT "fk_discussion_room_invites_inviter_user_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_invites'
       AND CONSTRAINT_NAME = 'fk_discussion_room_invites_invitee_id') = 0,
    'ALTER TABLE discussion_room_invites ADD CONSTRAINT fk_discussion_room_invites_invitee_id FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT "fk_discussion_room_invites_invitee_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_invites'
       AND INDEX_NAME = 'uq_discussion_room_invites_room_invitee') = 0,
    'CREATE UNIQUE INDEX uq_discussion_room_invites_room_invitee ON discussion_room_invites(room_id, invitee_id)',
    'SELECT "uq_discussion_room_invites_room_invitee exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_room_invites'
       AND INDEX_NAME = 'idx_discussion_room_invites_invitee_status') = 0,
    'CREATE INDEX idx_discussion_room_invites_invitee_status ON discussion_room_invites(invitee_id, status)',
    'SELECT "idx_discussion_room_invites_invitee_status exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===========================================
-- 6. 匹配队列表（当前排队）
-- ===========================================
CREATE TABLE IF NOT EXISTS discussion_match_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    game_id VARCHAR(50) NOT NULL,
    preference_json JSON NULL,
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_match_queue'
       AND CONSTRAINT_NAME = 'fk_discussion_match_queue_user_id') = 0,
    'ALTER TABLE discussion_match_queue ADD CONSTRAINT fk_discussion_match_queue_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT "fk_discussion_match_queue_user_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_match_queue'
       AND CONSTRAINT_NAME = 'fk_discussion_match_queue_game_id') = 0,
    'ALTER TABLE discussion_match_queue ADD CONSTRAINT fk_discussion_match_queue_game_id FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE',
    'SELECT "fk_discussion_match_queue_game_id exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 一个用户同时只能有一个排队记录
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_match_queue'
       AND INDEX_NAME = 'uq_discussion_match_queue_user') = 0,
    'CREATE UNIQUE INDEX uq_discussion_match_queue_user ON discussion_match_queue(user_id)',
    'SELECT "uq_discussion_match_queue_user exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'dpccgaming'
       AND TABLE_NAME = 'discussion_match_queue'
       AND INDEX_NAME = 'idx_discussion_match_queue_game_time') = 0,
    'CREATE INDEX idx_discussion_match_queue_game_time ON discussion_match_queue(game_id, queued_at)',
    'SELECT "idx_discussion_match_queue_game_time exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===========================================
-- 升级结束
-- ===========================================
SELECT 'Discussion mode schema migration completed.' AS message;
