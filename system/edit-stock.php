<?php
session_start();

error_reporting(0);
$did = intval($_GET['id']);
include('../assets/mashaAllah/gyada.php');

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
} else {
    if (isset($_POST['submit'])) {
        $additional_items = intval($_POST['additional_items']);
        $purchase_from = $_POST['purchase_from'];
        $quantity = intval($_POST['quantity']) + $additional_items;
        
        $s_subtotal = $_POST['sell'] * $quantity;
        $b_subtotal = $_POST['bought'] * $quantity;
        $name = $_POST['name'];
        $sell = $_POST['sell'];
        $bought = $_POST['bought'];
        $expiry = $_POST['expiry'];
        $facilityID = $_POST['branch'];
        $store_id = !empty($_POST['store_id']) ? intval($_POST['store_id']) : NULL;
        $yards_per_belt = !empty($_POST['yards_per_belt']) && (float)$_POST['yards_per_belt'] > 0 ? (float)$_POST['yards_per_belt'] : NULL;

        // Validate Store if provided
        if ($store_id !== NULL) {
            $store_check = mysqli_query($con, "SELECT id, branch_id, status FROM stores WHERE id = '$store_id'");
            if (mysqli_num_rows($store_check) == 0) {
                $error = "Invalid Store selected";
            } else {
                $store_row = mysqli_fetch_assoc($store_check);
                if ($store_row['status'] != 'active') {
                    $error = "Selected Store is inactive. Please select an active Store.";
                } elseif ($store_row['branch_id'] != $facilityID) {
                    $error = "Selected Store does not belong to the selected Branch.";
                }
            }
        }

        if (!$error) {
            $sql = mysqli_query($con, "UPDATE stocks SET 
                Ssubtotal = '$s_subtotal', 
                Bsubtotal = '$b_subtotal', 
                name = '$name', 
                selling = '$sell', 
                buying = '$bought', 
                quantity = '$quantity', 
                expiry = '$expiry' ,
                facilityID = '$facilityID',
                store_id = " . ($store_id ? "'$store_id'" : "NULL") . ",
                yards_per_belt = " . ($yards_per_belt !== NULL ? "'$yards_per_belt'" : "NULL") . "
                WHERE id = '$did' ");

            if ($sql) {
                // If additional items were added, record in purchase history
                if ($additional_items > 0) {
                    $p_total_cost = $bought * $additional_items;
                    $amount_paid = $_POST['amount_paid'] ?? 0;
                    $balance = $p_total_cost - $amount_paid;
                    $for_desc = $_POST['for_desc'] ?? '';
                    
                    $initial_qty = intval($_POST['quantity']);
                    
                    // Record history WITH stock_id, purchase_date, and initial_quantity
                    mysqli_query($con, "INSERT INTO purchase_history(facilityID, stock_id, initial_quantity, stock_name, quantity, cost_price, total_cost, amount_paid, balance, for_desc, purchase_date, purchase_from) 
                                          VALUES('$facilityID', '$did', '$initial_qty', '$name', '$additional_items', '$bought', '$p_total_cost', '$amount_paid', '$balance', '$for_desc', CURDATE(), '$purchase_from')") or die(mysqli_error($con));
                    
                    // Update new_order count for Today's report
                    mysqli_query($con, "UPDATE stocks SET new_order = new_order + '$additional_items' WHERE id = '$did'");
                }
                echo "<script>alert('Stock updated successfully'); window.location.href ='stocks'</script>";
            } else {
                $error = "Something went wrong. Please try again";
            }
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
    <title>SIMDA - Update Stock</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
    
    <!-- BEGIN PAGE LEVEL CUSTOM STYLES -->
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <!-- END PAGE LEVEL CUSTOM STYLES -->
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
                        <div class="skills layout-spacing">
                            <div class="p-3 widget-content widget-content-area">
                                <h3 class="">Update Stock Info</h3>
                                <form method="POST">
                                    <?php
                                    $sql = mysqli_query($con, "SELECT * FROM stocks WHERE id = '$did' AND facilityID = '{$_SESSION['facilityID']}'");
                                    while ($data = mysqli_fetch_array($sql)) {
                                    ?>
                                    <div class="form-group">
                                        <label>Stock Name</label>
                                        <span style="color:red">*</span><br>
                                        <input type="text" class="form-control" required name="name" value="<?php echo htmlentities($data['name']); ?>">
                                    </div>
                                    <div class="form-group">
                                        <label>Selling Price</label>
                                        <span style="color:red">*</span><br>
                                        <input type="number" class="form-control" required name="sell" value="<?php echo htmlentities($data['selling']); ?>">
                                    </div>
                                    <div class="form-group">
                                        <label>Cost Price</label>
                                        <span style="color:red">*</span><br>
                                        <input type="number" class="form-control" required name="bought" value="<?php echo htmlentities($data['buying']); ?>">
                                    </div>
                                    <div class="form-group">
                                        <label>Stock Quantity</label>
                                        <input type="number" class="form-control" name="quantity" value="<?php echo htmlentities($data['quantity']); ?>">
                                    </div>
                                    <div class="form-group">
                                        <label>Yards per Belt <small class="text-muted">(Optional, for belt stock)</small></label>
                                        <input type="number" step="0.01" min="0" class="form-control" name="yards_per_belt" value="<?php echo htmlentities($data['yards_per_belt'] ?? ''); ?>" placeholder="e.g. 100">
                                    </div>
                                    <div class="form-group" style="background: #f1f2f3; padding: 10px; border-radius: 5px; border-left: 5px solid #2196f3;">
                                        <label style="color: #2196f3; font-weight: bold;">Additional items (Add to Stock)</label>
                                        <input type="number" class="form-control" name="additional_items" value="0">
                                        <small class="text-muted">Enter a number to increase the current quantity.</small>
                                    </div>
                                    <div class="form-group" id="additional_info" style="display: none;">
                                        <div class="row">
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label>Amount Paid (to Supplier)</label>
                                                    <input type="number" class="form-control" name="amount_paid" value="0">
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label>For (Description)</label>
                                                    <input type="text" class="form-control" name="for_desc" placeholder="e.g. Monthly restock">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <script>
                                        document.getElementsByName('additional_items')[0].addEventListener('input', function() {
                                            var additionalInfo = document.getElementById('additional_info');
                                            if (parseInt(this.value) > 0) {
                                                additionalInfo.style.display = 'block';
                                                document.getElementsByName('purchase_from')[0].required = true;
                                            } else {
                                                additionalInfo.style.display = 'none';
                                                document.getElementsByName('purchase_from')[0].required = false;
                                            }
                                        });
                                    </script>
                                    <div class="form-group">
                                        <label>Purchase From (Required if adding items)</label>
                                        <input type="text" class="form-control" name="purchase_from" placeholder="Enter supplier/source name">
                                    </div>
                                    <div class="form-group">
                                        <label>Branch</label>
                                        <span style="color:red">*</span><br>
                                        <select name="branch" id="branchSelect" class="form-control" onchange="loadStores(this.value)">
                                            <?php 
                                            $categorySql = mysqli_query($con,"select * from branch");
                                            $cnt=1;
                                            while($crow=mysqli_fetch_array($categorySql))
                                            {
                                            $selected = $crow['facilityID'] == $data['facilityID'] ? "selected" : "";
                                            echo "<option value='{$crow['facilityID']}' $selected>{$crow['name']}</option>";
                                            }
                                            ?>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Store</label>
                                        <select name="store_id" id="storeSelect" class="form-control">
                                            <option value="">Select Store (Optional)</option>
                                            <?php
                                            $current_branch = $data['facilityID'];
                                            $storeSql = mysqli_query($con, "SELECT id, store_name FROM stores WHERE branch_id = '$current_branch' ORDER BY store_name ASC");
                                            while($srow = mysqli_fetch_array($storeSql)) {
                                                $selected = $srow['id'] == $data['store_id'] ? "selected" : "";
                                                echo "<option value='{$srow['id']}' $selected>" . htmlspecialchars($srow['store_name']) . "</option>";
                                            }
                                            ?>
                                        </select>
                                    </div>
                  
                                    <div class="modal-footer">
                                        <button type="submit" class="btn btn-primary" name="submit">Save</button>
                                    </div>
                                    <?php } ?>
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

        // Load stores based on selected branch
        function loadStores(branchId) {
            if (!branchId) {
                $('#storeSelect').html('<option value="">Select Store (Optional)</option>');
                return;
            }
            $.get('get_stores.php', { branch_id: branchId }, function(data) {
                $('#storeSelect').html(data);
            });
        }
    </script>
    <script src="../assets/js/custom.js"></script>
    <!-- END GLOBAL MANDATORY SCRIPTS -->
</body>
</html>


