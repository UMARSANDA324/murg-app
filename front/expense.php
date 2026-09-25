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
$from_date = isset($_GET['from_date']) ? mysqli_real_escape_string($con, $_GET['from_date']) : '';
$to_date = isset($_GET['to_date']) ? mysqli_real_escape_string($con, $_GET['to_date']) : '';

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
if ($from_date && $to_date) {
    $query .= " AND DATE(creation) BETWEEN '$from_date' AND '$to_date'";
} else {
    $today = date('Y-m-d');
    $query .= " AND DATE(creation) = '$today'";
}
$query .= " ORDER BY creation DESC";
$sql = mysqli_query($con, $query);

// Calculate totals
$totalQuery = "SELECT SUM(CASE WHEN type='in' THEN price ELSE 0 END) as total_in, SUM(CASE WHEN type='out' THEN price ELSE 0 END) as total_out FROM expense WHERE 1=1";
if ($from_date && $to_date) {
    $totalQuery .= " AND DATE(creation) BETWEEN '$from_date' AND '$to_date'";
} else {
    $today = date('Y-m-d');
    $totalQuery .= " AND DATE(creation) = '$today'";
}
$totalResult = mysqli_query($con, $totalQuery);
$totals = mysqli_fetch_array($totalResult);

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
            color: #fff;
            opacity: 0.8;
        }
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
                
                <div class="row layout-top-spacing">
                    <!-- Cards -->
                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-primary">
                            <div class="icon text-white"><i class="fas fa-arrow-down"></i></div>
                            <div class="value text-white">₦<?php 
                                $today = date('Y-m-d');
                                $t_in = $con->query("SELECT SUM(price) as total FROM expense WHERE Date(creation)='$today' AND type='in'")->fetch_assoc()['total'];
                                echo number_format($t_in ?: 0); 
                            ?></div>
                            <div class="label">Today's In</div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-danger">
                            <div class="icon text-white"><i class="fas fa-arrow-up"></i></div>
                            <div class="value text-white">₦<?php 
                                $t_out = $con->query("SELECT SUM(price) as total FROM expense WHERE Date(creation)='$today' AND type='out'")->fetch_assoc()['total'];
                                echo number_format($t_out ?: 0); 
                            ?></div>
                            <div class="label">Today's Out</div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-success">
                            <div class="icon text-white"><i class="fas fa-plus-circle"></i></div>
                            <div class="value text-white">₦<?php 
                                $total_in = $con->query("SELECT SUM(price) as total FROM expense WHERE type='in'")->fetch_assoc()['total'];
                                echo number_format($total_in ?: 0); 
                            ?></div>
                            <div class="label">Total In (All Time)</div>
                        </div>
                    </div>

                    <div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-12 layout-spacing">
                        <div class="stat-card bg-warning">
                            <div class="icon text-white"><i class="fas fa-minus-circle"></i></div>
                            <div class="value text-white">₦<?php 
                                $total_out = $con->query("SELECT SUM(price) as total FROM expense WHERE type='out'")->fetch_assoc()['total'];
                                echo number_format($total_out ?: 0); 
                            ?></div>
                            <div class="label">Total Out (All Time)</div>
                        </div>
                    </div>
                </div>

                <div class="row layout-top-spacing" id="cancel-row">
                    <div class="col-xl-12 col-lg-12 col-sm-12 layout-spacing">
                        <?php if ($msg) { ?>
                            <div class="alert alert-success alert-dismissible fade show" role="alert">
                                <?php echo $msg; ?>
                                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                        <?php } ?>
                        <?php if ($error) { ?>
                            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                                <?php echo $error; ?>
                                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                        <?php } ?>

                        <button type="button" class="btn btn-primary mb-4 mr-2 no-print" data-toggle="modal" data-target="#exampleModal">
                            Add New Expense
                        </button>
                        
                        <div class="widget-content widget-content-area br-6">
                            <form method="GET" class="no-print p-3">
                                <div class="row">
                                    <div class="col-md-3">
                                        <label>Type</label>
                                        <select name="type" class="form-control" onchange="this.form.submit()">
                                            <option value="">All Types</option>
                                            <option value="in" <?php echo $typeFilter == 'in' ? 'selected' : ''; ?>>In</option>
                                            <option value="out" <?php echo $typeFilter == 'out' ? 'selected' : ''; ?>>Out</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3">
                                        <label>From Date</label>
                                        <input type="date" name="from_date" class="form-control" value="<?php echo $from_date; ?>" onchange="this.form.submit()">
                                    </div>
                                    <div class="col-md-3">
                                        <label>To Date</label>
                                        <input type="date" name="to_date" class="form-control" value="<?php echo $to_date; ?>" onchange="this.form.submit()">
                                    </div>
                                    <div class="col-md-3">
                                        <a href="expense" class="btn btn-danger mt-4">Reset</a>
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
                                    $pageTotalIn = 0;
                                    $pageTotalOut = 0;
                                    while ($row = mysqli_fetch_array($sql)) {
                                        if ($row['type'] == 'in') $pageTotalIn += $row['price'];
                                        else $pageTotalOut += $row['price'];
                                    ?>
                                    <tr>
                                        <td><?php echo $cnt; ?>.</td>
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
                                            <div class="btn-group">
                                                <button class="btn btn-primary btn-sm" data-toggle="modal" data-target="#editModal<?php echo $row['id']; ?>">Edit</button>
                                                <a href="expense?del=delete&id=<?php echo $row['id']; ?>" onclick="return confirm('Are you sure you want to delete?')" class="btn btn-danger btn-sm">Delete</a>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Edit Modal -->
                                    <div class="modal fade no-print" id="editModal<?php echo $row['id']; ?>" tabindex="-1" role="dialog" aria-hidden="true">
                                        <div class="modal-dialog" role="document">
                                            <div class="modal-content">
                                                <div class="modal-header">
                                                    <h5 class="modal-title">Edit Expense</h5>
                                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                                        <span aria-hidden="true">&times;</span>
                                                    </button>
                                                </div>
                                                <form method="POST">
                                                    <div class="modal-body">
                                                        <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
                                                        <div class="form-group">
                                                            <label>Item <span class="text-danger">*</span></label>
                                                            <input type="text" class="form-control" required name="item" value="<?php echo htmlspecialchars($row['item']); ?>">
                                                        </div>
                                                        <div class="form-group">
                                                            <label>Price <span class="text-danger">*</span></label>
                                                            <input type="number" class="form-control" required name="price" value="<?php echo $row['price']; ?>">
                                                        </div>
                                                        <div class="form-group">
                                                            <label>Type <span class="text-danger">*</span></label>
                                                            <select class="form-control" required name="type">
                                                                <option value="in" <?php echo $row['type'] == 'in' ? 'selected' : ''; ?>>In</option>
                                                                <option value="out" <?php echo $row['type'] == 'out' ? 'selected' : ''; ?>>Out</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer">
                                                        <button class="btn" data-dismiss="modal">Cancel</button>
                                                        <button type="submit" class="btn btn-primary" name="update">Update</button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                    <?php $cnt++; } ?>
                                </tbody>
                                <tfoot>
                                    <tr class="bg-light">
                                        <td colspan="2"><strong>Total In (This View)</strong></td>
                                        <td colspan="4"><strong>₦<?php echo number_format($pageTotalIn); ?></strong></td>
                                    </tr>
                                    <tr class="bg-light">
                                        <td colspan="2"><strong>Total Out (This View)</strong></td>
                                        <td colspan="4"><strong>₦<?php echo number_format($pageTotalOut); ?></strong></td>
                                    </tr>
                                    <tr class="bg-info text-white">
                                        <td colspan="2"><strong>Net Difference</strong></td>
                                        <td colspan="4"><strong>₦<?php echo number_format($pageTotalIn - $pageTotalOut); ?></strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- Add Modal -->
                    <div class="modal fade no-print" id="exampleModal" tabindex="-1" role="dialog" aria-hidden="true">
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">New Expense Information</h5>
                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                        <span aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                                <form method="POST">
                                    <div class="modal-body">
                                        <div class="form-group">
                                            <label>Item <span class="text-danger">*</span></label>
                                            <input type="text" class="form-control" required name="item" placeholder="e.g. Fuel, Maintenance">
                                        </div>
                                        <div class="form-group">
                                            <label>Price <span class="text-danger">*</span></label>
                                            <input type="number" class="form-control" required name="price" placeholder="0.00">
                                        </div>
                                        <div class="form-group">
                                            <label>Type <span class="text-danger">*</span></label>
                                            <select class="form-control" required name="type">
                                                <option value="out">Out (Expenditure)</option>
                                                <option value="in">In (Income/Deposit)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="modal-footer">
                                        <button class="btn" data-dismiss="modal">Discard</button>
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
                        { extend: 'copy', className: 'btn btn-sm', exportOptions: { columns: [0, 1, 2, 3, 4] }},
                        { extend: 'csv', className: 'btn btn-sm', exportOptions: { columns: [0, 1, 2, 3, 4] }},
                        { extend: 'excel', className: 'btn btn-sm', exportOptions: { columns: [0, 1, 2, 3, 4] }},
                        { extend: 'print', className: 'btn btn-sm', exportOptions: { columns: [0, 1, 2, 3, 4] }}
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
                "pageLength": 10
            });
        });
    </script>
</body>
</html>


