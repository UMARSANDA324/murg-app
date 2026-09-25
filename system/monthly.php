<?php
session_start();

error_reporting(0);
include('../assets/mashaAllah/gyada.php');
if(strlen($_SESSION['email'])==0)
  {
header('location:../index.php');
}
else 
{
    if(isset($_GET['del']))
      {
              mysqli_query($con,"delete from customers where id = '".$_GET['id']."'");
            

      }
  
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
     <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>MURG TEXTILE ENTERPRISES</title>
  <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="../assets/css/loader.css" rel="stylesheet" type="text/css" />
    <script src="../assets/js/loader.js"></script>
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
        
    <!-- BEGIN PAGE LEVEL CUSTOM STYLES -->
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dataTables.responsive.min.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <link rel="stylesheet" type="text/css" href="../assets/css/widgets/modules-widgets.css">    

    <!-- END PAGE LEVEL CUSTOM STYLES -->
    <!-- END PAGE LEVEL PLUGINS/CUSTOM STYLES -->
    <style>
        .stat-card {
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease;
        }
        .stat-card:hover {
            transform: translateY(-5px);
        }
        .stat-card .icon {
            font-size: 30px;
            margin-bottom: 15px;
        }
        .stat-card .value {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        .stat-card .label {
            font-size: 14px;
            color: #6c757d;
        }
        .filter-container {
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .progress {
            height: 10px;
            margin-top: 10px;
        }
        .week-range {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #333;
        }
    </style>
</head>
<body class="sidebar-noneoverflow">
    <!-- BEGIN LOADER -->
    <div id="load_screen"> <div class="loader"> <div class="loader-content">
        <div class="spinner-grow align-self-center"></div>
    </div></div></div>
    <!--  END LOADER -->
 <?php include('header.php'); ?>
    <!--  BEGIN NAVBAR  -->
   
    <!--  END NAVBAR  -->

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

                <!-- Date Filter Form -->
                <div class="filter-container mt-4">
                    <form method="GET" action="">
                        <div class="row">
                            <div class="col-md-4">
                                <label for="from_date">From Date:</label>
                                <input type="date" class="form-control" id="from_date" name="from_date" 
                                       value="<?php echo isset($_GET['from_date']) ? $_GET['from_date'] : date('Y-m-01'); ?>">
                            </div>
                            <div class="col-md-4">
                                <label for="to_date">To Date:</label>
                                <input type="date" class="form-control" id="to_date" name="to_date" 
                                       value="<?php echo isset($_GET['to_date']) ? $_GET['to_date'] : date('Y-m-t'); ?>">
                            </div>
                            <div class="col-md-4">
                                <button type="submit" class="btn btn-primary" style="margin-top: 32px;">Filter</button>
                                <a href="monthly" class="btn btn-danger" style="margin-top: 32px;">Reset</a>
                            </div>
                        </div>
                    </form>
                </div>

                <?php
                // Use selected date range or current month
                $from_date = isset($_GET['from_date']) ? mysqli_real_escape_string($con, $_GET['from_date']) : date('Y-m-01');
                $to_date = isset($_GET['to_date']) ? mysqli_real_escape_string($con, $_GET['to_date']) : date('Y-m-t');
                $facilityID = $_SESSION['facilityID'];
                
                $date_title = ($from_date == $to_date) 
                    ? date('F j, Y', strtotime($from_date)) 
                    : date('M j, Y', strtotime($from_date)) . " - " . date('M j, Y', strtotime($to_date));
                ?>

                <div class="row layout-top-spacing">
                    <div class="col-xl-6 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="widget widget-account-invoice-two">
                            <div class="widget-content">
                                <div class="account-box">
                                    <div class="info">
                                        <div class="inv-title">
                                            <h3 class="" style="color:white;">Total Sales For <b><?php echo $date_title; ?></b></h3>
                                        </div>
                                        <div class="inv-balance-info"></div>
                                    </div>
                                    <div class="acc-action">
                                         <?php
                                         if ($facilityID) {
                                             $order_query = $con->query("SELECT SUM(CAST(subtotal AS DECIMAL(15,2))) as 'total' FROM orders WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date' AND facilityID='$facilityID'");
                                             $r_query = $con->query("SELECT SUM(debt) as 'debt' FROM (SELECT orderId, (CAST(net_total AS DECIMAL(15,2)) - CAST(amount_paid AS DECIMAL(15,2))) as debt FROM orders WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date' AND facilityID='$facilityID' AND CAST(net_total AS DECIMAL(15,2)) > CAST(amount_paid AS DECIMAL(15,2)) GROUP BY orderId) as t");
                                         } else {
                                             $order_query = $con->query("SELECT SUM(CAST(subtotal AS DECIMAL(15,2))) as 'total' FROM orders WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date'");
                                             $r_query = $con->query("SELECT SUM(debt) as 'debt' FROM (SELECT orderId, (CAST(net_total AS DECIMAL(15,2)) - CAST(amount_paid AS DECIMAL(15,2))) as debt FROM orders WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date' AND CAST(net_total AS DECIMAL(15,2)) > CAST(amount_paid AS DECIMAL(15,2)) GROUP BY orderId) as t");
                                         }
                                         $row = $order_query->fetch_array();
                                         $r_row = $r_query->fetch_array();
                                         $real = ($row['total'] ?? 0) - ($r_row['debt'] ?? 0);
                                         ?>
                                         <h1 style="color:white"> <b>₦<?php echo number_format($real); ?></b></h1>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>

                     <div class="col-xl-6 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                         <div class="widget widget-account-invoice-two">
                             <div class="widget-content">
                                 <div class="account-box">
                                     <div class="info">
                                         <div class="inv-title">
                                             <h3 class="" style="color:white;">Total Outstandings For <b><?php echo $date_title; ?></b></h3>
                                         </div>
                                         <div class="inv-balance-info"></div>
                                     </div>
                                     <div class="acc-action">
                                         <?php
                                         if ($facilityID) {
                                             $r_query = $con->query("SELECT SUM(debt) as 'debt' FROM (SELECT orderId, (CAST(net_total AS DECIMAL(15,2)) - CAST(amount_paid AS DECIMAL(15,2))) as debt FROM orders WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date' AND facilityID='$facilityID' AND CAST(net_total AS DECIMAL(15,2)) > CAST(amount_paid AS DECIMAL(15,2)) GROUP BY orderId) as t");
                                         } else {
                                             $r_query = $con->query("SELECT SUM(debt) as 'debt' FROM (SELECT orderId, (CAST(net_total AS DECIMAL(15,2)) - CAST(amount_paid AS DECIMAL(15,2))) as debt FROM orders WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date' AND CAST(net_total AS DECIMAL(15,2)) > CAST(amount_paid AS DECIMAL(15,2)) GROUP BY orderId) as t");
                                         }
                                         $r_row = $r_query->fetch_array();
                                         ?>
                                         <h1 style="color:white;"><b>₦<?php echo number_format($r_row['debt'] ?? 0); ?></b></h1>
                                     </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <?php
                $date = date('m');
                $facilityID = $_SESSION['facilityID'];

                if ($facilityID) {
                    $cashQuery = "SELECT SUM(cash) as cash_total FROM (
                                    SELECT orderId, cash FROM orders
                                    WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date'
                                    AND facilityID = '$facilityID'
                                    GROUP BY orderId
                                ) as unique_orders";

                    $posQuery = "SELECT SUM(pos) as pos_total FROM (
                                    SELECT orderId, pos FROM orders
                                    WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date'
                                    AND facilityID = '$facilityID'
                                    GROUP BY orderId
                                ) as unique_orders";

                    $transferQuery = "SELECT SUM(transfer) as transfer_total FROM (
                                        SELECT orderId, transfer FROM orders
                                        WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date'
                                        AND facilityID = '$facilityID'
                                        GROUP BY orderId
                                    ) as unique_orders";

                    $changeQuery = "SELECT SUM(change_given) as change_total FROM (
                                        SELECT orderId, change_given FROM orders
                                        WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date'
                                        AND facilityID = '$facilityID'
                                        GROUP BY orderId
                                    ) as unique_orders";


                } else {
                    $cashQuery = "SELECT SUM(cash) as cash_total FROM (
                                    SELECT orderId, cash FROM orders
                                    WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date'
                                    GROUP BY orderId
                                ) as unique_orders";

                    $posQuery = "SELECT SUM(pos) as pos_total FROM (
                                    SELECT orderId, pos FROM orders
                                    WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date'
                                    GROUP BY orderId
                                ) as unique_orders";

                    $transferQuery = "SELECT SUM(transfer) as transfer_total FROM (
                                        SELECT orderId, transfer FROM orders
                                        WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date'
                                        GROUP BY orderId
                                ) as unique_orders";

                    $changeQuery = "SELECT SUM(change_given) as change_total FROM (
                                        SELECT orderId, change_given FROM orders
                                        WHERE DATE(creation) BETWEEN '$from_date' AND '$to_date'
                                        GROUP BY orderId
                                ) as unique_orders";


                }

                $cashResult = mysqli_query($con, $cashQuery);
                $posResult = mysqli_query($con, $posQuery);
                $transferResult = mysqli_query($con, $transferQuery);
                $changeResult = mysqli_query($con, $changeQuery);


                $cashTotal = mysqli_fetch_assoc($cashResult)['cash_total'] ?? 0;
                $posTotal = mysqli_fetch_assoc($posResult)['pos_total'] ?? 0;
                $transferTotal = mysqli_fetch_assoc($transferResult)['transfer_total'] ?? 0;
                $changeTotal = mysqli_fetch_assoc($changeResult)['change_total'] ?? 0;

                ?>
                <div class="row layout-top-spacing">
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-primary">
                            <div class="icon text-white">
                                <i class="fas fa-money-bill-wave"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($cashTotal); ?></div>
                            <div class="label text-white">Cash Sales</div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-primary">
                            <div class="icon text-white">
                                <i class="fas fa-credit-card"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($posTotal); ?></div>
                            <div class="label text-white">POS Sales</div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-primary">
                            <div class="icon text-white">
                                <i class="fas fa-university"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($transferTotal); ?></div>
                            <div class="label text-white">Bank Transfer Sales</div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-danger">
                            <div class="icon text-white">
                                <i class="fas fa-hand-holding-usd"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($changeTotal); ?></div>
                            <div class="label text-white">Change Given</div>
                        </div>
                    </div>

                </div>

                
                <div class="row layout-top-spacing" id="cancel-row">
                
                    <div class="col-xl-12 col-lg-12 col-sm-12  layout-spacing">
                        
                        <div class="widget-content widget-content-area br-6">
                        <?php
                            if($facilityID){
                            $sql = mysqli_query($con, "SELECT orders.*, stores.store_name FROM orders LEFT JOIN stocks ON orders.stockID = stocks.id LEFT JOIN stores ON stocks.store_id = stores.id WHERE DATE(orders.creation) BETWEEN '$from_date' AND '$to_date' AND orders.facilityID='$facilityID' ORDER BY orders.orderID DESC, orders.creation DESC");
                            }else{
                            $sql = mysqli_query($con, "SELECT orders.*, stores.store_name FROM orders LEFT JOIN stocks ON orders.stockID = stocks.id LEFT JOIN stores ON stocks.store_id = stores.id WHERE DATE(orders.creation) BETWEEN '$from_date' AND '$to_date' ORDER BY orders.orderID DESC, orders.creation DESC");
                            }
                            $orders = [];
                            while($row = mysqli_fetch_assoc($sql)) {
                                $orderID = $row['orderID'];
                                if (!isset($orders[$orderID])) {
                                    $orders[$orderID] = [
                                        'facilityID' => $row['facilityID'],
                                        'staff' => $row['staff'],
                                        'creation' => $row['creation'],
                                        'payment' => $row['payment'],
                                        'discount' => $row['discount'],
                                        'change_given' => $row['change_given'],
                                        'cash' => $row['cash'] ?? 0,
                                        'pos' => $row['pos'] ?? 0,
                                        'transfer' => $row['transfer'] ?? 0,
                                        'buyer_name' => !empty($row['buyer_name']) ? $row['buyer_name'] : $row['customer_name'],
                                        'items' => []
                                    ];
                                }
                                $orders[$orderID]['items'][] = [
                                    'item' => $row['item'],
                                    'store_name' => !empty($row['store_name']) ? $row['store_name'] : 'Unassigned',
                                    'quantity' => $row['quantity'],
                                    'price' => $row['price'],
                                    'subtotal' => $row['subtotal']
                                ];
                            }
                            ?>
                            <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th>S/N</th>
                                        <th>Branch ID</th>
                                        <th>Staff</th>
                                        <th>Customer</th>
                                        <th>Payment Method</th>
                                        <th>Order ID</th>
                                        <th>Store</th>
                                        <th>Item</th>
                                        <th>Quantity</th>
                                        <th>Price</th>
                                        <th>Total Amount</th>
                                        <th>Discount</th>
                                        <th>Final Amount</th>
                                        <th>Cash</th>
                                        <th>POS</th>
                                        <th>Transfer</th>

                                        <th>Date/Time</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php $cnt = 1; foreach ($orders as $orderID => $order): 
                                        $totalAmount = array_sum(array_column($order['items'], 'subtotal'));
                                        $finalAmount = $totalAmount - $order['discount'];

                                        $isFirst = true;
                                        foreach ($order['items'] as $item):
                                    ?>
                                    <tr>
                                        <td><?= $cnt++; ?></td>
                                        <td><?= htmlspecialchars($order['facilityID']); ?></td>
                                        <td><?= htmlspecialchars($order['staff']); ?></td>
                                        <td><?= htmlspecialchars($order['buyer_name']); ?></td>
                                        <td><?= htmlspecialchars($order['payment']); ?></td>
                                        <td><?= htmlspecialchars($orderID); ?></td>
                                        <td><?= htmlspecialchars($item['store_name']); ?></td>
                                        <td><?= htmlspecialchars($item['item']); ?></td>
                                        <td><?= htmlspecialchars($item['quantity']); ?></td>
                                        <td>₦<?= number_format($item['price']); ?></td>
                                        <td>₦<?= number_format($item['subtotal']); ?></td>
                                        <td>₦<?= number_format($order['discount']); ?></td>
                                        <td>₦<?= number_format($finalAmount); ?></td>
                                        <td>₦<?= number_format($order['cash']); ?></td>
                                        <td>₦<?= number_format($order['pos']); ?></td>
                                        <td>₦<?= number_format($order['transfer']); ?></td>

                                        <td><?= htmlspecialchars($order['creation']); ?></td>
                                        <td>
                                            <button class="btn btn-primary view-invoice" data-orderid="<?= $orderID ?>">View</button>
                                            <a href="invoice?orderid=<?= $orderID ?>" class="btn btn-success" target="_blank">Invoice</a>
                                        </td>
                                    </tr>
                                    <?php 
                                        $isFirst = false;
                                        endforeach; 
                                    endforeach; 
                                    ?>
                                </tbody>
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

           <!-- Invoice Modal -->
