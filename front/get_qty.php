<?php
session_start();
include('../assets/mashaAllah/gyada.php');
if(!empty($_POST['specilizationid'])) 
{
 $sql=mysqli_query($con,"select quantity from stocks where id='".$_POST['specilizationid']."'");
 if($row=mysqli_fetch_array($sql))
 {
  echo htmlentities($row['quantity']);
 }
}
?>
