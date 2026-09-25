<?php
session_start();
include('assets/mashaAllah/gyada.php');
$_SESSION['email']=="";
session_unset();
session_destroy();
  echo "<script>alert('You have successfully logout');</script>";

?>
<script language="javascript">
document.location="index.php";
</script>
