<?php
session_start();

error_reporting(0);
include('../assets/mashaAllah/gyada.php');

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
} else {
    $staffID = $_SESSION['id'];
    $facilityID = $_SESSION['facilityID'];
    $customerID = isset($_GET['customerid']) ? intval($_GET['customerid']) : 0;

    if (isset($_POST['cart'])) {
        $price = floatval($_POST['available']);
        $selected_stock_id = mysqli_real_escape_string($con, $_POST['speciality']);
        $customer = mysqli_real_escape_string($con, $_POST['customer']);
        $quantity = floatval($_POST['quantity']);
        $subtotal = $price * $quantity;
        $store_id = !empty($_POST['store_id']) ? intval($_POST['store_id']) : NULL;
        $item_discount = floatval($_POST['item_discount'] ?? 0);
        $error = "";

        // 1. Validate Store selection is mandatory
        if ($store_id === NULL) {
            $error = "Please select a Store.";
        } else {
            // Verify store exists, is active, and belongs to the current branch
            $store_check = mysqli_query($con, "SELECT id, branch_id, status FROM stores WHERE id = '$store_id'");
            if (mysqli_num_rows($store_check) == 0) {
                $error = "Invalid Store selected.";
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
            // 2. Find product name of the selected stockId
            $stock_name_query = mysqli_query($con, "SELECT name FROM stocks WHERE id='$selected_stock_id' AND facilityID='$facilityID'");
            if (mysqli_num_rows($stock_name_query) == 0) {
                $error = "Invalid Product selected.";
            } else {
                $stock_name_row = mysqli_fetch_assoc($stock_name_query);
                $product_name = $stock_name_row['name'];

                // 3. Find the stock record for this product in the selected store (excluding locked stocks)
                $stock_query = mysqli_query($con, "SELECT id, quantity, name FROM stocks WHERE name='$product_name' AND store_id='$store_id' AND facilityID='$facilityID' AND (status = 'active' OR status IS NULL)");
                
                if (mysqli_num_rows($stock_query) > 1) {
                    $error = "Ambiguity detected: Multiple stock records exist for product '" . addslashes($product_name) . "' in the selected Store and Branch. Please contact the administrator.";
                } elseif (mysqli_num_rows($stock_query) == 0) {
                    $error = "This product is not available in the selected Store.";
                } else {
                    $stock_row = mysqli_fetch_assoc($stock_query);
                    $available_stock = floatval($stock_row['quantity']);
                    $item = $stock_row['name'];
                    $actual_stock_id = $stock_row['id'];

                    // 4. Validate quantity
                    if ($quantity <= 0) {
                        $error = "Invalid quantity requested.";
                    } elseif ($quantity > $available_stock) {
                        $error = "Requested quantity exceeds available stock! Only " . $available_stock . " available.";
                    }
                }
            }
        }

        if ($error) {
            ?>
            <script>
                alert('<?php echo addslashes($error); ?>');
            </script>
            <?php
        } else {
            // Fetch customer name
            $cust_query = $con->query("SELECT name FROM customers WHERE id='$customer'");
            $cust_row = $cust_query->fetch_array();
            $customer_name = $cust_row['name'];

            $sql = mysqli_query($con, "INSERT INTO debt_cart(facilityID, customerID, staffID, stockID, store_id, name, item, price, quantity, subtotal, discount, status)
                                 VALUES('$facilityID', '$customer', '$staffID', '$actual_stock_id', '$store_id', '$customer_name', '$item', '$price', '$quantity', '$subtotal', '$item_discount', '0')");
            if ($sql) {
                // Update stock: decrement quantity and increment out_stocks counter on actual stock record
                $remain = $available_stock - $quantity;
                mysqli_query($con, "UPDATE stocks SET quantity='$remain', out_stocks = out_stocks + '$quantity' WHERE id='$actual_stock_id'");

                ?>
                <script>window.location.href = "credit?customerid=<?php echo $customer; ?>";</script>
                <?php
            } else {
                ?>
                <script>
                    alert('Something went wrong. Please try again.');
                </script>
                <?php
            }
        }
    }

    if (isset($_GET['del'])) {
        $cart_id = intval($_GET['id']);
        $cart_query = $con->query("SELECT * FROM debt_cart WHERE id='$cart_id'");
        $c_row = $cart_query->fetch_array();
        $quantity = $c_row['quantity'];
        $stockID = $c_row['stockID'];
        $customer = $c_row['customerID'];

        // Restore stock and decrement out_stocks
        mysqli_query($con, "UPDATE stocks SET quantity = quantity + '$quantity', out_stocks = out_stocks - '$quantity' WHERE id='$stockID'");

        // Delete from cart
        mysqli_query($con, "DELETE FROM debt_cart WHERE id = '$cart_id'");
        
        ?>
        <script>window.location.href = "credit?customerid=<?php echo $customer; ?>";</script>
        <?php
    }

    // Checkout logic (if they want to do it from here too, following order.php)
    if (isset($_POST['checkout'])) {
        $customer = $_POST['customer_id'];
        $staff = $_SESSION['name'];
        $discount = $_POST['discount']; // General Discount
        
        // Fetch customer details
        $cust_query = $con->query("SELECT name FROM customers WHERE id='$customer'");
        $cust_row = $cust_query->fetch_array();
        $customer_name = $cust_row['name'];

        // Calculate total from cart: SUM((price - unit_discount) * quantity)
        $total_query = $con->query("SELECT SUM((CAST(price AS DECIMAL(15,2)) - CAST(discount AS DECIMAL(15,2))) * CAST(quantity AS DECIMAL(15,2))) as total FROM debt_cart WHERE customerID='$customer' AND staffID='$staffID'");
        $total_row = $total_query->fetch_array();
        $total = $total_row['total'];
        $net_total = $total - $discount;
        
        // Get payment amounts
        $cash_amount = $_POST['cash_amount'] ?? 0;
        $pos_amount = $_POST['pos_amount'] ?? 0;
        $transfer_amount = $_POST['transfer_amount'] ?? 0;
        $bank_name = $_POST['bank_name'] ?? null;
        
        $total_paid = $cash_amount + $pos_amount + $transfer_amount;
        $payment_type = ($total_paid >= $net_total) ? 'Split Payment' : 'Credit';
        
        // Create unique order ID (Timestamp + Random)
        $orderID = time() . rand(10, 99);
        $_SESSION['orderID'] = $orderID;
        
        $sql = mysqli_query($con, "INSERT INTO orders(
            facilityID, stockID, staffID, customerID, customer_name, item, price, quantity, subtotal, item_discount, staff, 
            payment, orderID, discount, status, 
            amount_paid, change_given, net_total, bank_name,
            cash, pos, transfer, creation
        ) SELECT 
            facilityID, stockID, staffID, customerID, name, item, price, quantity, subtotal, discount, '$staff',
            '$payment_type', '$orderID', '$discount', " . ($total_paid >= $net_total ? 1 : 0) . ",
            '$total_paid', 0, (price - discount) * quantity, " . ($bank_name ? "'$bank_name'" : "NULL") . ",
            '$cash_amount', '$pos_amount', '$transfer_amount', NOW()
        FROM debt_cart WHERE customerID='$customer' AND staffID='$staffID' AND facilityID='$facilityID'");
        
        if ($sql) {
            // Insert into sales queue (prevents duplicates via UNIQUE constraint on orderID)
            $queue_insert = mysqli_query($con, "INSERT IGNORE INTO sales_queue(orderID, facilityID, status) VALUES('$orderID', '$facilityID', 'pending')");
            
            // Handle outstanding balance if its a credit order
            $balance = $net_total - $total_paid;
            if ($balance > 0) {
                $outstand_query = $con->query("SELECT amount, balance FROM outstand WHERE customerID='$customer' AND facilityID='$facilityID'");
                if ($outstand_query->num_rows > 0) {
                    $row = $outstand_query->fetch_assoc();
                    $new_amount = $row['amount'] + $total_paid;
                    $new_balance = $row['balance'] + $balance;
                    mysqli_query($con, "UPDATE outstand SET amount='$new_amount', balance='$new_balance' WHERE customerID='$customer' AND facilityID='$facilityID'");
                } else {
                    mysqli_query($con, "INSERT INTO outstand(facilityID, customerID, staffID, Customer, staff, amount, balance) VALUES ('$facilityID', '$customer', '$staffID', '$customer_name', '$staff', '$total_paid', '$balance')");
                }
            }

            // Clear cart
            mysqli_query($con, "DELETE FROM debt_cart WHERE customerID='$customer' AND staffID='$staffID'");
            ?>
            <script>window.open("invoice?id=<?php echo $staffID; ?>&orderid=<?php echo $orderID; ?>");</script>
            <script>window.location.href = 'credit';</script>
            <?php
        } else {
            $error = "Something went wrong. Please try again";
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
    <title>MURG TEXTILE ENTERPRISES - Credit Order</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/users/user-profile.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/select2/select2.min.css">
    <style>
        .summary-box { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }
        .negative { color: red; }
        .positive { color: green; }
    </style>
    <script>
        function getdoctor(val) {
            $("#available_qty").val('');
            $("#storeSelect").html('<option value="">Select Store</option>');
            if (!val) {
                return;
            }
            $.ajax({
                type: "POST",
                url: "get_price.php",
                data: 'specilizationid=' + val,
                success: function(data) {
                    $("#available").html(data);
                }
            });
            $.ajax({
                type: "POST",
                url: "get_stock_stores.php",
                data: 'stock_id=' + val,
                success: function(data) {
                    $("#storeSelect").html(data);
                }
            });
        }
        function getqty(val) {
            $("#available_qty").val('');
            if (!val) {
                return;
            }
            var stockId = $("select[name='speciality']").val();
            $.ajax({
                type: "POST",
                url: "get_qty.php",
                data: 'specilizationid=' + stockId + '&store_id=' + val,
                success: function(data) {
                    $("#available_qty").val($.trim(data));
                }
            });
        }

        $(document).ready(function() {
            $(document).on('change', 'select[name="speciality"]', function() {
                getdoctor($(this).val());
            });
            $(document).on('change', '#storeSelect', function() {
                getqty($(this).val());
            });
        });
    </script>
</head>
<body class="sidebar-noneoverflow">
    <div id="load_screen"> <div class="loader"> <div class="loader-content"><div class="spinner-grow align-self-center"></div></div></div></div>
    <?php include('header.php'); ?>
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <div class="search-overlay"></div>
        <?php include('sidebar.php'); ?>
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <div class="row layout-spacing">
                    <!-- New Order Form -->
                    <div class="col-xl-6 col-lg-6 col-md-5 col-sm-12 layout-top-spacing">
                        <div class="skills layout-spacing">
                            <div class="widget-content widget-content-area">
                                <h3 class="">New Credit Order</h3>
                                <form method="POST">
                                    <div class="form-group">
                                        <label>Customer Name</label><span style="color:red">*</span><br>
                                        <select class="form-control basic" style="width: 100%;" required name="customer" onchange="window.location.href='credit?customerid='+this.value">
                                             <option value="">Select from list</option>
                                            <?php
                                            $ret = mysqli_query($con, "SELECT * FROM customers");
                                            while ($row = mysqli_fetch_array($ret)) {
                                                $selected = ($customerID == $row['id']) ? "selected" : "";
                                                echo "<option value='".htmlentities($row['id'])."'$selected>".htmlentities($row['name'])."</option>";
                                            } ?>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Stock Name</label><span style="color:red">*</span><br>
                                        <select class="form-control basic" required name="speciality" onChange="getdoctor(this.value);">
                                            <option value="">Select from list</option>
                                            <?php
                                            $ret = mysqli_query($con, "SELECT * FROM stocks WHERE quantity > 0 AND (status = 'active' OR status IS NULL) ORDER BY name ASC");
                                            while ($row = mysqli_fetch_array($ret)) {
                                                echo "<option value='".htmlentities($row['id'])."'>".htmlentities($row['name'])."</option>";
                                            } ?>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Stock Price</label><span style="color:red">*</span><br>
                                        <select class="form-control select2" style="width: 100%;" required name="available" id="available"></select>
                                    </div>
                                    <div class="form-group">
                                        <label>Store</label>
                                        <select class="form-control" name="store_id" id="storeSelect" onchange="getqty(this.value)" required>
                                            <option value="">Select Store</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Available Quantity (In Stock)</label>
                                        <input type="text" class="form-control" name="available_qty" id="available_qty" readonly>
                                    </div>
                                    <div class="form-group">
                                        <label>Quantity</label><span style="color:red">*</span><br>
                                        <input type="number" class="form-control" required name="quantity" value="1">
                                    </div>
                                    <div class="form-group">
                                        <label>Unit Discount (Naira Discount Per Each Single Item)</label>
                                        <input type="number" class="form-control" name="item_discount" value="0">
                                    </div>
                                    <div class="modal-footer">
                                        <button type="submit" class="btn btn-primary" name="cart">Add To Cart</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <!-- Cart Section -->
                    <div class="col-xl-6 col-lg-6 col-md-5 col-sm-12 layout-top-spacing">
                        <div class="skills layout-spacing">
                            <div class="widget-content widget-content-area">
                                <h3 class="">Cart</h3>
                                <?php if ($customerID > 0) { 
                                    $cust_q = $con->query("SELECT name FROM customers WHERE id='$customerID'");
                                    $cust_r = $cust_q->fetch_assoc();
                                ?>
                                    <h4 class="mb-4">Customer: <?php echo htmlspecialchars($cust_r['name']); ?></h4>
                                    <form method="POST">
                                        <input type="hidden" name="customer_id" value="<?php echo $customerID; ?>">
                                    <div class="table-responsive">
                                        <table class="table table-hover">
                                            <thead>
                                                <tr>
                                                    <th>S/N</th>
                                                    <th>Item</th>
                                                    <th>Store</th>
                                                    <th>Price</th>
                                                    <th>Disc.</th>
                                                    <th>Qty</th>
                                                    <th>Subtotal (Gross)</th>
                                                    <th>Total (Net)</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <?php
                                                $sql = mysqli_query($con, "SELECT dc.*, s.store_name FROM debt_cart dc LEFT JOIN stores s ON dc.store_id = s.id WHERE customerID='$customerID' AND staffID='$staffID' AND facilityID='$facilityID'");
                                                $cnt = 1;
                                                $total = 0;
                                                while ($row = mysqli_fetch_array($sql)) {
                                                    $row_net = ($row['price'] - $row['discount']) * $row['quantity'];
                                                    $total += $row_net;
                                                    $store_display = !empty($row['store_name']) ? $row['store_name'] : 'Unassigned';
                                                    ?>
                                                    <tr>
                                                        <td><?php echo $cnt++; ?>.</td>
                                                        <td><?php echo htmlspecialchars($row['item']); ?></td>
                                                        <td><?php echo htmlspecialchars($store_display); ?></td>
                                                        <td><?php echo number_format($row['price']); ?></td>
                                                        <td><?php echo number_format($row['discount']); ?></td>
                                                        <td><?php echo number_format($row['quantity']); ?></td>
                                                        <td><?php echo number_format($row['subtotal']); ?></td>
                                                        <td><?php echo number_format($row_net); ?></td>
                                                        <td>
                                                            <a href="credit?id=<?php echo $row['id'] ?>&del=delete&customerid=<?php echo $customerID; ?>" onClick="return confirm('Are you sure?')" class="btn btn-danger btn-xs">Remove</a>
                                                        </td>
                                                    </tr>
                                                <?php } ?>
                                            </tbody>
                                        </table>
                                    </div>
                                        <h2 class="mt-4">Total: ₦<?php echo number_format($total); ?></h2>
                                        
                                        <div class="form-group mt-4">
                                            <label>General Discount</label>
                                            <input type="number" class="form-control" name="discount" value="0" id="discount" oninput="calculatePayments()">
                                        </div>
                                        
                                        <h4>Payment Methods</h4>
                                        <div class="row">
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label>Cash</label>
                                                    <input type="number" class="form-control" name="cash_amount" id="cash_amount" value="0" oninput="calculatePayments()">
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label>POS</label>
                                                    <input type="number" class="form-control" name="pos_amount" id="pos_amount" value="0" oninput="calculatePayments()">
                                                </div>
                                            </div>
                                        </div>
                                        <div class="form-group">
                                            <label>Bank Transfer</label>
                                            <input type="number" class="form-control" name="transfer_amount" id="transfer_amount" value="0" oninput="calculatePayments()">
                                        </div>
                                        <div class="form-group">
                                            <label>Bank Name</label>
                                            <input type="text" class="form-control" name="bank_name" id="bank_name">
                                        </div>
                                        
                                        <div class="summary-box">
                                            <div class="form-group">
                                                <label>Subtotal</label>
                                                <input type="number" class="form-control" id="sub_total_val" value="<?php echo $total; ?>" readonly>
                                            </div>
                                            <div class="form-group">
                                                <label>Net Total</label>
                                                <input type="number" class="form-control" id="net_total_val" readonly>
                                            </div>
                                            <div class="form-group">
                                                <label>Balance (Debt)</label>
                                                <input type="number" class="form-control" id="balance_val" readonly>
                                            </div>
                                        </div>
                                        
                                        <div class="modal-footer">
                                            <button type="submit" class="btn btn-primary" name="checkout">Check Out (Credit)</button>
                                        </div>
                                    </form>
                                <?php } else { ?>
                                    <p class="text-muted">Please select a customer to view their cart.</p>
                                <?php } ?>
                            </div>
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
    <script>$(document).ready(function() { App.init(); });</script>
    <script src="../plugins/select2/select2.min.js"></script>
    <script src="../plugins/select2/custom-select2.js"></script>
    <script>
        function calculatePayments() {
            var subtotal = parseFloat(document.getElementById('sub_total_val').value) || 0;
            var discount = parseFloat(document.getElementById('discount').value) || 0;
            var cash = parseFloat(document.getElementById('cash_amount').value) || 0;
            var pos = parseFloat(document.getElementById('pos_amount').value) || 0;
            var transfer = parseFloat(document.getElementById('transfer_amount').value) || 0;
            
            var netTotal = subtotal - discount;
            document.getElementById('net_total_val').value = netTotal.toFixed(2);
            
            var totalPaid = cash + pos + transfer;
            var balance = netTotal - totalPaid;
            var balanceField = document.getElementById('balance_val');
            balanceField.value = balance.toFixed(2);
            
            if (balance > 0) {
                balanceField.className = 'form-control negative';
            } else {
                balanceField.className = 'form-control positive';
            }
        }
        document.addEventListener('DOMContentLoaded', calculatePayments);
    </script>
</body>
</html>





