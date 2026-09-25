-- ======================================================
-- MURG DATABASE BACKUP PRE-MQBPZUTQ MIGRATION
-- Generated: 2026-09-17 05:36:37
-- Database: murg
-- ======================================================

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- Table structure for `branch`
DROP TABLE IF EXISTS `branch`;
CREATE TABLE `branch` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table `branch`
INSERT INTO `branch` (`id`, `facilityID`, `name`, `address`) VALUES
('4', 'MURG/001', 'Alh Yasir', 'No. 123 testing street, Kano');

-- Table structure for `cart`
DROP TABLE IF EXISTS `cart`;
CREATE TABLE `cart` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `staffID` varchar(200) NOT NULL,
  `stockID` int(11) NOT NULL,
  `store_id` int(11) DEFAULT NULL,
  `item` varchar(200) NOT NULL,
  `price` varchar(200) NOT NULL,
  `quantity` varchar(200) NOT NULL,
  `subtotal` varchar(200) NOT NULL,
  `discount` varchar(200) DEFAULT '0',
  `status` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cart_store_id` (`store_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `conca`
DROP TABLE IF EXISTS `conca`;
CREATE TABLE `conca` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lastID` varchar(200) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table `conca`
INSERT INTO `conca` (`id`, `lastID`) VALUES
('1', '2');

-- Table structure for `customers`
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `name` varchar(200) NOT NULL,
  `phone` varchar(200) NOT NULL,
  `email` varchar(200) NOT NULL,
  `gender` varchar(200) NOT NULL,
  `address` varchar(200) NOT NULL,
  `creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `updation` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `debt_cart`
DROP TABLE IF EXISTS `debt_cart`;
CREATE TABLE `debt_cart` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) NOT NULL,
  `customerID` varchar(200) NOT NULL,
  `staffID` varchar(200) NOT NULL,
  `stockID` int(11) DEFAULT NULL,
  `store_id` int(11) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `item` varchar(200) NOT NULL,
  `price` varchar(200) NOT NULL,
  `quantity` varchar(200) NOT NULL,
  `subtotal` varchar(200) NOT NULL,
  `discount` decimal(15,2) DEFAULT 0.00,
  `status` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_debt_cart_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `deposit_history`
DROP TABLE IF EXISTS `deposit_history`;
CREATE TABLE `deposit_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customerID` int(11) NOT NULL,
  `transaction_id` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `previous_balance` decimal(10,2) NOT NULL,
  `new_balance` decimal(10,2) NOT NULL,
  `deposit_date` datetime NOT NULL DEFAULT current_timestamp(),
  `processed_by` varchar(100) NOT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `expense`
DROP TABLE IF EXISTS `expense`;
CREATE TABLE `expense` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `item` varchar(200) NOT NULL,
  `price` varchar(200) NOT NULL,
  `type` varchar(11) DEFAULT NULL,
  `creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `updation` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `sync_status` enum('pending','synced','failed') DEFAULT 'pending',
  `last_sync` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table `expense`
INSERT INTO `expense` (`id`, `facilityID`, `item`, `price`, `type`, `creation`, `updation`, `sync_status`, `last_sync`) VALUES
('1', 'MURG/001', 'company cash', '178000', 'in', '2026-08-04 10:24:37', NULL, 'pending', NULL),
('2', 'MURG/001', 'kudin dakko', '9000', 'out', '2026-08-04 17:29:56', '2026-08-04 17:33:24', 'pending', NULL),
('3', 'MURG/001', 'kudin dakko', '1000', 'out', '2026-08-05 14:45:43', NULL, 'pending', NULL),
('4', 'MURG/001', 'kudin dakko', '7000', 'out', '2026-08-06 12:05:04', '2026-08-06 14:48:20', 'pending', NULL),
('5', 'MURG/001', 'kudin sabalan victory', '5000', 'out', '2026-08-06 17:01:39', NULL, 'pending', NULL),
('6', 'MURG/001', 'company cash', '5000', 'out', '2026-08-06 17:04:46', NULL, 'pending', NULL),
('7', 'MURG/001', 'kudin dakko', '1000', 'out', '2026-08-07 10:44:06', NULL, 'pending', NULL);

-- Table structure for `facility`
DROP TABLE IF EXISTS `facility`;
CREATE TABLE `facility` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) NOT NULL,
  `agentID` varchar(200) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `email` varchar(200) NOT NULL,
  `phone` varchar(200) NOT NULL,
  `gender` varchar(200) NOT NULL,
  `dob` varchar(200) NOT NULL,
  `fname` varchar(200) NOT NULL,
  `address` varchar(200) NOT NULL,
  `country` varchar(200) NOT NULL,
  `state` varchar(200) NOT NULL,
  `lga` varchar(200) NOT NULL,
  `type` varchar(200) NOT NULL,
  `plan` varchar(200) NOT NULL,
  `price` varchar(200) NOT NULL,
  `role` varchar(200) NOT NULL,
  `status` int(11) NOT NULL,
  `paid` varchar(200) NOT NULL,
  `due` varchar(200) NOT NULL,
  `password` varchar(200) NOT NULL,
  `creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `updation` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `last_stock_reset` date DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table `facility`
