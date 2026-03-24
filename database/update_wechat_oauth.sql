-- 微信 OAuth 账号绑定表
-- 说明：后端已实现启动时自动建表；此脚本用于手工初始化或巡检。
USE dpccgaming;
CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_user_id VARCHAR(128) NOT NULL,
    union_id VARCHAR(128) NULL,
    provider_username VARCHAR(255) NULL,
    provider_avatar_url VARCHAR(512) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_oauth_provider_user (provider, provider_user_id),
    KEY idx_user_oauth_user_id (user_id),
    KEY idx_user_oauth_provider_union (provider, union_id),
    CONSTRAINT fk_user_oauth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;