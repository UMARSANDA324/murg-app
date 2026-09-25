<?php
session_start();
include('../assets/mashaAllah/gyada.php');
if(!empty($_POST["specilizationid"])) 
{
 $sql=mysqli_query($con,"select selling,id from stocks where id='".$_POST['specilizationid']."'");?>
 
 <?php
 while($row=mysqli_fetch_array($sql))
    
    {?>
  <option value="<?php echo htmlentities($row['selling']); ?>"><?php echo htmlentities($row['selling']); ?></option>
  <?php
}
}




?>

