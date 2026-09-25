<?php
session_start();
error_reporting(0);
include('../config/connection.php');

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
} else {
    
    

  
$facilityID = isset($_SESSION['facilityID']) ? $_SESSION['facilityID'] : '';
$staffID = isset($_SESSION['id']) ? intval($_SESSION['id']) : 0;
$issuedByName = isset($_SESSION['name']) ? $_SESSION['name'] : '';
$invoice = isset($_GET['invoice']) ? $_GET['invoice'] : 0;


    if (isset($_POST['checkout']) && $invoice > 0) {
        try {
            $checkQuery = "SELECT status FROM orders WHERE order_id = '$invoice' AND facilityID = '$facilityID'";
            $checkResult = mysqli_query($con, $checkQuery);
            $orderStatus = mysqli_fetch_assoc($checkResult);

            if ($orderStatus && strtolower($orderStatus['status']) === 'completed') {
                echo "<script>alert('This order has already been issued.');</script>";
            } else {
                $updateQuery = "UPDATE orders SET status = 'completed', issuedById = '$staffID', issuedByName = '$issuedByName' WHERE order_id = '$invoice' AND facilityID = '$facilityID'";
                mysqli_query($con, $updateQuery);
                echo "<script>alert('Order checked out successfully!');</script>";
            }
        } catch (Exception $e) {
            echo "<script>alert('An error occurred: " . htmlspecialchars($e->getMessage()) . "');</script>";
        }
    }

    
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>FCA</title>
     <!-- <link href="../assets/img/murglogo.jpg" rel="shortcut icon"> -->
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
    
    <!--  BEGIN CUSTOM STYLE FILE  -->
    <link href="../assets/css/users/user-profile.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/select2/select2.min.css">
    <!--  END CUSTOM STYLE FILE  -->
    <script>
        function getdoctor(val) {
            $.ajax({
                type: "POST",
                url: "get_price",
                data: 'specilizationid=' + val,
                success: function(data) {
                    $("#available").html(data);
                }
            });
        }
    </script>
    <script>
        function getfee(val) {
            $.ajax({
                type: "POST",
                url: "get_available",
                data: 'available=' + val,
                success: function(data) {
                    $("#doctor").html(data);
                }
            });
        }
    </script>
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
                <div class="row layout-spacing">
                    <div class="col-xl-4 col-lg-4 col-md-5 col-sm-12 layout-top-spacing">
                        <div class="skills layout-spacing">
                            <div class="widget-content widget-content-area">
                                <h3>Verify Order</h3>
                                <form method="GET">
                                    <div class="form-group">
                                        <label>Invoice Number</label>
                                        <span style="color:red">*</span><br>
                                        <input type="number" class="form-control" required name="invoice" min="1">
                                    </div>
                                    <div class="modal-footer">
                                        <button type="submit" class="btn btn-primary">Verify Order</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <?php if (!empty($invoice) > 0) {?>
                    <div class="col-xl-8 col-lg-8 col-md-5 col-sm-12 layout-top-spacing">
                        <div class="skills layout-spacing">
                            <div class="widget-content widget-content-area">
                                <h3>Order</h3>
                                <form method="POST">
                                    <table id="sample-table-1" class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>S/N</th>
                                                <th>Item</th>
                                                <th>Price</th>
                                                <th>Quantity</th>
                                                <th>Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php
                                            $facilityID = $_SESSION['facilityID'];
                                            $staffID = $_SESSION['id'];
                                            $sql = mysqli_query($con, "SELECT * FROM orders WHERE orderID='$invoice' AND facilityID='$facilityID'");
                                            $cnt = 1;
                                            while ($row = mysqli_fetch_array($sql)) {
                                            ?>
                                                <tr>
                                                    <td class="center"><?php echo $cnt; ?>.</td>
                                                    <td class="hidden-xs"><?php echo $row['item']; ?></td>
                                                    <td><?php echo number_format($row['price']); ?></td>
                                                    <td><?php echo $row['quantity']; ?></td>
                                                    <td><?php echo number_format($row['subtotal']); ?></td>
                                                </tr>
                                            <?php
                                                $cnt++;
                                            }
                                            ?>
                                        </tbody>
                                    </table>
                                    <br>
                                    <br>
                                    <?php
                                    $staffID = $_SESSION['id'];
                                    $facilityID = $_SESSION['facilityID'];
                                    $order_query = $con->query("SELECT SUM(subtotal) as total FROM orders WHERE orderID='$invoice' AND facilityID='$facilityID'");
                                    $order_row = $order_query->fetch_array();
                                    $total = $order_row['total'];
                                    ?>
                                    <h2>Total Amount: ₦<?php echo number_format($total); ?></h2>
                               
                                    <h4>Order Details</h4>
                                    <?php
                                    if ($invoice > 0) {
                                        $orderQuery = "SELECT * FROM orders WHERE orderID = '$invoice' AND facilityID = '$facilityID'";
                                        $orderResult = mysqli_query($con, $orderQuery);
                                        if (mysqli_num_rows($orderResult) > 0) {
                                            $order = mysqli_fetch_assoc($orderResult);
                                            ?>
                                            <div class="order-details">
                                                <div class="row">
                                                    <div class="col-md-6">
                                                        <p><strong>Order ID:</strong> <?php echo htmlspecialchars($order['orderID']); ?></p>
                                                        <p><strong>Staff Name:</strong> <?php echo htmlspecialchars($order['staff']); ?></p>
                                                        <?php if (!empty($order['customerID'])) { ?>
                                                            <p><strong>Customer Name:</strong> <?php echo htmlspecialchars($order['customer_name']); ?></p>
                                                            <p><strong>Amount Paid:</strong> ₦<?php echo number_format($order['amount_paid']); ?></p>
                                                            <p><strong>Order type: </strong> Credit Order</p>
                                                        <?php } ?>
                                                    </div>
                                                    <div class="col-md-6">
                                                        <p><strong>Buyer Name:</strong> <?php echo htmlspecialchars($order['buyer_name']); ?></p>
                                                        <p><strong>Discount:</strong> ₦<?php echo number_format($order['discount']); ?></p>
                                                        <p><strong>Change:</strong> ₦<?php echo number_format($order['change_given']); ?></p>
                                                        <p><strong>Payment Method:</strong> <?php echo $order['payment'] == 'Bank Transfer' ? $order['payment'] . '('.$order['bank_name'].')' : $order['payment']; ?></p>
                                                    </div>
                                                </div>
                                            </div>
                                            <?php
                                        } else {
                                            echo "<p>No order found for invoice number $invoice.</p>";
                                        }
                                    } else {
                                        echo "<p>Please enter a valid invoice number.</p>";
                                    }
                                    ?>
                                    <hr>

                                    <div class="modal-footer">
                                        <?php if (!empty($order) && strtolower($order['status']) === 'completed') { ?>
                                            <button type="button" class="btn btn-success" disabled>Issued Successfully</button>
                                        <?php } else { ?>
                                            <button type="submit" class="btn btn-success" name="checkout" <?php echo $total == 0 ? 'disabled' : ''; ?>>Issue</button>
                                        <?php } ?>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                    <?php } ?>

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
    <script>
        $(document).ready(function() {
            App.init();
        });
    </script>
    
    <script src="../assets/js/custom.js"></script>
    <!-- END PAGE LEVEL CUSTOM SCRIPTS -->

    <script src="../plugins/highlight/highlight.pack.js"></script>
    <!-- END GLOBAL MANDATORY SCRIPTS -->

    <!--  BEGIN CUSTOM SCRIPTS FILE  -->
    <script src="../plugins/select2/select2.min.js"></script>
    <script src="../plugins/select2/custom-select2.js"></script>
</body>
</html>



