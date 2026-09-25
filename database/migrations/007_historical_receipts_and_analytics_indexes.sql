-- Migration: 007_historical_receipts_and_analytics_indexes.sql
-- Description: Non-destructive additive index optimization for historical receipt lookups, daily ledger grouping, and DAS/WAS/MAS aggregations.

-- 1. Index on orders.orderID for instant historical receipt and line-item lookup
ALTER TABLE `orders` ADD INDEX IF NOT EXISTS `idx_orders_orderid` (`orderID`);

-- 2. Composite index on orders(facilityID, creation) for branch-scoped date filtering and DAS/WAS/MAS
ALTER TABLE `orders` ADD INDEX IF NOT EXISTS `idx_orders_facility_creation` (`facilityID`, `creation`);

-- 3. Index on orders.creation for entire-app analytics queries
ALTER TABLE `orders` ADD INDEX IF NOT EXISTS `idx_orders_creation` (`creation`);

-- 4. Composite index on stock_movements(facilityID, created_at) for branch daily ledger timelines
ALTER TABLE `stock_movements` ADD INDEX IF NOT EXISTS `idx_sm_facility_created` (`facilityID`, `created_at`);
