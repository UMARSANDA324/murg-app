<?php
session_start();
error_reporting(0);
include('../assets/mashaAllah/gyada.php');
if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
    exit;
}

$facilityID = $_SESSION['facilityID'];
$from_date = isset($_GET['from_date']) ? mysqli_real_escape_string($con, $_GET['from_date']) : '';
$to_date = isset($_GET['to_date']) ? mysqli_real_escape_string($con, $_GET['to_date']) : '';

// Card calculations block
$card_from = $from_date;
$card_to = $to_date;
if (empty($card_from) || empty($card_to)) {
    $card_from = date('Y-m-01', strtotime("-5 months"));
    $card_to = date('Y-m-d');
}

// Fetch orders with stocks buying prices
$facility_filter = "";
if (!empty($facilityID)) {
    $facility_filter = " AND o.facilityID = '$facilityID' ";
}
$orders_q = mysqli_query($con, "
    SELECT o.*, s.buying 
    FROM orders o 
    LEFT JOIN stocks s ON o.stockID = s.id 
    WHERE DATE(o.creation) BETWEEN '$card_from' AND '$card_to' $facility_filter
");

$orders_map = [];
while ($row = mysqli_fetch_assoc($orders_q)) {
    $orderID = $row['orderID'];
    if (!isset($orders_map[$orderID])) {
        $orders_map[$orderID] = [
            'discount' => is_numeric($row['discount']) ? floatval($row['discount']) : 0,
            'amount_paid' => is_numeric($row['amount_paid']) ? floatval($row['amount_paid']) : 0,
            'cash' => is_numeric($row['cash']) ? floatval($row['cash']) : 0,
            'pos' => is_numeric($row['pos']) ? floatval($row['pos']) : 0,
            'transfer' => is_numeric($row['transfer']) ? floatval($row['transfer']) : 0,
            'change_given' => is_numeric($row['change_given']) ? floatval($row['change_given']) : 0,
            'items' => []
        ];
    }
    $orders_map[$orderID]['items'][] = [
        'quantity' => is_numeric($row['quantity']) ? floatval($row['quantity']) : 0,
        'subtotal' => is_numeric($row['subtotal']) ? floatval($row['subtotal']) : 0,
        'item_discount' => is_numeric($row['item_discount']) ? floatval($row['item_discount']) : 0,
        'buying' => is_numeric($row['buying']) ? floatval($row['buying']) : 0
    ];
}

$card_sales_gross = 0;
$card_discount = 0;
$card_sales_net = 0;
$card_cost = 0;
$card_outstanding = 0;
$card_cash = 0;
$card_pos = 0;
$card_transfer = 0;
$card_change = 0;

foreach ($orders_map as $orderID => $order) {
    $order_subtotal = 0;
    $order_item_discount = 0;
    $order_cost = 0;
    
    foreach ($order['items'] as $item) {
        $order_subtotal += $item['subtotal'];
        $order_item_discount += ($item['item_discount'] * $item['quantity']);
        $order_cost += ($item['buying'] * $item['quantity']);
    }
    
    $order_final = $order_subtotal - $order_item_discount - $order['discount'];
    
    $card_sales_gross += $order_subtotal;
    $card_discount += ($order_item_discount + $order['discount']);
    $card_sales_net += $order_final;
    $card_cost += $order_cost;
    
    $card_cash += $order['cash'];
    $card_pos += $order['pos'];
    $card_transfer += $order['transfer'];
    $card_change += $order['change_given'];
    
    $debt = $order_final - $order['amount_paid'];
    if ($debt > 0) {
        $card_outstanding += $debt;
    }
}

$card_gross_profit = $card_sales_net - $card_cost;

// Fetch expenses for same range
$facility_filter_expense = "";
if (!empty($facilityID)) {
    $facility_filter_expense = " AND facilityID = '$facilityID' ";
}
$expenses_q = mysqli_query($con, "
    SELECT SUM(price) as total 
    FROM expense 
    WHERE DATE(creation) BETWEEN '$card_from' AND '$card_to' AND type='out' $facility_filter_expense
");
$expenses_row = mysqli_fetch_assoc($expenses_q);
$card_expenses = $expenses_row['total'] ?? 0;

$card_net_profit = $card_gross_profit - $card_expenses;

$card_date_title = ($card_from == $card_to) 
    ? date('F j, Y', strtotime($card_from)) 
    : date('M j, Y', strtotime($card_from)) . " - " . date('M j, Y', strtotime($card_to));

// 1. Profit & Loss Data
$profit_data = [];
$labels = [];

if ($from_date && $to_date) {
    // Daily view for selected range
    $start = new DateTime($from_date);
    $end = new DateTime($to_date);
    $interval = new DateInterval('P1D');
    $period = new DatePeriod($start, $interval, $end->modify('+1 day'));

    foreach ($period as $date) {
        $day = $date->format('Y-m-d');
        $display = $date->format('d M');
        $labels[] = $display;

        // Sales and Cost
        $facility_filter_chart = "";
        if (!empty($facilityID)) {
            $facility_filter_chart = " AND o.facilityID = '$facilityID' ";
        }
        $q = mysqli_query($con, "SELECT 
            SUM(CAST(o.subtotal AS DECIMAL(10,2)) - CAST(o.discount AS DECIMAL(10,2))) as sales,
            SUM(CAST(o.quantity AS DECIMAL(10,2)) * CAST(s.buying AS DECIMAL(10,2))) as cost
            FROM orders o 
            JOIN stocks s ON o.stockID = s.id
            WHERE DATE(o.creation) = '$day' $facility_filter_chart");
        $row = mysqli_fetch_assoc($q);
        $sales = $row['sales'] ?? 0;
        $cost = $row['cost'] ?? 0;

        // Expenses
        $facility_filter_expense_chart = "";
        if (!empty($facilityID)) {
            $facility_filter_expense_chart = " AND facilityID = '$facilityID' ";
        }
        $eq = mysqli_query($con, "SELECT SUM(price) as total FROM expense WHERE DATE(creation) = '$day' AND type='out' $facility_filter_expense_chart");
        $erow = mysqli_fetch_assoc($eq);
        $expenses = $erow['total'] ?? 0;

        $profit_data[] = round($sales - $cost - $expenses, 2);
    }
    $filter_sql = " AND DATE(creation) BETWEEN '$from_date' AND '$to_date'";
    $purchase_filter_sql = " AND DATE(purchase_date) BETWEEN '$from_date' AND '$to_date'";
    $chart_title = "Profit / Loss Trend (" . date('d M', strtotime($from_date)) . " - " . date('d M', strtotime($to_date)) . ")";
} else {
    // Grouped by Month for the last 6 months (Default)
    for ($i = 5; $i >= 0; $i--) {
        $month = date('Y-m', strtotime("-$i months"));
        $display_month = date('M Y', strtotime("-$i months"));
        $labels[] = $display_month;

        // Sales and Cost
        $facility_filter_monthly = "";
        if (!empty($facilityID)) {
            $facility_filter_monthly = " AND o.facilityID = '$facilityID' ";
        }
        $q = mysqli_query($con, "SELECT 
            SUM(CAST(o.subtotal AS DECIMAL(10,2)) - CAST(o.discount AS DECIMAL(10,2))) as sales,
            SUM(CAST(o.quantity AS DECIMAL(10,2)) * CAST(s.buying AS DECIMAL(10,2))) as cost
            FROM orders o 
            JOIN stocks s ON o.stockID = s.id
            WHERE o.creation LIKE '$month%' $facility_filter_monthly");
        $row = mysqli_fetch_assoc($q);
        $sales = $row['sales'] ?? 0;
        $cost = $row['cost'] ?? 0;

        // Expenses
        $facility_filter_expense_monthly = "";
        if (!empty($facilityID)) {
            $facility_filter_expense_monthly = " AND facilityID = '$facilityID' ";
        }
        $eq = mysqli_query($con, "SELECT SUM(price) as total FROM expense WHERE creation LIKE '$month%' AND type='out' $facility_filter_expense_monthly");
        $erow = mysqli_fetch_assoc($eq);
        $expenses = $erow['total'] ?? 0;

        $profit_data[] = round($sales - $cost - $expenses, 2);
    }
    $filter_sql = "";
    $purchase_filter_sql = "";
    $chart_title = "Profit / Loss Trend (Last 6 Months)";
}

// 2. Top Selling Stocks
$ts_labels = [];
$ts_values = [];
$facility_filter_ts = "";
if (!empty($facilityID)) {
    $facility_filter_ts = " AND facilityID = '$facilityID' ";
}
$ts_q = mysqli_query($con, "SELECT item, SUM(CAST(quantity AS DECIMAL(10,2))) as total_qty 
                           FROM orders 
                           WHERE 1=1 $filter_sql $facility_filter_ts
                           GROUP BY item 
                           ORDER BY total_qty DESC LIMIT 5");
while ($row = mysqli_fetch_assoc($ts_q)) {
    $ts_labels[] = $row['item'];
    $ts_values[] = (float)$row['total_qty'];
}

// 3. Stocks Mostly Purchased (Inventory)
$tp_labels = [];
$tp_values = [];
$facility_filter_tp = "";
if (!empty($facilityID)) {
    $facility_filter_tp = " AND facilityID = '$facilityID' ";
}
$tp_q = mysqli_query($con, "SELECT stock_name, SUM(quantity) as total_qty 
                           FROM purchase_history 
                           WHERE 1=1 $purchase_filter_sql $facility_filter_tp
                           GROUP BY stock_name 
                           ORDER BY total_qty DESC LIMIT 5");
while ($row = mysqli_fetch_assoc($tp_q)) {
    $tp_labels[] = $row['stock_name'];
    $tp_values[] = (float)$row['total_qty'];
}

// 4. Recommendations
$recommendations = [];
// Low Stock
$low_stock_q = mysqli_query($con, "SELECT name, quantity FROM stocks WHERE CAST(quantity AS DECIMAL(10,2)) < 10 LIMIT 3");
while ($row = mysqli_fetch_assoc($low_stock_q)) {
    $recommendations[] = [
        'type' => 'warning',
        'msg' => "<b>{$row['name']}</b> is running low ({$row['quantity']} remaining). Consider restocking soon."
    ];
}
// Best Seller
if (!empty($ts_labels)) {
    $recommendations[] = [
        'type' => 'success',
        'msg' => "<b>{$ts_labels[0]}</b> is your top-selling item. Ensure you maintain high stock levels."
    ];
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>Business Report - MURG</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/widgets/modules-widgets.css" rel="stylesheet" type="text/css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .report-card { border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); background: #fff; padding: 20px; margin-bottom: 30px; }
        .card-title { font-weight: 700; color: #3b3f5c; margin-bottom: 20px; font-size: 1.1rem; border-bottom: 2px solid #f1f2f3; padding-bottom: 10px; }
        .rec-item { padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 5px solid; }
        .rec-success { background: #e7f7ed; border-color: #2ecc71; color: #1e8449; }
        .rec-warning { background: #fff9e6; border-color: #f1c40f; color: #9a7d0a; }
        .rec-info { background: #eaf1ff; border-color: #FFB200; color: #1b2e4b; }

        /* KPI Cards Premium Design */
        .kpi-card {
            border-radius: 16px;
            border: none;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            position: relative;
            overflow: hidden;
            color: #fff;
            margin-bottom: 20px;
        }
        .kpi-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 16px 32px rgba(0,0,0,0.18);
        }
        .kpi-card .card-body {
            padding: 24px;
            display: flex;
            align-items: center;
        }
        .kpi-card .card-icon-container {
            width: 52px;
            height: 52px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 20px;
            backdrop-filter: blur(4px);
        }
        .kpi-card .kpi-icon {
            color: #fff;
            width: 28px;
            height: 28px;
        }
        .kpi-card .card-info {
            display: flex;
            flex-direction: column;
        }
        .kpi-card .card-label {
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            opacity: 0.85;
            margin-bottom: 4px;
        }
        .kpi-card .card-value {
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 4px;
            color: #fff;
            letter-spacing: -0.5px;
        }
        .kpi-card .card-desc {
            font-size: 11px;
            opacity: 0.7;
        }
        
        /* Gradient Backgrounds */
        .bg-primary-gradient {
            background: linear-gradient(135deg, #4e54c8 0%, #8f94fb 100%);
        }
        .bg-warning-gradient {
            background: linear-gradient(135deg, #f857a6 0%, #ff5858 100%);
        }
        .bg-info-gradient {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        .bg-danger-gradient {
            background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
        }
        .bg-secondary-gradient {
            background: linear-gradient(135deg, #3a7bd5 0%, #3a6073 100%);
        }
        .bg-success-gradient {
            background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%);
        }
        .bg-loss-gradient {
            background: linear-gradient(135deg, #ed213a 0%, #93291e 100%);
        }
        .bg-dark-gradient {
            background: linear-gradient(135deg, #1f4068 0%, #162447 100%);
        }
    </style>
</head>
<body class="sidebar-noneoverflow">
    <?php include('header.php'); ?>
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <?php include('sidebar.php'); ?>
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                
                <div class="row layout-top-spacing">
                    <div class="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                        <div class="report-card">
                            <form method="GET">
                                <div class="row align-items-end">
                                    <div class="col-md-4">
                                        <label>From Date</label>
                                        <input type="date" name="from_date" class="form-control" value="<?= $from_date ?>">
                                    </div>
                                    <div class="col-md-4">
                                        <label>To Date</label>
                                        <input type="date" name="to_date" class="form-control" value="<?= $to_date ?>">
                                    </div>
                                    <div class="col-md-4">
                                        <button type="submit" class="btn btn-primary">Filter Report</button>
                                        <a href="report" class="btn btn-danger">Reset</a>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- KPI Statistics Cards -->
                <div class="row">
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="kpi-card bg-primary-gradient">
                            <div class="card-body">
                                <div class="card-icon-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kpi-icon"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                </div>
                                <div class="card-info">
                                    <span class="card-label">Total Sales (Gross)</span>
                                    <h3 class="card-value">₦<?= number_format($card_sales_gross) ?></h3>
                                    <span class="card-desc">Subtotal before discount</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="kpi-card bg-warning-gradient">
                            <div class="card-body">
                                <div class="card-icon-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kpi-icon"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
                                </div>
                                <div class="card-info">
                                    <span class="card-label">Total Discount</span>
                                    <h3 class="card-value">₦<?= number_format($card_discount) ?></h3>
                                    <span class="card-desc">General & unit discounts</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="kpi-card bg-info-gradient">
                            <div class="card-body">
                                <div class="card-icon-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kpi-icon"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="12" y1="4" x2="12" y2="20"></line></svg>
                                </div>
                                <div class="card-info">
                                    <span class="card-label">Net Sales (Remaining)</span>
                                    <h3 class="card-value">₦<?= number_format($card_sales_net) ?></h3>
                                    <span class="card-desc">Balance after discount</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="kpi-card bg-danger-gradient">
                            <div class="card-body">
                                <div class="card-icon-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kpi-icon"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                </div>
                                <div class="card-info">
                                    <span class="card-label">Total Outstanding</span>
                                    <h3 class="card-value">₦<?= number_format($card_outstanding) ?></h3>
                                    <span class="card-desc">Unpaid debt balance</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="kpi-card bg-secondary-gradient">
                            <div class="card-body">
                                <div class="card-icon-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kpi-icon"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                                </div>
                                <div class="card-info">
                                    <span class="card-label">Total Cost Price</span>
                                    <h3 class="card-value">₦<?= number_format($card_cost) ?></h3>
                                    <span class="card-desc">Cost of sold items (Stocks)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="kpi-card <?= $card_gross_profit >= 0 ? 'bg-success-gradient' : 'bg-loss-gradient' ?>">
                            <div class="card-body">
                                <div class="card-icon-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kpi-icon"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                                </div>
                                <div class="card-info">
                                    <span class="card-label">Gross Profit / Loss</span>
                                    <h3 class="card-value">₦<?= number_format($card_gross_profit) ?></h3>
                                    <span class="card-desc">Net Sales - Cost Price</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="kpi-card bg-dark-gradient">
                            <div class="card-body">
                                <div class="card-icon-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kpi-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                </div>
                                <div class="card-info">
                                    <span class="card-label">Total Expenses</span>
                                    <h3 class="card-value">₦<?= number_format($card_expenses) ?></h3>
                                    <span class="card-desc">All expenses in period</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="kpi-card <?= $card_net_profit >= 0 ? 'bg-success-gradient' : 'bg-loss-gradient' ?>">
                            <div class="card-body">
                                <div class="card-icon-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kpi-icon"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                </div>
                                <div class="card-info">
                                    <span class="card-label">Net Profit / Loss</span>
                                    <h3 class="card-value">₦<?= number_format($card_net_profit) ?></h3>
                                    <span class="card-desc">Gross Profit - Expenses</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section Subtitle showing selected Range -->
                <div class="row">
                    <div class="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                        <div style="margin-bottom: 25px; padding-left: 5px;">
                            <span class="badge badge-info" style="font-size: 14px; padding: 8px 12px; border-radius: 20px; background-color: #3b3f5c; border-color: #3b3f5c;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; vertical-align: middle;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                Date Range for Statistics: <strong><?= $card_date_title ?></strong>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="row">
                    
                    <!-- Profit/Loss Chart -->
                    <div class="col-xl-8 col-lg-12 col-md-12 col-sm-12 col-12 layout-spacing">
                        <div class="report-card">
                            <h5 class="card-title"><?= $chart_title ?></h5>
                            <canvas id="profitChart" height="150"></canvas>
                        </div>
                    </div>

                    <!-- Recommendations -->
                    <div class="col-xl-4 col-lg-12 col-md-12 col-sm-12 col-12 layout-spacing">
                        <div class="report-card">
                            <h5 class="card-title">Smart Recommendations</h5>
                            <div class="recommendations-list">
                                <?php if (empty($recommendations)): ?>
                                    <div class="rec-item rec-info">Business is looking stable. Keep monitoring your stock levels!</div>
                                <?php else: ?>
                                    <?php foreach ($recommendations as $rec): ?>
                                        <div class="rec-item rec-<?= $rec['type'] ?>"><?= $rec['msg'] ?></div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <!-- Top Selling -->
                    <div class="col-xl-6 col-lg-12 col-md-12 col-sm-12 col-12 layout-spacing">
                        <div class="report-card">
                            <h5 class="card-title">Best Selling Items (Customer Favorites)</h5>
                            <canvas id="sellingChart"></canvas>
                        </div>
                    </div>

                    <!-- Top Purchased -->
                    <div class="col-xl-6 col-lg-12 col-md-12 col-sm-12 col-12 layout-spacing">
                        <div class="report-card">
                            <h5 class="card-title">Most Restocked Inventory</h5>
                            <canvas id="purchaseChart"></canvas>
                        </div>
                    </div>

                </div>
            </div>
            <?php include('footer.php'); ?>
        </div>
    </div>

    <script src="../assets/js/libs/jquery-3.1.1.min.js"></script>
    <script src="../bootstrap/js/bootstrap.min.js"></script>
    <script src="../assets/js/app.js"></script>
    <script>
        $(document).ready(function() { App.init(); });

        // Chart Configurations
        Chart.defaults.font.family = "'Quicksand', sans-serif";

        // 1. Profit Chart
        new Chart(document.getElementById('profitChart'), {
            type: 'line',
            data: {
                labels: <?= json_encode($labels) ?>,
                datasets: [{
                    label: 'Net Profit (₦)',
                    data: <?= json_encode($profit_data) ?>,
                    borderColor: '#FFB200',
                    backgroundColor: 'rgba(255, 178, 0, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });

        // 2. Selling Chart
        new Chart(document.getElementById('sellingChart'), {
            type: 'bar',
            data: {
                labels: <?= json_encode($ts_labels) ?>,
                datasets: [{
                    label: 'Quantity Sold',
                    data: <?= json_encode($ts_values) ?>,
                    backgroundColor: '#2ecc71'
                }]
            }
        });

        // 3. Purchase Chart
        new Chart(document.getElementById('purchaseChart'), {
            type: 'bar',
            data: {
                labels: <?= json_encode($tp_labels) ?>,
                datasets: [{
                    label: 'Quantity Purchased',
                    data: <?= json_encode($tp_values) ?>,
                    backgroundColor: '#ffbb44'
                }]
            }
        });
    </script>
</body>
</html>



