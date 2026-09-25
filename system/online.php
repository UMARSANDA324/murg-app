<?php
session_start();

error_reporting(0);
include('../assets/mashaAllah/gyada.php');
if(strlen($_SESSION['email'])==0) {
    header('location:../index.php');
}

// API Configuration
define('ONLINE_API_URL', 'https://aminudogaracompany.com.ng');
define('API_AUTH_TOKEN', 'your_api_auth_token_here');

// Handle sync to online
// if(isset($_POST['push_to_online'])) {
//     $date = $_POST['sync_date'];
//     $facilityID = $_SESSION['facilityID'];
    
//     // Get orders for selected date
//     $sql = mysqli_query($con, "SELECT * FROM orders WHERE DATE(creation) = '$date' AND facilityID = '$facilityID' ORDER BY creation DESC");
    
//     // Process sync
//     $result = syncOrdersToOnline($sql);
    
//     if($result['success']) {
//         $msg = "Successfully synced ".$result['synced_count']." orders to online database!";
//         if($result['duplicate_count'] > 0) {
//             $msg .= " (".$result['duplicate_count']." duplicates skipped)";
//         }
//     } else {
//         $error = "Error syncing orders: ".$result['error'];
//     }
// }

/**
 * Sync orders to online database via API
 */
function syncOrdersToOnline($orders) {
    global $con;
    
    $response = [
        'success' => false,
        'synced_count' => 0,
        'duplicate_count' => 0,
        'error' => ''
    ];
    
    // Group orders by orderID
    $ordersByID = [];
    while($row = mysqli_fetch_assoc($orders)) {
        $ordersByID[$row['orderID']][] = $row;
    }
    
    // First check which orders already exist online
    $existingOrders = checkExistingOrdersOnline(array_keys($ordersByID));
    $response['duplicate_count'] = count($existingOrders);
    
    // Prepare orders to sync (filter out existing ones)
    $ordersToSync = [];
    foreach($ordersByID as $orderID => $orderItems) {
        if(!in_array($orderID, $existingOrders)) {
            // Combine items for the same order
            $firstItem = $orderItems;
            $orderData = [
                'facilityID' => $firstItem['facilityID'],
                'staffID' => $firstItem['staffID'],
                'staff' => $firstItem['staff'],
                'orderID' => $firstItem['orderID'],
                'discount' => $firstItem['discount'],
                'status' => $firstItem['status'],
                'customerID' => $firstItem['customerID'],
                'customer_name' => $firstItem['customer_name'],
                'buyer_name' => $firstItem['buyer_name'],
                'amount_paid' => $firstItem['amount_paid'],
                'change_given' => $firstItem['change_given'],
                'net_total' => $firstItem['net_total'],
                'bank_name' => $firstItem['bank_name'],
                'payment' => $firstItem['payment'],
                'creation' => $firstItem['creation'],
                'item' => $firstItem['item'],
                'price' => $firstItem['price'],
                'quantity' => $firstItem['quantity'],
                'subtotal' => $firstItem['subtotal']
            ];
            
            // foreach($orderItems as $item) {
            //     $orderData['items'][] = [
            //         'item' => $item['item'],
            //         'price' => $item['price'],
            //         'quantity' => $item['quantity'],
            //         'subtotal' => $item['subtotal']
            //     ];
            // }
            
            $ordersToSync[] = $orderData;
        }
    }
    
    if(empty($ordersToSync)) {
        $response['success'] = true;
        return $response;
    }
    
    // Sync orders in batches
    $batchSize = 20;
    $batches = array_chunk($ordersToSync, $batchSize);
    
    foreach($batches as $batch) {
        $apiResponse = sendOrdersToOnlineAPI($batch);
        
        if($apiResponse['success']) {
            $response['synced_count'] += count($batch);
            
            // Mark orders as synced in local database
            foreach($batch as $order) {
                markOrderAsSynced($order['orderID']);
            }
            
            $response['success'] = true;
        } else {
            $response['error'] = $apiResponse['error'];
            $response['success'] = false;
            break;
        }
    }
    
    return $response;
}

/**
 * Check which orders already exist in online database
 */
function checkExistingOrdersOnline($orderIDs) {
    if(empty($orderIDs)) return [];
    
    $ch = curl_init();
    $url = ONLINE_API_URL.'/check-existing?orderIDs='.implode(',', $orderIDs);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        $data = json_decode($response, true);
        return $data['existing_orderIDs'] ?? [];
    }
    
    return [];
}

/**
 * Send orders to online API
 */
function sendOrdersToOnlineAPI($orders) {
    $ch = curl_init();
    $url = ONLINE_API_URL.'/bulk-create';
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['orders' => $orders]),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        return ['success' => true];
    } else {
        $error = "API Error: HTTP $httpCode";
        if($response) {
            $data = json_decode($response, true);
            $error = $data['error'] ?? $error;
        }
        return ['success' => false, 'error' => $error];
    }
}

/**
 * Mark order as synced in local database
 */
function markOrderAsSynced($orderID) {
    global $con;
    
    $query = "UPDATE orders SET sync_status = 'synced', last_sync = NOW() WHERE orderID = ?";
    $stmt = $con->prepare($query);
    $stmt->bind_param("s", $orderID);
    $stmt->execute();
}

