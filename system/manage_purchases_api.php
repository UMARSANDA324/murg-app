<?php
session_start();
include('../assets/mashaAllah/gyada.php');

if (strlen($_SESSION['email']) == 0) {
    die(json_encode(['status' => 'error', 'message' => 'Unauthorized']));
}

$facilityID = $_SESSION['facilityID'];
$action = $_REQUEST['action'] ?? '';

if ($action == 'list') {
    $stock_id = mysqli_real_escape_string($con, $_GET['stock_id']);
    
    // Check if stock exists and belongs to this facility
    $stock_check = mysqli_query($con, "SELECT name FROM stocks WHERE id = '$stock_id' AND facilityID = '$facilityID'");
    if (mysqli_num_rows($stock_check) == 0) {
        die("<p class='text-center text-danger'>Stock not found or access denied.</p>");
    }
    $stock_row = mysqli_fetch_assoc($stock_check);
    $stock_name = $stock_row['name'];

    $sql = mysqli_query($con, "SELECT * FROM purchase_history WHERE stock_id = '$stock_id' AND facilityID = '$facilityID' ORDER BY purchase_date DESC, id DESC");
    
    if (mysqli_num_rows($sql) == 0) {
        echo "<p class='text-center'>No purchase history found for this item.</p>";
    } else {
        echo '<div class="table-responsive">
                <table class="table table-bordered table-striped">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Supplier</th>
                            <th>Initial Qty</th>
                            <th>Added Qty</th>
                            <th>Cost</th>
                            <th>Total</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>';
        while ($row = mysqli_fetch_assoc($sql)) {
            echo "<tr>
                    <td>".date('d/m/Y', strtotime($row['purchase_date']))."</td>
                    <td>".htmlentities($row['purchase_from'])."</td>
                    <td>".number_format($row['initial_quantity'])."</td>
                    <td>".number_format($row['quantity'])."</td>
                    <td>₦".number_format($row['cost_price'])."</td>
                    <td>₦".number_format($row['total_cost'])."</td>
                    <td>
                        <button class='btn btn-sm btn-primary edit-p-btn' 
                            data-id='{$row['id']}' 
                            data-stock-id='{$row['stock_id']}' 
                            data-qty='{$row['quantity']}' 
                            data-cost='{$row['cost_price']}'>Edit</button>
                        <button class='btn btn-sm btn-danger remove-p-btn' 
                            data-id='{$row['id']}' 
                            data-stock-id='{$row['stock_id']}'>Delete</button>
                    </td>
                  </tr>";
        }
        echo '</tbody></table></div>';
    }
}

if ($action == 'delete') {
    $id = mysqli_real_escape_string($con, $_POST['id']);
    $stock_id = mysqli_real_escape_string($con, $_POST['stock_id']);

    // Get purchase info before deleting
    $p_sql = mysqli_query($con, "SELECT quantity, DATE(purchase_date) as p_date FROM purchase_history WHERE id = '$id' AND stock_id = '$stock_id' AND facilityID = '$facilityID'");
    if ($row = mysqli_fetch_assoc($p_sql)) {
        $p_qty = $row['quantity'];
        $p_date = $row['p_date'];
        $is_today = ($p_date == date('Y-m-d'));

        // Update stock: decrement current quantity
        $update_sql = "UPDATE stocks SET quantity = quantity - '$p_qty'";
        if ($is_today) {
            $update_sql .= ", new_order = new_order - '$p_qty'";
        }
        $update_sql .= " WHERE id = '$stock_id' AND facilityID = '$facilityID'";
        
        mysqli_query($con, $update_sql);
        mysqli_query($con, "DELETE FROM purchase_history WHERE id = '$id'");

        echo json_encode(['status' => 'success', 'message' => 'Purchase removed and stock adjusted successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Purchase record not found.']);
    }
}

if ($action == 'update') {
    $id = mysqli_real_escape_string($con, $_POST['purchase_id']);
    $stock_id = mysqli_real_escape_string($con, $_POST['stock_id']);
    $new_qty = floatval($_POST['quantity']);
    $new_cost = floatval($_POST['cost']);
    $new_total = $new_qty * $new_cost;

    // Get old purchase info
    $p_sql = mysqli_query($con, "SELECT quantity, DATE(purchase_date) as p_date FROM purchase_history WHERE id = '$id' AND stock_id = '$stock_id' AND facilityID = '$facilityID'");
    if ($row = mysqli_fetch_assoc($p_sql)) {
        $old_qty = $row['quantity'];
        $p_date = $row['p_date'];
        $diff = $new_qty - $old_qty;
        $is_today = ($p_date == date('Y-m-d'));

        // Update purchase history
        mysqli_query($con, "UPDATE purchase_history SET quantity = '$new_qty', cost_price = '$new_cost', total_cost = '$new_total' WHERE id = '$id'");

        // Update stock: adjust by the difference
        $update_sql = "UPDATE stocks SET quantity = quantity + '$diff'";
        if ($is_today) {
            $update_sql .= ", new_order = new_order + '$diff'";
        }
        $update_sql .= " WHERE id = '$stock_id' AND facilityID = '$facilityID'";
        
        mysqli_query($con, $update_sql);

        echo json_encode(['status' => 'success', 'message' => 'Purchase updated and stock adjusted successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Purchase record not found.']);
    }
}
?>