<div class="modal fade" id="invoiceModal" tabindex="-1" role="dialog" aria-labelledby="invoiceModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="invoiceModalLabel">Order Invoice #<span id="modal-order-id"></span></h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <strong>Staff:</strong> <span id="modal-staff"></span><br>
                        <strong>Customer:</strong> <span id="modal-customer"></span><br>
                        <strong>Date:</strong> <span id="modal-date"></span>
                    </div>
                    <div class="col-md-6 text-right">
                        <strong>Payment Method:</strong> <span id="modal-payment"></span>
                    </div>
                </div>
                
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody id="modal-items">
                        <!-- Items will be inserted here by JavaScript -->
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" class="text-right"><strong>Total:</strong></td>
                            <td>₦<span id="modal-total"></span></td>
                        </tr>
                        <tr>
                            <td colspan="3" class="text-right"><strong>Discount:</strong></td>
                            <td>₦<span id="modal-discount"></span></td>
                        </tr>
                        <tr>
                            <td colspan="3" class="text-right"><strong>Final Amount:</strong></td>
                            <td>₦<span id="modal-final"></span></td>
                        </tr>
                        <tr>
                            <td colspan="3" class="text-right"><strong>Cash:</strong></td>
                            <td>₦<span id="modal-cash"></span></td>
                        </tr>
                        <tr>
                            <td colspan="3" class="text-right"><strong>POS:</strong></td>
                            <td>₦<span id="modal-pos"></span></td>
                        </tr>
                        <tr>
                            <td colspan="3" class="text-right"><strong>Transfer:</strong></td>
                            <td>₦<span id="modal-transfer"></span></td>
                        </tr>

                    </tfoot>
                </table>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>


     <!-- BEGIN GLOBAL MANDATORY SCRIPTS -->
    <script src="../assets/js/libs/jquery-3.1.1.min.js"></script>
    <script src="../bootstrap/js/popper.min.js"></script>
    <script src="../bootstrap/js/bootstrap.min.js"></script>
    <script src="../plugins/perfect-scrollbar/perfect-scrollbar.min.js"></script>
    <script src="../assets/js/app.js"></script>
    
    <script>
        $(document).ready(function() {
            App.init();
        });
    </script>
    <script src="../assets/js/custom.js"></script>
    <!-- END GLOBAL MANDATORY SCRIPTS -->

    <!-- BEGIN PAGE LEVEL CUSTOM SCRIPTS -->
    <script src="../plugins/table/datatable/datatables.js"></script>
    <script src="../plugins/table/datatable/dataTables.responsive.min.js"></script>
    <!-- NOTE TO Use Copy CSV Excel PDF Print Options You Must Include These Files  -->
    <script src="../plugins/table/datatable/button-ext/dataTables.buttons.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/jszip.min.js"></script>    
    <script src="../plugins/table/datatable/button-ext/buttons.html5.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/buttons.print.min.js"></script>
    <script>
        $('#html5-extension').DataTable( {
            responsive: true,
            "dom": "<'dt--top-section'<'row'<'col-sm-12 col-md-6 d-flex justify-content-md-start justify-content-center'B><'col-sm-12 col-md-6 d-flex justify-content-md-end justify-content-center mt-md-0 mt-3'f>>>" +
        "<'table-responsive'tr>" +
        "<'dt--bottom-section d-sm-flex justify-content-sm-between text-center'<'dt--pages-count  mb-sm-0 mb-3'i><'dt--pagination'p>>",
            buttons: {
                buttons: [
                    { extend: 'copy', className: 'btn btn-sm' },
                    { extend: 'csv', className: 'btn btn-sm' },
                    { 
                        extend: 'excel', 
                        className: 'btn btn-sm',
                        exportOptions: {
                            columns: [0, 2, 5, 3, 4, 6, 7, 8, 9, 10, 11]
                        }
                    },
                    { extend: 'print', className: 'btn btn-sm' }
                ]
            },
            "order": [[6, "asc"]],
            "oLanguage": {
                "oPaginate": { "sPrevious": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>', "sNext": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' },
                "sInfo": "Showing page _PAGE_ of _PAGES_",
                "sSearch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
                "sSearchPlaceholder": "Search...",
               "sLengthMenu": "Results :  _MENU_",
            },
            "stripeClasses": [],
            "lengthMenu": [7, 10, 20, 50],
            "pageLength": 7 
        } );
    </script>
    <!-- END PAGE LEVEL CUSTOM SCRIPTS -->
    <script>
