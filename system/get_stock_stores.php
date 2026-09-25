<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
include('../assets/mashaAllah/gyada.php');

if(!empty($_POST["stock_id"])) {
    $stock_id = mysqli_real_escape_string($con, $_POST['stock_id']);
    $facilityID = $_SESSION['facilityID'];

    // Get stock info to find the product name
    $stock_query = mysqli_query($con, "SELECT name FROM stocks WHERE id='$stock_id' AND facilityID='$facilityID'");
    $stock_row = mysqli_fetch_assoc($stock_query);
    $product_name = $stock_row['name'];

    // Get all stores for this product in this branch with quantity > 0
    $sql = mysqli_query($con, "
        SELECT s.id as store_id, s.store_name, st.quantity
        FROM stores s
        INNER JOIN stocks st ON st.store_id = s.id
        WHERE st.name = '$product_name'
        AND st.facilityID = '$facilityID'
        AND s.status = 'active'
        AND (st.status = 'active' OR st.status IS NULL)
        AND st.quantity > 0
        ORDER BY s.store_name ASC
    ");

    $has_stores = false;
    $options = '<option value="">Select Store</option>';
    while($row = mysqli_fetch_array($sql)) {
        $has_stores = true;
        $options .= '<option value="' . $row['store_id'] . '">' . htmlspecialchars($row['store_name']) . ' (Qty: ' . $row['quantity'] . ')</option>';
    }

    if (!$has_stores) {
        echo '<option value="">No Store Available</option>';
    } else {
        echo $options;
    }
}
?>