INSERT INTO `facility` (`id`, `facilityID`, `agentID`, `name`, `email`, `phone`, `gender`, `dob`, `fname`, `address`, `country`, `state`, `lga`, `type`, `plan`, `price`, `role`, `status`, `paid`, `due`, `password`, `creation`, `updation`, `last_stock_reset`) VALUES
('4', 'MURG/001', '1', 'Alh Yasir', 'yasir@gmail.com', '1234567890', 'Male', '', 'Alh Yasir', 'No 123 Testing street', 'Nigeria', 'Kano', '', '', '', '', 'Admin', '1', '', '', 'fd149fa1f2a2fee8d88bc1be14467a81', '2025-06-17 16:16:03', '2026-03-26 13:31:42', '0000-00-00'),
('6', 'MURG/001', 'N/A', 'Bilya staff1', 'staff1@gmail.com', '081234565789', 'Male', '', 'ALH Yasir', 'No 123 Testing street', '', '', '', '', '', '', 'Staff', '1', '', '', '827ccb0eea8a706c4c34a16891f84e7b', '2026-03-11 07:30:03', '2026-03-26 12:37:32', '0000-00-00');

-- Table structure for `order_items`
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `orderID` varchar(255) NOT NULL,
  `stockID` int(11) NOT NULL,
  `item` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int(11) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `orders`
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `staffID` varchar(200) NOT NULL,
  `stockID` int(11) DEFAULT NULL,
  `item` varchar(200) NOT NULL,
  `price` varchar(200) NOT NULL,
  `quantity` varchar(200) NOT NULL,
  `subtotal` varchar(200) NOT NULL,
  `item_discount` varchar(200) DEFAULT '0',
  `staff` varchar(200) DEFAULT NULL,
  `payment` varchar(200) DEFAULT NULL,
  `orderID` varchar(200) DEFAULT NULL,
  `discount` varchar(200) DEFAULT NULL,
  `status` int(11) NOT NULL,
  `customerID` int(11) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `buyer_name` varchar(255) DEFAULT NULL,
  `amount_paid` varchar(200) DEFAULT NULL,
  `change_given` varchar(200) DEFAULT NULL,
  `net_total` varchar(200) DEFAULT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `cash` varchar(200) DEFAULT NULL,
  `pos` varchar(200) DEFAULT NULL,
  `transfer` varchar(200) DEFAULT NULL,
  `creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `updation` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `sync_status` enum('pending','synced','failed') DEFAULT 'pending',
  `last_sync` timestamp NULL DEFAULT NULL,
  `sync_attempts` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `outstand`
DROP TABLE IF EXISTS `outstand`;
CREATE TABLE `outstand` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `customerID` varchar(200) DEFAULT NULL,
  `staffID` varchar(200) NOT NULL,
  `Customer` varchar(200) NOT NULL,
  `staff` varchar(200) NOT NULL,
  `amount` varchar(200) NOT NULL,
  `balance` varchar(200) NOT NULL,
  `creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `updation` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `purchase_deposit_history`
