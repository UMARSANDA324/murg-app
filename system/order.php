<?php
session_start();

error_reporting(0);
$did = intval($_GET['id']);
include('../assets/mashaAllah/gyada.php');

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
} else {
    if (isset($_POST['cart'])) {
        $price = floatval($_POST['available']);
        $selected_stock_id = mysqli_real_escape_string($con, $_POST['speciality']);
        $quantity = floatval($_POST['quantity']);
        $staffID = $_SESSION['id'];
        $facilityID = $_SESSION['facilityID'];
        $store_id = !empty($_POST['store_id']) ? intval($_POST['store_id']) : NULL;
        $item_discount = floatval($_POST['item_discount'] ?? 0);
        $error = '';

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

        if (empty($error)) {
            // 2. Get product name from the selected stock item
            $prod_query = mysqli_query($con, "SELECT name FROM stocks WHERE id='$selected_stock_id' AND facilityID='$facilityID'");
            $prod_row = mysqli_fetch_assoc($prod_query);
            $product_name = $prod_row ? $prod_row['name'] : '';

            // 3. Find the stock record for this product in the selected store (excluding locked stocks)
            $stock_query = mysqli_query($con, "SELECT id, quantity, name FROM stocks WHERE name='$product_name' AND store_id='$store_id' AND facilityID='$facilityID' AND (status = 'active' OR status IS NULL)");
            if (mysqli_num_rows($stock_query) > 1) {
                $error = "Ambiguity detected: Multiple stock records exist for product '" . addslashes($product_name) . "' in the selected Store and Branch. Please contact the administrator.";
            } elseif (mysqli_num_rows($stock_query) == 0) {
                $error = "This product is not available in the selected Store.";
            } else {
                $stock_row = mysqli_fetch_assoc($stock_query);
                $actual_stock_id = $stock_row['id'];
                $available_stock = floatval($stock_row['quantity']);
                $item = $stock_row['name'];

                // 4. Validate quantity against available stock in that store
                if ($quantity > $available_stock) {
                    $error = "Requested quantity exceeds available stock in this Store! Only $available_stock available.";
                } else {
                    $subtotal = $price * $quantity;

                    // Insert into cart with store_id and ACTUAL store-specific stock ID
                    $sql = mysqli_query($con, "INSERT INTO cart(facilityID, staffID, stockID, store_id, item, price, quantity, subtotal, discount, status) VALUES('$facilityID', '$staffID', '$actual_stock_id', '$store_id', '$item', '$price', '$quantity', '$subtotal', '$item_discount', '0')");

                    if ($sql) {
                        // Update stock in this specific store: decrement quantity and increment out_stocks counter
                        $remain = $available_stock - $quantity;
                        $qty = mysqli_query($con, "UPDATE stocks SET quantity='$remain', out_stocks = out_stocks + '$quantity' WHERE id='$actual_stock_id'");
                    } else {
                        ?>
                        <script>
                            alert('Something went wrong. Please try again.');
                        </script>
                        <?php
                    }
                }
            }
        }
    }

    if (isset($_GET['del'])) {
        $order_query = $con->query("SELECT * FROM cart WHERE id='".$_GET['id']."'");
        $o_row = $order_query->fetch_array();
        $quantity = $o_row['quantity'];
        $price = $o_row['price'];
        $name = $o_row['item'];
        $stockID = $o_row['stockID'];
        $facilityID = $_SESSION['facilityID'];
        $query = $con->query("SELECT *, (quantity+'$quantity') AS total FROM stocks WHERE id='$stockID'") or die($con->error);
        $row = $query->fetch_assoc();
        $remain = $row["total"];
        $qty = mysqli_query($con, "UPDATE stocks SET quantity=quantity + '$quantity', out_stocks = out_stocks - '$quantity' WHERE id='$stockID'");

        mysqli_query($con, "DELETE FROM cart WHERE id = '".$_GET['id']."'");
       
    }

    if (isset($_POST['checkout'])) {
        $staffID = $_SESSION['id'];
        $staff = $_SESSION['name'];
        $customer_name = $_POST['customer_name'];
        $discount = $_POST['discount']; // Global discount
        
        // Calculate total from cart: SUM((price - unit_discount) * quantity)
        $total_query = $con->query("SELECT SUM((CAST(price AS DECIMAL(15,2)) - CAST(discount AS DECIMAL(15,2))) * CAST(quantity AS DECIMAL(15,2))) as total FROM cart WHERE staffID='$staffID'");
        $total_row = $total_query->fetch_array();
        $total = $total_row['total'];
        $net_total = $total - $discount;
        
        // Get payment amounts
        $cash_amount = $_POST['cash_amount'] ?? 0;
        $pos_amount = $_POST['pos_amount'] ?? 0;
        $transfer_amount = $_POST['transfer_amount'] ?? 0;
        $bank_name = $_POST['bank_name'] ?? null;
        
        $total_paid = $cash_amount + $pos_amount + $transfer_amount;
        
        // Validate payments
        if ($total_paid < $net_total) {
            echo "<script>alert('Total payments (₦".number_format($total_paid).") is less than the net total (₦".number_format($net_total).")!');</script>";
            echo "<script>window.location.href ='order'</script>";
            exit();
        }
        
        // Calculate change (only for cash overpayment)
        $change_given = $_POST['change'];
        
        // Create unique order ID (Timestamp + Random)
        $orderID = time() . rand(10, 99);
        $_SESSION['orderID'] = $orderID;
        
        $sql = mysqli_query($con, "INSERT INTO orders(
            facilityID, stockID, staffID, item, price, quantity, subtotal, item_discount, staff, 
            payment, orderID, discount, status, 
            buyer_name, amount_paid, change_given, net_total, bank_name,
            cash, pos, transfer, creation
        ) SELECT 
            facilityID, stockID, staffID, item, price, quantity, subtotal, discount, '$staff',
            'Split Payment', '$orderID', '$discount', 1,
            '$customer_name', '$total_paid', '$change_given', (price - discount) * quantity, " . 
            ($bank_name ? "'$bank_name'" : "NULL") . ",
            '$cash_amount', '$pos_amount', '$transfer_amount', NOW()
        FROM cart WHERE staffID='$staffID'");
        
        if ($sql) {
            // Clear cart
            mysqli_query($con, "DELETE FROM cart WHERE staffID= '$staffID'");
            
            // Insert into sales queue (prevents duplicates via UNIQUE constraint on orderID)
            $queue_insert = mysqli_query($con, "INSERT IGNORE INTO sales_queue(orderID, facilityID, status) VALUES('$orderID', '$facilityID', 'pending')");
            
            ?>
            <script>window.open("invoice?id=<?php echo $staffID; ?>&orderid=<?php echo $orderID; ?>");</script>
            <?php
            echo "<script>window.location.href ='order'</script>";
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
    <title>MURG TEXTILE ENTERPRISES</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
    
    <!--  BEGIN CUSTOM STYLE FILE  -->
    <link href="../assets/css/users/user-profile.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/select2/select2.min.css">
    <style>
        .summary-box {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
        }
        .negative {
            color: red;
        }
        .positive {
            color: green;
        }
    </style>
    <!--  END CUSTOM STYLE FILE  -->
    <script>
        function getdoctor(val) {
            $("#available_qty").val('');
            $("#storeSelect").html('<option value="">Select Store</option>');
            if (!val) {
                return;
            }
            $.ajax({
                type: "POST",
                url: "get_price",
                data: 'specilizationid=' + val,
                success: function(data) {
                    $("#available").html(data);
                }
            });
            $.ajax({
                type: "POST",
                url: "get_stock_stores",
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
                url: "get_qty",
                data: 'specilizationid=' + stockId + '&store_id=' + val,
                success: function(data) {
                    $("#available_qty").val($.trim(data));
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
                    <!-- Content -->
                    <div class="col-xl-6 col-lg-6 col-md-5 col-sm-12 layout-top-spacing">
                        <div class="skills layout-spacing">
                            <div class="widget-content widget-content-area">
                                <h3 class="">New Order</h3>
                                <form method="POST">
                                    <div class="form-group">
                                        <label>Stock Name</label>
                                        <span style="color:red">*</span><br>
                                        <select class="form-control basic" required name="speciality" onChange="getdoctor(this.value);">
                                            <option value="">Select from list</option>
                                            <?php
                                            $ret = mysqli_query($con, "SELECT * FROM stocks WHERE quantity > 0 AND (status = 'active' OR status IS NULL) ORDER BY name ASC");
                                            while ($row = mysqli_fetch_array($ret)) {
                                            ?>
                                                <option value="<?php echo htmlentities($row['id']); ?>"><?php echo htmlentities($row['name']); ?></option>
                                            <?php } ?>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Stock Price</label>
                                        <span style="color:red">*</span><br>
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
                                        <label>Quantity</label>
                                        <span style="color:red">*</span><br>
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

                    <div class="col-xl-6 col-lg-6 col-md-5 col-sm-12 layout-top-spacing">
                        <div class="skills layout-spacing">
                            <div class="widget-content widget-content-area">
                                <h3 class="">Cart</h3>
                                <form method="POST">
                                    <div class="table-responsive">
                                        <table id="sample-table-1" class="table table-hover">
                                            <thead>
                                                <tr>
                                                    <th>S/N</th>
                                                    <th>Item</th>
                                                    <th>Store</th>
                                                    <th>Price</th>
                                                    <th>Quantity</th>
                                                    <th>Subtotal (Gross)</th>
                                                    <th>Unit Disc.</th>
                                                    <th>Total (Net)</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <?php
                                                $facilityID = $_SESSION['facilityID'];
                                                $staffID = $_SESSION['id'];
                                                $sql = mysqli_query($con, "SELECT c.*, s.store_name FROM cart c LEFT JOIN stores s ON c.store_id = s.id WHERE staffID='$staffID'");
                                                $cnt = 1;
                                                $total = 0;
                                                while ($row = mysqli_fetch_array($sql)) {
                                                    $item_total = ($row['price'] - $row['discount']) * $row['quantity'];
                                                    $total += $item_total;
                                                    $store_display = !empty($row['store_name']) ? $row['store_name'] : 'Unassigned';
                                                ?>
                                                    <tr>
                                                        <td class="center"><?php echo $cnt; ?>.</td>
                                                        <td class="hidden-xs"><?php echo $row['item']; ?></td>
                                                        <td><?php echo htmlspecialchars($store_display); ?></td>
                                                        <td><?php echo number_format($row['price']); ?></td>
                                                        <td><?php echo number_format($row['quantity']); ?></td>
                                                        <td><?php echo number_format($row['subtotal']); ?></td>
                                                        <td><?php echo number_format($row['discount']); ?></td>
                                                        <td><?php echo number_format($item_total); ?></td>
                                                        <td>
                                                            <div class="visible-md visible-lg hidden-sm hidden-xs">
                                                                <a href="order?id=<?php echo $row['id'] ?>&del=delete" onClick="return confirm('Are you sure you want to delete?')" class="btn btn-danger btn-xs tooltips" tooltip-placement="top" tooltip="Remove">Remove</a>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                <?php
                                                    $cnt++;
                                                }
                                                ?>
                                            </tbody>
                                        </table>
                                    </div>
                                    <br>
                                    <br>
                                <h2>Total Price: ₦<?php echo number_format($total); ?></h2>
                                <div class="form-group">
                                    <label>Customer Name</label>
                                    <span style="color:red">*</span><br>
                                    <input type="text" class="form-control" required name="customer_name">
                                </div>
                                
                                <div class="form-group">
                                    <label>General Discount</label>
                                    <span style="color:red">*</span><br>
                                    <input type="number" class="form-control" required name="discount" value="0" id="discount" oninput="calculatePayments()">
                                </div>
                                
                                <h4>Payment Methods</h4>
                                
                                <div class="row">
                                    <!-- Cash Payment -->
                                    <div class="col-md-6 payment-method">
                                        <div class="form-group">
                                            <label>Cash</label>
                                            <input type="number" class="form-control" name="cash_amount" id="cash_amount" value="0" oninput="calculatePayments()">
                                        </div>
                                    </div>
                                    
                                    <!-- POS Payment -->
                                    <div class="col-md-6 payment-method">
                                        <div class="form-group">
                                            <label>POS</label>
                                            <input type="number" class="form-control" name="pos_amount" id="pos_amount" value="0" oninput="calculatePayments()">
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Bank Transfer Payment -->
                                <div class="payment-method">
                                    <div class="form-group">
                                        <label>Bank Transfer</label>
                                        <input type="number" class="form-control" name="transfer_amount" id="transfer_amount" value="0" oninput="calculatePayments()">
                                    </div>
                                    <div class="form-group">
                                        <label>Bank Name</label>
                                        <input type="text" class="form-control" name="bank_name" id="bank_name">
                                    </div>
                                </div>
                                
                                <!-- Payment Summary -->
                                <div class="summary-box">
                                    <div class="form-group">
                                        <label>Subtotal</label>
                                        <input type="number" class="form-control" id="subtotal" value="<?php echo $total; ?>" readonly>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Net Total (After Discount)</label>
                                        <input type="number" class="form-control" id="net_total" readonly>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Total Paid</label>
                                        <input type="number" class="form-control" id="total_paid" readonly>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Balance</label>
                                        <input type="number" class="form-control" id="balance" readonly>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Change Due</label>
                                        <input type="number" class="form-control" name="change" id="change_due" readonly>
                                    </div>
                                </div>
                                
                                <div class="modal-footer">
                                    <button type="submit" class="btn btn-primary" name="checkout">Check Out</button>
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
    <!-- END PAGE LEVEL CUSTOM SCRIPTS -->

    <script src="../plugins/highlight/highlight.pack.js"></script>
    <!-- END GLOBAL MANDATORY SCRIPTS -->

    <!--  BEGIN CUSTOM SCRIPTS FILE  -->
    <script src="../plugins/select2/select2.min.js"></script>
    <script src="../plugins/select2/custom-select2.js"></script>
    <script>
function calculateChange() {
    var total = <?php echo $total ?: 0; ?>;
    var discount = parseFloat(document.getElementById('discount').value) || 0;
    var amountPaid = parseFloat(document.getElementById('amount_paid').value) || 0;
    
    var paymentMethod = document.getElementById('payment_method').value;
    
    // Calculate net total after discount
    var netTotal = total - discount;
    
    // Only calculate change for cash payments
   
        var change = amountPaid - netTotal;
        document.getElementById('change').value = change > 0 ? change.toFixed(2) : 0;
    
}

function checkPaymentMethod() {
    var paymentMethod = document.getElementById('payment_method').value;
    if (paymentMethod !== 'Cash') {
        document.getElementById('change').value = 0;
    }
    
    if (paymentMethod == 'Bank Transfer') {
        document.getElementById('bankName').style.display = 'block';
    }
    calculateChange();
}

function calculatePayments() {
        // Get values from form
        var subtotal = parseFloat(document.getElementById('subtotal').value) || 0;
        var discount = parseFloat(document.getElementById('discount').value) || 0;
        var cash = parseFloat(document.getElementById('cash_amount').value) || 0;
        var pos = parseFloat(document.getElementById('pos_amount').value) || 0;
        var transfer = parseFloat(document.getElementById('transfer_amount').value) || 0;
        
        // Calculate net total
        var netTotal = subtotal - discount;
        document.getElementById('net_total').value = netTotal.toFixed(2);
        
        // Calculate total paid
        var totalPaid = cash + pos + transfer;
        document.getElementById('total_paid').value = totalPaid.toFixed(2);
        
        // Calculate balance
        var balance = netTotal - totalPaid;
        var balanceField = document.getElementById('balance');
        balanceField.value = Math.abs(balance).toFixed(2);
        
        if (balance > 0) {
            balanceField.className = 'form-control negative';
        } else {
            balanceField.className = 'form-control positive';
        }
        
        // Calculate change due (only if cash covers the remaining balance)
        var remainingAfterOtherPayments = netTotal - pos - transfer;
        var changeDue = (cash > remainingAfterOtherPayments) ? (cash - remainingAfterOtherPayments) : 0;
        document.getElementById('change_due').value = changeDue.toFixed(2);
    }
    
    // Initialize calculations on page load
    document.addEventListener('DOMContentLoaded', function() {
        calculatePayments();
    });
</script>
</body>
</html>