// Handle stock sync to online
if(isset($_POST['push_stocks_to_online'])) {
    $facilityID = $_SESSION['facilityID'];
    $result = syncStocksToOnline($facilityID);
    
    if($result['success']) {
        $msg = "Successfully synced ".$result['synced_count']." stock items to online database!";
        if($result['duplicate_count'] > 0) {
            $msg .= " (".$result['duplicate_count']." duplicates skipped)";
        }
    } else {
        $error = "Error syncing stocks: ".$result['error'];
    }
}

/**
 * Sync stocks to online database via API
 */
function syncStocksToOnline($facilityID) {
    global $con;
    
    $response = [
        'success' => false,
        'synced_count' => 0,
        'duplicate_count' => 0,
        'error' => ''
    ];
    
    // Get all stocks for the facility
    $sql = "SELECT * FROM stocks WHERE facilityID = '$facilityID'";
    $result = mysqli_query($con, $sql);
    
    $stocks = [];
    while($row = mysqli_fetch_assoc($result)) {
        $stocks[] = $row;
    }
    
    if(empty($stocks)) {
        $response['success'] = true;
        return $response;
    }
    
    // First check which stocks already exist online
    $stockNames = array_column($stocks, 'name');
    $existingStocks = checkExistingStocksOnline($stockNames);
    $response['duplicate_count'] = count($existingStocks);
    
    // Prepare stocks to sync (filter out existing ones)
    $stocksToSync = [];
    foreach($stocks as $stock) {
        if(!in_array($stock['name'], $existingStocks)) {
            $stockData = [
                'facilityID' => $stock['facilityID'],
                'name' => $stock['name'],
                'buying' => $stock['buying'],
                'selling' => $stock['selling'],
                'quantity' => $stock['quantity'],
                'Bsubtotal' => $stock['Bsubtotal'],
                'Ssubtotal' => $stock['Ssubtotal'],
                'expiry' => $stock['expiry'] ?? null,
                'creation' => $stock['creation']
            ];
            
            $stocksToSync[] = $stockData;
        }
    }
    
    if(!empty($stocksToSync)) {
        $apiResponse = sendStocksToOnlineAPI($stocksToSync);
        
        if($apiResponse['success']) {
            $response['synced_count'] = count($stocksToSync);
            $response['success'] = true;
            
            // Mark stocks as synced in local database
            foreach($stocksToSync as $stock) {
                markStockAsSynced($stock['name'], $facilityID);
            }
        } else {
            $response['error'] = $apiResponse['error'];
        }
    } else {
        $response['success'] = true;
    }
    
    return $response;
}

/**
 * Check which stocks already exist in online database
 */
function checkExistingStocksOnline($stockNames) {
    if(empty($stockNames)) return [];
    
    $ch = curl_init();
    $url = ONLINE_API_URL.'/stocks/check-existing?names='.implode(',', $stockNames);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        $data = json_decode($response, true);
        return $data['existing_stocks'] ?? [];
    }
    
    return [];
}

/**
 * Send stocks to online API
 */
function sendStocksToOnlineAPI($stocks) {
    $ch = curl_init();
    $url = ONLINE_API_URL.'/stocks/bulk-create';
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['stocks' => $stocks]),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        return ['success' => true];
    } else {
        $error = "API Error: HTTP $httpCode";
        if($response) {
            $data = json_decode($response, true);
            $error = $data['error'] ?? $error;
        }
        return ['success' => false, 'error' => $error];
    }
}

/**
 * Mark stock as synced in local database
 */
