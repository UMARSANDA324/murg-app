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
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dataTables.responsive.min.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
     <link rel="stylesheet" type="text/css" href="../plugins/select2/select2.min.css">
      <link href="../assets/css/scrollspyNav.css" rel="stylesheet" type="text/css" />
      <style>
        .stat-card {
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease;
        }
        .stat-card:hover {
            transform: translateY(-5px);
        }
        .stat-card .icon {
            font-size: 30px;
            margin-bottom: 15px;
        }
        .stat-card .value {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        .stat-card .label {
            font-size: 14px;
            color: #6c757d;
        }
    </style>
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

                <div class="widget-content widget-content-area br-6 mb-4 mt-4">
                    <form method="GET" action="">
                        <div class="row">
                            <div class="col-md-4">
                                <label>From Date</label>
                                <input type="date" name="from_date" class="form-control" value="<?php echo isset($_GET['from_date']) ? $_GET['from_date'] : ''; ?>">
                            </div>
                            <div class="col-md-4">
                                <label>To Date</label>
                                <input type="date" name="to_date" class="form-control" value="<?php echo isset($_GET['to_date']) ? $_GET['to_date'] : ''; ?>">
                            </div>
                            <div class="col-md-4">
                                <button type="submit" class="btn btn-primary" style="margin-top: 33px;">Filter</button>
                                <a href="out" class="btn btn-danger" style="margin-top: 33px;">Reset</a>
                            </div>
                        </div>
                    </form>
                </div>

            <?php
                $facilityID = $_SESSION['facilityID'];
                $from_date = isset($_GET['from_date']) ? mysqli_real_escape_string($con, $_GET['from_date']) : '';
                $to_date = isset($_GET['to_date']) ? mysqli_real_escape_string($con, $_GET['to_date']) : '';
                $date_filter = "";
                if(!empty($from_date) && !empty($to_date)){
                    $date_filter = " AND DATE(creation) BETWEEN '$from_date' AND '$to_date'";
                }

                $balanceQuery = "SELECT SUM(balance) as balance_total FROM outstand WHERE 1=1 $date_filter";
                $amountQuery = "SELECT SUM(amount) as amount_total FROM outstand WHERE 1=1 $date_filter";
                
                $balanceResult = mysqli_query($con, $balanceQuery);
                $amountResult = mysqli_query($con, $amountQuery);
                
                $balanceTotal = mysqli_fetch_assoc($balanceResult)['balance_total'] ?? 0;
                $amountTotal = mysqli_fetch_assoc($amountResult)['amount_total'] ?? 0;
                ?>
                <div class="row layout-top-spacing">
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-primary">
                            <div class="icon text-white">
                                <i class="fas fa-money-bill-wave"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($balanceTotal); ?></div>
                            <div class="label text-white">Total Balance</div>
                        </div>
                    </div>
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-primary">
                            <div class="icon text-white">
                                <i class="fas fa-credit-card"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($amountTotal); ?></div>
                            <div class="label text-white">Total Amount Paid</div>
                        </div>
                    </div>
                </div>
                
                <div class="row layout-top-spacing" id="cancel-row">
                
                    <div class="col-xl-12 col-lg-12 col-sm-12  layout-spacing">
                        
                        <div class="widget-content widget-content-area br-6">

                             <?php if($error){?><strong style="color:red; font-size:18px; margin-top: 15px;">Something Went Wrong Try again later</strong> <?php } 
        else if($msg){?><strong style="color:green; font-size:18px;  margin-top: 15px;"> Success</strong><?php }?>

                            <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                     <th>S/N</th>
                                     <th>Customer</th>
                                     <th>Amount Paid</th>
                                     <th>Balance</th>
                                     <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                 <?php
                                $sql = "SELECT * FROM outstand WHERE 1=1 $date_filter";
                                $result = mysqli_query($con, $sql);
                                $cnt = 1;
                                while ($row = mysqli_fetch_array($result)) {
                                    $cid = $row['customerID'];
                                    
                                    // Calculate dynamic balance for this customer to match view-customer
                                    $facilityID = $_SESSION['facilityID'];
                                    $cust_sales_query = mysqli_query($con, "SELECT SUM(CAST(subtotal AS DECIMAL(10,2)) - (CAST(item_discount AS DECIMAL(10,2)) * CAST(quantity AS SIGNED))) as total_sales FROM orders WHERE customerID='$cid' AND facilityID='$facilityID'");
                                    $cust_sales_data = mysqli_fetch_array($cust_sales_query);
                                    $cust_total_sales = $cust_sales_data['total_sales'] ?? 0;

                                    $cust_discount_query = mysqli_query($con, "SELECT SUM(CAST(discount AS DECIMAL(10,2))) as total_discount FROM (SELECT orderID, discount FROM orders WHERE customerID='$cid' AND facilityID='$facilityID' GROUP BY orderID) as t");
                                    $cust_discount_data = mysqli_fetch_array($cust_discount_query);
                                    $cust_total_discount = $cust_discount_data['total_discount'] ?? 0;

                                    $cust_initial_payment_query = mysqli_query($con, "SELECT SUM(CAST(amount_paid AS DECIMAL(10,2))) as total_initial_paid FROM (SELECT orderID, amount_paid FROM orders WHERE customerID='$cid' AND facilityID='$facilityID' GROUP BY orderID) as t");
                                    $cust_initial_payment_data = mysqli_fetch_array($cust_initial_payment_query);
                                    $cust_total_initial_paid = $cust_initial_payment_data['total_initial_paid'] ?? 0;

                                    $cust_deposits_query = mysqli_query($con, "SELECT SUM(amount) as total FROM deposit_history WHERE customerID='$cid'");
                                    $cust_deposits_data = mysqli_fetch_array($cust_deposits_query);
                                    $cust_actual_total_deposits = $cust_deposits_data['total'] ?? 0;

                                    $cust_actual_balance = $cust_total_sales - $cust_total_discount - $cust_total_initial_paid - $cust_actual_total_deposits;
                                ?>
                                 <tr>
                                    <td class="center"><?php echo $cnt;?>.</td>
                                    <td class="hidden-xs"><?php echo $row['Customer'];?></td>
                                    <td class="hidden-xs">₦<?php echo number_format($cust_actual_total_deposits);?></td>
                                    <td>
                                        <?php if ($cust_actual_balance == 0): ?>
                                            <span class="badge badge-success">Clear</span>
                                        <?php elseif ($cust_actual_balance < 0): ?>
                                            <span class="badge badge-info">Credit: ₦<?php echo number_format(abs($cust_actual_balance)); ?></span>
                                        <?php else: ?>
                                            <span class="text-danger" style="font-weight: bold;">₦<?php echo number_format($cust_actual_balance); ?></span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <div class="visible-md visible-lg hidden-sm hidden-xs">
                                            <a href="deposit?id=<?php echo $row['customerID'];?>" class="btn btn-primary">Add Deposit</a>
                                        </div>
                                    </td>
                                  </tr>
                                <?php 
                                $cnt = $cnt + 1; 
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
    </div>

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
    
    <!-- BEGIN PAGE LEVEL CUSTOM SCRIPTS -->
    <script src="../plugins/table/datatable/datatables.js"></script>
    <script src="../plugins/table/datatable/dataTables.responsive.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/dataTables.buttons.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/jszip.min.js"></script>    
    <script src="../plugins/table/datatable/button-ext/buttons.html5.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/buttons.print.min.js"></script>
    <script src="../plugins/select2/select2.min.js"></script>
    <script src="../plugins/select2/custom-select2.js"></script>

    <script>
        $('#html5-extension').DataTable( {
            responsive: true,
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
</body>
</html>


