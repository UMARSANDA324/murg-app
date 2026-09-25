<?php
session_start();
include('../assets/mashaAllah/gyada.php');
if(strlen($_SESSION['email'])==0) {
    header('location:../index.php');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no">
    <title>Sales Report - MURG TEXTILE ENTERPRISES</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="../assets/css/loader.css" rel="stylesheet" type="text/css" />
    <script src="../assets/js/loader.js"></script>
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <style>
        .filter-container {
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(255, 178, 0, 0.1);
        }
        #html5-extension th, #html5-extension td {
            border: 1px solid #e0e6ed !important;
            padding: 8px 12px !important;
        }
        #html5-extension {
            border-collapse: collapse !important;
        }
    </style>
</head>
<body class="sidebar-noneoverflow">
    <div id="load_screen"> <div class="loader"> <div class="loader-content">
        <div class="spinner-grow align-self-center"></div>
    </div></div></div>
    <?php include('header.php'); ?>
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <div class="search-overlay"></div>
        <?php include('sidebar.php'); ?>
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <div class="row layout-top-spacing">
                    <div class="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                        <div class="filter-container">
                            <form method="GET" action="">
                                <div class="row align-items-end">
                                    <div class="col-md-4">
                                        <label>From Date:</label>
                                        <input type="date" class="form-control" name="from_date" 
                                               value="<?php echo isset($_GET['from_date']) ? $_GET['from_date'] : date('Y-m-d'); ?>">
                                    </div>
                                    <div class="col-md-4">
                                        <label>To Date:</label>
                                        <input type="date" class="form-control" name="to_date" 
                                               value="<?php echo isset($_GET['to_date']) ? $_GET['to_date'] : date('Y-m-d'); ?>">
                                    </div>
                            <div class="col-md-4">
                                <button type="submit" class="btn btn-primary">Filter</button>
                                <a href="sales_report" class="btn btn-danger">Reset</a>
                                <a href="weekly" class="btn btn-secondary">Back</a>
                            </div>
                        </div>
                    </form>
                </div>

                <div class="widget-content widget-content-area br-6">
                    <?php
                    $from_date = isset($_GET['from_date']) ? mysqli_real_escape_string($con, $_GET['from_date']) : date('Y-m-d');
                    $to_date = isset($_GET['to_date']) ? mysqli_real_escape_string($con, $_GET['to_date']) : date('Y-m-d');
                    $facilityID = $_SESSION['facilityID'];
                    $where_facility = !empty($facilityID) ? "AND facilityID='$facilityID'" : "";

                    // Correct Item-wise query that apportions general discounts based on item value
                    $query = "
                        SELECT 
                            o.item,
                            SUM(CAST(o.quantity AS DECIMAL(15,2))) as total_quantity,
                            SUM(CAST(o.subtotal AS DECIMAL(15,2))) as total_gross,
                            SUM(CAST(o.item_discount AS DECIMAL(15,2)) * CAST(o.quantity AS DECIMAL(15,2))) as total_unit_discount,
                            SUM(
                                CAST(o.discount AS DECIMAL(15,2)) * 
                                (CAST(o.subtotal AS DECIMAL(15,2)) / NULLIF(CAST(t.order_gross AS DECIMAL(15,2)), 0))
                            ) as total_gen_discount_apportioned
                        FROM orders o
                        JOIN (
                            SELECT orderID, SUM(CAST(subtotal AS DECIMAL(15,2))) as order_gross 
                            FROM orders 
                            GROUP BY orderID
                        ) t ON o.orderID = t.orderID
                        WHERE DATE(o.creation) BETWEEN '$from_date' AND '$to_date' $where_facility
                        GROUP BY o.item
                        ORDER BY total_quantity DESC
                    ";
                    $result = mysqli_query($con, $query);
                    ?>
                    <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                        <thead>
                            <tr>
                                <th>S/N</th>
                                <th>Item Name</th>
                                <th>Qty Sold</th>
                                <th>Gross Value</th>
                                <th>Unit Discount</th>
                                <th>General Discount</th>
                                <th>Net Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $cnt = 1;
                            $grand_qty = 0;
                            $grand_gross = 0;
                            $grand_unit_discount = 0;
                            $grand_gen_discount = 0;
                            $grand_net = 0;

                            while($row = mysqli_fetch_assoc($result)): 
                                $gen_disc = $row['total_gen_discount_apportioned'] ?? 0;
                                $net = $row['total_gross'] - $row['total_unit_discount'] - $gen_disc;
                                
                                $grand_qty += $row['total_quantity'];
                                $grand_gross += $row['total_gross'];
                                $grand_unit_discount += $row['total_unit_discount'];
                                $grand_gen_discount += $gen_disc;
                                $grand_net += $net;
                            ?>
                            <tr>
                                <td><?php echo $cnt++; ?></td>
                                <td><?php echo htmlspecialchars($row['item']); ?></td>
                                <td><?php echo number_format($row['total_quantity']); ?></td>
                                <td>₦<?php echo number_format($row['total_gross']); ?></td>
                                <td>₦<?php echo number_format($row['total_unit_discount']); ?></td>
                                <td>₦<?php echo number_format($gen_disc); ?></td>
                                <td>₦<?php echo number_format($net); ?></td>
                            </tr>
                            <?php endwhile; ?>
                            <!-- Total Row in Table Body for visibility/sorting -->
                            <tr style="background-color: #f1f2f3; font-weight: bold;">
                                <td>TOTAL</td>
                                <td></td>
                                <td><?php echo number_format($grand_qty); ?></td>
                                <td>₦<?php echo number_format($grand_gross); ?></td>
                                <td>₦<?php echo number_format($grand_unit_discount); ?></td>
                                <td>₦<?php echo number_format($grand_gen_discount); ?></td>
                                <td>₦<?php echo number_format($grand_net); ?></td>
                            </tr>
                        </tbody>
                        <tfoot style="background-color: #f1f2f3; font-weight: bold;">
                            <tr>
                                <td>TOTAL</td>
                                <td></td>
                                <td><?php echo number_format($grand_qty); ?></td>
                                <td>₦<?php echo number_format($grand_gross); ?></td>
                                <td>₦<?php echo number_format($grand_unit_discount); ?></td>
                                <td>₦<?php echo number_format($grand_gen_discount); ?></td>
                                <td>₦<?php echo number_format($grand_net); ?></td>
                            </tr>
                        </tfoot>
                    </table>
                        </div>
                    </div>
                </div>
            </div>
            <?php include('footer.php'); ?>
        </div>
    </div>

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
    <script src="../plugins/table/datatable/datatables.js"></script>
    <script src="../plugins/table/datatable/button-ext/dataTables.buttons.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/jszip.min.js"></script>    
    <script src="../plugins/table/datatable/button-ext/buttons.html5.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/buttons.print.min.js"></script>
    <script>
        $('#html5-extension').DataTable({
            "dom": "<'dt--top-section'<'row'<'col-sm-12 col-md-6 d-flex justify-content-md-start justify-content-center'B><'col-sm-12 col-md-6 d-flex justify-content-md-end justify-content-center mt-md-0 mt-3'f>>>" +
            "<'table-responsive'tr>" +
            "<'dt--bottom-section d-sm-flex justify-content-sm-between text-center'<'dt--pages-count mb-sm-0 mb-3'i><'dt--pagination'p>>",
            buttons: {
                buttons: [
                    { extend: 'copy', className: 'btn btn-sm' },
                    { extend: 'csv', className: 'btn btn-sm' },
                    { 
                        extend: 'excel', 
                        className: 'btn btn-sm',
                        title: 'Item Sales Report - MURG TEXTILE ENTERPRISES <?= date("Y-m-d"); ?>',
                        exportOptions: {
                            footer: true
                        },
                        customize: function(xlsx) {
                            var sheet = xlsx.xl.worksheets['sheet1.xml'];
                            // Style 25 is thin border.
                            $('row c', sheet).attr('s', '25');
                        }
                    },
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
            "pageLength": 10
        });
    </script>
</body>
</html>


