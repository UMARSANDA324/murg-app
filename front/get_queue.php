<?php
session_start();
include('../assets/mashaAllah/gyada.php');

$facilityID = $_SESSION['facilityID'];

// Get filter parameters
$filter = $_GET['filter'] ?? 'today';
$status_filter = $_GET['status'] ?? 'pending';
$from_date = $_GET['from_date'] ?? null;
$to_date = $_GET['to_date'] ?? null;

// Build date condition based on filter
$date_condition = '';
switch ($filter) {
    case 'today':
        $date_condition = "AND DATE(sq.creation) = CURDATE()";
        break;
    case 'yesterday':
        $date_condition = "AND DATE(sq.creation) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        break;
    case 'week':
        $date_condition = "AND YEARWEEK(sq.creation, 1) = YEARWEEK(CURDATE(), 1)";
        break;
    case 'month':
        $date_condition = "AND MONTH(sq.creation) = MONTH(CURDATE()) AND YEAR(sq.creation) = YEAR(CURDATE())";
        break;
    case 'custom':
        if ($from_date && $to_date) {
            $date_condition = "AND DATE(sq.creation) BETWEEN '$from_date' AND '$to_date'";
        } else {
            $date_condition = "AND DATE(sq.creation) = CURDATE()"; // Default to today if custom dates not provided
        }
        break;
    default:
        $date_condition = "AND DATE(sq.creation) = CURDATE()";
}

// Build status condition
$status_condition = '';
if ($status_filter === 'pending') {
    $status_condition = "AND sq.status = 'pending'";
} elseif ($status_filter === 'viewed') {
    $status_condition = "AND sq.status = 'viewed'";
}

// Get pending queue count for badge (always count pending, today only)
$pending_count_query = mysqli_query($con, "SELECT COUNT(*) as count FROM sales_queue WHERE facilityID = '$facilityID' AND status = 'pending' AND DATE(creation) = CURDATE()");
$pending_count = mysqli_fetch_assoc($pending_count_query)['count'];

// Get queue data for panel with filters
$queue_query = mysqli_query($con, "
    SELECT 
        sq.orderID, 
        sq.status, 
        sq.creation as queue_time,
        o.buyer_name,
        o.customer_name,
        o.net_total
    FROM sales_queue sq
    INNER JOIN orders o ON sq.orderID = o.orderID
    WHERE sq.facilityID = '$facilityID' 
    $date_condition
    $status_condition
    ORDER BY sq.creation DESC
");

$queue_data = [];
while ($row = mysqli_fetch_assoc($queue_query)) {
    $queue_data[] = [
        'orderID' => $row['orderID'],
        'buyer_name' => $row['buyer_name'],
        'customer_name' => $row['customer_name'],
        'net_total' => $row['net_total'],
        'queue_time' => date('H:i', strtotime($row['queue_time'])),
        'status' => $row['status']
    ];
}

echo json_encode([
    'pending_count' => $pending_count,
    'queue_data' => $queue_data
]);
?>
