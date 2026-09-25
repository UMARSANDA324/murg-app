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
        .filter-container {
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .progress {
            height: 10px;
            margin-top: 10px;
        }
        .week-range {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #333;
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
                $from_date = isset($_GET['from_date']) ? mysqli_real_escape_string($con, $_GET['from_date']) : '';
                $to_date = isset($_GET['to_date']) ? mysqli_real_escape_string($con, $_GET['to_date']) : '';
                $date_filter = "";
                $date_filter_orders = "";
                if(!empty($from_date) && !empty($to_date)){
                    $date_filter = " AND DATE(creation) BETWEEN '$from_date' AND '$to_date'";
                    $date_filter_orders = "AND DATE(creation) BETWEEN '$from_date' AND '$to_date'";
                }

                $facilityID = $_SESSION['facilityID'];
                $facility_q = "";

                // 1. Total Outstanding (Filtered) - Using same logic as view-customer page
                // Calculate for all customers: total_sales - total_discount - total_initial_paid - total_deposits
                $totalSalesQuery = "SELECT SUM(CAST(subtotal AS DECIMAL(10,2)) - (CAST(item_discount AS DECIMAL(10,2)) * CAST(quantity AS SIGNED))) as total_sales FROM orders WHERE customerID IS NOT NULL $date_filter_orders $facility_q";
                $totalSalesResult = mysqli_query($con, $totalSalesQuery);
                $totalSales = mysqli_fetch_assoc($totalSalesResult)['total_sales'] ?? 0;

                $totalDiscountQuery = "SELECT SUM(CAST(discount AS DECIMAL(10,2))) as total_discount FROM (SELECT orderID, discount FROM orders WHERE customerID IS NOT NULL $date_filter_orders $facility_q GROUP BY orderID) as t";
                $totalDiscountResult = mysqli_query($con, $totalDiscountQuery);
                $totalDiscount = mysqli_fetch_assoc($totalDiscountResult)['total_discount'] ?? 0;

                $totalInitialPaidQuery = "SELECT SUM(CAST(amount_paid AS DECIMAL(10,2))) as total_initial_paid FROM (SELECT orderID, amount_paid FROM orders WHERE customerID IS NOT NULL $date_filter_orders $facility_q GROUP BY orderID) as t";
                $totalInitialPaidResult = mysqli_query($con, $totalInitialPaidQuery);
                $totalInitialPaid = mysqli_fetch_assoc($totalInitialPaidResult)['total_initial_paid'] ?? 0;

                $totalDepositsQuery = "SELECT SUM(amount) as total FROM deposit_history d JOIN customers c ON d.customerID = c.id WHERE 1=1";
                if(!empty($from_date) && !empty($to_date)){
                    $totalDepositsQuery .= " AND DATE(d.deposit_date) BETWEEN '$from_date' AND '$to_date'";
                }
                $totalDepositsResult = mysqli_query($con, $totalDepositsQuery);
                $totalDeposits = mysqli_fetch_assoc($totalDepositsResult)['total'] ?? 0;

                $totalOutstanding = $totalSales - $totalDiscount - $totalInitialPaid - $totalDeposits;

                // 2. Today's Outstanding - Using same logic as view-customer page for today's orders
                $todaysSalesQuery = "SELECT SUM(CAST(subtotal AS DECIMAL(10,2)) - (CAST(item_discount AS DECIMAL(10,2)) * CAST(quantity AS SIGNED))) as total_sales FROM orders WHERE DATE(creation) = CURDATE() $facility_q";
                $todaysSalesResult = mysqli_query($con, $todaysSalesQuery);
                $todaysSales = mysqli_fetch_assoc($todaysSalesResult)['total_sales'] ?? 0;

                $todaysDiscountQuery = "SELECT SUM(CAST(discount AS DECIMAL(10,2))) as total_discount FROM (SELECT orderID, discount FROM orders WHERE DATE(creation) = CURDATE() $facility_q GROUP BY orderID) as t";
                $todaysDiscountResult = mysqli_query($con, $todaysDiscountQuery);
                $todaysDiscount = mysqli_fetch_assoc($todaysDiscountResult)['total_discount'] ?? 0;

                $todaysInitialPaidQuery = "SELECT SUM(CAST(amount_paid AS DECIMAL(10,2))) as total_initial_paid FROM (SELECT orderID, amount_paid FROM orders WHERE DATE(creation) = CURDATE() $facility_q GROUP BY orderID) as t";
                $todaysInitialPaidResult = mysqli_query($con, $todaysInitialPaidQuery);
                $todaysInitialPaid = mysqli_fetch_assoc($todaysInitialPaidResult)['total_initial_paid'] ?? 0;

                $todaysOutstanding = $todaysSales - $todaysDiscount - $todaysInitialPaid;

                // 3. Amount Paid Today (Initial payments on orders today + Deposits today)
                $todaysOrdersPaidQuery = "SELECT SUM(paid) as paid_total FROM (
                                            SELECT orderId, (CAST(amount_paid AS DECIMAL(15,2)) - CAST(change_given AS DECIMAL(15,2))) as paid FROM orders 
                                            WHERE DATE(creation) = CURDATE() $facility_q 
                                            GROUP BY orderId
                                         ) as t";
                $todaysDepositsPaidQuery = "SELECT SUM(d.amount) as deposit_total FROM deposit_history d 
                                            JOIN customers c ON d.customerID = c.id 
                                            WHERE DATE(d.deposit_date) = CURDATE()";
                
                $ordersPaidResult = mysqli_query($con, $todaysOrdersPaidQuery);
                $depositsPaidResult = mysqli_query($con, $todaysDepositsPaidQuery);
                
                $ordersPaidToday = mysqli_fetch_assoc($ordersPaidResult)['paid_total'] ?? 0;
                $depositsPaidToday = mysqli_fetch_assoc($depositsPaidResult)['deposit_total'] ?? 0;
                $totalPaidToday = $ordersPaidToday + $depositsPaidToday;

                // 4. Remaining Balance For Today (This is the new debt generated today)
                $remainingBalanceToday = $todaysOutstanding;

                ?>
                <div class="row layout-top-spacing">
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-primary">
                            <div class="icon text-white">
                                <i class="fas fa-list-ul"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($totalOutstanding); ?></div>
                            <div class="label text-white">Total Outstanding</div>
                        </div>
                    </div>
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-primary">
                            <div class="icon text-white">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($todaysOutstanding); ?></div>
                            <div class="label text-white">Today's Outstanding</div>
                        </div>
                    </div>
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-success">
                            <div class="icon text-white">
                                <i class="fas fa-hand-holding-usd"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($totalPaidToday); ?></div>
                            <div class="label text-white">Amount Paid</div>
                        </div>
                    </div>
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-danger">
                            <div class="icon text-white">
                                <i class="fas fa-balance-scale"></i>
                            </div>
                            <div class="value text-white">₦<?php echo number_format($remainingBalanceToday); ?></div>
                            <div class="label text-white">Remaining Balance For Today</div>
                        </div>
                    </div>
                </div>
                
                <div class="row layout-top-spacing" id="cancel-row">
                
                    <div class="col-xl-12 col-lg-12 col-sm-12  layout-spacing">
                        
                        <div class="widget-content widget-content-area br-6">

                             <?php if($error){?><strong style="color:red; font-size:18px; margin-top: 15px;">Something Went Wrong Try again later</strong> <?php } 
        else if($msg){?><strong style="color:green; font-size:18px;  margin-top: 15px;"> Stock Added Successfully</strong><?php }?>

                            <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                     <th>S/N</th>
                     <th>Customer</th>
                    
                      <th>Amount Paid</th>
                     <th>Balance</th>
                    <th>Action</th>
                   
                                    </tr>
                                <tbody>
                                 <?php
$sql = "SELECT * FROM outstand WHERE 1=1";
$result = mysqli_query($con, $sql);
$cnt = 1;
while ($row = mysqli_fetch_array($result)) {
    $cid = $row['customerID'];
    
    // Calculate today's payments for this specific customer
    $custOrdersPaidQuery = "SELECT SUM(paid) as paid_total FROM (
                                SELECT orderId, (CAST(amount_paid AS DECIMAL(15,2)) - CAST(change_given AS DECIMAL(15,2))) as paid FROM orders 
                                WHERE customerID='$cid' AND DATE(creation) = CURDATE() $facility_q 
                                GROUP BY orderId
                             ) as t";
    $custOrdersPaidResult = mysqli_query($con, $custOrdersPaidQuery);
    $custOrdersPaidToday = mysqli_fetch_assoc($custOrdersPaidResult)['paid_total'] ?? 0;

    $custDepositsPaidQuery = "SELECT SUM(amount) as deposit_total FROM deposit_history 
                                WHERE customerID='$cid' AND DATE(deposit_date) = CURDATE()";
    $custDepositsPaidResult = mysqli_query($con, $custDepositsPaidQuery);
    $custDepositsPaidToday = mysqli_fetch_assoc($custDepositsPaidResult)['deposit_total'] ?? 0;

    $todayTotalPaidForCust = $custOrdersPaidToday + $custDepositsPaidToday;

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
                          <td class="hidden-xs">₦<?php echo number_format($todayTotalPaidForCust);?></td>
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
                               <a href="deposit?id=<?php echo $row['customerID'];?>" class="btn btn-primary" tooltip-placement="top" tooltip="Edit">Add Deposit</a>
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

                   <div class="modal fade" id="exampleModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
                                        <div class="modal-dialog" role="document">
                                            <div class="modal-content">
                                                <div class="modal-header">
                                                    <h5 class="modal-title" id="exampleModalLabel">Stock Information</h5>
                                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                </div>
                                               <form method="POST">
                                                <div class="modal-body">
                                                  
                                          <div class="form-group">
                      
                      
                      <div class="form-group">
                        <label>Selling Price</label>
                        <span style="color:red">*</span><br>
                        <input type="number" class="form-control" required name="sell">
                       

                      </div>
                  </div>
                     
                                                </div>
                                                <div class="modal-footer">
                                                    <button class="btn" data-dismiss="modal"><i class="flaticon-cancel-12"></i> Discard</button>
                                                    <button type="submit" class="btn btn-primary" name="submit">Save</button>
                                                </div>
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

    <!-- BEGIN PAGE LEVEL CUSTOM SCRIPTS -->
    <script src="../plugins/table/datatable/datatables.js"></script>
    <script src="../plugins/table/datatable/dataTables.responsive.min.js"></script>
    <!-- NOTE TO Use Copy CSV Excel PDF Print Options You Must Include These Files  -->
    <script src="../plugins/table/datatable/button-ext/dataTables.buttons.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/jszip.min.js"></script>    
    <script src="../plugins/table/datatable/button-ext/buttons.html5.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/buttons.print.min.js"></script>
     

     
    <script src="../plugins/highlight/highlight.pack.js"></script>
    
    <!-- END GLOBAL MANDATORY SCRIPTS -->

    <!--  BEGIN CUSTOM SCRIPTS FILE  -->
    
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
    <!-- END PAGE LEVEL CUSTOM SCRIPTS -->
</body>
</html>




