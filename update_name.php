<?php
include('assets/mashaAllah/gyada.php');

// List of updates for the branch identity and staff records
$updates = [
    "UPDATE branch SET name = 'MURG' WHERE name = 'Alh Yasir'",
    "UPDATE facility SET facilityID = 'MURG/001' WHERE facilityID = 'MURG/001'",
    "UPDATE facility SET fname = 'MURG' WHERE fname LIKE '%Alh Yasir%'",
    "UPDATE branch SET facilityID = 'MURG/001' WHERE facilityID = 'MURG/001'"
];

foreach ($updates as $sql) {
    if (mysqli_query($con, $sql)) {
        echo "Updated: $sql\n";
    } else {
        echo "Failed update: $sql Error: " . mysqli_error($con) . "\n";
    }
}
?>

