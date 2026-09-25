<?php
include('assets/mashaAllah/gyada.php');
$res = $con->query('SHOW TABLES');
while($row = $res->fetch_row()) {
    echo $row[0] . "\n";
}
?>
