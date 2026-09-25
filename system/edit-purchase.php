<?php
session_start();

error_reporting(0);
$did = intval($_GET['id']);
include('../assets/mashaAllah/gyada.php');

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
    exit;
}

if (isset($_POST['update'])) {
    $stock_name = $_POST['stock_name'];
    $purchase_from = $_POST['purchase_from'];
    $for_desc = $_POST['for_desc'];
    $amount_paid = floatval($_POST['amount_paid']);
    $total_cost = floatval($_POST['total_cost']);
    $balance = $total_cost - $amount_paid;

    $sql = mysqli_query($con, "UPDATE purchase_history SET 
        stock_name = '$stock_name', 
        purchase_from = '$purchase_from', 
        for_desc = '$for_desc', 
        amount_paid = '$amount_paid', 
        total_cost = '$total_cost',
        balance = '$balance'
        WHERE id = '$did'");

    if ($sql) {
        echo "<script>alert('Purchase record updated successfully'); window.location.href ='purchase'</script>";
        exit;
    } else {
        $error = "Something went wrong. Please try again";
    }
}

$query = mysqli_query($con, "SELECT * FROM purchase_history WHERE id = '$did'");
$row = mysqli_fetch_array($query);

if (!$row) {
    header('location:purchase');
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>MURG - Edit Purchase Record</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
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
                            <h3 class="">Edit Purchase Record</h3>
                            
                            <?php if(isset($error)) { ?>
                                <div class="alert alert-danger mt-3"><?php echo $error; ?></div>
                            <?php } ?>
                            
                            <form method="POST" class="mt-4">
                                <div class="form-group">
                                    <label>Stock Name</label>
                                    <input type="text" class="form-control" name="stock_name" value="<?php echo htmlentities($row['stock_name']); ?>" required>
                                </div>
                                <div class="form-group">
                                    <label>For (Description)</label>
                                    <input type="text" class="form-control" name="for_desc" value="<?php echo htmlentities($row['for_desc']); ?>">
                                </div>
                                <div class="form-group">
                                    <label>Purchase From (Supplier)</label>
                                    <input type="text" class="form-control" name="purchase_from" value="<?php echo htmlentities($row['purchase_from']); ?>" required>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Total Cost</label>
                                            <input type="number" step="0.01" class="form-control" name="total_cost" value="<?php echo $row['total_cost']; ?>" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Amount Paid</label>
                                            <input type="number" step="0.01" class="form-control" name="amount_paid" value="<?php echo $row['amount_paid']; ?>" required>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="modal-footer mt-4">
                                    <a href="purchase" class="btn btn-secondary">Cancel</a>
                                    <button type="submit" name="update" class="btn btn-primary">Update Record</button>
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



