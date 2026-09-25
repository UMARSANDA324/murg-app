<?php
session_start();

error_reporting(0);
$did = intval($_GET['id']);
include('../assets/mashaAllah/gyada.php');

if(strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
    exit;
}

// Get purchase information
$purchase_query = $con->query("SELECT * FROM purchase_history WHERE id='$did'");
$purchase_data = $purchase_query->fetch_array();

if(!$purchase_data) {
    header('location:purchase');
    exit;
}

if(isset($_POST['submit'])) {
    $amount = floatval($_POST['amount']);
    $current_balance = floatval($purchase_data['balance']);
    $current_paid = floatval($purchase_data['amount_paid']);
    
    // Validate amount
    if($amount <= 0) {
        $error = "Payment amount must be greater than zero";
    } elseif($amount > $current_balance) {
        $error = "Payment amount cannot be greater than outstanding balance";
    } elseif(empty($_POST['payment_method'])) {
        $error = "Please select a payment method";
    } else {
        // Calculate new values
        $new_paid = $current_paid + $amount;
        $new_balance = $current_balance - $amount;
        $payment_method = mysqli_real_escape_string($con, $_POST['payment_method']);
        
        // Generate transaction ID
        $transaction_id = 'P-DP-' . time() . '-' . rand(1000, 9999);
        $processed_by = $_SESSION['name'];
        
        // Start transaction
        mysqli_begin_transaction($con);
        
        try {
            // Update purchase history
            $update_sql = mysqli_query($con, "UPDATE purchase_history 
                                           SET amount_paid='$new_paid', balance='$new_balance' 
                                           WHERE id='$did'");
            
            if(!$update_sql) throw new Exception("Failed to update balance");
            
            // Record in purchase deposit history
            $insert_sql = mysqli_query($con, "INSERT INTO purchase_deposit_history 
                                            (purchaseID, transaction_id, amount, payment_method,
                                             previous_balance, new_balance, processed_by, deposit_date) 
                                            VALUES 
                                            ('$did', '$transaction_id', '$amount', '$payment_method',
                                             '$current_balance', '$new_balance', '$processed_by', NOW())");
            
            if(!$insert_sql) throw new Exception("Failed to record payment history");
            
            // Commit transaction
            mysqli_commit($con);
            
            echo "<script>alert('Payment recorded successfully'); window.location.href ='purchase'</script>";
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
    <title>MURG - Record Supplier Payment</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/users/user-profile.css" rel="stylesheet" type="text/css" />
    <style>
        .widget-content-area { border-radius: 6px; margin-bottom: 30px; padding: 25px 30px; }
    </style>
</head>
<body class="sidebar-noneoverflow">
    <?php include('header.php'); ?>
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <?php include('sidebar.php'); ?>
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <div class="row layout-spacing">
                    <div class="col-xl-6 col-lg-6 col-md-8 col-sm-12 mx-auto layout-top-spacing">
                        <div class="widget-content widget-content-area mt-5">
                            <h3 class="">Supplier Payment (Deposit)</h3>
                            <p class="text-muted">Record a payment for purchase: <b><?php echo htmlentities($purchase_data['stock_name']); ?></b> from <b><?php echo htmlentities($purchase_data['purchase_from']); ?></b></p>
                            
                            <?php if(isset($error)) { ?>
                                <div class="alert alert-danger mt-3"><?php echo $error; ?></div>
                            <?php } ?>
                            
                            <form method="POST" class="mt-4">
                                <div class="row">
                                    <div class="col-md-12">
                                        <div class="form-group">
                                            <label>Total Cost</label>
                                            <input type="text" class="form-control" value="₦<?php echo number_format($purchase_data['total_cost']); ?>" readonly>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Already Paid</label>
                                            <input type="text" class="form-control text-success" value="₦<?php echo number_format($purchase_data['amount_paid']); ?>" readonly>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Remaining Balance</label>
                                            <input type="text" class="form-control text-danger" value="₦<?php echo number_format($purchase_data['balance']); ?>" readonly>
                                        </div>
                                    </div>
                                    <div class="col-md-12">
                                        <div class="form-group mt-3">
                                            <label>Payment Amount <span class="text-danger">*</span></label>
                                            <div class="input-group">
                                                <div class="input-group-prepend">
                                                    <span class="input-group-text">₦</span>
                                                </div>
                                                <input type="number" class="form-control" name="amount" min="0.01" step="0.01" required autofocus>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-12">
                                        <div class="form-group">
                                            <label>Payment Method <span class="text-danger">*</span></label>
                                            <select name="payment_method" class="form-control" required>
                                                <option value="">Select Method</option>
                                                <option value="Cash">Cash</option>
                                                <option value="POS">POS</option>
                                                <option value="Bank Transfer">Bank Transfer</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="modal-footer mt-4">
                                    <a href="purchase" class="btn btn-secondary">Cancel</a>
                                    <button type="submit" name="submit" class="btn btn-primary">Record Payment</button>
                                </div>
                            </form>
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
    <script>$(document).ready(function() { App.init(); });</script>
</body>
</html>



