<?php
session_start();

error_reporting(0);
$did = intval($_GET['id']);
include('../assets/mashaAllah/gyada.php');
if(strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
    exit;
}

// Get customer and outstanding balance information
$outstanding_query = $con->query("SELECT *
                                 FROM outstand
                                 WHERE id='$did'");
$outstanding_data = $outstanding_query->fetch_array();

if(isset($_POST['submit'])) {
    $amount = floatval($_POST['amount']);
    $current_balance = floatval($_POST['current_balance']);
    $current_deposits = floatval($_POST['current_deposits']);
    
    // Validate amount
    if($amount <= 0) {
        $error = "Deposit amount must be greater than zero";
    } elseif($amount > $current_balance) {
        $error = "Deposit amount cannot be greater than outstanding balance";
    } elseif(empty($_POST['payment_method'])) {
        $error = "Please select a payment method";
    } else {
        // Calculate new values
        $new_deposits = $current_deposits + $amount;
        $new_balance = $current_balance - $amount;
        $payment_method = mysqli_real_escape_string($con, $_POST['payment_method']);
        
        // Generate transaction ID
        $transaction_id = 'DP-' . time() . '-' . rand(1000, 9999);
        $processed_by = $_SESSION['name'];
        $description = mysqli_real_escape_string($con, $_POST['description']);
        
        // Start transaction
        mysqli_begin_transaction($con);
        
        try {
            // Update outstanding balance
            $update_sql = mysqli_query($con, "UPDATE outstand 
                                           SET amount='$new_deposits', balance='$new_balance' 
                                           WHERE id='$did'");
            
            if(!$update_sql) throw new Exception("Failed to update balance");
            
            // Record in deposit history
            $insert_sql = mysqli_query($con, "INSERT INTO deposit_history 
                                             (customerID, transaction_id, amount, payment_method, description,
                                              previous_balance, new_balance, processed_by, deposit_date) 
                                             VALUES 
                                             ('$did', '$transaction_id', '$amount', '$payment_method', '$description',
                                              '$current_balance', '$new_balance', '$processed_by', NOW())");
            
            if(!$insert_sql) throw new Exception("Failed to record deposit history");
            
            // Commit transaction
            mysqli_commit($con);
            
            // Redirect to customer page or outstanding balances page
            echo "<script>window.location.href ='view-customer?id=$did'</script>";
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
    <title>MURG TEXTILE ENTERPRISES - Add Deposit</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
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
                    <div class="col-xl-8 col-lg-8 col-md-8 col-sm-12 mx-auto layout-top-spacing">
                        <div class="widget-content widget-content-area">
                            <div class="d-flex justify-content-between">
                                <h3 class="">Add Deposit</h3>
                                <a href="customer.php?id=<?php echo $did; ?>" class="btn btn-secondary">Back to Customer</a>
                            </div>
                            
                            <?php if(isset($error)) { ?>
                                <div class="alert alert-danger mt-3"><?php echo $error; ?></div>
                            <?php } ?>
                            
                            <form method="POST" class="mt-4">
                                <div class="form-group">
                                    <label>Customer</label>
                                    <input type="text" class="form-control" value="<?php echo htmlentities($outstanding_data['Customer']); ?>" readonly>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="form-group">
                                            <label>Total Deposits</label>
                                            <div class="input-group">
                                                <div class="input-group-prepend">
                                                    <span class="input-group-text">₦</span>
                                                </div>
                                                <input type="text" class="form-control" value="<?php echo number_format($outstanding_data['amount'], 2); ?>" readonly>
                                                <input type="hidden" name="current_deposits" value="<?php echo $outstanding_data['amount']; ?>">
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-4">
                                        <div class="form-group">
                                            <label>Current Outstanding</label>
                                            <div class="input-group">
                                                <div class="input-group-prepend">
                                                    <span class="input-group-text">₦</span>
                                                </div>
                                                <input type="text" class="form-control" value="<?php echo number_format($outstanding_data['balance'], 2); ?>" readonly>
                                                <input type="hidden" name="current_balance" value="<?php echo $outstanding_data['balance']; ?>">
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-4">
                                        <div class="form-group">
                                            <label>Deposit Amount <span class="text-danger">*</span></label>
                                            <div class="input-group">
                                                <div class="input-group-prepend">
                                                    <span class="input-group-text">₦</span>
                                                </div>
                                                <input type="number" class="form-control" name="amount" min="0.01" step="0.01" 
                                                       value="<?php echo isset($_POST['amount']) ? htmlentities($_POST['amount']) : ''; ?>" 
                                                       required autofocus>
                                            </div>
                                            <small class="form-text text-muted">Enter amount to deposit</small>
                                        </div>
                                    </div>
                                </div>

                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Payment Method <span class="text-danger">*</span></label>
                                            <select name="payment_method" class="form-control" required>
                                                <option value="">Select Method</option>
                                                <option value="Cash" <?php echo (isset($_POST['payment_method']) && $_POST['payment_method'] == 'Cash') ? 'selected' : ''; ?>>Cash</option>
                                                <option value="POS" <?php echo (isset($_POST['payment_method']) && $_POST['payment_method'] == 'POS') ? 'selected' : ''; ?>>POS</option>
                                                <option value="Bank Transfer" <?php echo (isset($_POST['payment_method']) && $_POST['payment_method'] == 'Bank Transfer') ? 'selected' : ''; ?>>Bank Transfer</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Description</label>
                                            <textarea name="description" class="form-control" rows="1" placeholder="Enter payment description..."><?php echo isset($_POST['description']) ? htmlentities($_POST['description']) : ''; ?></textarea>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group text-right mt-4">
                                    <button type="reset" class="btn btn-secondary">Clear</button>
                                    <button type="submit" name="submit" class="btn btn-primary">Record Deposit</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!--  END CONTENT AREA  -->
    </div>
    <!-- END MAIN CONTAINER -->

    <?php include('footer.php'); ?>

    <!-- BEGIN GLOBAL MANDATORY SCRIPTS -->
    <script src="../assets/js/libs/jquery-3.1.1.min.js"></script>
    <script src="../bootstrap/js/popper.min.js"></script>
    <script src="../bootstrap/js/bootstrap.min.js"></script>
    <script src="../plugins/perfect-scrollbar/perfect-scrollbar.min.js"></script>
    <script src="../assets/js/app.js"></script>
    
    <script>
        $(document).ready(function() {
            App.init();
            
            // Focus on amount field when page loads
            $('input[name="amount"]').focus();
            
            // Validate form before submission
            $('form').submit(function() {
                var amount = parseFloat($('input[name="amount"]').val());
                var balance = parseFloat($('input[name="current_balance"]').val());
                
                if(amount <= 0) {
                    alert('Deposit amount must be greater than zero');
                    return false;
                }
                
                if(amount > balance) {
                    alert('Deposit amount cannot be greater than outstanding balance');
                    return false;
                }
                
                return true;
            });
        });
    </script>
    <!-- END PAGE LEVEL CUSTOM SCRIPTS -->

    <script src="../plugins/highlight/highlight.pack.js"></script>
    <script src="../plugins/select2/select2.min.js"></script>
    <script src="../plugins/select2/custom-select2.js"></script>
</body>
</html>




