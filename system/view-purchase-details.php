<?php
session_start();
include('../assets/mashaAllah/gyada.php');

$did = intval($_GET['id']);
if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
}

// Get purchase information
$purchase_query = mysqli_query($con, "SELECT * FROM purchase_history WHERE id='$did'");
$purchase_data = mysqli_fetch_array($purchase_query);

if (!$purchase_data) {
    header('location:purchase');
    exit;
}

// Delete deposit logic
if(isset($_GET['del_dep'])) {
    $dep_id = intval($_GET['dep_id']);
    $dep_query = mysqli_query($con, "SELECT * FROM purchase_deposit_history WHERE id='$dep_id'");
    if($row = mysqli_fetch_array($dep_query)) {
        $amount = floatval($row['amount']);
        $pID = $row['purchaseID'];
        
        // Update purchase_history (Total paid decrease, balance increases)
        mysqli_query($con, "UPDATE purchase_history SET amount_paid = amount_paid - $amount, balance = balance + $amount WHERE id='$pID'");
        
        // Delete the deposit
        mysqli_query($con, "DELETE FROM purchase_deposit_history WHERE id='$dep_id'");
        
        echo "<script>alert('Payment record deleted successfully'); window.location.href='view-purchase-details?id=$did';</script>";
        exit;
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>MURG - Purchase Dashboard</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/users/user-profile.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
</head>
<body class="sidebar-noneoverflow">
    <?php include('header.php'); ?>
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <?php include('sidebar.php'); ?>
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <div class="row layout-spacing">
                    <div class="col-xl-12 col-lg-12 col-md-12 col-sm-12 layout-top-spacing">
                        <div class="skills layout-spacing">
                            <div class="p-3 widget-content widget-content-area">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h3 class="">Purchase Dashboard</h3>
                                    <div>
                                        <a href="purchase-deposit?id=<?php echo $did; ?>" class="btn btn-primary btn-sm">Add Payment</a>
                                        <a href="purchase" class="btn btn-secondary btn-sm">Back</a>
                                    </div>
                                </div>
                                <div class="customer-info-card mt-3">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <p><strong>Stock Item:</strong> <?php echo htmlentities($purchase_data['stock_name']); ?></p>
                                            <p><strong>Supplier:</strong> <?php echo htmlentities($purchase_data['purchase_from']); ?></p>
                                            <p><strong>Description:</strong> <?php echo htmlentities($purchase_data['for_desc']); ?></p>
                                        </div>
                                        <div class="col-md-6">
                                            <p><strong>Purchase Date:</strong> <?php echo $purchase_data['purchase_date']; ?></p>
                                            <p><strong>Total Cost:</strong> ₦<?php echo number_format($purchase_data['total_cost'], 2); ?></p>
                                            <p><strong>Already Paid:</strong> ₦<?php echo number_format($purchase_data['amount_paid'], 2); ?></p>
                                            <p class="text-danger"><strong>Outstanding Balance:</strong> ₦<?php echo number_format($purchase_data['balance'], 2); ?></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="widget-content widget-content-area mt-3">
                            <h4 class="mb-4">Payment stage/History</h4>
                            <div class="table-responsive">
                                <table id="history-table" class="table table-hover non-hover" style="width:100%">
                                    <thead>
                                        <tr>
                                            <th>S/N</th>
                                            <th>Date</th>
                                            <th>Transaction ID</th>
                                            <th>Amount PAID</th>
                                            <th>Method</th>
                                            <th>Previous Balance</th>
                                            <th>New Balance</th>
                                            <th>Processed By</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php
                                        $history_query = mysqli_query($con, "SELECT * FROM purchase_deposit_history WHERE purchaseID='$did' ORDER BY deposit_date DESC");
                                        $cnt = 1;
                                        while ($row = mysqli_fetch_array($history_query)) {
                                        ?>
                                        <tr>
                                            <td><?php echo $cnt++; ?>.</td>
                                            <td><?php echo date('d M Y h:i A', strtotime($row['deposit_date'])); ?></td>
                                            <td><?php echo htmlentities($row['transaction_id']); ?></td>
                                            <td class="text-success">₦<?php echo number_format($row['amount'], 2); ?></td>
                                            <td><?php echo htmlentities($row['payment_method'] ?: 'N/A'); ?></td>
                                            <td>₦<?php echo number_format($row['previous_balance'], 2); ?></td>
                                            <td class="text-primary">₦<?php echo number_format($row['new_balance'], 2); ?></td>
                                            <td><?php echo htmlentities($row['processed_by']); ?></td>
                                            <td>
                                                <a href="view-purchase-details?id=<?php echo $did; ?>&dep_id=<?php echo $row['id']; ?>&del_dep=1" onclick="return confirm('Are you sure you want to delete this payment record?')" class="btn btn-danger btn-sm">Delete</a>
                                            </td>
                                        </tr>
                                        <?php } ?>
                                    </tbody>
                                </table>
                            </div>
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
    <script src="../plugins/table/datatable/datatables.js"></script>
    <script>
        $(document).ready(function() {
            App.init();
            $('#history-table').DataTable({
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
            });
        });
    </script>
</body>
</html>



