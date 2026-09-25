<?php
session_start();

error_reporting(0);
include('assets/mashaAllah/gyada.php');
$did=$_GET['id'];

if (isset($_POST['submit'])) {
 
 $_SESSION["facilityID"]= $_POST['facilityID'];

echo "<script>window.location.href ='system'</script>";
}


?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>MURG - Branch Selection</title>
       <link href="assets/img/murglogo.jpg" rel="shortcut icon">
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link href="assets/css/authentication/form-2.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
    <link rel="stylesheet" type="text/css" href="assets/css/forms/theme-checkbox-radio.css">
    <link rel="stylesheet" type="text/css" href="assets/css/forms/switches.css">
</head>
<body class="form">
    

    <div class="form-container outer">
        <div class="form-form">
            <div class="form-form-wrap">
                <div class="form-container">
                    <div class="form-content">

                       <h1 class="">Business Branches</h1>
                        <p class="">Select Business Branch and Continue</p>
                        
                        <form class="text-left" Method="POST">
                            <div class="form">

                                <div class="form-group">
                      <label>Select Branch</label>
                      <span style="color:red">*</span><br>
                       <select class="form-control select2" style="width: 100%;" name="facilityID" required>
                                            <option value="">Select from list</option>
                         <?php
                       
                        $ret=mysqli_query($con,"select * from branch where email='$did'");
while($row=mysqli_fetch_array($ret))
{
?>
                                <option value="<?php echo htmlentities($row['facilityID']);?>">
                                  <?php echo htmlentities($row['name']." -- ".$row['address']);?>
                                </option>
                                <?php } ?>
                      </select>
                    </div>

                                
                                <div class="d-sm-flex justify-content-between">
                                    <div class="field-wrapper">
                                        <button type="submit" class="btn btn-primary" value="" name="submit">Log In</button>
                                    </div>
                                </div>

                               

                            </div>
                        </form>

                    </div>                    
                </div>
            </div>
        </div>
    </div>

    
    <!-- BEGIN GLOBAL MANDATORY SCRIPTS -->
    <script src="assets/js/libs/jquery-3.1.1.min.js"></script>
    <script src="bootstrap/js/popper.min.js"></script>
    <script src="bootstrap/js/bootstrap.min.js"></script>
    
    <!-- END GLOBAL MANDATORY SCRIPTS -->
    <script src="assets/js/authentication/form-2.js"></script>

</body>
</html>




