-- Migration: 001_multibranch_and_stock_ledger.sql
-- Description: Non-destructive additive migration for multi-branch, stock ledger, shipping, audit logs, and dynamic receipts.

-- 1. Extend branch table
ALTER TABLE `branch` 
  ADD COLUMN IF NOT EXISTS `status` ENUM('active', 'inactive') DEFAULT 'active' AFTER `address`,
  ADD COLUMN IF NOT EXISTS `phone` VARCHAR(50) NULL AFTER `address`,
  ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER `status`;

-- 2. Extend facility (users) table for modern bcrypt and granular permissions
ALTER TABLE `facility`
  ADD COLUMN IF NOT EXISTS `password_hash` VARCHAR(255) NULL AFTER `password`,
  ADD COLUMN IF NOT EXISTS `permissions` JSON NULL AFTER `role`;

-- 3. Extend deposit_history to associate debt payments with a branch
ALTER TABLE `deposit_history`
  ADD COLUMN IF NOT EXISTS `facilityID` VARCHAR(200) NULL AFTER `customerID`,
  ADD INDEX IF NOT EXISTS `idx_deposit_facility` (`facilityID`);

-- 4. Create immutable stock movement ledger
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `facilityID` VARCHAR(200) NOT NULL,
  `store_id` INT NULL,
  `stock_id` INT NOT NULL,
  `movement_type` ENUM(
    'STOCK_IN_SUPPLIER',
    'STOCK_OUT_SALE',
    'STOCK_IN_RETURN',
    'STOCK_OUT_TRANSFER',
    'STOCK_IN_TRANSFER',
    'STOCK_ADJUSTMENT',
    'STOCK_DAMAGE'
  ) NOT NULL,
  `quantity_change` DECIMAL(15,2) NOT NULL,
  `quantity_before` DECIMAL(15,2) NOT NULL,
  `quantity_after` DECIMAL(15,2) NOT NULL,
  `reference_type` VARCHAR(50) NOT NULL,
  `reference_id` VARCHAR(100) NOT NULL,
  `notes` TEXT NULL,
  `performed_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_stock_facility` (`stock_id`, `facilityID`),
  INDEX `idx_movement_type` (`movement_type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Create shipments tables for inter-branch transfer
CREATE TABLE IF NOT EXISTS `shipments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tracking_number` VARCHAR(50) NOT NULL UNIQUE,
  `source_branch` VARCHAR(200) NOT NULL,
  `destination_branch` VARCHAR(200) NOT NULL,
  `source_store_id` INT NULL,
  `destination_store_id` INT NULL,
  `status` ENUM('Draft', 'Pending', 'In Transit', 'Received', 'Cancelled') NOT NULL DEFAULT 'Draft',
  `dispatched_by` INT NULL,
  `dispatched_at` DATETIME NULL,
  `received_by` INT NULL,
  `received_at` DATETIME NULL,
  `notes` TEXT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_source_dest` (`source_branch`, `destination_branch`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `shipment_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shipment_id` INT NOT NULL,
  `stock_id` INT NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `quantity_sent` DECIMAL(15,2) NOT NULL,
  `quantity_received` DECIMAL(15,2) DEFAULT 0,
  INDEX `idx_shipment_id` (`shipment_id`),
  FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. Create centralized audit logs table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `facilityID` VARCHAR(200) NULL,
  `user_id` INT NOT NULL,
  `user_name` VARCHAR(200) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(100) NOT NULL,
  `old_values` JSON NULL,
  `new_values` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_entity` (`entity_type`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7. Backfill deposit_history.facilityID from customer's facilityID where missing
UPDATE `deposit_history` dh
INNER JOIN `customers` c ON dh.customerID = c.id
SET dh.facilityID = c.facilityID
WHERE dh.facilityID IS NULL OR dh.facilityID = '';
