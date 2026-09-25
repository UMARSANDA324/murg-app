<?php
session_start();
error_reporting(E_ALL);
include('../assets/mashaAllah/gyada.php');

if(strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
    exit;
}

$id = intval($_GET['id']);

// Get deposit record
$dep_query = mysqli_query($con, "SELECT * FROM deposit_history WHERE id='$id'");
$dep_data = mysqli_fetch_array($dep_query);
if(!$dep_data) {
    echo "Deposit record not found";
    exit;
}

$did = $dep_data['customerID'];

// Get customer and outstanding balance information
$outstanding_query = $con->query("SELECT * FROM outstand WHERE customerID='$did'");
$outstanding_data = $outstanding_query->fetch_array();

if(isset($_POST['submit'])) {
    $new_amount = floatval($_POST['amount']);
    $old_amount = floatval($dep_data['amount']);
    $payment_method = mysqli_real_escape_string($con, $_POST['payment_method']);
    $description = mysqli_real_escape_string($con, $_POST['description']);
    
    if($new_amount <= 0) {
        $error = "Deposit amount must be greater than zero";
    } else {
        $diff = $new_amount - $old_amount;
        
        // Final balance calculation
        $new_total_deposits = floatval($outstanding_data['amount']) + $diff;
        $new_total_balance = floatval($outstanding_data['balance']) - $diff;
        
        // Start transaction
        mysqli_begin_transaction($con);
        
        try {
            // Update deposit history
            $update_dep = mysqli_query($con, "UPDATE deposit_history 
                                             SET amount='$new_amount', payment_method='$payment_method', description='$description' 
                                             WHERE id='$id'");
            
            if(!$update_dep) throw new Exception("Failed to update deposit record");
            
            // Update outstanding balance
            $update_out = mysqli_query($con, "UPDATE outstand 
                                           SET amount='$new_total_deposits', balance='$new_total_balance' 
                                           WHERE customerID='$did'");
            
            if(!$update_out) throw new Exception("Failed to update total balance");
            
            mysqli_commit($con);
            echo "<script>alert('Deposit updated successfully'); window.location.href ='view-customer?id=$did'</script>";
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
    <title>Edit Deposit</title>
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
                            <h3>Edit Deposit</h3>
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
                                    <label>Deposit Amount (₦)</label>
                                    <input type="number" class="form-control" name="amount" min="0.01" step="0.01" 
                                           value="<?php echo $dep_data['amount']; ?>" required>
                                </div>
                                <div class="form-group">
                                    <label>Payment Method</label>
                                    <select name="payment_method" class="form-control" required>
                                        <option value="Cash" <?php echo ($dep_data['payment_method'] == 'Cash') ? 'selected' : ''; ?>>Cash</option>
                                        <option value="POS" <?php echo ($dep_data['payment_method'] == 'POS') ? 'selected' : ''; ?>>POS</option>
                                        <option value="Bank Transfer" <?php echo ($dep_data['payment_method'] == 'Bank Transfer') ? 'selected' : ''; ?>>Bank Transfer</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Description</label>
                                    <textarea name="description" class="form-control" rows="2" placeholder="Enter payment description..."><?php echo htmlentities($dep_data['description']); ?></textarea>
                                </div>
                                <div class="form-group text-right">
                                    <button type="submit" name="submit" class="btn btn-primary">Update Deposit</button>
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


