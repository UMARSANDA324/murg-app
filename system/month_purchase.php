<?php
session_start();

error_reporting(0);
include('../assets/mashaAllah/gyada.php');
if(strlen($_SESSION['email'])==0)
  {
header('location:../index.php');
}
else 
{
    if(isset($_GET['del']))
      {
              mysqli_query($con,"delete from purchase_history where id = '".$_GET['id']."'");
            

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
    <link href="../assets/css/loader.css" rel="stylesheet" type="text/css" />
    <script src="../assets/js/loader.js"></script>
    <!-- BEGIN GLOBAL MANDATORY STYLES -->
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <!-- END GLOBAL MANDATORY STYLES -->
        
    <!-- BEGIN PAGE LEVEL CUSTOM STYLES -->
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <link rel="stylesheet" type="text/css" href="../assets/css/widgets/modules-widgets.css">    

    <!-- END PAGE LEVEL CUSTOM STYLES -->
    <!-- END PAGE LEVEL PLUGINS/CUSTOM STYLES -->

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

                <div class="filter-container mb-4">
                    <form method="GET" action="">
                        <div class="row">
                            <div class="col-md-4">
                                <label for="from_date">From Date:</label>
                                <input type="date" class="form-control" id="from_date" name="from_date" 
                                       value="<?php echo isset($_GET['from_date']) ? $_GET['from_date'] : date('Y-m-01'); ?>">
                            </div>
                            <div class="col-md-4">
                                <label for="to_date">To Date:</label>
                                <input type="date" class="form-control" id="to_date" name="to_date" 
                                       value="<?php echo isset($_GET['to_date']) ? $_GET['to_date'] : date('Y-m-t'); ?>">
                            </div>
                            <div class="col-md-4">
                                <button type="submit" class="btn btn-primary" style="margin-top: 32px;">Filter</button>
                                <a href="month_purchase" class="btn btn-danger" style="margin-top: 32px;">Reset</a>
                            </div>
                        </div>
                    </form>
                </div>

                <div class="row layout-top-spacing">
                    <div class="col-xl-6 col-lg-6 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="widget widget-account-invoice-two">
                            <div class="widget-content">
                                <div class="account-box">
                                    <div class="info">
                                        <div class="inv-title">
                                            <?php
                                            $from_date = isset($_GET['from_date']) ? mysqli_real_escape_string($con, $_GET['from_date']) : date('Y-m-01');
                                            $to_date = isset($_GET['to_date']) ? mysqli_real_escape_string($con, $_GET['to_date']) : date('Y-m-t');
                                            $date_title = ($from_date == $to_date) ? date('d-m-Y', strtotime($from_date)) : date('d-m-Y', strtotime($from_date)) . " to " . date('d-m-Y', strtotime($to_date));
                                            ?>
                                            <h3 class="" style="color:white;">Total Purchase For <b><?php echo $date_title; ?></b></h3>
                                
                                        </div>
                                        <div class="inv-balance-info">

                                            
                                        </div>
                                    </div>
                                    <div class="acc-action">
                                           <?php
                      $facilityID = $_SESSION['facilityID'];
                  $x_query = $con->query("SELECT SUM(total_cost) as 'selling' FROM purchase_history where DATE(purchase_date) BETWEEN '$from_date' AND '$to_date' and facilityID='$facilityID'");
$x_row = $x_query->fetch_array();
$real = $x_row['selling'];
?>
                                       
            <h1 style="color:white"> <b>  ₦<?php echo number_format($real);    ?></b></h1>
                   
                                        
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                 
                    
</div>
                
                <div class="row layout-top-spacing" id="cancel-row">
                
                    <div class="col-xl-12 col-lg-12 col-sm-12  layout-spacing">
                        
                        <div class="widget-content widget-content-area br-6">

                             
                            <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                    <th>S/N</th>
                                    <th>Stock Name</th>
                                    <th>Purchase From</th>
                                    <th>Quantity</th>
                                    <th>Cost Price</th>
                                    <th>Total Cost</th>
                                    <th>Purchase Date</th>
                                    <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                  <?php
     $facilityID = $_SESSION['facilityID'];
$sql=mysqli_query($con,"select * from purchase_history where DATE(purchase_date) BETWEEN '$from_date' AND '$to_date' and facilityID='$facilityID'");

$cnt=1;
while($row=mysqli_fetch_array($sql))
{
?>
                         <tr>
                      <td class="center"><?php echo $cnt;?>.</td>
                        <td class="hidden-xs"><?php echo $row['stock_name'];?></td>
                        <td class="hidden-xs"><?php echo $row['purchase_from'];?></td>
                        <td class="hidden-xs"><?php echo $row['quantity'];?></td>
                          <td class="hidden-xs">₦ <?php echo number_format($row['cost_price']);?></td>
                           <td class="hidden-xs">₦ <?php echo number_format($row['total_cost']);?></td>
                           <td class="hidden-xs"><?php echo $row['purchase_date'];?></td>
                           <td>
                                <div class="visible-md visible-lg hidden-sm hidden-xs">
                                    <a href="month_purchase?id=<?php echo $row['id']?>&del=delete" onClick="return confirm('Are you sure you want to delete?')" class="btn btn-danger" tooltip-placement="top" tooltip="Remove">Delete</a>
                                </div>
                           </td>
                        
                        
                      </tr>

                      <?php 
$cnt=$cnt+1; 
}
?>
                                </tbody>

                            </table>
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

    <!-- BEGIN PAGE LEVEL CUSTOM SCRIPTS -->
    <script src="../plugins/table/datatable/datatables.js"></script>
    <!-- NOTE TO Use Copy CSV Excel PDF Print Options You Must Include These Files  -->
    <script src="../plugins/table/datatable/button-ext/dataTables.buttons.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/jszip.min.js"></script>    
    <script src="../plugins/table/datatable/button-ext/buttons.html5.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/buttons.print.min.js"></script>
    <script>
        $('#html5-extension').DataTable( {
            "dom": "<'dt--top-section'<'row'<'col-sm-12 col-md-6 d-flex justify-content-md-start justify-content-center'B><'col-sm-12 col-md-6 d-flex justify-content-md-end justify-content-center mt-md-0 mt-3'f>>>" +
        "<'table-responsive'tr>" +
        "<'dt--bottom-section d-sm-flex justify-content-sm-between text-center'<'dt--pages-count  mb-sm-0 mb-3'i><'dt--pagination'p>>",
            buttons: {
                buttons: [
                    { extend: 'copy', className: 'btn btn-sm' },
                    { extend: 'csv', className: 'btn btn-sm' },
                    { extend: 'excel', className: 'btn btn-sm' },
                    { extend: 'print', className: 'btn btn-sm' }
                ]
            },
            "oLanguage": {
                "oPaginate": { "sPrevious": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>', "sNext": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' },
                "sInfo": "Showing page _PAGE_ of _PAGES_",
                "sSearch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
                "sSearchPlaceholder": "Search...",
               "sLengthMenu": "Results :  _MENU_",
            },
            "stripeClasses": [],
            "lengthMenu": [7, 10, 20, 50],
            "pageLength": 7 
        } );
    </script>
    <!-- END PAGE LEVEL CUSTOM SCRIPTS -->
</body>
</html>






