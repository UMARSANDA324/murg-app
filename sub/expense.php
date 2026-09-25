<?php
session_start();
error_reporting(0);
include('../assets/mashaAllah/gyada.php');
if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
    exit;
}

$facilityID = $_SESSION['facilityID'];
$msg = $error = "";
$typeFilter = isset($_GET['type']) ? mysqli_real_escape_string($con, $_GET['type']) : '';
$dateFilter = isset($_GET['date']) ? mysqli_real_escape_string($con, $_GET['date']) : '';

if (isset($_POST['submit'])) {
    $item = mysqli_real_escape_string($con, $_POST['item']);
    $price = mysqli_real_escape_string($con, $_POST['price']);
    $type = mysqli_real_escape_string($con, $_POST['type']);
    
    $sql = mysqli_query($con, "INSERT INTO expense (facilityID, item, price, type) VALUES ('$facilityID', '$item', '$price', '$type')");
    
    if ($sql) {
        $msg = "Billing Item Added successfully";
    } else {
        $error = "Something went wrong. Please try again";
    }
}

if (isset($_POST['update'])) {
    $id = mysqli_real_escape_string($con, $_POST['id']);
    $item = mysqli_real_escape_string($con, $_POST['item']);
    $price = mysqli_real_escape_string($con, $_POST['price']);
    $type = mysqli_real_escape_string($con, $_POST['type']);
    
    $sql = mysqli_query($con, "UPDATE expense SET item='$item', price='$price', type='$type' WHERE id='$id'");
    
    if ($sql) {
        $msg = "Expense updated successfully";
    } else {
        $error = "Something went wrong. Please try again";
    }
}

if (isset($_GET['del']) && isset($_GET['id'])) {
    $id = mysqli_real_escape_string($con, $_GET['id']);
    mysqli_query($con, "DELETE FROM expense WHERE id = '$id'");
}

// Build the query with filters
$query = "SELECT * FROM expense WHERE 1=1";
if ($typeFilter) {
    $query .= " AND type = '$typeFilter'";
}
if ($dateFilter) {
    $query .= " AND DATE(creation) = '$dateFilter'";
}
$sql = mysqli_query($con, $query);

// Calculate total for filtered results
$totalQuery = "SELECT SUM(price) as total FROM expense WHERE 1=1";
if ($typeFilter) {
    $totalQuery .= " AND type = '$typeFilter'";
}
if ($dateFilter) {
    $totalQuery .= " AND DATE(creation) = '$dateFilter'";
}
$totalResult = mysqli_query($con, $totalQuery);
$totalRow = mysqli_fetch_array($totalResult);
$totalPrice = $totalRow['total'] ? number_format($totalRow['total']) : '0';
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
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <link rel="stylesheet" type="text/css" href="../assets/css/widgets/modules-widgets.css">
    <style>
        @media print {
            .no-print { display: none !important; }
            .table { width: 100%; border-collapse: collapse; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; }
            .table tr.total-row { font-weight: bold; }
        }
    </style>
