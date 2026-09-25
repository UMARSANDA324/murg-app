<?php
session_start();

error_reporting(0);
$did = intval($_GET['id']);
include('../assets/mashaAllah/gyada.php');

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
} else {
    if (isset($_POST['submit'])) {
        $s_subtotal = $_POST['sell'] * $_POST['quantity'];
        $b_subtotal = $_POST['bought'] * $_POST['quantity'];
        $name = $_POST['name'];
        $sell = $_POST['sell'];
        $bought = $_POST['bought'];
        $quantity = $_POST['quantity'];
        $expiry = $_POST['expiry'];
        $facilityID = $_SESSION['facilityID'];

        $sql = mysqli_query($con, "UPDATE stocks SET 
            Ssubtotal = '$s_subtotal', 
            Bsubtotal = '$b_subtotal', 
            name = '$name', 
            selling = '$sell', 
            buying = '$bought', 
            quantity = '$quantity', 
            expiry = '$expiry' 
            WHERE id = '$did' AND facilityID = '$facilityID'");

        if ($sql) {
            echo "<script>window.location.href ='stocks'</script>";
        } else {
            $error = "Something went wrong. Please try again";
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
    <title>SIMDA - Update Stock</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
    
    <!-- BEGIN PAGE LEVEL CUSTOM STYLES -->
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <!-- END PAGE LEVEL CUSTOM STYLES -->
</head>
<body class="sidebar-noneoverflow">
    <!-- BEGIN LOADER -->
    <div id="load_screen"> <div class="loader"> <div class="loader-content">
        <div class="spinner-grow align-self-center"></div>
    </div></div></div>
    <!--  END LOADER -->
    <?php include('header.php'); ?>
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
                <div class="row layout-spacing">
                    <!-- Content -->
                    <div class="col-xl-6 col-lg-6 col-md-5 col-sm-12 layout-top-spacing">
                        <div class="skills layout-spacing">
                            <div class="p-3 widget-content widget-content-area">
                                <h3 class="">Update Stock Info</h3>
                                <form method="POST">
                                    <?php
                                    $sql = mysqli_query($con, "SELECT * FROM stocks WHERE id = '$did' AND facilityID = '{$_SESSION['facilityID']}'");
                                    while ($data = mysqli_fetch_array($sql)) {
                                    ?>
                                    <div class="form-group">
                                        <label>Stock Name</label>
                                        <span style="color:red">*</span><br>
                                        <input type="text" class="form-control" required name="name" value="<?php echo htmlentities($data['name']); ?>">
                                    </div>
                                    <div class="form-group">
                                        <label>Selling Price</label>
                                        <span style="color:red">*</span><br>
                                        <input type="number" class="form-control" required name="sell" value="<?php echo htmlentities($data['selling']); ?>">
                                    </div>
                                    <div class="form-group">
                                        <label>Cost Price</label>
                                        <span style="color:red">*</span><br>
                                        <input type="number" class="form-control" required name="bought" value="<?php echo htmlentities($data['buying']); ?>">
                                    </div>
                                    <div class="form-group">
                                        <label>Stock Quantity</label>
                                        <span style="color:red">*</span><br>
                                        <input type="number" class="form-control" required name="quantity" value="<?php echo htmlentities($data['quantity']); ?>">
                                    </div>
                                    <div class="form-group">
                                        <label>Expiring Date</label>
                                        <span style="color:red">*</span><br>
                                        <input type="date" class="form-control" required name="expiry" value="<?php echo htmlentities($data['expiry']); ?>">
                                    </div>
                                    <div class="modal-footer">
                                        <button type="submit" class="btn btn-primary" name="submit">Save</button>
                                    </div>
                                    <?php } ?>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <?php include('footer.php'); ?>
        </div>
        <!--  END CONTENT AREA  -->
    </div>
    <!-- END MAIN CONTAINER -->

    <!-- BEGIN GLOBAL MANDATORY SCRIPTS -->
    <script src="../assets/js/libs/jquery-3.1.1.min.js"></script>
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
    <!-- END GLOBAL MANDATORY SCRIPTS -->
</body>
</html>


