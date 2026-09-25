<?php
session_start();
include('../assets/mashaAllah/gyada.php');

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
} else {
    $facilityID = $_SESSION['facilityID'];
    $start_date = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-d');
    $end_date = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-d');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>MURG TEXTILE - Track Stock</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dataTables.responsive.min.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <style>
        .sales-list { list-style: none; padding-left: 0; font-size: 0.9em; }
        .sales-list li { border-bottom: 1px solid #f1f2f3; padding: 2px 0; }
        .total-row { font-weight: bold; background: #fafafa; }
        .widget-header { border-bottom: 1px solid #f1f2f3; padding-bottom: 15px; margin-bottom: 20px; }
        .customer-summary { margin-top: 40px; }
    </style>
</head>
<body class="sidebar-noneoverflow">
    <?php include('header.php'); ?>
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <div class="search-overlay"></div>
        <?php include('sidebar.php'); ?>
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <div class="row layout-top-spacing">
                    <div class="col-xl-12 col-lg-12 col-sm-12 layout-spacing">
                        <div class="widget-content widget-content-area br-6">
                            <div class="widget-header">
                                <div class="row">
                                    <div class="col-xl-12 col-md-12 col-sm-12 col-12">
                                        <h4>Track Stock Movement & Sales</h4>
                                    </div>
                                </div>
                            </div>
                            
                            <form method="GET" class="mb-4">
                                <div class="row">
                                    <div class="col-md-4">
                                        <label>From Date</label>
                                        <input type="date" name="start_date" class="form-control" value="<?php echo $start_date; ?>">
                                    </div>
                                    <div class="col-md-4">
                                        <label>To Date</label>
                                        <input type="date" name="end_date" class="form-control" value="<?php echo $end_date; ?>">
                                    </div>
                                    <div class="col-md-2">
                                        <label>&nbsp;</label>
                                        <button type="submit" class="btn btn-primary btn-block">Filter Range</button>
                                    </div>
                                </div>
                            </form>

                            <div class="table-responsive">
                                <table id="track-stock-table" class="table table-hover" style="width:100%">
                                    <thead>
                                        <tr>
                                            <th>Stock Name</th>
                                            <th>Initial Qty (Start)</th>
                                            <th>Additional Qty</th>
                                            <th>Total Stock (In Range)</th>
                                            <th>Store</th>
                                            <th>Sales Details</th>
                                            <th>Total Sold</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php
                                        // Get all stocks that had activity (purchases or sales) in the range
                                        $activities = mysqli_query($con, "
                                            SELECT DISTINCT stock_id as sid, stock_name as sname FROM purchase_history 
                                            WHERE DATE(purchase_date) BETWEEN '$start_date' AND '$end_date'
                                            UNION
                                            SELECT DISTINCT stockID as sid, item as sname FROM orders 
                                            WHERE DATE(creation) BETWEEN '$start_date' AND '$end_date'
                                        ");

                                        $grand_total_sold = 0;
                                        $customer_totals = [];

                                        while ($act = mysqli_fetch_array($activities)) {
                                            $sid = $act['sid'];
                                            $sname = $act['sname'];

                                            // 1. Get Initial Qty (at the start of the start_date)
                                            // Logic: Current Qty - (Additions since start_date) + (Sales since start_date)
                                            $current_sql = mysqli_query($con, "SELECT stocks.quantity, stores.store_name FROM stocks LEFT JOIN stores ON stocks.store_id = stores.id WHERE stocks.id = '$sid'");
                                            if (mysqli_num_rows($current_sql) == 0 && $sid == 0) {
                                                // Fallback if ID is lost (match by name)
                                                $current_sql = mysqli_query($con, "SELECT stocks.id, stocks.quantity, stores.store_name FROM stocks LEFT JOIN stores ON stocks.store_id = stores.id WHERE stocks.name = '$sname' LIMIT 1");
                                                $row = mysqli_fetch_array($current_sql);
                                                $sid = $row['id'] ?? 0;
                                            }
                                            
                                            $current_row = mysqli_fetch_array($current_sql);
                                            $current_qty = (int)($current_row['quantity'] ?? 0);
                                            $store_name = !empty($current_row['store_name']) ? $current_row['store_name'] : 'Unassigned';
                                            
                                            // Purchases from start_date to Today (restricted to specific store-specific stockID only)
                                            $p_future_sql = mysqli_query($con, "SELECT SUM(quantity) as total FROM purchase_history WHERE stock_id = '$sid' AND DATE(purchase_date) >= '$start_date'");
                                            $p_future_row = mysqli_fetch_array($p_future_sql);
                                            $total_p_future = (int)$p_future_row['total'];
                                            
                                            // Sales from start_date to Today (restricted to specific store-specific stockID only)
                                            $s_future_sql = mysqli_query($con, "SELECT SUM(quantity) as total FROM orders WHERE stockID = '$sid' AND DATE(creation) >= '$start_date'");
                                            $s_future_row = mysqli_fetch_array($s_future_sql);
                                            $total_s_future = (int)$s_future_row['total'];
                                            
                                            $initial_qty = $current_qty - $total_p_future + $total_s_future;

                                            // 2. Get Total Additional Qty in range (restricted to specific store-specific stockID only)
                                            $add_sql = mysqli_query($con, "SELECT SUM(quantity) as total_add FROM purchase_history WHERE stock_id = '$sid' AND DATE(purchase_date) BETWEEN '$start_date' AND '$end_date'");
                                            $add_row = mysqli_fetch_array($add_sql);
                                            $total_additional = $add_row ? (int)$add_row['total_add'] : 0;
                                            
                                            $total_stock = $initial_qty + $total_additional;

                                            // 3. Get Sales Breakdown (restricted to specific store-specific stockID only)
                                            $sales_sql = mysqli_query($con, "SELECT buyer_name, customer_name, quantity FROM orders WHERE stockID = '$sid' AND DATE(creation) BETWEEN '$start_date' AND '$end_date' ORDER BY creation ASC");
                                            $sales_list = "";
                                            $item_total_sold = 0;
                                            while ($sale = mysqli_fetch_array($sales_sql)) {
                                                $customer = !empty($sale['buyer_name']) && $sale['buyer_name'] != 'N/A' ? $sale['buyer_name'] : $sale['customer_name'];
                                                $qty = (int)$sale['quantity'];
                                                $sales_list .= "<li>" . htmlentities($customer) . " (Qty: " . $qty . ")</li>";
                                                $item_total_sold += $qty;
                                                
                                                // Track for summary
                                                if (!isset($customer_totals[$customer])) $customer_totals[$customer] = 0;
                                                $customer_totals[$customer] += $qty;
                                            }
                                            if (empty($sales_list)) $sales_list = "<li>No sales in range</li>";

                                            $grand_total_sold += $item_total_sold;
                                        ?>
                                            <tr>
                                                <td><?php echo htmlentities($sname); ?></td>
                                                <td><?php echo $initial_qty; ?></td>
                                                <td><?php echo $total_additional; ?></td>
                                                <td><?php echo $total_stock; ?></td>
                                                <td><?php echo htmlspecialchars($store_name); ?></td>
                                                <td><ul class="sales-list"><?php echo $sales_list; ?></ul></td>
                                                <td class="font-weight-bold"><?php echo $item_total_sold; ?></td>
                                            </tr>
                                        <?php } ?>
                                    </tbody>
                                    <tfoot>
                                        <tr class="total-row">
                                            <td colspan="6" class="text-right">Grand Total Sold Items:</td>
                                            <td><?php echo $grand_total_sold; ?></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <!-- Customer Summary Table -->
                            <div class="customer-summary">
                                <h5 class="mb-3">Summary of Sales by Customer</h5>
                                <div class="table-responsive">
                                    <table id="customer-table" class="table table-bordered" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th>Customer Name</th>
                                                <th>Total Quantity Bought</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php 
                                            arsort($customer_totals); // Sort by quantity descending
                                            foreach ($customer_totals as $cust => $qty) { ?>
                                            <tr>
                                                <td><?php echo htmlentities($cust); ?></td>
                                                <td class="font-weight-bold"><?php echo $qty; ?></td>
                                            </tr>
                                            <?php } ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
            <?php include('footer.php'); ?>
        </div>
    </div>
    <script src="../assets/js/libs/jquery-3.1.1.min.js"></script>
    <script src="../bootstrap/js/popper.min.js"></script>
    <script src="../bootstrap/js/bootstrap.min.js"></script>
    <script src="../plugins/perfect-scrollbar/perfect-scrollbar.min.js"></script>
    <script src="../assets/js/app.js"></script>
    <script src="../plugins/table/datatable/datatables.js"></script>
    <script src="../plugins/table/datatable/dataTables.responsive.min.js"></script>
    <script>
        $(document).ready(function() {
            App.init();
            
            // Stock Table with Search
            $('#track-stock-table').DataTable({
                responsive: true,
                "oLanguage": {
                    "oPaginate": { "sPrevious": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>', "sNext": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' },
                    "sInfo": "Showing page _PAGE_ of _PAGES_",
                    "sSearch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
                    "sSearchPlaceholder": "Search for product/stock...",
                   "sLengthMenu": "Results :  _MENU_",
                },
                "stripeClasses": [],
                "lengthMenu": [10, 20, 50],
                "pageLength": 10 
            });

            // Customer Table with Search
            $('#customer-table').DataTable({
                "oLanguage": {
                    "oPaginate": { "sPrevious": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>', "sNext": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' },
                    "sInfo": "Showing page _PAGE_ of _PAGES_",
                    "sSearch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
                    "sSearchPlaceholder": "Search customer...",
                   "sLengthMenu": "Results :  _MENU_",
                },
                "stripeClasses": [],
                "lengthMenu": [5, 10, 20],
                "pageLength": 5
            });
        });
    </script>
</body>
</html>