function markStockAsSynced($stockName, $facilityID) {
    global $con;
    
    $query = "UPDATE stocks SET sync_status = 'synced', last_sync = NOW() WHERE name = ? AND facilityID = ?";
    $stmt = $con->prepare($query);
    $stmt->bind_param("ss", $stockName, $facilityID);
    $stmt->execute();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>MURG - Administrative Panel </title>
    <link rel="icon" href="../assets/img/murglogo.jpg">
  
    <link href="assets/css/loader.css" rel="stylesheet" type="text/css" />
    <script src="assets/js/loader.js"></script>
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->

    <!-- BEGIN PAGE LEVEL PLUGINS/CUSTOM STYLES -->
    <link href="../plugins/apex/apexcharts.css" rel="stylesheet" type="text/css">
    <link href="../assets/css/dashboard/dash_1.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../assets/css/widgets/modules-widgets.css">   
    
    <!-- BEGIN PAGE LEVEL CUSTOM STYLES -->
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <link rel="stylesheet" type="text/css" href="../assets/css/widgets/modules-widgets.css">    

    <!-- END PAGE LEVEL PLUGINS/CUSTOM STYLES -->
</head>
<body class="sidebar-noneoverflow">
    <!-- BEGIN LOADER -->
    <div id="load_screen"> <div class="loader"> <div class="loader-content">
        <div class="spinner-grow align-self-center"></div>
    </div></div></div>
    <!--  END LOADER -->
    <?php include('header.php'); ?>
    
    <!--  BEGIN MAIN CONTAINER  -->
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <div class="search-overlay"></div>

        <!--  BEGIN SIDEBAR  -->
        <?php include('sidebar.php'); ?>
        <!--  END SIDEBAR  -->
        
        <!--  BEGIN CONTENT AREA  -->
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <div class="row">
                    <div class="col-md-12">
                        <?php if(isset($msg)) { ?>
                            <div class="alert alert-success mb-4" role="alert">
                                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x close" data-dismiss="alert"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                                <strong>Success!</strong> <?php echo $msg; ?>
                            </div>
                        <?php } ?>
                        
                        <?php if(isset($error)) { ?>
                            <div class="alert alert-danger mb-4" role="alert">
                                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x close" data-dismiss="alert"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                                <strong>Error!</strong> <?php echo $error; ?>
                            </div>
                        <?php } ?>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <h3>Sales Records</h3>
                    </div>
                    <div class="col-md-6 text-right">
                        <form method="post" class="form-inline float-right">
                            <div class="form-group mr-2">
                                <input type="date" name="filter_date" class="form-control" value="<?php echo isset($_POST['filter_date']) ? $_POST['filter_date'] : date('Y-m-d'); ?>">
                            </div>
                            <button type="submit" name="filter" class="btn btn-primary mr-2">Filter</button>
                            <button type="submit" name="push_to_online" class="btn btn-success">
                                <i class="fas fa-cloud-upload-alt"></i> Push to Online
                            </button>
                            <input type="hidden" name="sync_date" value="<?php echo isset($_POST['filter_date']) ? $_POST['filter_date'] : date('Y-m-d'); ?>">
                        </form>
                    </div>
                </div>
                
                <div class="row layout-top-spacing" id="cancel-row">
                    <div class="col-xl-12 col-lg-12 col-sm-12 layout-spacing">
                        <div class="widget-content widget-content-area br-6">
                            <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th>S/N</th>
                                        <th>Staff</th>
                                        <th>OrderID</th>
                                        <th>Item</th>
                                        <th>Qty</th>
                                        <th>Price</th>
                                        <th>Subtotal</th>
                                        <th>Discount</th>
                                        <th>Total</th>
                                        <th>Payment</th>
                                        <th>Date</th>
                                        <th>Sync Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php
                                    $date = isset($_POST['filter_date']) ? $_POST['filter_date'] : date('Y-m-d');
                                    $facilityID = $_SESSION['facilityID'];
                                    $sql = mysqli_query($con, "SELECT * FROM orders WHERE DATE(creation) = '$date' AND facilityID = '$facilityID' ORDER BY creation DESC");
                                    $cnt = 1;
                                    $currentOrderID = null;
                                    $discountShown = false;

                                    while($row = mysqli_fetch_array($sql)) {
                                        // Check if this is a new order
                                        if ($currentOrderID != $row['orderID']) {
                                            $currentOrderID = $row['orderID'];
                                            $discountShown = false;
                                        }
                                        
                                        // Only show discount for the first item of the order
                                        $displayDiscount = (!$discountShown) ? $row['discount'] : 0;
                                        if (!$discountShown && $row['discount'] > 0) {
                                            $discountShown = true;
                                        }
                                        
                                        // Determine sync status
                                        $syncStatus = $row['sync_status'] ?? 'pending';
                                        $syncBadge = ($syncStatus == 'synced') ? 
                                            '<span class="badge badge-success">Synced</span>' : 
                                            '<span class="badge badge-warning">Pending</span>';
                                    ?>
                                    <tr>
                                        <td class="center"><?php echo $cnt;?>.</td>
                                        <td><?php echo $row['staff'];?></td>
                                        <td><?php echo $row['orderID'];?></td>
                                        <td><?php echo $row['item'];?></td>
                                        <td><?php echo $row['quantity'];?></td>
                                        <td>₦<?php echo number_format($row['price']);?></td>
                                        <td>₦<?php echo number_format($row['subtotal']);?></td>
                                        <td>₦<?php echo ($displayDiscount > 0) ? number_format($displayDiscount) : '0'; ?></td>
                                        <td>₦<?php echo number_format($row['subtotal'] - (($displayDiscount > 0) ? $displayDiscount : '0'));?></td>
                                        <td><?php echo $row['payment'];?></td>
                                        <td><?php echo date('M j, Y g:i A', strtotime($row['creation']));?></td>
                                        <td><?php echo $syncBadge; ?></td>
                                    </tr>
                                    <?php 
                                        $cnt=$cnt+1; 
                                    }
                                    ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <h3>Stocks Records</h3>
                    </div>
                    <div class="col-md-6 text-right">
                        <form method="post" class="form-inline float-right">
                            <button type="submit" name="push_stocks_to_online" class="btn btn-success">
                                <i class="fas fa-cloud-upload-alt"></i> Push Stocks to Online
                            </button>
                        </form>
                    </div>
                </div>
                <div class="row layout-top-spacing" id="cancel-row">
                    <div class="col-xl-12 col-lg-12 col-sm-12 layout-spacing">
                        <div class="widget-content widget-content-area br-6">
                            <table id="stocks-table" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th>S/N</th>
                                        <th>Stock Name</th>
                                        <th>Cost Price</th>
                                        <th>Selling Price</th>
                                        <th>Quantity</th>
                                        <th>Sync Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php
                                    $facilityID = $_SESSION['facilityID'];
                                    $sql = mysqli_query($con, "SELECT * FROM stocks WHERE facilityID='$facilityID'");
                                    $cnt = 1;
                                    while($row = mysqli_fetch_array($sql)) {
                                        $syncStatus = $row['sync_status'] ?? 'pending';
                                        $syncBadge = ($syncStatus == 'synced') ? 
                                            '<span class="badge badge-success">Synced</span>' : 
                                            '<span class="badge badge-warning">Pending</span>';
                                    ?>
                                    <tr>
                                        <td class="center"><?php echo $cnt;?>.</td>
                                        <td><?php echo $row['name'];?></td>
                                        <td>₦<?php echo number_format($row['buying']);?></td>
                                        <td>₦<?php echo number_format($row['selling']);?></td>
                                        <td><?php echo $row['quantity'];?></td>
                                        <td><?php echo $syncBadge; ?></td>
                                    </tr>
                                    <?php 
                                        $cnt++;
                                    }
                                    ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <h3>Expense Records</h3>
                    </div>
                    <div class="col-md-6 text-right">
                        <form method="post" class="form-inline float-right">
                            <button type="submit" name="push_expense_to_online" class="btn btn-success">
                                <i class="fas fa-cloud-upload-alt"></i> Push Expense to Online
                            </button>
                        </form>
                    </div>
                </div>
                <div class="row layout-top-spacing" id="cancel-row">
                    <div class="col-xl-12 col-lg-12 col-sm-12 layout-spacing">
                        <div class="widget-content widget-content-area br-6">
                        <form method="GET" class="no-print">
                                <div class="row mb-4">
                                    <div class="col-md-3">
                                        <label>Filter by Type</label>
                                        <select name="type" class="form-control" onchange="this.form.submit()">
                                            <option value="">All Types</option>
                                            <option value="in" <?php echo $typeFilter == 'in' ? 'selected' : ''; ?>>In</option>
                                            <option value="out" <?php echo $typeFilter == 'out' ? 'selected' : ''; ?>>Out</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3">
                                        <label>Filter by Date</label>
                                        <input type="date" name="date" class="form-control" value="<?php echo $dateFilter; ?>" onchange="this.form.submit()">
                                    </div>
                                </div>
                            </form>
                            
                            <table id="expense-table" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th>S/N</th>
                                        <th>Item</th>
                                        <th>Price</th>
                                        <th>Type</th>
                                        <th>Date Added</th>
                                        <th>Sync status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php
                                    $typeFilter = isset($_GET['type']) ? mysqli_real_escape_string($con, $_GET['type']) : '';
                                    $dateFilter = isset($_GET['date']) ? mysqli_real_escape_string($con, $_GET['date']) : '';
                                    
                                    // Build the query with filters
$expenseQuery = "SELECT * FROM expense WHERE facilityID = '$facilityID'";
if ($typeFilter) {
    $expenseQuery .= " AND type = '$typeFilter'";
}
if ($dateFilter) {
    $expenseQuery .= " AND DATE(creation) = '$dateFilter'";
}
$expensesql = mysqli_query($con, $expenseQuery);
                                    $cnt = 1;
                                    $totalInExpense = 0;
                                    $totalOutExpense = 0;
                                    $totalExpense = 0;
                                    while ($row = mysqli_fetch_array($expensesql)) {
                                        if ($row['type'] == 'in') {
                                            $totalInExpense += $row['price'];
                                        } else {
                                            $totalOutExpense += $row['price'];
                                        }
                                        $totalExpense += $row['price'];
                                    ?>
                                    <tr>
                                        <td class="center"><?php echo $cnt; ?>.</td>
                                        <td><?php echo htmlspecialchars($row['item']); ?></td>
                                        <td>₦<?php echo number_format($row['price']); ?></td>
                                        <td>
                                            <?php if ($row['type'] == 'in') { ?>
                                                <span class="badge badge-success">In</span>
                                            <?php } else { ?>
                                                <span class="badge badge-danger">Out</span>
                                            <?php } ?>
                                        </td>
                                        <td><?php echo $row['creation']; ?></td>
                                        <td>
                                            <?php 
                                            $syncStatus = $row['sync_status'] ?? 'pending';
                                            $syncBadge = ($syncStatus == 'synced') ? 
                                                '<span class="badge badge-success">Synced</span>' : 
                                                '<span class="badge badge-warning">Pending</span>';
                                            echo $syncBadge;
                                            ?>
                                        </td>
                                    </tr>
                                    <?php
                                    $cnt++;
                                    }
                                    ?>
                                    
                                </tbody>
                                <tfoot>
                                    <tr class="total-row">
                                        <td colspan="2"><strong>Total In Expense</strong></td>
                                        <td><strong>₦<?php echo $totalInExpense; ?></strong></td>
                                        <td colspan="3"></td>
                                    </tr>
                                    <tr class="total-row">
                                        <td colspan="2"><strong>Total Out Expense</strong></td>
                                        <td><strong>₦<?php echo $totalOutExpense; ?></strong></td>
                                        <td colspan="3"></td>
                                    </tr>
                                    <tr class="total-row">
                                        <td colspan="2"><strong>Total</strong></td>
                                        <td><strong>₦<?php echo $totalExpense; ?></strong></td>
                                        <td colspan="3"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <?php include('footer.php'); ?>
        </div>
        <!--  END CONTENT AREA  -->
    </div>
    <!-- END MAIN CONTAINER -->

    <!-- BEGIN GLOBAL MANDATORY SCRIPTS -->
    <script src="../assets/js/libs/jquery-3.1.1.min.js"></script>
    <script src="../bootstrap/js/popper.min.js"></script>
    <script src="../bootstrap/js/bootstrap.min.js"></script>
    <script src="../plugins/perfect-scrollbar/perfect-scrollbar.min.js"></script>
    <script src="../assets/js/app.js"></script>
    <script src="https://kit.fontawesome.com/a076d05399.js" crossorigin="anonymous"></script>
    
    <script>
        $(document).ready(function() {
            App.init();
        });
    </script>
    <script src="../assets/js/custom.js"></script>
    <!-- END GLOBAL MANDATORY SCRIPTS -->

    <!-- BEGIN PAGE LEVEL CUSTOM SCRIPTS -->
<script src="../plugins/table/datatable/datatables.js"></script>
<script src="../plugins/table/datatable/button-ext/dataTables.buttons.min.js"></script>
<script src="../plugins/table/datatable/button-ext/jszip.min.js"></script>    
<script src="../plugins/table/datatable/button-ext/buttons.html5.min.js"></script>
<script src="../plugins/table/datatable/button-ext/buttons.print.min.js"></script>

<!-- Add SweetAlert for beautiful alerts -->
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

<!-- Progress Modal HTML (Add before closing body tag) -->
<div class="modal fade" id="syncProgressModal" tabindex="-1" role="dialog" aria-labelledby="syncProgressModalLabel" aria-hidden="true" data-backdrop="static" data-keyboard="false">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="syncProgressModalLabel">Syncing Orders</h5>
            </div>
            <div class="modal-body">
                <div class="progress" style="height: 30px;">
                    <div id="syncProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                        <span id="syncProgressText">0%</span>
                    </div>
                </div>
                <div id="syncStatus" class="mt-3 text-center">
                    <i class="fas fa-spinner fa-spin"></i> Preparing to sync...
                </div>
                <button class="btn btn-primary text-center" data-dismiss="modal"><i class="flaticon-cancel-12"></i> Ok</button>
                <div id="syncDetails" class="mt-2 small text-muted"></div>
            </div>
        </div>
    </div>
</div>

<script>
$(document).ready(function() {
    App.init();
    
    // Initialize DataTable
    var table = $('#html5-extension').DataTable({
        "dom": "<'dt--top-section'<'row'<'col-sm-12 col-md-6 d-flex justify-content-md-start justify-content-center'B><'col-sm-12 col-md-6 d-flex justify-content-md-end justify-content-center mt-md-0 mt-3'f>>>" +
            "<'table-responsive'tr>" +
            "<'dt--bottom-section d-sm-flex justify-content-sm-between text-center'<'dt--pages-count  mb-sm-0 mb-3'i><'dt--pagination'p>>",
        buttons: {
            buttons: [
                { extend: 'copy', className: 'btn btn-sm' },
                { extend: 'csv', className: 'btn btn-sm' },
                { extend: 'excel', className: 'btn btn-sm' },
                { extend: 'print', className: 'btn btn-sm' }
            ]
        },
        "oLanguage": {
            "oPaginate": { "sPrevious": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>', "sNext": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' },
            "sInfo": "Showing page _PAGE_ of _PAGES_",
            "sSearch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
            "sSearchPlaceholder": "Search...",
            "sLengthMenu": "Results :  _MENU_",
        },
        "stripeClasses": [],
        "lengthMenu": [7, 10, 20, 50],
        "pageLength": 10,
        "order": [[10, "desc"]]
    });
    
    // Handle Push to Online with AJAX
    $('button[name="push_to_online"]').click(function(e) {
        e.preventDefault();
        
        const form = $(this).closest('form');
        const date = form.find('input[name="sync_date"]').val();
        
        Swal.fire({
            title: 'Confirm Sync',
            text: `Are you sure you want to push all orders from ${date} to the online database?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, sync now!'
        }).then((result) => {
            if (result.isConfirmed) {
                startSyncProcess(date);
            }
        });
    });

    function startSyncProcess(date) {
        // Show progress modal
        const progressModal = $('#syncProgressModal');
        const progressBar = $('#syncProgressBar');
        const progressText = $('#syncProgressText');
        const syncStatus = $('#syncStatus');
        const syncDetails = $('#syncDetails');
        
        progressModal.modal('show');
        syncStatus.html('<i class="fas fa-spinner fa-spin"></i> Preparing to sync...');
        syncDetails.html('');
        
        // Initialize progress
        updateProgress(0, 'Starting synchronization...');
        
        // Get total orders count first
        $.ajax({
            url: 'sync_helper?action=get_count&date=' + date,
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                if(response.success) {
                    const totalOrders = response.count;
                    syncDetails.html(`Found ${totalOrders} orders to process`);
                    
                    if(totalOrders > 0) {
                        processBatch(date, 0, totalOrders, 20); // Process in batches of 20
                    } else {
                        updateProgress(100, 'No orders to sync');
                        syncStatus.html('<i class="fas fa-check-circle text-success"></i> No orders to sync for selected date');
                        setTimeout(() => progressModal.modal('hide'), 2000);
                    }
                } else {
                    showSyncError(response.error || 'Failed to get order count');
                }
            },
            error: function(xhr) {
                showSyncError(xhr.responseJSON?.error || 'Connection error');
            }
        });
    }
    
    function processBatch(date, processed, total, batchSize) {
        const progressModal = $('#syncProgressModal');
        const progressBar = $('#syncProgressBar');
        const progressText = $('#syncProgressText');
        const syncStatus = $('#syncStatus');
        const syncDetails = $('#syncDetails');
        
        const percent = Math.round((processed / total) * 100);
        updateProgress(percent, `Processing batch (${processed}/${total} orders)`);
        
        $.ajax({
            url: 'sync_helper?action=process_batch', // Make sure to include .php extension
            type: 'POST',
            dataType: 'json',
            contentType: 'application/json', // Add this line
            data: JSON.stringify({
                action: 'process_batch',
                date: date,
                offset: processed,
                limit: batchSize
            }),
            success: function(response) {
                if(response.success) {
                    const newProcessed = processed + response.processed;
                    const newPercent = Math.round((newProcessed / total) * 100);
                    
                    // Update details
                    if(response.duplicates > 0) {
                        syncDetails.append(`<div>Batch processed: ${response.processed} orders (${response.duplicates} duplicates skipped)</div>`);
                    } else {
                        syncDetails.append(`<div>Batch processed: ${response.processed} orders</div>`);
                    }
                    
                    if(newProcessed < total && newProcessed != 0) {
                        // Process next batch
                        updateProgress(newPercent, `Processing batch (${newProcessed}/${total} orders)`);
                        processBatch(date, newProcessed, total, batchSize);
                    } else {
                        // Sync complete
                        updateProgress(100, 'Sync completed successfully!');
                        syncStatus.html(`<i class="fas fa-check-circle text-success"></i> Sync completed! ${newProcessed} orders processed`);
                        
                        // Refresh the page after 3 seconds to show updated sync status
                        // setTimeout(() => {
                        //     progressModal.modal('hide');
                        //     location.reload();
                        // }, 3000);
                    }
                } else {
                    showSyncError(response.error || 'Batch processing failed');
                }
            },
            error: function(xhr) {
                showSyncError(xhr.responseJSON?.error || 'Batch processing error');
            }
        });
    }
    
    function updateProgress(percent, message) {
        const progressBar = $('#syncProgressBar');
        const progressText = $('#syncProgressText');
        const syncStatus = $('#syncStatus');
        
        progressBar.css('width', percent + '%').attr('aria-valuenow', percent);
        progressText.text(percent + '%');
        syncStatus.html(`<i class="fas fa-spinner fa-spin"></i> ${message}`);
    }
    
    function showSyncError(message) {
        const progressModal = $('#syncProgressModal');
        const syncStatus = $('#syncStatus');
        
        syncStatus.html(`<i class="fas fa-times-circle text-danger"></i> ${message}`);
        $('#syncProgressBar').removeClass('progress-bar-animated progress-bar-striped')
                            .addClass('bg-danger');
        
        // Auto-close after 5 seconds
        setTimeout(() => progressModal.modal('hide'), 5000);
    }
});
</script>

<script>
    // Initialize Stocks DataTable
$('#stocks-table').DataTable({
    "dom": "<'dt--top-section'<'row'<'col-sm-12 col-md-6 d-flex justify-content-md-start justify-content-center'B><'col-sm-12 col-md-6 d-flex justify-content-md-end justify-content-center mt-md-0 mt-3'f>>>" +
        "<'table-responsive'tr>" +
        "<'dt--bottom-section d-sm-flex justify-content-sm-between text-center'<'dt--pages-count  mb-sm-0 mb-3'i><'dt--pagination'p>>",
    buttons: {
        buttons: [
            { extend: 'copy', className: 'btn btn-sm' },
            { extend: 'csv', className: 'btn btn-sm' },
            { extend: 'excel', className: 'btn btn-sm' },
            { extend: 'print', className: 'btn btn-sm' }
        ]
    },
    "oLanguage": {
        "oPaginate": { "sPrevious": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>', "sNext": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' },
        "sInfo": "Showing page _PAGE_ of _PAGES_",
        "sSearch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
        "sSearchPlaceholder": "Search...",
        "sLengthMenu": "Results :  _MENU_",
    },
    "stripeClasses": [],
    "lengthMenu": [7, 10, 20, 50],
    "pageLength": 10
});

    // Handle Push Stocks to Online with AJAX
$('button[name="push_stocks_to_online"]').click(function(e) {
    e.preventDefault();
    
    Swal.fire({
        title: 'Confirm Stock Sync',
        text: 'Are you sure you want to push all stocks to the online database?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, sync now!'
    }).then((result) => {
        if (result.isConfirmed) {
            startStocksSyncProcess();
        }
    });
});

function startStocksSyncProcess() {
    // Show progress modal
    const progressModal = $('#syncProgressModal');
    const progressBar = $('#syncProgressBar');
    const progressText = $('#syncProgressText');
    const syncStatus = $('#syncStatus');
    const syncDetails = $('#syncDetails');
    
    progressModal.modal('show');
    syncStatus.html('<i class="fas fa-spinner fa-spin"></i> Preparing to sync stocks...');
    syncDetails.html('');
    
    // Initialize progress
    updateProgress(0, 'Starting stock synchronization...');
    
    // Get total stocks count first
    $.ajax({
        url: 'sync_helper?action=get_stocks_count',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            if(response.success) {
                const totalStocks = response.count;
                syncDetails.html(`Found ${totalStocks} stock items to process`);
                
                if(totalStocks > 0) {
                    processStocksBatch(0, totalStocks, 20); // Process in batches of 20
                } else {
                    updateProgress(100, 'No stocks to sync');
                    syncStatus.html('<i class="fas fa-check-circle text-success"></i> No stocks to sync');
                    setTimeout(() => progressModal.modal('hide'), 2000);
                }
            } else {
                showSyncError(response.error || 'Failed to get stock count');
            }
        },
        error: function(xhr) {
            showSyncError(xhr.responseJSON?.error || 'Connection error');
        }
    });
}

function processStocksBatch(processed, total, batchSize) {
    const progressModal = $('#syncProgressModal');
    const progressBar = $('#syncProgressBar');
    const progressText = $('#syncProgressText');
    const syncStatus = $('#syncStatus');
    const syncDetails = $('#syncDetails');
    
    const percent = Math.round((processed / total) * 100);
    updateProgress(percent, `Processing stock batch (${processed}/${total} items)`);
    
    $.ajax({
        url: 'sync_helper?action=process_stocks_batch',
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
            action: 'process_stocks_batch',
            offset: processed,
            limit: batchSize
        }),
        success: function(response) {
            if(response.success) {
                const newProcessed = processed + response.processed;
                const newPercent = Math.round((newProcessed / total) * 100);
                
                // Update details
                let details = [];
                if(response.inserted_count > 0) {
                    details.push(`Added: ${response.inserted_count}`);
                }
                if(response.updated_count > 0) {
                    details.push(`Updated: ${response.updated_count}`);
                }
                if(response.skipped_count > 0) {
                    details.push(`Skipped: ${response.skipped_count}`);
                }
                
                syncDetails.append(`<div>Batch processed: ${details.join(', ')}</div>`);
                
                if(newProcessed < total) {
                    // Process next batch
                    updateProgress(newPercent, `Processing stock batch (${newProcessed}/${total} items)`);
                    processStocksBatch(newProcessed, total, batchSize);
                } else {
                    // Sync complete
                    updateProgress(100, 'Stock sync completed successfully!');
                    const summary = [
                        `Total added: ${response.total_inserted || 0}`,
                        `Total updated: ${response.total_updated || 0}`,
                        `Total skipped: ${response.total_skipped || 0}`
                    ].join(', ');
                    
                    syncStatus.html(`<i class="fas fa-check-circle text-success"></i> Stock sync completed! ${summary}`);
                    
                    // Refresh the page after 3 seconds to show updated sync status
                    setTimeout(() => {
                        location.reload();
                    }, 3000);
                }
            } else {
                showSyncError(response.error || 'Stock batch processing failed');
            }
        },
        error: function(xhr) {
            showSyncError(xhr.responseJSON?.error || 'Stock batch processing error');
        }
    });
}

// Shared functions
function updateProgress(percent, message) {
    const progressBar = $('#syncProgressBar');
    const progressText = $('#syncProgressText');
    const syncStatus = $('#syncStatus');
    
    progressBar.css('width', percent + '%').attr('aria-valuenow', percent);
    progressText.text(percent + '%');
    syncStatus.html(`<i class="fas fa-spinner fa-spin"></i> ${message}`);
}

function showSyncError(message) {
    const progressModal = $('#syncProgressModal');
    const syncStatus = $('#syncStatus');
    
    syncStatus.html(`<i class="fas fa-times-circle text-danger"></i> ${message}`);
    $('#syncProgressBar').removeClass('progress-bar-animated progress-bar-striped')
                        .addClass('bg-danger');
}
</script>

<!-- push expense to online -->
<script>
    // Initialize Stocks DataTable
$('#expense-table').DataTable({
    "dom": "<'dt--top-section'<'row'<'col-sm-12 col-md-6 d-flex justify-content-md-start justify-content-center'B><'col-sm-12 col-md-6 d-flex justify-content-md-end justify-content-center mt-md-0 mt-3'f>>>" +
        "<'table-responsive'tr>" +
        "<'dt--bottom-section d-sm-flex justify-content-sm-between text-center'<'dt--pages-count  mb-sm-0 mb-3'i><'dt--pagination'p>>",
    buttons: {
        buttons: [
            { extend: 'copy', className: 'btn btn-sm' },
            { extend: 'csv', className: 'btn btn-sm' },
            { extend: 'excel', className: 'btn btn-sm' },
            { extend: 'print', className: 'btn btn-sm' }
        ]
    },
    "oLanguage": {
        "oPaginate": { "sPrevious": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>', "sNext": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' },
        "sInfo": "Showing page _PAGE_ of _PAGES_",
        "sSearch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
        "sSearchPlaceholder": "Search...",
        "sLengthMenu": "Results :  _MENU_",
    },
    "stripeClasses": [],
    "lengthMenu": [7, 10, 20, 50],
    "pageLength": 10
});

// Also, fix the button name (there was a typo in 'push_expnse_to_online')
$('button[name="push_expense_to_online"]').click(function(e) {
    e.preventDefault();
    
    Swal.fire({
        title: 'Confirm Expense Sync',
        text: 'Are you sure you want to push all expenses to the online database?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, sync now!'
    }).then((result) => {
        if (result.isConfirmed) {
            startExpensesSyncProcess();
        }
    });
});

function startExpensesSyncProcess() {
    const progressModal = $('#syncProgressModal');
    const progressBar = $('#syncProgressBar');
    const progressText = $('#syncProgressText');
    const syncStatus = $('#syncStatus');
    const syncDetails = $('#syncDetails');
    
    progressModal.modal('show');
    syncStatus.html('<i class="fas fa-spinner fa-spin"></i> Preparing to sync expenses...');
    syncDetails.html('');
    
    updateProgress(0, 'Starting expense synchronization...');
    
    $.ajax({
        url: 'sync_helper?action=get_expenses_count',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            if(response.success) {
                const totalExpenses = response.count;
                syncDetails.html(`Found ${totalExpenses} expense items to process`);
                
                if(totalExpenses > 0) {
                    processExpensesBatch(0, totalExpenses, 20);
                } else {
                    updateProgress(100, 'No expenses to sync');
                    syncStatus.html('<i class="fas fa-check-circle text-success"></i> No expenses to sync');
                    setTimeout(() => progressModal.modal('hide'), 2000);
                }
            } else {
                showSyncError(response.error || 'Failed to get expense count');
            }
        },
        error: function(xhr) {
            showSyncError(xhr.responseJSON?.error || 'Connection error');
        }
    });
}

function processExpensesBatch(processed, total, batchSize) {
    const progressModal = $('#syncProgressModal');
    const progressBar = $('#syncProgressBar');
    const progressText = $('#syncProgressText');
    const syncStatus = $('#syncStatus');
    const syncDetails = $('#syncDetails');
    
    const percent = Math.round((processed / total) * 100);
    updateProgress(percent, `Processing expense batch (${processed}/${total} items)`);
    
    $.ajax({
        url: 'sync_helper?action=process_expenses_batch',
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
            action: 'process_expenses_batch',
            offset: processed,
            limit: batchSize
        }),
        success: function(response) {
            if(response.success) {
                const newProcessed = processed + response.processed;
                const newPercent = Math.round((newProcessed / total) * 100);
                
                let details = [];
                if(response.inserted_count > 0) {
                    details.push(`Added: ${response.inserted_count}`);
                }
                if(response.updated_count > 0) {
                    details.push(`Updated: ${response.updated_count}`);
                }
                if(response.skipped_count > 0) {
                    details.push(`Skipped: ${response.skipped_count}`);
                }
                
                syncDetails.append(`<div>Batch processed: ${details.join(', ')}</div>`);
                
                if(newProcessed < total) {
                    updateProgress(newPercent, `Processing expense batch (${newProcessed}/${total} items)`);
                    processExpensesBatch(newProcessed, total, batchSize);
                } else {
                    updateProgress(100, 'Expense sync completed successfully!');
                    const summary = [
                        `Total added: ${response.total_inserted || 0}`,
                        `Total updated: ${response.total_updated || 0}`,
                        `Total skipped: ${response.total_skipped || 0}`
                    ].join(', ');
                    
                    syncStatus.html(`<i class="fas fa-check-circle text-success"></i> Expense sync completed! ${summary}`);
                    
                    setTimeout(() => {
                        location.reload();
                    }, 3000);
                }
            } else {
                showSyncError(response.error || 'Expense batch processing failed');
            }
        },
        error: function(xhr) {
            showSyncError(xhr.responseJSON?.error || 'Expense batch processing error');
        }
    });
}

// Shared functions
function updateProgress(percent, message) {
    const progressBar = $('#syncProgressBar');
    const progressText = $('#syncProgressText');
    const syncStatus = $('#syncStatus');
    
    progressBar.css('width', percent + '%').attr('aria-valuenow', percent);
    progressText.text(percent + '%');
    syncStatus.html(`<i class="fas fa-spinner fa-spin"></i> ${message}`);
}

function showSyncError(message) {
    const progressModal = $('#syncProgressModal');
    const syncStatus = $('#syncStatus');
    
    syncStatus.html(`<i class="fas fa-times-circle text-danger"></i> ${message}`);
    $('#syncProgressBar').removeClass('progress-bar-animated progress-bar-striped')
                        .addClass('bg-danger');
}
</script>
</body>
</html>




