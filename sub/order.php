<?php
session_start();

error_reporting(0);
$did = intval($_GET['id']);
include('../assets/mashaAllah/gyada.php');

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
} else {
    if (isset($_POST['cart'])) {
        $price = $_POST['available'];
        $stockId = $_POST['speciality'];
        $quantity = $_POST['quantity'];
        $staffID = $_SESSION['id'];
        $facilityID = $_SESSION['facilityID'];

        // Check available stock
        $stock_query = mysqli_query($con, "SELECT quantity, name FROM stocks WHERE id='$stockId'");
        $stock_row = mysqli_fetch_assoc($stock_query);
        $available_stock = $stock_row['quantity'];
        $item = $stock_row['name'];

        // Check if requested quantity is greater than available stock
        if ($quantity > $available_stock) {
            ?>
            <script>
                alert('Requested quantity exceeds available stock! Only <?php echo $available_stock; ?> available.');
            </script>
            <?php
        } else {
            $item_discount = floatval($_POST['item_discount'] ?? 0);
            $subtotal = $price * $quantity;

            // Insert into cart
            $sql = mysqli_query($con, "INSERT INTO cart(facilityID, staffID, stockID, item, price, quantity, subtotal, discount, status) VALUES('$facilityID', '$staffID', '$stockId','$item', '$price', '$quantity', '$subtotal', '$item_discount', '0')");

            if ($sql) {
                // Update stock: decrement quantity and increment out_stocks
                $remain = $available_stock - $quantity;
                $qty = mysqli_query($con, "UPDATE stocks SET quantity='$remain', out_stocks = out_stocks + '$quantity' WHERE id='$stockId'");

                // Redirect or show success message
                ?>
                <!-- <script>window.location.href = "order?id=<?php echo $staffID; ?>";</script> -->
                <?php
            } else {
                $error = "Something went wrong. Please try again";
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
            echo "<script>window.location.href ='order.php'</script>";
            exit();
        }
        
        // Calculate change (only for cash overpayment)
        $change_given = $_POST['change'];
        
        // Create order
        $orderID = rand(00000, 99999);
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
            $.ajax({
                type: "POST",
                url: "get_price",
                data: 'specilizationid=' + val,
                success: function(data) {
                    $("#available").html(data);
                    // Trigger Select2 update if initialized
                    if ($("#available").hasClass("select2-hidden-accessible")) {
                        $("#available").trigger('change');
                    }
                }
            });
        }
    </script>
    <script>
        // This function seems to be a remnant or incorrectly named/purposed.
        // The form does not have an element with id="doctor" that needs to be populated by 'available' stock.
        // The server-side code already handles stock availability checks on form submission.
        // If this was intended to show available stock dynamically, it would need to target a different element
        // and potentially fetch stock quantity based on the selected stock item (speciality), not price.
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
                                            $facilityID = $_SESSION['facilityID'];
                                            $date = date("Y-m-d");
                                            $ret = mysqli_query($con, "SELECT * FROM stocks WHERE quantity > 0 ORDER BY name ASC");
                                            while ($row = mysqli_fetch_array($ret)) {
                                            ?>
                                                <option value="<?php echo htmlentities($row['id']); ?>"><?php echo htmlentities($row['name']); ?></option>
                                            <?php } ?>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Stock Price</label>
                                        <span style="color:red">*</span><br>
                                        <select class="form-control basic" style="width: 100%;" required name="available" id="available">
                                            <option value="">Select Price</option>
                                        </select>
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
                                    <table id="sample-table-1" class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>S/N</th>
                                                <th>Item</th>
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
                                            $sql = mysqli_query($con, "SELECT * FROM cart WHERE staffID='$staffID'");
                                            $cnt = 1;
                                            while ($row = mysqli_fetch_array($sql)) {
                                            ?>
                                                <tr>
                                                    <td class="center"><?php echo $cnt; ?>.</td>
                                                    <td class="hidden-xs"><?php echo $row['item']; ?></td>
                                                    <td><?php echo number_format($row['price']); ?></td>
                                                    <td><?php echo number_format($row['quantity']); ?></td>
                                                    <td><?php echo number_format($row['subtotal']); ?></td>
                                                    <td><?php echo number_format($row['discount']); ?></td>
                                                    <td><?php echo number_format(($row['price'] - $row['discount']) * $row['quantity']); ?></td>
                                                    <td>
                                                        <div class="visible-md visible-lg hidden-sm hidden-xs">
                                                            <a href="order.php?id=<?php echo $row['id'] ?>&del=delete" onClick="return confirm('Are you sure you want to delete?')" class="btn btn-danger btn-xs tooltips" tooltip-placement="top" tooltip="Remove">Remove</a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            <?php
                                                $cnt++;
                                            }
                                            ?>
                                        </tbody>
                                    </table>
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





