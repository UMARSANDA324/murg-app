<?php
include('assets/mashaAllah/gyada.php');

// We want to be very broad here to catch everything the user mentioned and anything similar.
$replacements = [
    'danzango' => 'MURG',
    'Danzango' => 'MURG',
    'DANZANGO' => 'MURG',
    'dansarki' => 'MURG',
    'Dansarki' => 'MURG',
    'DANSARKi' => 'MURG',
    'DANSARKI' => 'MURG',
    'DSK' => 'MURG',
    'DANSARKi GENERAL ENTERPRISES' => 'MURG TEXTILE ENTERPRISES',
    'DANSARKI GENERAL ENTERPRISES' => 'MURG TEXTILE ENTERPRISES',
    'H ALAVES TEXTILE' => 'MURG TEXTILE ENTERPRISES',
    'H. ALAVES FASHION TEXTILE' => 'MURG TEXTILE ENTERPRISES',
    'H ALAVES FASHION TEXTILE' => 'MURG TEXTILE ENTERPRISES',
    'H. ALAVES TEXTILE' => 'MURG TEXTILE ENTERPRISES'
];

$tables_query = mysqli_query($con, "SHOW TABLES");
while ($table_row = mysqli_fetch_row($tables_query)) {
    $table = $table_row[0];
    $columns_query = mysqli_query($con, "SHOW COLUMNS FROM `$table`");
    while ($column_row = mysqli_fetch_assoc($columns_query)) {
        $column = $column_row['Field'];
        $type = $column_row['Type'];
        
        // Only update text/char columns
        if (strpos($type, 'char') !== false || strpos($type, 'text') !== false) {
            foreach ($replacements as $old => $new) {
                // MySQL REPLACE is case-sensitive, so we need to run it for each variant
                $update_sql = "UPDATE `$table` SET `$column` = REPLACE(`$column`, '$old', '$new') WHERE `$column` LIKE '%$old%'";
                if (mysqli_query($con, $update_sql)) {
                    $affected = mysqli_affected_rows($con);
                    if ($affected > 0) {
                        echo "Updated $affected rows in $table.$column: '$old' -> '$new'\n";
                    }
                } else {
                    echo "Error updating $table.$column: " . mysqli_error($con) . "\n";
                }
            }
        }
    }
}
echo "Database update complete.\n";
?>
