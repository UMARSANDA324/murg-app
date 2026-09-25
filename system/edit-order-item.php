<?php
session_start();
error_reporting(E_ALL);
include('../assets/mashaAllah/gyada.php');

if(strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
    exit;
}

$id = intval($_GET['id']);

// Get order item record
$order_query = mysqli_query($con, "SELECT * FROM orders WHERE id='$id'");
$order_data = mysqli_fetch_array($order_query);
if(!$order_data) {
    echo "Order item not found";
    exit;
}

$orderID = $order_data['orderID'];
$did = $order_data['customerID'];
$facilityID = $order_data['facilityID'];
$item_name = $order_data['item'];

// Get customer and outstanding balance information
$outstanding_query = $con->query("SELECT * FROM outstand WHERE customerID='$did'");
$outstanding_data = $outstanding_query->fetch_array();

if(isset($_POST['submit'])) {
    $new_qty = intval($_POST['quantity']);
    $old_qty = intval($order_data['quantity']);
    $price = floatval($order_data['price']);
    $old_subtotal = floatval($order_data['subtotal']);
    $new_subtotal = $price * $new_qty;
    
    if($new_qty <= 0) {
        $error = "Quantity must be greater than zero";
    } else {
        // Start transaction
        mysqli_begin_transaction($con);
        
        try {
            // 1. Update this order item
            mysqli_query($con, "UPDATE orders SET quantity='$new_qty', subtotal='$new_subtotal' WHERE id='$id'");
            
            // 2. Recalculate net_total for the whole orderID
            $sum_query = mysqli_query($con, "SELECT SUM(subtotal) as total_sub, discount FROM orders WHERE orderID='$orderID'");
            $sum_data = mysqli_fetch_array($sum_query);
            $new_total_sub = floatval($sum_data['total_sub']);
            $discount = floatval($sum_data['discount']);
            $new_net_total = $new_total_sub - $discount;
            
            // 3. Update net_total on all rows for this order
            mysqli_query($con, "UPDATE orders SET net_total='$new_net_total' WHERE orderID='$orderID'");
            
            // 4. Update outstand balance
            // Diff in net total is exactly the diff in subtotal (since discount is constant)
            $diff_subtotal = $new_subtotal - $old_subtotal;
            mysqli_query($con, "UPDATE outstand SET balance = balance + $diff_subtotal WHERE customerID='$did'");
            
            // 5. Update stock quantity (Restore old, subtract new)
            $stock_diff = $new_qty - $old_qty;
            mysqli_query($con, "UPDATE stocks SET quantity = quantity - $stock_diff WHERE name='$item_name' AND facilityID='$facilityID'");
            
            mysqli_commit($con);
            echo "<script>alert('Order item updated successfully'); window.location.href ='view-customer?id=$did'</script>";
            exit;
            
        } catch(Exception $e) {
            mysqli_rollback($con);
            $error = "Transaction failed: " . $e->getMessage();
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
    <title>Edit Order Item</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/users/user-profile.css" rel="stylesheet" type="text/css" />
</head>
<body class="sidebar-noneoverflow">
    <?php include('header.php'); ?>
    <div class="main-container" id="container">
        <?php include('sidebar.php'); ?>
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <div class="row layout-spacing">
                    <div class="col-xl-8 col-lg-8 col-md-8 col-sm-12 mx-auto layout-top-spacing">
                        <div class="widget-content widget-content-area">
                            <h3>Edit Order Item</h3>
                            <a href="view-customer?id=<?php echo $did; ?>" class="btn btn-secondary btn-sm mb-4">Back to Customer</a>
                            
                            <?php if(isset($error)) { ?>
                                <div class="alert alert-danger"><?php echo $error; ?></div>
                            <?php } ?>
                            
                            <form method="POST">
                                <div class="form-group">
                                    <label>Customer</label>
                                    <input type="text" class="form-control" value="<?php echo htmlentities($outstanding_data['Customer']); ?>" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Item</label>
                                    <input type="text" class="form-control" value="<?php echo htmlentities($order_data['item']); ?>" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Price (₦)</label>
                                    <input type="text" class="form-control" value="<?php echo number_format($order_data['price'], 2); ?>" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Quantity</label>
                                    <input type="number" class="form-control" name="quantity" min="1" 
                                           value="<?php echo $order_data['quantity']; ?>" required>
                                </div>
                                <div class="form-group text-right">
                                    <button type="submit" name="submit" class="btn btn-primary">Update Item</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="../assets/js/libs/jquery-3.1.1.min.js"></script>
    <script src="../bootstrap/js/bootstrap.min.js"></script>
    <script src="../assets/js/app.js"></script>
    <script>$(document).ready(function() { App.init(); });</script>
</body>
</html>


