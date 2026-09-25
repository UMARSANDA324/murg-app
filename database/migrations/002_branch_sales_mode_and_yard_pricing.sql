-- Migration: 002_branch_sales_mode_and_yard_pricing.sql
-- Description: Non-destructive additive migration for Branch Sales Modes (DEALER vs PER_YARD),
-- per-yard pricing on stocks, and index optimization.

-- 1. Extend branch table with sales_mode
ALTER TABLE `branch`
  ADD COLUMN IF NOT EXISTS `sales_mode` ENUM('DEALER', 'PER_YARD') NOT NULL DEFAULT 'DEALER' AFTER `status`,
  ADD INDEX IF NOT EXISTS `idx_branch_sales_mode` (`sales_mode`);

-- 2. Extend stocks table with price_per_yard
ALTER TABLE `stocks`
  ADD COLUMN IF NOT EXISTS `price_per_yard` DECIMAL(15,2) NULL DEFAULT NULL AFTER `selling`;

-- 3. Guarantee backward compatibility: Ensure existing branches are DEALER mode
UPDATE `branch`
SET `sales_mode` = 'DEALER'
WHERE `sales_mode` IS NULL OR `sales_mode` = '';
