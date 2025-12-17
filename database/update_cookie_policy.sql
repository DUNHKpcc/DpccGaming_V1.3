-- Cookie 同意记录数据表
CREATE TABLE IF NOT EXISTS cookie_consents (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cookie_id CHAR(36) NOT NULL UNIQUE,
  user_id INT UNSIGNED NULL,
  consent_status ENUM('accepted', 'rejected', 'customized') NOT NULL DEFAULT 'accepted',
  preferences JSON NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cookie_consents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE
  SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
CREATE INDEX idx_cookie_consents_user ON cookie_consents (user_id);
CREATE INDEX idx_cookie_consents_status ON cookie_consents (consent_status);