-- Migration 004: Password Resets, Goods Requests, Notifications, and Shipment Receipts
-- Safe, additive migration. Preserves all existing tables and data.

-- 1. Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  email VARCHAR(200) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  reset_token VARCHAR(255) NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_user_id (user_id),
  INDEX idx_reset_token (reset_token),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Goods Requests Table
CREATE TABLE IF NOT EXISTS goods_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(64) NOT NULL UNIQUE,
  staff_id INT NOT NULL,
  staff_name VARCHAR(200) NOT NULL,
  requesting_branch VARCHAR(200) NOT NULL,
  stock_id INT NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  requested_quantity DECIMAL(15,2) NOT NULL,
  unit_type VARCHAR(50) NOT NULL DEFAULT 'belt',
  reason VARCHAR(500) NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'SHIPPING_CREATED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  admin_notes VARCHAR(500) NULL,
  source_branch VARCHAR(200) NULL,
  shipment_id BIGINT NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_request_code (request_code),
  INDEX idx_staff_id (staff_id),
  INDEX idx_requesting_branch (requesting_branch),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  role_target VARCHAR(50) NULL,
  facility_id VARCHAR(200) NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'GOODS_REQUEST',
  reference_id VARCHAR(100) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_role_target (role_target),
  INDEX idx_facility_id (facility_id),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Shipment Receipts Table
CREATE TABLE IF NOT EXISTS shipment_receipts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  receipt_code VARCHAR(64) NOT NULL UNIQUE,
  shipment_id BIGINT NOT NULL,
  request_id BIGINT NULL,
  source_branch VARCHAR(200) NOT NULL,
  destination_branch VARCHAR(200) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  quantity DECIMAL(15,2) NOT NULL,
  unit_type VARCHAR(50) NOT NULL DEFAULT 'belt',
  dispatched_by INT NOT NULL,
  dispatched_by_name VARCHAR(200) NOT NULL,
  consumed TINYINT(1) NOT NULL DEFAULT 0,
  consumed_by INT NULL,
  consumed_by_name VARCHAR(200) NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_receipt_code (receipt_code),
  INDEX idx_shipment_id (shipment_id),
  INDEX idx_destination (destination_branch),
  INDEX idx_consumed (consumed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