</head>
<body class="sidebar-noneoverflow">
    <div id="load_screen">
        <div class="loader">
            <div class="loader-content">
                <div class="spinner-grow align-self-center"></div>
            </div>
        </div>
    </div>
    <?php include('header.php'); ?>
    
    <div class="main-container" id="container">
        <div class="overlay"></div>
        <div class="search-overlay"></div>
        
        <?php include('sidebar.php'); ?>
        
        <div id="content" class="main-content">
            <div class="layout-px-spacing">
                <!-- Messages -->
                <?php if ($msg) { ?>
                    <div class="alert alert-success"><?php echo $msg; ?></div>
                <?php } ?>
                <?php if ($error) { ?>
                    <div class="alert alert-danger"><?php echo $error; ?></div>
                <?php } ?>
                
                <!-- Cards -->
                <div class="row layout-top-spacing">
                    <!-- Today's In Card -->
                    <div class="col-xl-3 col-lg-3 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="widget widget-account-invoice-two" style="background-color: #ffc100;">
                            <div class="widget-content">
                                <div class="account-box">
                                    <div class="info">
                                        <div class="inv-title">
                                            <h3 class="" style="color:white;">Today's In <b> ( <?php echo $date = date('d-m-Y'); ?> )</b></h3>
                                        </div>
                                    </div>
                                    <div class="acc-action">
                                        <?php
                                        $date = date('Y-m-d');
                                        $facilityID = $_SESSION['facilityID'];
                                        $in_query = $con->query("SELECT SUM(price) as 'total_in' FROM expense WHERE Date(creation)='$date' AND type='in'");
                                        $in_row = $in_query->fetch_array();
                                        ?>
                                        <h1 style="color:white"> <b>  ₦<?php echo number_format($in_row['total_in'] ?: 0); ?></b></h1>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Today's Out Card -->
                    <div class="col-xl-3 col-lg-3 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="widget widget-account-invoice-two" style="background-color: #e74c3c;">
                            <div class="widget-content">
                                <div class="account-box">
                                    <div class="info">
                                        <div class="inv-title">
                                            <h3 class="" style="color:white;">Today's Out <b> ( <?php echo $date = date('d-m-Y'); ?> )</b></h3>
                                        </div>
                                    </div>
                                    <div class="acc-action">
                                    <?php
                                        $date = date('Y-m-d');
                                        $facilityID = $_SESSION['facilityID'];
                                        $out_query = $con->query("SELECT SUM(price) as 'total_out' FROM expense WHERE Date(creation)='$date' AND type='out'");
                                        $out_row = $out_query->fetch_array();
                                        ?>
                                        <h1 style="color:white"> <b>  ₦<?php echo number_format($out_row['total_out'] ?: 0); ?></b></h1>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Total In Card -->
                    <div class="col-xl-3 col-lg-3 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="widget widget-account-invoice-two" style="background-color: #2ecc71;">
                            <div class="widget-content">
                                <div class="account-box">
                                    <div class="info">
                                        <div class="inv-title">
                                            <h3 class="" style="color:white;">Total Out Expense</h3>
                                        </div>
                                    </div>
                                    <div class="acc-action">
                                        <?php
                                        $total_out_query = "SELECT SUM(price) as 'total_out' FROM expense WHERE type='out'";
                                        if ($typeFilter) {
                                            $total_out_query .= " AND type = '$typeFilter'";
                                        }
                                        if ($dateFilter) {
                                            $total_out_query .= " AND DATE(creation) = '$dateFilter'";
                                        }
                                        $total_out_result = $con->query($total_out_query);
                                        $total_out_row = $total_out_result->fetch_array();
                                        ?>
                                        <h1 style="color:white"> <b>  ₦<?php echo number_format($total_out_row['total_out'] ?: 0); ?></b></h1>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Total Out Card -->
                    <div class="col-xl-3 col-lg-3 col-md-6 col-sm-12 col-12 layout-spacing">
                        <div class="widget widget-account-invoice-two" style="background-color: #e67e22;">
                            <div class="widget-content">
                                <div class="account-box">
                                    <div class="info">
                                        <div class="inv-title">
                                            <h3 class="" style="color:white;">Total In Expense</h3>
                                        </div>
                                    </div>
                                    <div class="acc-action">
                                        <?php
                                        $total_in_query = "SELECT SUM(price) as 'total_in' FROM expense WHERE type='in'";
                                        if ($typeFilter) {
                                            $total_in_query .= " AND type = '$typeFilter'";
                                        }
                                        if ($dateFilter) {
                                            $total_in_query .= " AND DATE(creation) = '$dateFilter'";
                                        }
                                        $total_in_result = $con->query($total_in_query);
                                        $total_in_row = $total_in_result->fetch_array();
                                        ?>
                                        <h1 style="color:white"> <b>  ₦<?php echo number_format($total_in_row['total_in'] ?: 0); ?></b></h1>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row layout-top-spacing" id="cancel-row">
                    <div class="col-xl-12 col-lg-12 col-sm-12 layout-spacing">
                        <button type="button" class="btn btn-primary mb-4 mr-2 no-print" data-toggle="modal" data-target="#exampleModal">
                            Add New Expense
                        </button>
                        
                        <div class="widget-content widget-content-area br-6">
                            <form method="GET" class="no-print">
                                <div class="row mb-4">
                                    <div class="col-md-3">
                                        <label>Filter by Type</label>
                                        <select name="type" class="form-control" onchange="this.form.submit()">
                                            <option value="">All Types</option>
                                            <option value="in" <?php echo $typeFilter == 'in' ? 'selected' : ''; ?>>In</option>
                                            <option value="out" <?php echo $typeFilter == 'out' ? 'selected' : ''; ?>>Out</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3">
                                        <label>Filter by Date</label>
                                        <input type="date" name="date" class="form-control" value="<?php echo $dateFilter; ?>" onchange="this.form.submit()">
                                    </div>
                                </div>
                            </form>
                            
                            <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th>S/N</th>
                                        <th>Item</th>
                                        <th>Price</th>
                                        <th>Type</th>
                                        <th>Date Added</th>
                                        <th class="no-print">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php
                                    $cnt = 1;
                                    $totalInExpense = 0;
                                    $totalOutExpense = 0;
                                    while ($row = mysqli_fetch_array($sql)) {
                                        if ($row['type'] == 'in') {
                                            $totalInExpense += $row['price'];
                                        } else {
                                            $totalOutExpense += $row['price'];
                                        }
                                    ?>
                                    <tr>
                                        <td class="center"><?php echo $cnt; ?>.</td>
                                        <td><?php echo htmlspecialchars($row['item']); ?></td>
                                        <td>₦<?php echo number_format($row['price']); ?></td>
                                        <td>
                                            <?php if ($row['type'] == 'in') { ?>
                                                <span class="badge badge-success">In</span>
                                            <?php } else { ?>
                                                <span class="badge badge-danger">Out</span>
                                            <?php } ?>
                                        </td>
                                        <td><?php echo $row['creation']; ?></td>
                                        <td class="no-print">
                                            <button class="btn btn-primary btn-sm" data-toggle="modal" data-target="#editModal<?php echo $row['id']; ?>">Edit</button>
                                            <a href="expense.php?del=delete&id=<?php echo $row['id']; ?>" onclick="return confirm('Are you sure you want to delete?')" class="btn btn-danger btn-sm">Delete</a>
                                        </td>
                                    </tr>
                                    <!-- Edit Modal -->
                                    <div class="modal fade no-print" id="editModal<?php echo $row['id']; ?>" tabindex="-1" role="dialog" aria-labelledby="editModalLabel<?php echo $row['id']; ?>" aria-hidden="true">
                                        <div class="modal-dialog" role="document">
                                            <div class="modal-content">
                                                <div class="modal-header">
                                                    <h5 class="modal-title" id="editModalLabel<?php echo $row['id']; ?>">Edit Expense</h5>
                                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                </div>
                                                <form method="POST">
                                                    <div class="modal-body">
                                                        <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
                                                        <div class="form-group">
                                                            <label>Item</label>
                                                            <span style="color:red">*</span><br>
                                                            <input type="text" class="form-control" required name="item" value="<?php echo htmlspecialchars($row['item']); ?>">
                                                        </div>
                                                        <div class="form-group">
                                                            <label>Price</label>
                                                            <span style="color:red">*</span><br>
                                                            <input type="number" class="form-control" required name="price" value="<?php echo $row['price']; ?>">
                                                        </div>
                                                        <div class="form-group">
                                                            <label>Type</label>
                                                            <span style="color:red">*</span><br>
                                                            <select class="form-control" required name="type">
                                                                <option value="in" <?php echo $row['type'] == 'in' ? 'selected' : ''; ?>>In</option>
                                                                <option value="out" <?php echo $row['type'] == 'out' ? 'selected' : ''; ?>>Out</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer">
                                                        <button class="btn" data-dismiss="modal"><i class="flaticon-cancel-12"></i> Cancel</button>
                                                        <button type="submit" class="btn btn-primary" name="update">Update</button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                    <?php
                                    $cnt++;
                                    }
                                    ?>
                                    
                                </tbody>
                                <tfoot>
                                    <tr class="total-row">
                                        <td colspan="2"><strong>Total In Expense</strong></td>
                                        <td><strong>₦<?php echo $totalInExpense; ?></strong></td>
                                        <td colspan="3"></td>
                                    </tr>
                                    <tr class="total-row">
                                        <td colspan="2"><strong>Total Out Expense</strong></td>
                                        <td><strong>₦<?php echo $totalOutExpense; ?></strong></td>
                                        <td colspan="3"></td>
                                    </tr>
                                    <tr class="total-row">
                                        <td colspan="2"><strong>Total</strong></td>
                                        <td><strong>₦<?php echo $totalPrice; ?></strong></td>
                                        <td colspan="3"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div class="modal fade no-print" id="exampleModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="exampleModalLabel">Expense Information</h5>
                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                                <form method="POST">
                                    <div class="modal-body">
                                        <div class="form-group">
                                            <label>Item</label>
                                            <span style="color:red">*</span><br>
                                            <input type="text" class="form-control" required name="item">
                                        </div>
                                        <div class="form-group">
                                            <label>Price</label>
                                            <span style="color:red">*</span><br>
                                            <input type="number" class="form-control" required name="price">
                                        </div>
                                        <div class="form-group">
                                            <label>Type</label>
                                            <span style="color:red">*</span><br>
                                            <select class="form-control" required name="type">
                                                <option value="in">In</option>
                                                <option value="out">Out</option>
                                            </select>
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
        $(document).ready(function() {
            $('#html5-extension').DataTable({
                "dom": "<'dt--top-section'<'row'<'col-sm-12 col-md-6 d-flex justify-content-md-start justify-content-center'B><'col-sm-12 col-md-6 d-flex justify-content-md-end justify-content-center mt-md-0 mt-3'f>>>" +
                    "<'table-responsive'tr>" +
                    "<'dt--bottom-section d-sm-flex justify-content-sm-between text-center'<'dt--pages-count mb-sm-0 mb-3'i><'dt--pagination'p>>",
                buttons: {
                    buttons: [
                        { 
                            extend: 'copy', 
                            className: 'btn btn-sm', 
                            exportOptions: { 
                                columns: [0, 1, 2, 3, 4],
                                rows: ':visible'
                            }
                        },
                        { 
                            extend: 'csv', 
                            className: 'btn btn-sm', 
                            exportOptions: { 
                                columns: [0, 1, 2, 3, 4],
                                rows: ':visible'
                            }
                        },
                        { 
                            extend: 'excel', 
                            className: 'btn btn-sm', 
                            exportOptions: { 
                                columns: [0, 1, 2, 3, 4],
                                rows: ':visible'
                            },
                            customize: function(xlsx) {
                                var sheet = xlsx.xl.worksheets['sheet1.xml'];
                                $('row:last c', sheet).attr('s', '2');
                            }
                        },
                        { 
                            extend: 'print', 
                            className: 'btn btn-sm',
                            exportOptions: { 
                                columns: [0, 1, 2, 3, 4],
                                rows: ':visible'
                            },
                            customize: function(win) {
                                $(win.document.body).find('.no-print').remove();
                                $(win.document.body).find('table').css({
                                    'width': '100%',
                                    'border-collapse': 'collapse'
                                });
                                $(win.document.body).find('table th, table td').css({
                                    'border': '1px solid #ddd',
                                    'padding': '8px'
                                });
                                $(win.document.body).find('table tr.total-row').css({
                                    'font-weight': 'bold'
                                });
                            }
                        }
                    ]
                },
                "oLanguage": {
                    "oPaginate": {
                        "sPrevious": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>',
                        "sNext": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>'
                    },
                    "sInfo": "Showing page _PAGE_ of _PAGES_",
                    "sSearch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
                    "sSearchPlaceholder": "Search...",
                    "sLengthMenu": "Results :  _MENU_",
                },
                "stripeClasses": [],
                "lengthMenu": [7, 10, 20, 50],
                "pageLength": 7
            });
        });
    </script>
</body>
</html>






