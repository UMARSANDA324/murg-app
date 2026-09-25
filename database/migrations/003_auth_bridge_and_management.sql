-- Migration 003: Auth Bridge Tickets and Management
-- Safe, additive migration. Preserves all existing tables, rows, and business data.

CREATE TABLE IF NOT EXISTS auth_bridge_tickets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket VARCHAR(64) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  facilityID VARCHAR(200) NOT NULL,
  role VARCHAR(50) NOT NULL,
  email VARCHAR(200) NOT NULL,
  name VARCHAR(200) NOT NULL,
  target_path VARCHAR(500) NOT NULL,
  consumed TINYINT(1) NOT NULL DEFAULT 0,
  consumed_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket (ticket),
  INDEX idx_user_id (user_id),
  INDEX idx_expires (expires_at),
  INDEX idx_consumed (consumed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
