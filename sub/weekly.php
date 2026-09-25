<?php
session_start();

error_reporting(0);
include('../assets/mashaAllah/gyada.php');
if(strlen($_SESSION['email'])==0) {
    header('location:../index.php');
} else {
    if(isset($_GET['del'])) {
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
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <link rel="stylesheet" type="text/css" href="../assets/css/widgets/modules-widgets.css">    
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
    <div id="load_screen"> <div class="loader"> <div class="loader-content">
        <div class="spinner-grow align-self-center"></div>
    </div></div></div>
    <?php include('header.php'); ?>
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <div class="search-overlay"></div>
        <?php include('sidebar.php'); ?>
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <!-- Date Filter Form -->
                <div class="filter-container">
                    <form method="GET" action="">
                        <div class="row">
                            <div class="col-md-4">
                                <label for="filter_date">Select Date:</label>
                                <input type="date" class="form-control" id="filter_date" name="filter_date" 
                                       value="<?php echo isset($_GET['filter_date']) ? $_GET['filter_date'] : date('Y-m-d'); ?>">
                            </div>
                            <div class="col-md-2">
                                <button type="submit" class="btn btn-primary" style="margin-top: 32px;">Filter</button>
                            </div>
                        </div>
                    </form>
                </div>

                <?php
                // Use selected date or current date
                $selected_date = isset($_GET['filter_date']) ? $_GET['filter_date'] : date('Y-m-d');
                $facilityID = $_SESSION['facilityID'];
                ?>

                <div class="row layout-top-spacing">
                    <div class="col-xl-6 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="widget widget-account-invoice-two">
                            <div class="widget-content">
                                <div class="account-box">
                                    <div class="info">
                                        <div class="inv-title">
                                            <h3 class="" style="color:white;">Total Sales For <b><?php echo date('F j, Y', strtotime($selected_date)); ?></b></h3>
                                        </div>
                                    </div>
                                    <div class="acc-action">
                                        <?php
                                        $order_query = $con->query("SELECT SUM(subtotal) as 'total' FROM orders WHERE DATE(creation)='$selected_date'");
                                        $row = $order_query->fetch_array();
                                        $r_query = $con->query("SELECT SUM(balance) as 'debt' FROM outstand WHERE DATE(creation)='$selected_date'");
                                        $r_row = $r_query->fetch_array();
                                        $real = $row['total'] - $r_row['debt'];
                                        ?>
                                        <h1 style="color:white"> <b> ₦<?php echo number_format($real); ?></b></h1>
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
                                            <h3 class="" style="color:white;">Total Outstandings For <b><?php echo date('F j, Y', strtotime($selected_date)); ?></b></h3>
                                        </div>
                                    </div>
                                    <div class="acc-action">
                                        <?php
                                        $r_query = $con->query("SELECT SUM(balance) as 'debt' FROM outstand WHERE DATE(creation)='$selected_date'");
                                        $r_row = $r_query->fetch_array();
                                        ?>
                                        <h1 style="color:white;"><b>₦<?php echo number_format($r_row['debt']); ?></b></h1>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <?php
                // Payment method queries modified for daily
                $cashQuery = "SELECT SUM(cash) as cash_total FROM (
                                    SELECT orderId, cash FROM orders
                                    WHERE DATE(creation) = '$selected_date'
                                    GROUP BY orderId
                                ) as unique_orders";

                $posQuery = "SELECT SUM(pos) as pos_total FROM (
                                SELECT orderId, pos FROM orders
                                WHERE DATE(creation) = '$selected_date'
                                GROUP BY orderId
                            ) as unique_orders";

                $transferQuery = "SELECT SUM(transfer) as transfer_total FROM (
                                        SELECT orderId, transfer FROM orders
                                        WHERE DATE(creation) = '$selected_date'
                                        GROUP BY orderId
                                    ) as unique_orders";



                $cashResult = mysqli_query($con, $cashQuery);
                $posResult = mysqli_query($con, $posQuery);
                $transferResult = mysqli_query($con, $transferQuery);

                
                $cashTotal = mysqli_fetch_assoc($cashResult)['cash_total'] ?? 0;
                $posTotal = mysqli_fetch_assoc($posResult)['pos_total'] ?? 0;
                $transferTotal = mysqli_fetch_assoc($transferResult)['transfer_total'] ?? 0;

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

                </div>
                
                <div class="row layout-top-spacing" id="cancel-row">
                    <div class="col-xl-12 col-lg-12 col-sm-12 layout-spacing">
                        <div class="widget-content widget-content-area br-6">
                            <?php
                            $sql = mysqli_query($con, "SELECT orders.*, customers.name as linked_customer_name FROM orders LEFT JOIN customers ON orders.customerID = customers.id WHERE DATE(orders.creation) = '$selected_date' ORDER BY orders.orderID DESC, orders.creation DESC");
                            $orders = [];
                            while($row = mysqli_fetch_assoc($sql)) {
                                $orderID = $row['orderID'];
                                if (!isset($orders[$orderID])) {
                                    $orders[$orderID] = [
                                        'staff' => $row['staff'],
                                        'creation' => $row['creation'],
                                        'payment' => $row['payment'],
                                        'discount' => (isset($row['discount']) && is_numeric($row['discount'])) ? $row['discount'] : 0,
                                        'change_given' => (isset($row['change_given']) && is_numeric($row['change_given'])) ? $row['change_given'] : 0,
                                        'cash' => (isset($row['cash']) && is_numeric($row['cash'])) ? $row['cash'] : 0,
                                        'pos' => (isset($row['pos']) && is_numeric($row['pos'])) ? $row['pos'] : 0,
                                        'transfer' => (isset($row['transfer']) && is_numeric($row['transfer'])) ? $row['transfer'] : 0,
                                        'buyer_name' => !empty($row['buyer_name']) && $row['buyer_name'] != 'N/A' ? $row['buyer_name'] : (!empty($row['customer_name']) && $row['customer_name'] != 'N/A' ? $row['customer_name'] : ($row['linked_customer_name'] ?? 'N/A')),
                                        'items' => []
                                    ];
                                }
                                $orders[$orderID]['items'][] = [
                                    'item' => $row['item'],
                                    'quantity' => (isset($row['quantity']) && is_numeric($row['quantity'])) ? $row['quantity'] : 0,
                                    'price' => (isset($row['price']) && is_numeric($row['price'])) ? $row['price'] : 0,
                                    'item_discount' => (isset($row['item_discount']) && is_numeric($row['item_discount'])) ? $row['item_discount'] : 0,
                                    'subtotal' => (isset($row['subtotal']) && is_numeric($row['subtotal'])) ? $row['subtotal'] : 0
                                ];
                            }
                            ?>
                            <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th>S/N</th>
                                        <th>Staff</th>
                                        <th>Customer</th>
                                        <th>Order ID</th>
                                        <th>Items Count</th>
                                        <th>Total Amount (Gross)</th>
                                        <th>Discount</th>
                                        <th>Final Amount (Net)</th>
                                        <th>Payment Method</th>
                                        <th>Cash</th>
                                        <th>POS</th>
                                        <th>Transfer</th>

                                        <th>Date/Time</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php $cnt = 1; foreach ($orders as $orderID => $order): ?>
                                    <?php 
                                        $totalAmount = array_sum(array_column($order['items'], 'subtotal'));
                                        $unitDiscTotal = 0;
                                        foreach($order['items'] as $it) {
                                            $unitDiscTotal += ($it['item_discount'] * $it['quantity']);
                                        }
                                        $finalAmount = $totalAmount - $unitDiscTotal - $order['discount'];
                                    ?>
                                    <tr>
                                        <td><?= $cnt++; ?></td>
                                        <td><?= htmlspecialchars($order['staff']); ?></td>
                                        <td><?= htmlspecialchars($order['buyer_name']); ?></td>
                                        <td><?= htmlspecialchars($orderID); ?></td>
                                        <td><?= count($order['items']); ?></td>
                                        <td>₦<?= number_format($totalAmount); ?></td>
                                        <td>₦<?= number_format($unitDiscTotal + $order['discount']); ?></td>
                                        <td>₦<?= number_format($finalAmount); ?></td>
                                        <td><?= htmlspecialchars($order['payment']); ?></td>
                                        <td>₦<?= number_format($order['cash']); ?></td>
                                        <td>₦<?= number_format($order['pos']); ?></td>
                                        <td>₦<?= number_format($order['transfer']); ?></td>

                                        <td><?= htmlspecialchars($order['creation']); ?></td>
                                        <td>
                                            <button class="btn btn-primary view-invoice" data-orderid="<?= $orderID ?>">View</button>
                                            <a href="invoice?orderid=<?= $orderID ?>" class="btn btn-success" target="_blank">Invoice</a>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                          
                        </div>
                    </div>
                </div>
                <?php include('footer.php'); ?>
            </div>
        </div>

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
                            <th>Unit Disc.</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody id="modal-items">
                        <!-- Items will be inserted here by JavaScript -->
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" class="text-right"><strong>Total (Gross):</strong></td>
                            <td>₦<span id="modal-total"></span></td>
                        </tr>
                        <tr>
                            <td colspan="4" class="text-right"><strong>Unit Discounts:</strong></td>
                            <td>₦<span id="modal-unit-discount"></span></td>
                        </tr>
                        <tr>
                            <td colspan="4" class="text-right"><strong>General Discount:</strong></td>
                            <td>₦<span id="modal-discount"></span></td>
                        </tr>
                        <tr>
                            <td colspan="4" class="text-right"><strong>Final Amount (Net):</strong></td>
                            <td>₦<span id="modal-final"></span></td>
                        </tr>
                        <tr>
                            <td colspan="4" class="text-right"><strong>Cash:</strong></td>
                            <td>₦<span id="modal-cash"></span></td>
                        </tr>
                        <tr>
                            <td colspan="4" class="text-right"><strong>POS:</strong></td>
                            <td>₦<span id="modal-pos"></span></td>
                        </tr>
                        <tr>
                            <td colspan="4" class="text-right"><strong>Transfer:</strong></td>
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
        <script src="../plugins/table/datatable/datatables.js"></script>
        <script src="../plugins/table/datatable/button-ext/dataTables.buttons.min.js"></script>
        <script src="../plugins/table/datatable/button-ext/jszip.min.js"></script>    
        <script src="../plugins/table/datatable/button-ext/buttons.html5.min.js"></script>
        <script src="../plugins/table/datatable/button-ext/buttons.print.min.js"></script>
        <script>
            $('#html5-extension').DataTable({
                "dom": "<'dt--top-section'<'row'<'col-sm-12 col-md-6 d-flex justify-content-md-start justify-content-center'B><'col-sm-12 col-md-6 d-flex justify-content-md-end justify-content-center mt-md-0 mt-3'f>>>" +
                "<'table-responsive'tr>" +
                "<'dt--bottom-section d-sm-flex justify-content-sm-between text-center'<'dt--pages-count mb-sm-0 mb-3'i><'dt--pagination'p>>",
                buttons: {
                    buttons: [
                        { extend: 'copy', className: 'btn btn-sm' },
                        { extend: 'csv', className: 'btn btn-sm' },
                        { 
                            extend: 'excel', 
                            className: 'btn btn-sm',
                            title: 'MURG TEXTILE ENTERPRISES Sales <?= date("Y-m-d"); ?>',
                            exportOptions: {
                                columns: [2, 8, 3, 4, 5, 6, 7, 10, 11],
                                format: {
                                    body: function(data, row, column, node) {
                                        // Column index 2 is Order ID in sub/weekly.php export (guessing based on col indices)
                                        return column === 2 ? "\u200C" + data : data;
                                    }
                                }
                            },
                            customize: function(xlsx) {
                                var sheet = xlsx.xl.worksheets['sheet1.xml'];
                                $('row c', sheet).attr('s', '25');
                                $('row c[r^="C"]', sheet).each(function() {
                                    var cell = $(this);
                                    var r = cell.attr('r');
                                    if (r && r.match(/^C\d+$/)) {
                                        cell.attr('t', 'inlineStr');
                                        var val = cell.find('v').text();
                                        cell.empty().append('<is><t>' + val + '</t></is>');
                                    }
                                });
                            }
                        },
                        { extend: 'print', className: 'btn btn-sm' }
                    ]
                },
                "oLanguage": {
                    "oPaginate": { 
                        "sPrevious": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>', 
                        "sNext": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' 
                    },
                    "sInfo": "Showing page _PAGE_ of _PAGES_",
                    "sSearch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
                    "sSearchPlaceholder": "Search...",
                    "sLengthMenu": "Results :  _MENU_",
                },
                "stripeClasses": [],
                "lengthMenu": [7, 10, 20, 50],
                "pageLength": 7 
            });
        </script>
        <script>
// Convert PHP orders array to JavaScript with fallback to prevent syntax errors
var ordersData = <?php echo json_encode($orders) ?: '{}'; ?>;

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
    var itemDiscTotal = 0;
    order.items.forEach(function(item) {
        total += parseFloat(item.subtotal);
        itemDiscTotal += (parseFloat(item.item_discount) * parseFloat(item.quantity));
    });
    var finalAmount = total - itemDiscTotal - parseFloat(order.discount);
    
    // Set totals
    $('#modal-total').text(total.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    $('#modal-unit-discount').text(itemDiscTotal.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
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
                <td>-₦${(parseFloat(item.item_discount) * parseFloat(item.quantity)).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</td>
                <td>₦${(parseFloat(item.subtotal) - (parseFloat(item.item_discount) * parseFloat(item.quantity))).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</td>
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


