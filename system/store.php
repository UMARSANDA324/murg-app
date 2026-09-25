<?php
session_start();
// error_reporting(0);
include('../assets/mashaAllah/gyada.php');
if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
} else {
    $facilityID = $_SESSION['facilityID'];

    // Handle new store creation
    if (isset($_POST['submit'])) {
        $store_name = mysqli_real_escape_string($con, $_POST['store_name']);
        $branch_id = mysqli_real_escape_string($con, $_POST['branch_id']);
        $status = mysqli_real_escape_string($con, $_POST['status']);

        // Validate inputs
        if (empty($store_name)) {
            $error = "Store Name is required";
        } elseif (empty($branch_id)) {
            $error = "Branch selection is required";
        } else {
            // Check if branch exists
            $branch_check = mysqli_query($con, "SELECT facilityID FROM branch WHERE facilityID = '$branch_id'");
            if (mysqli_num_rows($branch_check) == 0) {
                $error = "Invalid Branch selected";
            } else {
                // Check for duplicate store name in same branch
                $duplicate_check = mysqli_query($con, "SELECT id FROM stores WHERE store_name = '$store_name' AND branch_id = '$branch_id'");
                if (mysqli_num_rows($duplicate_check) > 0) {
                    $error = "This Store already exists for the selected Branch";
                } else {
                    // Insert new store
                    $sql = mysqli_query($con, "INSERT INTO stores(store_name, branch_id, status) VALUES('$store_name', '$branch_id', '$status')");
                    if ($sql) {
                        $msg = "Store added successfully";
                    } else {
                        $error = "Something went wrong adding store: " . mysqli_error($con);
                    }
                }
            }
        }
    }

    // Handle store update
    if (isset($_POST['update'])) {
        $store_id = intval($_POST['store_id']);
        $store_name = mysqli_real_escape_string($con, $_POST['store_name']);
        $branch_id = mysqli_real_escape_string($con, $_POST['branch_id']);
        $status = mysqli_real_escape_string($con, $_POST['status']);

        // Validate inputs
        if (empty($store_name)) {
            $error = "Store Name is required";
        } elseif (empty($branch_id)) {
            $error = "Branch selection is required";
        } else {
            // Check if branch exists
            $branch_check = mysqli_query($con, "SELECT facilityID FROM branch WHERE facilityID = '$branch_id'");
            if (mysqli_num_rows($branch_check) == 0) {
                $error = "Invalid Branch selected";
            } else {
                // Check for duplicate store name in same branch (excluding current store)
                $duplicate_check = mysqli_query($con, "SELECT id FROM stores WHERE store_name = '$store_name' AND branch_id = '$branch_id' AND id != '$store_id'");
                if (mysqli_num_rows($duplicate_check) > 0) {
                    $error = "This Store already exists for the selected Branch";
                } else {
                    // Update store
                    $sql = mysqli_query($con, "UPDATE stores SET store_name = '$store_name', branch_id = '$branch_id', status = '$status' WHERE id = '$store_id'");
                    if ($sql) {
                        $msg = "Store updated successfully";
                    } else {
                        $error = "Something went wrong updating store: " . mysqli_error($con);
                    }
                }
            }
        }
    }

    // Handle store deactivation
    if (isset($_GET['del'])) {
        $store_id = intval($_GET['id']);
        mysqli_query($con, "UPDATE stores SET status = 'inactive' WHERE id = '$store_id'");
        $msg = "Store deactivated successfully";
    }

    // Handle store activation
    if (isset($_GET['activate'])) {
        $store_id = intval($_GET['id']);
        mysqli_query($con, "UPDATE stores SET status = 'active' WHERE id = '$store_id'");
        $msg = "Store activated successfully";
    }

    // Handle permanent store deletion
    if (isset($_GET['action']) && $_GET['action'] == 'delete_store') {
        $store_id = intval($_GET['id']);
        
        // Check dependency in stocks, cart, and debt_cart
        $stock_dep = mysqli_query($con, "SELECT id FROM stocks WHERE store_id = '$store_id'");
        $cart_dep = mysqli_query($con, "SELECT id FROM cart WHERE store_id = '$store_id'");
        $debt_dep = mysqli_query($con, "SELECT id FROM debt_cart WHERE store_id = '$store_id'");
        
        if (mysqli_num_rows($stock_dep) > 0 || mysqli_num_rows($cart_dep) > 0 || mysqli_num_rows($debt_dep) > 0) {
            $error = "Cannot delete Store: This store is assigned to existing stock or cart items. You can Deactivate it instead.";
        } else {
            $del_sql = mysqli_query($con, "DELETE FROM stores WHERE id = '$store_id'");
            if ($del_sql) {
                $msg = "Store deleted successfully";
            } else {
                $error = "Something went wrong deleting store: " . mysqli_error($con);
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
    <title>MURG TEXTILE ENTERPRISES - Store Management</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <link href="../assets/css/loader.css" rel="stylesheet" type="text/css" />
    <script src="../assets/js/loader.js"></script>
    <link href="https://fonts.googleapis.com/css?family=Quicksand:400,500,600,700&display=swap" rel="stylesheet">
    <link href="../bootstrap/css/bootstrap.min.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/plugins.css" rel="stylesheet" type="text/css" />
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/datatables.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dataTables.responsive.min.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/custom_dt_html5.css">
    <link rel="stylesheet" type="text/css" href="../plugins/table/datatable/dt-global_style.css">
    <link rel="stylesheet" type="text/css" href="../assets/css/widgets/modules-widgets.css">
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
                    <div class="col-xl-12 col-lg-12 col-sm-12 layout-spacing">
                        <div class="widget-content widget-content-area br-6">
                            <?php if ($error) { ?>
                                <strong style="color:red; font-size:18px; margin-top: 15px;"><?php echo $error; ?></strong>
                            <?php } else if ($msg) { ?>
                                <strong style="color:green; font-size:18px; margin-top: 15px;"><?php echo $msg; ?></strong>
                            <?php } ?>
                            
                            <button type="button" class="btn btn-primary mb-4 mr-2" data-toggle="modal" data-target="#storeModal">
                                Add New Store
                            </button>

                            <table id="html5-extension" class="table table-hover non-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th>S/N</th>
                                        <th>Store Name</th>
                                        <th>Branch ID</th>
                                        <th>Branch Name</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php
                                    $sql = mysqli_query($con, "SELECT s.*, b.name as branch_name FROM stores s LEFT JOIN branch b ON s.branch_id = b.facilityID ORDER BY s.id DESC");
                                    $cnt = 1;
                                    while ($row = mysqli_fetch_array($sql)) {
                                    ?>
                                        <tr>
                                            <td class="center"><?php echo $cnt; ?>.</td>
                                            <td><?php echo htmlspecialchars($row['store_name']); ?></td>
                                            <td><?php echo htmlspecialchars($row['branch_id']); ?></td>
                                            <td><?php echo htmlspecialchars($row['branch_name']); ?></td>
                                            <td>
                                                <?php if ($row['status'] == 'active') { ?>
                                                    <span class="badge badge-success">Active</span>
                                                <?php } else { ?>
                                                    <span class="badge badge-secondary">Inactive</span>
                                                <?php } ?>
                                            </td>
                                            <td>
                                                <button type="button" class="btn btn-primary btn-sm" data-toggle="modal" data-target="#editModal" onclick="editStore(<?php echo $row['id']; ?>, '<?php echo htmlspecialchars($row['store_name'], ENT_QUOTES); ?>', '<?php echo htmlspecialchars($row['branch_id'], ENT_QUOTES); ?>', '<?php echo $row['status']; ?>')">Edit</button>
                                                <?php if ($row['status'] == 'active') { ?>
                                                    <a href="store.php?id=<?php echo $row['id']; ?>&del=delete" onClick="return confirm('Are you sure you want to deactivate this store?')" class="btn btn-warning btn-sm">Deactivate</a>
                                                <?php } else { ?>
                                                    <a href="store.php?id=<?php echo $row['id']; ?>&activate=activate" class="btn btn-success btn-sm">Activate</a>
                                                <?php } ?>
                                                <a href="store.php?id=<?php echo $row['id']; ?>&action=delete_store" onClick="return confirm('Are you sure you want to delete Store: <?php echo htmlspecialchars($row['store_name'], ENT_QUOTES); ?>?')" class="btn btn-danger btn-sm">Delete</a>
                                            </td>
                                        </tr>
                                    <?php
                                        $cnt++;
                                    }
                                    ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php include('footer.php'); ?>
    </div>
    
    <!-- Add Store Modal -->
    <div class="modal fade" id="storeModal" tabindex="-1" role="dialog" aria-labelledby="storeModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="storeModalLabel">Add New Store</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form method="POST">
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Store Name</label>
                            <span style="color:red">*</span>
                            <input type="text" class="form-control" name="store_name" required>
                        </div>
                        <div class="form-group">
                            <label>Branch</label>
                            <span style="color:red">*</span>
                            <select name="branch_id" class="form-control" required>
                                <option value="">Select Branch</option>
                                <?php
                                $branchSql = mysqli_query($con, "SELECT * FROM branch");
                                while ($brow = mysqli_fetch_array($branchSql)) {
                                    echo "<option value='{$brow['facilityID']}'>{$brow['facilityID']} - {$brow['name']}</option>";
                                }
                                ?>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select name="status" class="form-control">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
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

    <!-- Edit Store Modal -->
    <div class="modal fade" id="editModal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Store</h5>
                    <button type="button" class="close" data-dismiss="modal">&times;</button>
                </div>
                <form method="POST">
                    <div class="modal-body">
                        <input type="hidden" name="store_id" id="edit_store_id">
                        <div class="form-group">
                            <label>Store Name</label>
                            <span style="color:red">*</span>
                            <input type="text" class="form-control" name="store_name" id="edit_store_name" required>
                        </div>
                        <div class="form-group">
                            <label>Branch</label>
                            <span style="color:red">*</span>
                            <select name="branch_id" class="form-control" id="edit_branch_id" required>
                                <option value="">Select Branch</option>
                                <?php
                                $branchSql = mysqli_query($con, "SELECT * FROM branch");
                                while ($brow = mysqli_fetch_array($branchSql)) {
                                    echo "<option value='{$brow['facilityID']}'>{$brow['facilityID']} - {$brow['name']}</option>";
                                }
                                ?>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select name="status" class="form-control" id="edit_status">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary" name="update">Update</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script src="../assets/js/libs/jquery-3.1.1.min.js"></script>
    <script src="../bootstrap/js/popper.min.js"></script>
    <script src="../bootstrap/js/bootstrap.min.js"></script>
    <script src="../plugins/perfect-scrollbar/perfect-scrollbar.min.js"></script>
    <script src="../assets/js/app.js"></script>
    <script src="../plugins/table/datatable/datatables.js"></script>
    <script src="../plugins/table/datatable/dataTables.responsive.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/dataTables.buttons.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/jszip.min.js"></script>    
    <script src="../plugins/table/datatable/button-ext/buttons.html5.min.js"></script>
    <script src="../plugins/table/datatable/button-ext/buttons.print.min.js"></script>
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

        function editStore(id, storeName, branchId, status) {
            document.getElementById('edit_store_id').value = id;
            document.getElementById('edit_store_name').value = storeName;
            document.getElementById('edit_branch_id').value = branchId;
            document.getElementById('edit_status').value = status;
        }

        $(document).ready(function() {
            App.init();
        });
    </script>
</body>
</html>
