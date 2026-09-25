<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
include('../assets/mashaAllah/gyada.php');

$branch_id = isset($_GET['branch_id']) ? mysqli_real_escape_string($con, $_GET['branch_id']) : '';

if (!empty($branch_id)) {
    $sql = mysqli_query($con, "SELECT id, store_name FROM stores WHERE branch_id = '$branch_id' AND status = 'active' ORDER BY store_name ASC");
    echo '<option value="">Select Store (Optional)</option>';
    while ($row = mysqli_fetch_array($sql)) {
        echo '<option value="' . $row['id'] . '">' . htmlspecialchars($row['store_name']) . '</option>';
    }
} else {
    echo '<option value="">Select Store (Optional)</option>';
}
?>
