<?php
session_start();

error_reporting(0);
$did=intval($_GET['id']);
include('../assets/mashaAllah/gyada.php');
if(strlen($_SESSION['email'])==0)
  {
header('location:../index.php');
}
else{

if (isset($_POST['update'])) {
  $old = $_POST['old'];
 
  $confirm = md5($_POST['confirm']);

 
$pass = md5($old);
    $query = $con->query("SELECT * FROM facility where id='".$_SESSION['id']."' And password='$pass'")or die($con->error);

    if($query->num_rows > 0){
               $row = $query->fetch_assoc();

               $sql=mysqli_query($con,"Update facility set password='$confirm' where id='".$_SESSION['id']."'");
               if($sql){
                    $msg="Something went wrong. Please try again";

               }else{

                $error="Something went wrong. Please try again";
               }

             }else{

              echo "<script>alert('Old Password is worng!!!');</script>";
             }


}

}
 ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>MURG TEXTILE ENTERPRISES</title>
    <link rel="icon" type="image/png" href="../assets/img/Icon.jpeg"/>
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
    
    <!--  BEGIN CUSTOM STYLE FILE  -->
    <link href="../assets/css/users/user-profile.css" rel="stylesheet" type="text/css" />
     <link rel="stylesheet" type="text/css" href="../plugins/select2/select2.min.css">
    <!--  END CUSTOM STYLE FILE  -->
    <script type="text/javascript">
function valid()
{
 if(document.change.password.value!= document.change.confirm.value)
{
alert("Password and Confirm Password Field do not match  !!");
document.change.confirm.focus();
return false;
}
return true;
}
</script>
</head>
<body class="sidebar-noneoverflow">
    <!-- BEGIN LOADER -->
    <div id="load_screen"> <div class="loader"> <div class="loader-content">
        <div class="spinner-grow align-self-center"></div>
    </div>
    <!--  END LOADER -->
 <?php include('header.php'); ?>
    <!--  BEGIN NAVBAR  -->
   
    <!--  END NAVBAR  -->

    <!--  BEGIN MAIN CONTAINER  -->
    <div class="main-container" id="container">

        <div class="overlay"></div>
        <div class="search-overlay"></div>

        <!--  BEGIN SIDEBAR  -->
       
        <?php include('sidebar.php'); ?>

        <!--  END SIDEBAR  -->
        
        <!--  BEGIN CONTENT AREA  -->
       <div id="content" class="main-content">
            <div class="layout-px-spacing">

               

                    <div class="col-xl-5 col-lg-6 col-md-7 col-sm-12 layout-top-spacing">

                        <div class="skills layout-spacing ">
                            <div class="widget-content widget-content-area">
                                <h3 class="">Change Password</h3>
                                 <?php if($error){?><strong style="color:red; font-size:18px; margin-top: 15px;">Something Went Wrong Try again later</strong> <?php } 
        else if($msg){?><strong style="color:green; font-size:18px;  margin-top: 15px;"> Password Changed Successfully</strong><?php }?>

                                <form method="POST" id="change" name="change"  onSubmit="return valid();">
                  <div class="form-group">
                        <label>Old Password</label>
                        <span style="color:red">*</span><br>
                        <input type="text" class="form-control" required name="old">
                      </div>
                       <div class="form-group">
                        <label>New Password</label>
                        <span style="color:red">*</span><br>
                        <input type="text" class="form-control" required name="password">
                      </div>
                       <div class="form-group">
                        <label>Confirm Password</label>
                        <span style="color:red">*</span><br>
                        <input type="text" class="form-control" required name="confirm">
                      </div>
                      <div class="modal-footer">
                  <button type="submit" class="btn btn-primary" name="update" id="update">Change</button>
                </div>
               </div>
 
               </form>

                          

                </div>
                </div>
         <?php include('footer.php'); ?>
        <!--  END CONTENT AREA  -->

    </div>

     <!-- BEGIN GLOBAL MANDATORY SCRIPTS -->
    <script src="`../assets/js/libs/jquery-3.1.1.min.js"></script>
    <script src="../bootstrap/js/popper.min.js"></script>
    <script src="../bootstrap/js/bootstrap.min.js"></script>
    <script src="../plugins/perfect-scrollbar/perfect-scrollbar.min.js"></script>
    <script src="../assets/js/app.js"></script>
    
    <script>
        $(document).ready(function() {
            App.init();
        });
    </script>
    <script src="../assets/js/custom.js"></script>
    <!-- END PAGE LEVEL CUSTOM SCRIPTS -->


    <script src="../plugins/highlight/highlight.pack.js"></script>
    
    <!-- END GLOBAL MANDATORY SCRIPTS -->

    <!--  BEGIN CUSTOM SCRIPTS FILE  -->
    
    <script src="../plugins/select2/select2.min.js"></script>
    <script src="../plugins/select2/custom-select2.js"></script>
</body>
</html>


