<?php
include 'assets/mashaAllah/gyada.php';

// Check debt_cart
$check = mysqli_query($con, "SHOW COLUMNS FROM debt_cart LIKE 'discount'");
if(mysqli_num_rows($check) == 0) {
    mysqli_query($con, "ALTER TABLE debt_cart ADD COLUMN discount DECIMAL(15,2) DEFAULT 0 AFTER subtotal");
    echo "Added discount column to debt_cart\n";
} else {
    echo "discount column already exists in debt_cart\n";
}

// Ensure orders has item_discount
$check2 = mysqli_query($con, "SHOW COLUMNS FROM orders LIKE 'item_discount'");
if(mysqli_num_rows($check2) == 0) {
    mysqli_query($con, "ALTER TABLE orders ADD COLUMN item_discount DECIMAL(15,2) DEFAULT 0 AFTER subtotal");
    echo "Added item_discount column to orders\n";
} else {
    echo "item_discount column already exists in orders\n";
}
?>
