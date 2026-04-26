CREATE TABLE IF NOT EXISTS doc_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  doc_id VARCHAR(120) NOT NULL,
  rating INT NULL,
  comment_text TEXT NOT NULL,
  parent_id INT NULL,
  reply_to_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES doc_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_doc_comments_doc_id (doc_id),
  INDEX idx_doc_comments_user_id (user_id),
  INDEX idx_doc_comments_parent_id (parent_id),
  INDEX idx_doc_comments_reply_to_user_id (reply_to_user_id)
);
