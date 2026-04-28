CREATE TABLE IF NOT EXISTS doc_stars (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  doc_id VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_doc_stars_user_doc (user_id, doc_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_doc_stars_doc_id (doc_id),
  INDEX idx_doc_stars_user_id (user_id)
);