DROP TABLE IF EXISTS `purchase_deposit_history`;
CREATE TABLE `purchase_deposit_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `purchaseID` int(11) NOT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `previous_balance` decimal(15,2) NOT NULL,
  `new_balance` decimal(15,2) NOT NULL,
  `processed_by` varchar(100) DEFAULT NULL,
  `deposit_date` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `purchase_history`
DROP TABLE IF EXISTS `purchase_history`;
CREATE TABLE `purchase_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) DEFAULT NULL,
  `stock_id` int(11) DEFAULT NULL,
  `initial_quantity` int(11) DEFAULT 0,
  `purchaser` varchar(255) DEFAULT NULL,
  `purchase_from` varchar(255) DEFAULT NULL,
  `stock_name` varchar(255) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `total_cost` decimal(10,2) DEFAULT NULL,
  `amount_paid` decimal(15,2) DEFAULT 0.00,
  `balance` decimal(15,2) DEFAULT 0.00,
  `for_desc` varchar(255) DEFAULT '',
  `purchase_date` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `sales_queue`
DROP TABLE IF EXISTS `sales_queue`;
CREATE TABLE `sales_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `orderID` varchar(200) NOT NULL,
  `facilityID` varchar(200) NOT NULL,
  `status` enum('pending','viewed') NOT NULL DEFAULT 'pending',
  `creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `viewed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_orderID` (`orderID`),
  KEY `facilityID` (`facilityID`),
  KEY `status` (`status`),
  KEY `creation` (`creation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `stock_conversions`
DROP TABLE IF EXISTS `stock_conversions`;
CREATE TABLE `stock_conversions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) NOT NULL,
  `store_id` int(11) NOT NULL,
  `source_stock_id` int(11) NOT NULL,
  `target_stock_id` int(11) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `direction` enum('belt_to_yard','yard_to_belt') NOT NULL,
  `quantity_transferred` decimal(15,2) NOT NULL,
  `yards_per_belt` decimal(10,2) NOT NULL,
  `resulting_quantity` decimal(15,2) NOT NULL,
  `staff_id` varchar(200) NOT NULL,
  `staff_name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_conv_store` (`store_id`,`facilityID`),
  KEY `idx_conv_prod` (`product_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `stocks`
DROP TABLE IF EXISTS `stocks`;
CREATE TABLE `stocks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facilityID` varchar(200) NOT NULL,
  `store_id` int(11) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `unit_type` enum('belt','yard') NOT NULL DEFAULT 'belt',
  `yards_per_belt` decimal(10,2) DEFAULT NULL,
  `parent_stock_id` int(11) DEFAULT NULL,
  `buying` varchar(200) NOT NULL,
  `selling` varchar(200) NOT NULL,
  `quantity` varchar(200) NOT NULL,
  `opening_quantity` varchar(200) DEFAULT '0',
  `closing_quantity` varchar(200) DEFAULT '0',
  `new_order` varchar(200) DEFAULT '0',
  `out_stocks` varchar(200) DEFAULT '0',
  `Bsubtotal` varchar(200) DEFAULT NULL,
  `Ssubtotal` varchar(200) DEFAULT NULL,
  `expiry` varchar(200) DEFAULT NULL,
  `creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `updation` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `sync_status` enum('pending','synced','failed') DEFAULT 'pending',
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `last_sync` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stocks_store_id` (`store_id`),
  KEY `idx_stocks_status` (`status`),
  KEY `idx_unit_store` (`unit_type`,`store_id`,`facilityID`),
  KEY `idx_parent_stock` (`parent_stock_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `stores`
DROP TABLE IF EXISTS `stores`;
CREATE TABLE `stores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_name` varchar(255) NOT NULL,
  `branch_id` varchar(200) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `updation` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_store_per_branch` (`store_name`,`branch_id`),
  KEY `idx_branch_id` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS=1;
