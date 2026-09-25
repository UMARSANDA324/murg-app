-- Migration 005: Support Custom/Manual Product Entries in Goods Requests
-- Safe, additive migration. Does NOT drop or modify existing columns or data.

-- 1. Make stock_id nullable (custom products won't have a catalog ID)
ALTER TABLE goods_requests
  MODIFY COLUMN stock_id INT NULL;

-- 2. Add product_source column to distinguish catalog vs manual entries
ALTER TABLE goods_requests
  ADD COLUMN IF NOT EXISTS product_source ENUM('CATALOG', 'CUSTOM') NOT NULL DEFAULT 'CATALOG'
  AFTER stock_id;

-- 3. Index for source type queries
ALTER TABLE goods_requests
  ADD INDEX IF NOT EXISTS idx_product_source (product_source);
