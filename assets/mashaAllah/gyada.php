<?php
date_default_timezone_set('Africa/Lagos');

// Database configuration - supports both local and online environments
if (file_exists(__DIR__ . '/../../db_config.php')) {
    // Use online configuration if exists
    include(__DIR__ . '/../../db_config.php');
} else {
    // Use local configuration
    define('DB_SERVER','localhost');
    define('DB_USER','root');
    define('DB_PASS' ,'');
    define('DB_NAME', 'murg');
}

$con = mysqli_connect(DB_SERVER,DB_USER,DB_PASS,DB_NAME);
// Check connection
if (mysqli_connect_errno())
{
 echo "Failed to connect to MySQL: " . mysqli_connect_error();
}

// Check if 'switch_branch' is set in the URL
if (isset($_GET['switch_branch'])) {
    $branch = mysqli_real_escape_string($con, $_GET['switch_branch']);
    
    if(!empty($branch)){
        // Update the session with the selected branch
        $_SESSION['facilityID'] = $branch;
    }else{
        // Update the session with the selected branch
        unset($_SESSION['facilityID']);
    }
    
    // Redirect to the same page to avoid issues with the query string
    header("Location: " . $_SERVER['PHP_SELF']);
    exit;
}

// Retrieve the selected branch from the session
$facilityID = isset($_SESSION['facilityID']) ? $_SESSION['facilityID'] : null;
?>
