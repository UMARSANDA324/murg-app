-- Migration 006: Goods Request Approval Workflow Redesign
-- Implements: PENDING → APPROVED → RELEASED state machine
-- Adds: approval receipts, collection receipts, proper branch authorization
-- Safe, additive migration. Does NOT drop or modify existing rows or business data.

-- 1. Extend goods_requests with new workflow fields
ALTER TABLE goods_requests
  -- Extend status enum to include APPROVED and RELEASED
  MODIFY COLUMN status ENUM(
    'PENDING',
    'APPROVED',
    'REJECTED',
    'RELEASED',
    'SHIPPING_CREATED',
    'IN_TRANSIT',
    'RECEIVED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING',
  -- Approval receipt code (generated on APPROVED transition)
  ADD COLUMN IF NOT EXISTS receipt_code VARCHAR(64) NULL AFTER shipment_id,
  -- Who approved and when
  ADD COLUMN IF NOT EXISTS approved_by INT NULL AFTER reviewed_by,
  ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(200) NULL AFTER approved_by,
  ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL AFTER approved_by_name,
  -- Source stock ID at time of approval
  ADD COLUMN IF NOT EXISTS source_stock_id INT NULL AFTER source_branch,
  -- Who released (branch staff) and when
  ADD COLUMN IF NOT EXISTS released_by INT NULL AFTER approved_at,
  ADD COLUMN IF NOT EXISTS released_by_name VARCHAR(200) NULL AFTER released_by,
  ADD COLUMN IF NOT EXISTS released_at DATETIME NULL AFTER released_by_name,
  -- Final collection receipt code
  ADD COLUMN IF NOT EXISTS collection_code VARCHAR(64) NULL AFTER released_at,
  -- Rejection reason stored separately for clarity
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500) NULL AFTER admin_notes;

-- 2. Unique indexes to prevent duplicate receipt / collection codes
ALTER TABLE goods_requests
  ADD UNIQUE KEY IF NOT EXISTS `uq_receipt_code` (`receipt_code`),
  ADD UNIQUE KEY IF NOT EXISTS `uq_collection_code` (`collection_code`),
  ADD INDEX IF NOT EXISTS `idx_approved_by` (`approved_by`),
  ADD INDEX IF NOT EXISTS `idx_released_by` (`released_by`),
  ADD INDEX IF NOT EXISTS `idx_receipt_code` (`receipt_code`),
  ADD INDEX IF NOT EXISTS `idx_collection_code` (`collection_code`);

-- 3. Add read_at timestamp to notifications for richer audit trail
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at DATETIME NULL AFTER is_read;

-- 4. Backfill: requests that were previously SHIPPING_CREATED/RECEIVED/IN_TRANSIT
--    were using the old workflow and should remain untouched (no data migration needed).
--    The new workflow introduces APPROVED and RELEASED as new statuses.
