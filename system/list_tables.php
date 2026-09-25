<?php
include('c:/xampp/htdocs/dansarki/assets/mashaAllah/gyada.php');
$res = mysqli_query($con, 'SHOW TABLES');
while($row = mysqli_fetch_array($res)) { echo $row[0] . "\n"; }
?>
