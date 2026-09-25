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

if (isset($_POST['cart'])) {
  $price = $_POST['available'];
  $stockId = $_POST['speciality'];
  $customer = $_POST['customer'];
  $quantity = $_POST['quantity'];
  $subtotal = $price * $quantity;
  $staffID = $_SESSION['id'];
  $facilityID = $_SESSION['facilityID'];
  $order_query = $con->query("SELECT * FROM customers where id='$customer'");
  $z_row = $order_query->fetch_array();
  $name = $z_row['name'];

  // Check available stock
  $stock_query = mysqli_query($con, "SELECT quantity, name FROM stocks WHERE id='$stockId' AND facilityID='$facilityID'");
  $stock_row = mysqli_fetch_assoc($stock_query);
  $available_stock = $stock_row['quantity'];
  $item = $stock_row['name'];

  // Check if requested quantity is greater than available stock
  if ($quantity > $available_stock) {
      ?>
      <script>
          alert('Requested quantity exceeds available stock! Only <?php echo $available_stock; ?> available.');
      </script>
      <?php
  } else {
    $item_discount = floatval($_POST['item_discount'] ?? 0);
    $sql=mysqli_query($con,"insert into debt_cart(facilityID,customerID,staffID,stockID,name,item,price,quantity,subtotal,discount,status) values('$facilityID','$customer','$staffID','$stockId','$name','$item','$price','$quantity','$subtotal', '$item_discount','0')");
    if($sql)
    {
        $facilityID = $_SESSION['facilityID'];
        $query = $con->query("SELECT quantity, (quantity-'$quantity') AS total, (Ssubtotal -'$price') as 'selling' From stocks where id='$stockId' and facilityID='$facilityID'")or die($con->error);
        $row = $query->fetch_assoc();
          $remain = $row["total"];
          $sell = $row["selling"];
          // Update stocks: decrement quantity and increment out_stocks
          $qty=mysqli_query($con,"Update stocks set quantity='$remain',Ssubtotal='$sell', out_stocks = out_stocks + '$quantity' where id='$stockId' and facilityID='$facilityID'");
        

      $staffID = $_SESSION['id'];
    ?>

      <script>window.location.href="cart?customerid=<?php echo $customer;?> "</script>;
      <?php
    }
    else
    {
    $error="Something went wrong. Please try again";
    }
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
  <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
    
    <!--  BEGIN CUSTOM STYLE FILE  -->
    <link href="../assets/css/users/user-profile.css" rel="stylesheet" type="text/css" />
     <link rel="stylesheet" type="text/css" href="../plugins/select2/select2.min.css">
    <!--  END CUSTOM STYLE FILE  -->
    <script>
function getdoctor(val) {
  $.ajax({
  type: "POST",
  url: "get_price",
  data:'specilizationid='+val,
  success: function(data){
    $("#available").html(data);
  }
  });
}
</script>
</head>
<body class="sidebar-noneoverflow">
    <!-- BEGIN LOADER -->
    <div id="load_screen"> <div class="loader"> <div class="loader-content">
        <div class="spinner-grow align-self-center"></div>
    </div></div></div>
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

                <div class="row layout-spacing">

                    <!-- Content -->
                    <div class="col-xl-6 col-lg-6 col-md-5 col-sm-12 layout-top-spacing">

                        <div class="skills layout-spacing ">
                            <div class="widget-content widget-content-area">
                                <h3 class="">Credit Order</h3>
                                <form method="POST">
                                     <div class="form-group">
                      <label>Customer Name</label>
                      <span style="color:red">*</span><br>
                       <select class="form-control basic" style="width: 100%;" required name="customer">
                                            <option value="">Select from list</option>
                         <?php
                       $facilityID = $_SESSION['facilityID'];
                        $ret=mysqli_query($con,"select * from customers where facilityID='$facilityID'");
while($row=mysqli_fetch_array($ret))
{
?>

<option value="<?php echo htmlentities($row['id']);?>"> 
 
                                  <?php  echo "".htmlentities($row['name']);?>

                                </option>



                                
                                <?php } ?>
                      </select>
                    </div>
                                <div class="form-group">
                      <label>Stock Name</label>
                      <span style="color:red">*</span><br>
                                 <select class="form-control  basic" required name="speciality" onChange="getdoctor(this.value);">
                                                       <option value="">Select from list</option>
                         <?php
                     $facilityID = $_SESSION['facilityID'];
                        $ret=mysqli_query($con,"select * from stocks where quantity > 0 and facilityID='$facilityID'");
while($row=mysqli_fetch_array($ret))
{
?>

<option value="<?php echo htmlentities($row['id']);?>"> 
 
                                  <?php  echo htmlentities($row['name']);?>

                                </option>



                                
                                <?php } ?>
                      </select>

                            </div>
                             <div class="form-group">
                  <label>Stock price </label>
                  <span style="color:red">*</span><br>
                  <select class="form-control select2" style="width: 100%;" required name="available" id="available">
                    
                                
                  </select>
                 </div>
                 <div class="form-group">
                        <label>Quantity</label>
                        <span style="color:red">*</span><br>
                        <input type="number" class="form-control" required name="quantity" value="1">
                      </div>
                  <div class="form-group">
                        <label>Unit Discount (Naira Discount Per Each Single Item)</label>
                        <input type="number" class="form-control" name="item_discount" value="0">
                  </div>
                        <div class="modal-footer">
                  <button type="submit" class="btn btn-primary" name="cart">Add To Cart</button>
                </div>
                        </div>
                        </form>
                    </div>

                        
                    </div>
            

                        
                    
                </div>
                </div>
       <?php include('footer.php'); ?>
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
    <!-- END PAGE LEVEL CUSTOM SCRIPTS -->


    <script src="../plugins/highlight/highlight.pack.js"></script>
    
    <!-- END GLOBAL MANDATORY SCRIPTS -->

    <!--  BEGIN CUSTOM SCRIPTS FILE  -->
    
    <script src="../plugins/select2/select2.min.js"></script>
    <script src="../plugins/select2/custom-select2.js"></script>
</body>
</html>




