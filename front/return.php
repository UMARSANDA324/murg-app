<?php
session_start();

error_reporting(0);
include('../assets/mashaAllah/gyada.php');

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
    exit;
} else {
    $facilityID = $_SESSION['facilityID'];
    $staffID = $_SESSION['id'];
    $msg = $error = "";

    if (isset($_POST['submit'])) {
        $orderID = mysqli_real_escape_string($con, $_POST['name']);

        // Fetch all items in this order to verify and move
        $order_items_query = mysqli_query($con, "SELECT * FROM orders WHERE orderID='$orderID'");
        
        if (mysqli_num_rows($order_items_query) > 0) {
            $total_to_reverse = 0;
            $customerID = 0;
            $is_credit = false;

            // Move items to cart and restore stocks
            while ($item = mysqli_fetch_assoc($order_items_query)) {
                $stockID = $item['stockID'];
                $itemName = mysqli_real_escape_string($con, $item['item']);
                $price = $item['price'];
                $qty = $item['quantity'];
                $subtotal = $item['subtotal'];
                $row_net_total = floatval($item['net_total']);
                $total_to_reverse += $row_net_total;
                
                if ($item['payment'] == 'Credit') {
                    $is_credit = true;
                    $customerID = $item['customerID'];
                }

                // Fetch store_id for the stock item to preserve Store tracking
                $store_query = mysqli_query($con, "SELECT store_id FROM stocks WHERE id='$stockID'");
                $store_row = mysqli_fetch_assoc($store_query);
                $store_id = $store_row ? $store_row['store_id'] : NULL;
                $store_id_val = $store_id ? "'$store_id'" : "NULL";

                // Insert into cart (status 0 means active in cart for THIS staff member)
                mysqli_query($con, "INSERT INTO cart (facilityID, staffID, stockID, store_id, item, price, quantity, subtotal, status) 
                                   VALUES ('$facilityID', '$staffID', '$stockID', $store_id_val, '$itemName', '$price', '$qty', '$subtotal', '0')");
            }

            // If it was a credit order, reverse the debt
            if ($is_credit && $customerID > 0) {
                mysqli_query($con, "UPDATE outstand SET balance = balance - '$total_to_reverse' WHERE customerID='$customerID'");
            }

            // Delete the order records
            mysqli_query($con, "DELETE FROM orders WHERE orderID='$orderID'");
            
            echo "<script>alert('Order #$orderID has been moved back to the cart and stocks restored.'); window.location.href='index?id=$staffID';</script>";
            exit;
        } else {
            $error = "Order #$orderID not found.";
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
    <title>MURG TEXTILE ENTERPRISES</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
    
    <!--  BEGIN CUSTOM STYLE FILE  -->
    <link href="../assets/css/users/user-profile.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/select2/select2.min.css">
    <!--  END CUSTOM STYLE FILE  -->
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

                    <!-- Content -->
                    <div class="col-xl-6 col-lg-6 col-md-5 col-sm-12 layout-top-spacing">
                        <div class="skills layout-spacing ">
                            <div class="widget-content widget-content-area">
                                <h3 class="">Returned Order</h3>
                                <?php if ($error) { ?>
                                    <div class="alert alert-danger" role="alert">
                                        <?php echo $error; ?>
                                    </div>
                                <?php } ?>
                                <form method="POST">
                                    <div class="form-group">
                                        <label>Enter Invoice Number</label>
                                        <span style="color:red">*</span><br>
                                        <input type="number" class="form-control" required name="name" placeholder="Enter Order ID">
                                    </div>
                                    <div class="modal-footer">
                                        <button type="submit" class="btn btn-primary" name="submit">Return to Cart</button>
                                    </div>
                                </form>
                            </div>
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
    
    <script>
        $(document).ready(function() {
            App.init();
        });
    </script>
    <script src="../assets/js/custom.js"></script>
    <script src="../plugins/select2/select2.min.js"></script>
    <script src="../plugins/select2/custom-select2.js"></script>
</body>
</html>


