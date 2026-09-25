<?php
session_start();
// error_reporting(0);
include('../assets/mashaAllah/gyada.php');
if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
} else {
    $facilityID = $_SESSION['facilityID'];
    $report_date = isset($_GET['report_date']) ? $_GET['report_date'] : date('Y-m-d');

    // Handle new stock creation or purchase
    if (isset($_POST['submit'])) {
        $stock_id = mysqli_real_escape_string($con, $_POST['stock_id']);
        $name = mysqli_real_escape_string($con, $_POST['name']);
        $sell = !empty($_POST['sell']) ? (float)$_POST['sell'] : 0;
        $bought = (float)$_POST['bought'];
        $quantity = (float)$_POST['quantity'];
        $branch = mysqli_real_escape_string($con, $_POST['branch']);
        $store_id = !empty($_POST['store_id']) ? intval($_POST['store_id']) : NULL;
        $yards_per_belt = !empty($_POST['yards_per_belt']) && (float)$_POST['yards_per_belt'] > 0 ? (float)$_POST['yards_per_belt'] : NULL;
        $b_subtotal = $bought * $quantity;
        $s_subtotal = $sell * $quantity;

        // Validate Store if provided
        if ($store_id !== NULL) {
            $store_check = mysqli_query($con, "SELECT id, branch_id, status FROM stores WHERE id = '$store_id'");
            if (mysqli_num_rows($store_check) == 0) {
                $error = "Invalid Store selected";
            } else {
                $store_row = mysqli_fetch_assoc($store_check);
                if ($store_row['status'] != 'active') {
                    $error = "Selected Store is inactive. Please select an active Store.";
                } elseif ($store_row['branch_id'] != $branch) {
                    $error = "Selected Store does not belong to the selected Branch.";
                }
            }
        }

        if (!$error) {
            if ($stock_id) {
                // Fetch current quantity to record as initial_quantity
                $current_stock_query = mysqli_query($con, "SELECT quantity FROM stocks WHERE id = '$stock_id'");
                $current_stock_row = mysqli_fetch_array($current_stock_query);
                $initial_qty = $current_stock_row['quantity'];

                $sql = mysqli_query($con, "
                    UPDATE stocks 
                    SET quantity = quantity + '$quantity',
                        new_order = new_order + '$quantity',
                        Bsubtotal = buying * (quantity + '$quantity'),
                        Ssubtotal = selling * (quantity + '$quantity')
                    WHERE id = '$stock_id' AND facilityID = '$branch'
                ");

                if ($sql) {
                    // Insert into purchase_history with all required fields
                    $purchase_from = mysqli_real_escape_string($con, $_POST['purchase_from'] ?? '');
                    $amount_paid = (float)($_POST['amount_paid'] ?? 0);
                    $balance = $b_subtotal - $amount_paid;
                    $for_desc = mysqli_real_escape_string($con, $_POST['for_desc'] ?? '');

                    mysqli_query($con, "
                        INSERT INTO purchase_history(facilityID, stock_id, initial_quantity, stock_name, quantity, cost_price, total_cost, amount_paid, balance, for_desc, purchase_date, purchase_from) 
                        VALUES('$branch', '$stock_id', '$initial_qty', (SELECT name FROM stocks WHERE id='$stock_id' LIMIT 1), '$quantity', '$bought', '$b_subtotal', '$amount_paid', '$balance', '$for_desc', CURDATE(), '$purchase_from')
                    ");

                    echo "<script>alert('Stock Purchase Successful'); window.location.href='stocks'</script>";
                } else {
                    $error = "Something went wrong adding purchase: " . mysqli_error($con);
                }
            } else {
                // New stock creation
                $sql = mysqli_query($con, "
                    INSERT INTO stocks(facilityID, store_id, name, unit_type, yards_per_belt, selling, buying, quantity, opening_quantity, new_order, Bsubtotal, Ssubtotal, expiry) 
                    VALUES('$branch', " . ($store_id ? "'$store_id'" : "NULL") . ", '$name', 'belt', " . ($yards_per_belt !== NULL ? "'$yards_per_belt'" : "NULL") . ", '$sell', '$bought', '$quantity', 0, '$quantity', '$b_subtotal', '$s_subtotal', NULL)
                ");

                if ($sql) {
                    $new_stock_id = mysqli_insert_id($con);
                    // Get form data for purchase fields
                    $purchase_from = mysqli_real_escape_string($con, $_POST['purchase_from'] ?? '');
                    $for_desc = mysqli_real_escape_string($con, $_POST['for_desc'] ?? '');
                    $amount_paid = (float)($_POST['amount_paid'] ?? 0);
                    $balance = $b_subtotal - $amount_paid;
                    
                    // Insert into purchase_history with all fields including for_desc and purchase_from
                    $purchase_query = mysqli_query($con, "
                        INSERT INTO purchase_history(facilityID, stock_id, initial_quantity, stock_name, quantity, cost_price, total_cost, amount_paid, balance, for_desc, purchase_date, purchase_from) 
                        VALUES('$branch', '$new_stock_id', 0, '$name', '$quantity', '$bought', '$b_subtotal', '$amount_paid', '$balance', '$for_desc', CURDATE(), '$purchase_from')
                    ");

                    if ($purchase_query) {
                        echo "<script>alert('Stock added successfully');</script>";
                        echo "<script>window.location.href ='stocks.php'</script>";
                    } else {
                        $error = "Stock added, but purchase history could not be recorded: " . mysqli_error($con);
                    }
                } else {
                    $error = "Something went wrong adding new stock: " . mysqli_error($con);
                }
            }
        }
    }

    // Handle Stock Conversion (Belt <-> Yard in Same Store)
    if (isset($_POST['convert_stock'])) {
        $source_id = intval($_POST['source_stock_id']);
        $convert_qty = floatval($_POST['convert_qty']);
        $direction = mysqli_real_escape_string($con, $_POST['conversion_direction']);
        
        mysqli_begin_transaction($con);
        try {
            // Lock and fetch source stock
            $source_res = mysqli_query($con, "SELECT * FROM stocks WHERE id = '$source_id' AND facilityID = '$facilityID' FOR UPDATE");
            if (!$source_res || mysqli_num_rows($source_res) == 0) {
                throw new Exception("Source stock not found or branch mismatch.");
            }
            $source = mysqli_fetch_assoc($source_res);
            
            if ($source['status'] == 'locked') {
                throw new Exception("Cannot convert locked stock. Please unlock the stock first.");
            }
            if ($convert_qty <= 0) {
                throw new Exception("Conversion quantity must be greater than zero.");
            }
            if ($convert_qty > (float)$source['quantity']) {
                throw new Exception("Cannot convert {$convert_qty}. Only " . (float)$source['quantity'] . " available in this store.");
            }
            
            $ypb = (float)$source['yards_per_belt'];
            if ($ypb <= 0) {
                throw new Exception("Yards per Belt is not configured for this stock. Please edit the stock to set Yards per Belt first.");
            }
            
            $store_id_val = $source['store_id'];
            $store_sql_match = ($store_id_val !== null && $store_id_val !== '') ? "= '$store_id_val'" : "IS NULL";
            $store_sql_insert = ($store_id_val !== null && $store_id_val !== '') ? "'$store_id_val'" : "NULL";

            if ($direction == 'belt_to_yard') {
                $belts_transferred = $convert_qty;
                $yards_generated = $belts_transferred * $ypb;
                
                $unit_yard_sell = (float)$source['selling'] / $ypb;
                $unit_yard_buy = (float)$source['buying'] / $ypb;
                
                // 1. Decrement source belt stock
                $new_source_qty = (float)$source['quantity'] - $belts_transferred;
                $new_source_ssubtotal = (float)$source['selling'] * $new_source_qty;
                $new_source_bsubtotal = (float)$source['buying'] * $new_source_qty;
                
                $upd1 = mysqli_query($con, "UPDATE stocks SET quantity = '$new_source_qty', Ssubtotal = '$new_source_ssubtotal', Bsubtotal = '$new_source_bsubtotal' WHERE id = '$source_id'");
                if (!$upd1) {
                    throw new Exception("Failed to update source stock: " . mysqli_error($con));
                }
                
                // 2. Find or create target yard stock in SAME store and SAME facility
                $target_res = mysqli_query($con, "SELECT * FROM stocks WHERE parent_stock_id = '$source_id' AND store_id $store_sql_match AND facilityID = '{$source['facilityID']}' AND unit_type = 'yard' FOR UPDATE");
                if (mysqli_num_rows($target_res) == 0) {
                    // Try by name pattern
                    $yard_name = "Yards - " . mysqli_real_escape_string($con, $source['name']);
                    $target_res = mysqli_query($con, "SELECT * FROM stocks WHERE name = '$yard_name' AND store_id $store_sql_match AND facilityID = '{$source['facilityID']}' AND unit_type = 'yard' FOR UPDATE");
                }
                
                if ($target_res && mysqli_num_rows($target_res) > 0) {
                    $target = mysqli_fetch_assoc($target_res);
                    $target_id = $target['id'];
                    $new_target_qty = (float)$target['quantity'] + $yards_generated;
                    $new_target_ssubtotal = (float)$target['selling'] * $new_target_qty;
                    $new_target_bsubtotal = (float)$target['buying'] * $new_target_qty;
                    
                    $upd2 = mysqli_query($con, "UPDATE stocks SET quantity = '$new_target_qty', parent_stock_id = '$source_id', yards_per_belt = '$ypb', Ssubtotal = '$new_target_ssubtotal', Bsubtotal = '$new_target_bsubtotal' WHERE id = '$target_id'");
                    if (!$upd2) {
                        throw new Exception("Failed to update yard stock: " . mysqli_error($con));
                    }
                } else {
                    $yard_name = "Yards - " . mysqli_real_escape_string($con, $source['name']);
                    $new_target_ssubtotal = $unit_yard_sell * $yards_generated;
                    $new_target_bsubtotal = $unit_yard_buy * $yards_generated;
                    
                    $ins = mysqli_query($con, "INSERT INTO stocks (facilityID, store_id, name, unit_type, yards_per_belt, parent_stock_id, selling, buying, quantity, opening_quantity, closing_quantity, new_order, out_stocks, Bsubtotal, Ssubtotal, status) VALUES ('{$source['facilityID']}', $store_sql_insert, '$yard_name', 'yard', '$ypb', '$source_id', '$unit_yard_sell', '$unit_yard_buy', '$yards_generated', 0, 0, '$yards_generated', 0, '$new_target_bsubtotal', '$new_target_ssubtotal', 'active')");
                    if (!$ins) {
                        throw new Exception("Failed to create yard stock: " . mysqli_error($con));
                    }
                    $target_id = mysqli_insert_id($con);
                }
                
                // 3. Insert audit log
                $staff_id = $_SESSION['id'] ?? '';
                $staff_name = mysqli_real_escape_string($con, $_SESSION['name'] ?? $_SESSION['email'] ?? 'System');
                $prod_name = mysqli_real_escape_string($con, $source['name']);
                $conv_store = $store_id_val ? intval($store_id_val) : 0;
                
                $aud = mysqli_query($con, "INSERT INTO stock_conversions (facilityID, store_id, source_stock_id, target_stock_id, product_name, direction, quantity_transferred, yards_per_belt, resulting_quantity, staff_id, staff_name, created_at) VALUES ('{$source['facilityID']}', '$conv_store', '$source_id', '$target_id', '$prod_name', 'belt_to_yard', '$belts_transferred', '$ypb', '$yards_generated', '$staff_id', '$staff_name', NOW())");
                if (!$aud) {
                    throw new Exception("Failed to record conversion audit: " . mysqli_error($con));
                }
                
                mysqli_commit($con);
                $msg = "Successfully converted {$belts_transferred} Belts to " . number_format($yards_generated) . " Yards in same store.";
                echo "<script>alert('" . addslashes($msg) . "'); window.location.href='stocks';</script>";
                exit();
            } elseif ($direction == 'yard_to_belt') {
                $yards_transferred = $convert_qty;
                if (fmod($yards_transferred, $ypb) != 0) {
                    throw new Exception("Yard conversion must be an exact multiple of {$ypb} Yards (e.g. " . ($ypb) . ", " . ($ypb * 2) . ", " . ($ypb * 3) . ").");
                }
                
                $belts_generated = $yards_transferred / $ypb;
                
                // Find parent belt stock
                $parent_id = intval($source['parent_stock_id']);
                $parent_res = null;
                if ($parent_id > 0) {
                    $parent_res = mysqli_query($con, "SELECT * FROM stocks WHERE id = '$parent_id' AND store_id $store_sql_match AND facilityID = '{$source['facilityID']}' FOR UPDATE");
                }
                if (!$parent_res || mysqli_num_rows($parent_res) == 0) {
                    // Try finding parent belt stock by stripping 'Yards - ' from name
                    $clean_name = preg_replace('/^Yards\s*-\s*/i', '', $source['name']);
                    $clean_name_esc = mysqli_real_escape_string($con, $clean_name);
                    $parent_res = mysqli_query($con, "SELECT * FROM stocks WHERE name = '$clean_name_esc' AND store_id $store_sql_match AND facilityID = '{$source['facilityID']}' AND unit_type = 'belt' FOR UPDATE");
                }
                
                if (!$parent_res || mysqli_num_rows($parent_res) == 0) {
                    throw new Exception("Matching Belt stock not found in this Store.");
                }
                
                $parent_stock = mysqli_fetch_assoc($parent_res);
                $target_id = $parent_stock['id'];
                
                // 1. Decrement source yard stock
                $new_source_qty = (float)$source['quantity'] - $yards_transferred;
                $new_source_ssubtotal = (float)$source['selling'] * $new_source_qty;
                $new_source_bsubtotal = (float)$source['buying'] * $new_source_qty;
                
                $upd1 = mysqli_query($con, "UPDATE stocks SET quantity = '$new_source_qty', Ssubtotal = '$new_source_ssubtotal', Bsubtotal = '$new_source_bsubtotal' WHERE id = '$source_id'");
                if (!$upd1) {
                    throw new Exception("Failed to update yard stock: " . mysqli_error($con));
                }
                
                // 2. Increment target belt stock
                $new_target_qty = (float)$parent_stock['quantity'] + $belts_generated;
                $new_target_ssubtotal = (float)$parent_stock['selling'] * $new_target_qty;
                $new_target_bsubtotal = (float)$parent_stock['buying'] * $new_target_qty;
                
                $upd2 = mysqli_query($con, "UPDATE stocks SET quantity = '$new_target_qty', Ssubtotal = '$new_target_ssubtotal', Bsubtotal = '$new_target_bsubtotal' WHERE id = '$target_id'");
                if (!$upd2) {
                    throw new Exception("Failed to update belt stock: " . mysqli_error($con));
                }
                
                // 3. Insert audit log
                $staff_id = $_SESSION['id'] ?? '';
                $staff_name = mysqli_real_escape_string($con, $_SESSION['name'] ?? $_SESSION['email'] ?? 'System');
                $prod_name = mysqli_real_escape_string($con, $source['name']);
                $conv_store = $store_id_val ? intval($store_id_val) : 0;
                
                $aud = mysqli_query($con, "INSERT INTO stock_conversions (facilityID, store_id, source_stock_id, target_stock_id, product_name, direction, quantity_transferred, yards_per_belt, resulting_quantity, staff_id, staff_name, created_at) VALUES ('{$source['facilityID']}', '$conv_store', '$source_id', '$target_id', '$prod_name', 'yard_to_belt', '$yards_transferred', '$ypb', '$belts_generated', '$staff_id', '$staff_name', NOW())");
                if (!$aud) {
                    throw new Exception("Failed to record conversion audit: " . mysqli_error($con));
                }
                
                mysqli_commit($con);
                $msg = "Successfully converted " . number_format($yards_transferred) . " Yards back to {$belts_generated} Belts in same store.";
                echo "<script>alert('" . addslashes($msg) . "'); window.location.href='stocks';</script>";
                exit();
            } else {
                throw new Exception("Invalid conversion direction.");
            }
        } catch (Exception $e) {
            mysqli_rollback($con);
            $error = $e->getMessage();
            echo "<script>alert('Conversion Failed: " . addslashes($error) . "'); window.location.href='stocks';</script>";
            exit();
        }
    }

    // Handle stock deletion
    if (isset($_GET['del'])) {
        mysqli_query($con, "DELETE FROM stocks WHERE id = '" . $_GET['id'] . "'");
        $msg = "Stock deleted successfully";
    }

    // Handle Lock / Unlock
    if (isset($_GET['action'])) {
        $stock_id = intval($_GET['id']);
        if ($_GET['action'] == 'lock') {
            mysqli_query($con, "UPDATE stocks SET status = 'locked' WHERE id = '$stock_id'");
            $msg = "Stock locked successfully";
        } elseif ($_GET['action'] == 'unlock') {
            mysqli_query($con, "UPDATE stocks SET status = 'active' WHERE id = '$stock_id'");
            $msg = "Stock unlocked successfully";
        }
    }

    // Handle Close Day / Update Stock Quantities
    if (isset($_POST['update_stock_quantities'])) {
        $sql = mysqli_query($con, "
            UPDATE stocks 
            SET closing_quantity = quantity,
                opening_quantity = quantity,
                new_order = 0,
                out_stocks = 0
            WHERE 1=1
        ");
        if ($sql) {
            $msg = "Stock quantities updated (Day Closed) successfully";
        } else {
            $error = "Something went wrong updating stock quantities: " . mysqli_error($con);
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
    <link href="../assets/img/Icon.png" rel="shortcut icon">
    <link href="../assets/css/loader.css" rel="stylesheet" type="text/css" />
    <script src="../assets/js/loader.js"></script>
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dataTables.responsive.min.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <link rel="stylesheet" type="text/css" href="../assets/css/widgets/modules-widgets.css">
</head>
<body class="sidebar-noneoverflow">
    <div id="load_screen">
        <div class="loader">
            <div class="loader-content">
                <div class="spinner-grow align-self-center"></div>
            </div>
        </div>
    </div>
    <?php include('header.php'); ?>
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <div class="search-overlay"></div>
        <?php include('sidebar.php'); ?>
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <div class="row layout-top-spacing">
                    <div class="col-xl-6 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="widget widget-account-invoice-two">
                            <div class="widget-content">
                                <div class="account-box">
                                    <div class="info">
                                        <h3 style="color:white;">Total Cost Price</h3>
                                    </div>
                                    <div class="acc-action">
                                        <?php
                                        $facility_filter = "";
                                        if (!empty($facilityID)) {
                                            $facility_filter = " WHERE facilityID = '$facilityID' ";
                                        }
                                        $r_query = $con->query("SELECT SUM(buying * quantity) as 'buying' FROM stocks $facility_filter");
                                        $r_row = $r_query->fetch_array();
                                        $real = $r_row['buying'];
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
                                        <h3 style="color:white;">Total Selling Price</h3>
                                    </div>
                                    <div class="acc-action">
                                        <?php
                                        $q_query = $con->query("SELECT SUM(selling * quantity) as 'selling' FROM stocks $facility_filter");
                                        $q_row = $q_query->fetch_array();
                                        $real = $q_row['selling'];
                                        ?>
                                        <h1 style="color:white"> <b> ₦<?php echo number_format($real); ?></b></h1>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="row layout-top-spacing" id="cancel-row">
                    <div class="col-xl-12 col-lg-12 col-sm-12 layout-spacing">
                        <button type="button" class="btn btn-primary mb-4 mr-2" data-toggle="modal" data-target="#stockModal">
                            Add New Stock
                        </button>



                        <form method="GET" class="mb-4">
                            <div class="row">
                                <div class="col-md-3">
                                    <label>Select Date</label>
                                    <input type="date" name="report_date" id="report_date" class="form-control" value="<?php echo $report_date; ?>">
                                </div>
                                <div class="col-md-2 d-flex align-items-end">
                                    <button type="submit" class="btn btn-primary w-100">Filter</button>
                                </div>
                            </div>
                        </form>

                        <div class="widget-content widget-content-area br-6">
                            <?php if ($error) { ?>
                                <strong style="color:red; font-size:18px; margin-top: 15px;"><?php echo $error; ?></strong>
                            <?php } else if ($msg) { ?>
                                <strong style="color:green; font-size:18px; margin-top: 15px;"><?php echo $msg; ?></strong>
                            <?php } ?>
                            <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th>S/N</th>
                                        <th>Branch ID</th>
                                        <th>Stock Name</th>
                                        <th>Store</th>
                                        <th>Cost Price</th>
                                        <th>Selling Price</th>
                                        <th>Quantity</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php
                                    $sql = mysqli_query($con, "SELECT s.*, st.store_name FROM stocks s LEFT JOIN stores st ON s.store_id = st.id");
                                    $cnt = 1;
                                    $is_today = ($report_date == date('Y-m-d'));
                                    
                                    while ($row = mysqli_fetch_array($sql)) {
                                        $stock_id = $row['id'];
                                        $stock_name = $row['name'];
                                        $display_quantity = $row['quantity'];
                                        $store_name = !empty($row['store_name']) ? $row['store_name'] : 'Unassigned';
                                        $unit_type = $row['unit_type'] ?? 'belt';
                                        $yards_per_belt = !empty($row['yards_per_belt']) ? (float)$row['yards_per_belt'] : 0;
                                        
                                        if (!$is_today) {
                                            $current_qty = $row['quantity'];
                                            
                                            // Calculate Quantity at the end of selected date using "backward" logic:
                                            // Hist Qty = Current Qty - (Purchases made AFTER report_date) + (Sales made AFTER report_date)
                                            
                                            // Purchases after report_date
                                            $p_future_sql = mysqli_query($con, "SELECT COALESCE(SUM(quantity), 0) as total_p_future FROM purchase_history WHERE stock_id = '$stock_id' AND DATE(purchase_date) > '$report_date'");
                                            $p_future_row = mysqli_fetch_array($p_future_sql);
                                            $total_p_future = $p_future_row['total_p_future'];
                                            
                                            // Sales after report_date
                                            $s_future_sql = mysqli_query($con, "SELECT COALESCE(SUM(quantity), 0) as total_s_future FROM orders WHERE (stockID = '$stock_id' OR item = '$stock_name') AND DATE(creation) > '$report_date'");
                                            $s_future_row = mysqli_fetch_array($s_future_sql);
                                            $total_s_future = $s_future_row['total_s_future'];
                                            
                                            $display_quantity = $current_qty - $total_p_future + $total_s_future;
                                        }
                                    ?>
                                        <tr>
                                            <td class="center"><?php echo $cnt; ?>.</td>
                                            <td><?php echo $row['facilityID']; ?></td>
                                            <td><?php echo $row['name']; ?></td>
                                            <td><?php echo htmlspecialchars($store_name); ?></td>
                                            <td>₦ <?php echo number_format($row['buying']); ?></td>
                                            <td>₦ <?php echo number_format($row['selling']); ?></td>
                                            <td>
                                                <?php if ($unit_type == 'belt' && $yards_per_belt > 0) { ?>
                                                    <b><?php echo number_format($display_quantity); ?> Belts</b>
                                                    <small class="text-muted d-block font-weight-bold" style="font-size:11px;">(<?php echo number_format($display_quantity * $yards_per_belt); ?> Yards @ <?php echo $yards_per_belt; ?> yds/belt)</small>
                                                <?php } elseif ($unit_type == 'yard') { ?>
                                                    <b><?php echo number_format($display_quantity); ?> Yards</b>
                                                    <span class="badge badge-warning d-block mt-1" style="font-size:10px; width: fit-content;">Yard Stock</span>
                                                <?php } else { ?>
                                                    <?php echo $display_quantity; ?>
                                                <?php } ?>
                                            </td>
                                            <td>
                                                <a href="edit-stock.php?id=<?php echo $row['id']; ?>" class="btn btn-primary btn-sm">Edit</a>
                                                <?php if (($unit_type == 'belt' && $yards_per_belt > 0) || $unit_type == 'yard') { ?>
                                                    <button type="button" class="btn btn-dark btn-sm convert-btn" 
                                                        onclick="openConvertModal(this)"
                                                        data-stock-id="<?php echo $row['id']; ?>" 
                                                        data-stock-name="<?php echo htmlspecialchars($row['name']); ?>" 
                                                        data-unit-type="<?php echo $unit_type; ?>" 
                                                        data-yards-per-belt="<?php echo $yards_per_belt; ?>" 
                                                        data-current-qty="<?php echo $row['quantity']; ?>" 
                                                        data-store-id="<?php echo $row['store_id']; ?>" 
                                                        data-store-name="<?php echo htmlspecialchars($store_name); ?>"
                                                        data-status="<?php echo $row['status']; ?>"
                                                        data-selling="<?php echo $row['selling']; ?>"
                                                        data-buying="<?php echo $row['buying']; ?>">Convert</button>
                                                <?php } ?>
                                                <button type="button" class="btn btn-info btn-sm manage-btn" data-stock-id="<?php echo $row['id']; ?>" data-stock-name="<?php echo $row['name']; ?>">Manage</button>
                                                <?php if ($row['status'] == 'locked') { ?>
                                                    <a href="stocks.php?id=<?php echo $row['id']; ?>&action=unlock" class="btn btn-warning btn-sm">Unlock</a>
                                                <?php } else { ?>
                                                    <a href="stocks.php?id=<?php echo $row['id']; ?>&action=lock" class="btn btn-secondary btn-sm">Lock</a>
                                                <?php } ?>
                                                <a href="stocks.php?id=<?php echo $row['id']; ?>&del=delete" onClick="return confirm('Are you sure you want to delete?')" class="btn btn-danger btn-sm">Delete</a>
                                            </td>
                                        </tr>
                                    <?php
                                        $cnt++;
                                    }
                                    ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="modal fade" id="stockModal" tabindex="-1" role="dialog" aria-labelledby="stockModalLabel" aria-hidden="true">
                    <div class="modal-dialog" role="document">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="stockModalLabel">Add New Stock</h5>
                                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <form method="POST" id="stockForm">
                                <div class="modal-body">
                                    <input type="hidden" name="stock_id" id="stockIdHidden" value="">
                                    <div class="form-group" id="nameGroup">
                                        <label>Stock Name</label>
                                        <span style="color:red">*</span>
                                        <input type="text" class="form-control" name="name" id="nameInput" required>
                                    </div>
                                    <div class="form-group" id="sellGroup">
                                        <label>Selling Price</label>
                                        <span style="color:red">*</span>
                                        <input type="number" class="form-control" name="sell" id="sellInput" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Cost Price</label>
                                        <span style="color:red">*</span>
                                        <input type="number" class="form-control" name="bought" required>
                                    </div>
                                    <div class="form-group" id="qtyGroup">
                                        <label>Stock Quantity</label>
                                        <span style="color:red">*</span>
                                        <input type="number" class="form-control" name="quantity" id="qtyInput" required>
                                    </div>
                                    <div class="form-group" id="yardsPerBeltGroup">
                                        <label>Yards per Belt <small class="text-muted">(Optional, for belt stock)</small></label>
                                        <input type="number" step="0.01" min="0" class="form-control" name="yards_per_belt" id="yardsPerBeltInput" placeholder="e.g. 100">
                                        <small class="text-info font-weight-bold d-block mt-1" id="totalYardsDisplay" style="display:none;"></small>
                                    </div>
                                    <div class="form-group">
                                        <label>Branch</label>
                                        <span style="color:red">*</span>
                                        <select name="branch" id="branchSelect" class="form-control" required onchange="loadStores(this.value)">
                                            <option value="">Select Branch</option>
                                            <?php
                                            $branchSql = mysqli_query($con, "SELECT * FROM branch");
                                            while ($brow = mysqli_fetch_array($branchSql)) {
                                                echo "<option value='{$brow['facilityID']}'>{$brow['name']}</option>";
                                            }
                                            ?>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Store</label>
                                        <select name="store_id" id="storeSelect" class="form-control">
                                            <option value="">Select Store (Optional)</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>For Description</label>
                                        <input type="text" class="form-control" name="for_desc" placeholder="Enter description for this purchase">
                                    </div>
                                    <div class="form-group">
                                        <label>Purchase From</label>
                                        <input type="text" class="form-control" name="purchase_from" placeholder="Enter supplier/vendor name">
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button class="btn" data-dismiss="modal">Discard</button>
                                    <button type="submit" class="btn btn-primary" name="submit">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="conversionModal" tabindex="-1" role="dialog" aria-labelledby="conversionModalLabel" aria-hidden="true">
                    <div class="modal-dialog" role="document">
                        <div class="modal-content text-dark">
                            <div class="modal-header">
                                <h5 class="modal-title" id="conversionModalLabel">Convert Stock</h5>
                                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <form method="POST" id="conversionForm">
                                <div class="modal-body">
                                    <input type="hidden" name="source_stock_id" id="conv_source_id">
                                    <input type="hidden" name="conversion_direction" id="conv_direction_hidden" value="belt_to_yard">
                                    
                                    <div class="alert alert-light-primary border-0 mb-3" role="alert" style="background-color: #ebf3fe; padding: 12px; border-radius: 6px;">
                                        <h6 class="mb-1 text-primary font-weight-bold" id="conv_prod_title">Product Name</h6>
                                        <p class="mb-0 text-muted" style="font-size: 13px;">
                                            Store: <span id="conv_store_badge" class="font-weight-bold text-dark">Store</span> | 
                                            Available: <span id="conv_avail_badge" class="font-weight-bold text-success">0</span>
                                        </p>
                                    </div>

                                    <div class="form-group">
                                        <label>Conversion Direction</label>
                                        <select id="conv_direction" class="form-control" style="pointer-events: none; background-color: #e9ecef;">
                                            <option value="belt_to_yard">Belt &rarr; Yard (Convert Belts to Cut Yards)</option>
                                            <option value="yard_to_belt">Yard &rarr; Belt (Convert Cut Yards back to Belts)</option>
                                        </select>
                                    </div>

                                    <div class="form-group">
                                        <label id="conv_qty_label">Quantity to Convert</label>
                                        <span style="color:red">*</span>
                                        <input type="number" step="any" min="0.01" class="form-control" name="convert_qty" id="conv_qty_input" placeholder="Enter quantity" required>
                                        <small class="form-text text-muted" id="conv_qty_hint">Enter number of Belts to convert.</small>
                                    </div>

                                    <div class="p-3 bg-light rounded mb-2 border" id="conv_preview_box">
                                        <div class="d-flex justify-content-between mb-1">
                                            <span class="text-muted" style="font-size:13px;">Conversion Rate:</span>
                                            <span class="font-weight-bold text-dark" style="font-size:13px;" id="conv_rate_txt">100 Yards / Belt</span>
                                        </div>
                                        <div class="d-flex justify-content-between mb-1">
                                            <span class="text-muted" style="font-size:13px;">Resulting Stock:</span>
                                            <span class="font-weight-bold text-primary" style="font-size:13px;" id="conv_result_txt">0 Yards</span>
                                        </div>
                                        <div class="d-flex justify-content-between">
                                            <span class="text-muted" style="font-size:13px;">Remaining Balance:</span>
                                            <span class="font-weight-bold text-secondary" style="font-size:13px;" id="conv_remain_txt">0</span>
                                        </div>
                                    </div>
                                    <div id="conv_error_alert" class="alert alert-danger py-2 px-3 mt-2 d-none" style="font-size:12px;"></div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                    <button type="submit" class="btn btn-primary" name="convert_stock" id="conv_submit_btn">Confirm Conversion</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="modal fade" id="manageModal" tabindex="-1" role="dialog" aria-labelledby="manageModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-lg" role="document">
                        <div class="modal-content text-dark">
                            <div class="modal-header">
                                <h5 class="modal-title" id="manageModalLabel">Manage Purchases</h5>
                                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <div class="modal-body">
                                <div id="history-container">
                                    <p class="text-center">Loading history...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="editPurchaseModal" tabindex="-1" role="dialog" aria-hidden="true">
                    <div class="modal-dialog" role="document">
                        <div class="modal-content text-dark">
                            <div class="modal-header">
                                <h5 class="modal-title">Modify Purchase</h5>
                                <button type="button" class="close" data-dismiss="modal">&times;</button>
                            </div>
                            <form id="editPurchaseForm">
                                <div class="modal-body">
                                    <input type="hidden" name="purchase_id" id="edit_p_id">
                                    <input type="hidden" name="stock_id" id="edit_p_stock_id">
                                    <div class="form-group">
                                        <label>Quantity</label>
                                        <input type="number" name="quantity" id="edit_p_qty" class="form-control" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Cost Price</label>
                                        <input type="number" name="cost" id="edit_p_cost" class="form-control" required>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="submit" class="btn btn-primary">Update Purchase</button>
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
    <script src="../plugins/table/datatable/dataTables.responsive.min.js"></script>
    <!-- NOTE TO Use Copy CSV Excel PDF Print Options You Must Include These Files  -->
    <script src="../plugins/table/datatable/button-ext/dataTables.buttons.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/jszip.min.js"></script>    
    <script src="../plugins/table/datatable/button-ext/buttons.html5.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/buttons.print.min.js"></script>
    <script>
        function loadStores(branchId, selectedStoreId) {
            if (!branchId) {
                $('#storeSelect').html('<option value="">Select Store (Optional)</option>');
                return;
            }
            $.get('get_stores.php', { branch_id: branchId }, function(data) {
                $('#storeSelect').html(data);
                if (selectedStoreId) {
                    $('#storeSelect').val(selectedStoreId);
                }
            });
        }

        // Global function to populate and open Conversion Modal from clicked button
        function openConvertModal(btn) {
            if (!btn) return;

            var stockId = btn.getAttribute('data-stock-id');
            var stockName = btn.getAttribute('data-stock-name');
            var unitType = btn.getAttribute('data-unit-type') || 'belt';
            var ypb = parseFloat(btn.getAttribute('data-yards-per-belt')) || 0;
            var currentQty = parseFloat(btn.getAttribute('data-current-qty')) || 0;
            var storeName = btn.getAttribute('data-store-name') || 'Unassigned';
            var status = btn.getAttribute('data-status');

            if (status === 'locked') {
                alert('Cannot convert locked stock. Please unlock the stock first.');
                return false;
            }

            $('#conv_source_id').val(stockId);
            $('#conv_prod_title').text(stockName);
            $('#conv_store_badge').text(storeName);
            $('#conv_avail_badge').text(currentQty.toLocaleString() + ' ' + (unitType === 'yard' ? 'Yards' : 'Belts'));
            
            if (unitType === 'yard') {
                $('#conv_direction').val('yard_to_belt');
                $('#conv_direction_hidden').val('yard_to_belt');
                $('#conv_qty_label').text('Yards to Convert back to Belts');
                $('#conv_qty_hint').text('Must be an exact multiple of ' + ypb + ' Yards (e.g. ' + ypb + ', ' + (ypb*2) + ').');
            } else {
                $('#conv_direction').val('belt_to_yard');
                $('#conv_direction_hidden').val('belt_to_yard');
                $('#conv_qty_label').text('Belts to Convert to Yards');
                $('#conv_qty_hint').text('Enter number of Belts to convert (1 Belt = ' + ypb + ' Yards).');
            }

            $('#conv_rate_txt').text(ypb + ' Yards / Belt');
            $('#conv_qty_input').val('').data('ypb', ypb).data('avail', currentQty).data('type', unitType);
            $('#conv_result_txt').text('0 ' + (unitType === 'yard' ? 'Belts' : 'Yards'));
            $('#conv_remain_txt').text(currentQty.toLocaleString() + ' ' + (unitType === 'yard' ? 'Yards' : 'Belts'));
            $('#conv_error_alert').addClass('d-none').text('');
            $('#conv_submit_btn').prop('disabled', false);

            $('#conversionModal').modal('show');
            return true;
        }

        $(document).ready(function() {
            $('#html5-extension').DataTable({
                responsive: true,
                "dom": "<'dt--top-section'<'row'<'col-sm-12 col-md-6 d-flex justify-content-md-start justify-content-center'B><'col-sm-12 col-md-6 d-flex justify-content-md-end justify-content-center mt-md-0 mt-3'f>>>" +
            "<'table-responsive'tr>" +
            "<'dt--bottom-section d-sm-flex justify-content-sm-between text-center'<'dt--pages-count  mb-sm-0 mb-3'i><'dt--pagination'p>>",
                buttons: {
                    buttons: [
                        { extend: 'copy', className: 'btn btn-sm' },
                        { extend: 'csv', className: 'btn btn-sm' },
                        { 
                            extend: 'excel', 
                            className: 'btn btn-sm',
                            title: 'MURG TEXTILE ENTERPRISES CLOSING - <?= date("Y-m-d"); ?>',
                            customize: function(xlsx) {
                                var sheet = xlsx.xl.worksheets['sheet1.xml'];
                                // Style 25 is thin border.
                                $('row c', sheet).attr('s', '25');
                            }
                        },
                        { extend: 'print', className: 'btn btn-sm' }
                    ]
                },
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

            // Live calculation of Total Yards in Add Stock Modal
            function updateTotalYards() {
                const qty = parseFloat($('#qtyInput').val()) || 0;
                const ypb = parseFloat($('#yardsPerBeltInput').val()) || 0;
                if (qty > 0 && ypb > 0) {
                    const totalYards = qty * ypb;
                    $('#totalYardsDisplay').text('Total Yards: ' + totalYards.toLocaleString() + ' Yds').show();
                } else {
                    $('#totalYardsDisplay').hide();
                }
            }
            $('#qtyInput, #yardsPerBeltInput').on('input', updateTotalYards);

            // Auto-load store on Add New Stock modal show
            $('#stockModal').on('show.bs.modal', function() {
                if (!$('#stockIdHidden').val()) {
                    const sessionBranch = '<?php echo $facilityID; ?>';
                    if (!$('#branchSelect').val() && sessionBranch) {
                        $('#branchSelect').val(sessionBranch);
                    }
                    const branchVal = $('#branchSelect').val();
                    if (branchVal) {
                        loadStores(branchVal);
                    }
                }
            });

            // Handle purchase button click using event delegation
            $(document).on('click', '.purchase-btn', function() {
                const branchId = $(this).data('branch-id');
                const storeId = $(this).data('store-id');

                $('#stockModalLabel').text('Add Purchase');
                $('#stockIdHidden').val($(this).data('stock-id'));
                $('#nameInput').val($(this).data('stock-name')).prop('readonly', true).removeAttr('required');
                $('#sellInput').removeAttr('required');
                $('#branchSelect').val(branchId).prop('disabled', true);
                
                // Add hidden branch for form submission (since disabled selects are not posted)
                if (!$('#branchHidden').length) {
                    $('#stockForm').append('<input type="hidden" name="branch" id="branchHidden" value="' + branchId + '">');
                } else {
                    $('#branchHidden').val(branchId);
                }

                $('#nameGroup').hide();
                $('#sellGroup').hide();
                $('#yardsPerBeltGroup').hide();
                $('#stockForm').find('button[name="submit"]').text('Add Purchase');

                loadStores(branchId, storeId);
            });

            // Reset modal for new stock
            $('#stockModal').on('hidden.bs.modal', function() {
                $('#stockModalLabel').text('Add New Stock');
                $('#stockForm')[0].reset();
                $('#storeSelect').html('<option value="">Select Store (Optional)</option>');
                $('#nameInput').prop('readonly', false).attr('required', 'required');
                $('#sellInput').attr('required', 'required');
                $('#branchSelect').prop('disabled', false);
                $('#branchHidden').remove();
                $('#nameGroup').show();
                $('#sellGroup').show();
                $('#yardsPerBeltGroup').show();
                $('#totalYardsDisplay').hide();
                $('#stockIdHidden').val('');
                $('#stockForm').find('button[name="submit"]').text('Save');
            });



            // Reset conversion modal state when hidden
            $('#conversionModal').on('hidden.bs.modal', function() {
                $('#conv_qty_input').val('');
                $('#conv_error_alert').addClass('d-none').text('');
                $('#conv_submit_btn').prop('disabled', false);
            });

            // Live preview and validation for conversion input
            $('#conv_qty_input').on('input', function() {
                const qty = parseFloat($(this).val()) || 0;
                const ypb = parseFloat($(this).data('ypb')) || 0;
                const avail = parseFloat($(this).data('avail')) || 0;
                const type = $(this).data('type');
                const $err = $('#conv_error_alert');
                const $btn = $('#conv_submit_btn');

                $err.addClass('d-none').text('');
                $btn.prop('disabled', false);

                if (qty <= 0) {
                    $('#conv_result_txt').text('0 ' + (type === 'yard' ? 'Belts' : 'Yards'));
                    $('#conv_remain_txt').text(avail.toLocaleString() + ' ' + (type === 'yard' ? 'Yards' : 'Belts'));
                    return;
                }

                if (qty > avail) {
                    $err.removeClass('d-none').text('Cannot convert more than available stock (' + avail.toLocaleString() + ').');
                    $btn.prop('disabled', true);
                    return;
                }

                if (type === 'yard') {
                    if (ypb > 0 && (qty % ypb !== 0)) {
                        $err.removeClass('d-none').text('Yard quantity must be an exact multiple of ' + ypb + ' Yards (e.g. ' + ypb + ', ' + (ypb*2) + ', ' + (ypb*3) + ').');
                        $btn.prop('disabled', true);
                    }
                    const resultingBelts = ypb > 0 ? (qty / ypb) : 0;
                    const remainingYards = avail - qty;
                    $('#conv_result_txt').text(resultingBelts.toLocaleString() + ' Belts');
                    $('#conv_remain_txt').text(remainingYards.toLocaleString() + ' Yards');
                } else {
                    const resultingYards = qty * ypb;
                    const remainingBelts = avail - qty;
                    $('#conv_result_txt').text(resultingYards.toLocaleString() + ' Yards');
                    $('#conv_remain_txt').text(remainingBelts.toLocaleString() + ' Belts');
                }
            });

            // Manage Purchases
            $(document).on('click', '.manage-btn', function() {
                const stockId = $(this).data('stock-id');
                const stockName = $(this).data('stock-name');
                const date = $('#report_date').val();

                $('#manageModalLabel').text('Purchase History: ' + stockName);
                $('#manageModal').modal('show');
                loadHistory(stockId, date, date);
            });

            function loadHistory(stockId, start, end) {
                $('#history-container').html('<p class="text-center">Loading history...</p>');
                $.get('manage_purchases_api.php', { action: 'list', stock_id: stockId, start: start, end: end }, function(data) {
                    $('#history-container').html(data);
                });
            }

            // Remove Purchase
            $(document).on('click', '.remove-p-btn', function() {
                if(confirm('Are you sure you want to remove this purchase? Stock quantity and report values will be adjusted.')) {
                    const pid = $(this).data('id');
                    const sid = $(this).data('stock-id');
                    $.post('manage_purchases_api.php', { action: 'delete', id: pid, stock_id: sid }, function(res) {
                        const date = $('#report_date').val();
                        loadHistory(sid, date, date);
                        alert(res.message);
                    }, 'json');
                }
            });

            // Edit Purchase
            $(document).on('click', '.edit-p-btn', function() {
                $('#edit_p_id').val($(this).data('id'));
                $('#edit_p_stock_id').val($(this).data('stock-id'));
                $('#edit_p_qty').val($(this).data('qty'));
                $('#edit_p_cost').val($(this).data('cost'));
                $('#editPurchaseModal').modal('show');
            });

            $('#editPurchaseForm').on('submit', function(e) {
                e.preventDefault();
                $.post('manage_purchases_api.php', $(this).serialize() + '&action=update', function(res) {
                    $('#editPurchaseModal').modal('hide');
                    const sid = $('#edit_p_stock_id').val();
                    const date = $('#report_date').val();
                    loadHistory(sid, date, date);
                    alert(res.message);
                }, 'json');
            });
        });
    </script>
</body>
</html>

