<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
error_reporting(0);
include('../assets/mashaAllah/gyada.php');
if(!empty($_POST['specilizationid'])) 
{
    $stock_id = mysqli_real_escape_string($con, $_POST['specilizationid']);
    $store_id = !empty($_POST['store_id']) ? mysqli_real_escape_string($con, $_POST['store_id']) : NULL;
    $facilityID = $_SESSION['facilityID'];

    if ($store_id) {
        // 1. Fetch product name of the selected stock ID
        $stock_name_query = mysqli_query($con, "SELECT name FROM stocks WHERE id='$stock_id' AND facilityID='$facilityID'");
        $stock_name_row = mysqli_fetch_assoc($stock_name_query);
        $product_name = $stock_name_row['name'] ?? '';

        if (!empty($product_name)) {
            // 2. Fetch all stocks for this product name, store, and branch
            $sql = mysqli_query($con, "SELECT id, quantity FROM stocks WHERE name='$product_name' AND store_id='$store_id' AND facilityID='$facilityID'");
            
            if (mysqli_num_rows($sql) > 1) {
                echo "Ambiguous";
            } elseif ($row = mysqli_fetch_array($sql)) {
                echo htmlentities($row['quantity']);
            } else {
                echo "0";
            }
        } else {
            echo "0";
        }
    } else {
        echo "0";
    }
}
?>