// Convert PHP orders array to JavaScript
var ordersData = <?= json_encode($orders); ?>;

// Handle view invoice button click
$(document).on('click', '.view-invoice', function() {
    var orderID = $(this).data('orderid');
    var order = ordersData[orderID];
    
    // Set modal header info
    $('#modal-order-id').text(orderID);
    $('#modal-staff').text(order.staff);
    $('#modal-customer').text(order.buyer_name);
    $('#modal-date').text(order.creation);
    $('#modal-payment').text(order.payment);
    
    // Calculate totals
    var total = 0;
    order.items.forEach(function(item) {
        total += parseFloat(item.subtotal);
    });
    var finalAmount = total - parseFloat(order.discount);
    
    // Set totals
    $('#modal-total').text(total.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    $('#modal-discount').text(parseFloat(order.discount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    $('#modal-final').text(finalAmount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    $('#modal-cash').text(parseFloat(order.cash).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    $('#modal-pos').text(parseFloat(order.pos).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    $('#modal-transfer').text(parseFloat(order.transfer).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));

    
    // Populate items table
    var itemsHtml = '';
    order.items.forEach(function(item) {
        itemsHtml += `
            <tr>
                <td>${item.item}</td>
                <td>${item.quantity}</td>
                <td>₦${parseFloat(item.price).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</td>
                <td>₦${parseFloat(item.subtotal).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</td>
            </tr>
        `;
    });
    $('#modal-items').html(itemsHtml);
    
    // Show modal
    $('#invoiceModal').modal('show');
});
</script>
</body>
</html>






