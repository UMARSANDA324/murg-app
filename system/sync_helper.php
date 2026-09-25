<?php
session_start();
// error_reporting(0);
include('../assets/mashaAllah/gyada.php');
header('Content-Type: application/json');

// API Configuration
define('ONLINE_API_URL', 'https://aminudogaracompany.com.ng');
define('API_AUTH_TOKEN', 'your_api_auth_token_here');

$response = ['success' => false, 'error' => 'Invalid action'];

try {
    if(isset($_GET['action']) || isset($_POST['action'])) {
        $action = $_GET['action'] ?? $_POST['action'];
        $facilityID = $_SESSION['facilityID'];
        $date = $_GET['date'] ?? $_POST['date'] ?? date('Y-m-d');
        
        switch($action) {
            case 'get_count':
                // Get total orders count for the date
                $sql = "SELECT COUNT(DISTINCT orderID) as count FROM orders 
                        WHERE DATE(creation) = ? AND facilityID = ?";
                $stmt = $con->prepare($sql);
                $stmt->bind_param("si", $date, $facilityID);
                $stmt->execute();
                $result = $stmt->get_result();
                $row = $result->fetch_assoc();
                
                $response = [
                    'success' => true,
                    'count' => $row['count']
                ];
                break;
                
            case 'process_batch':
                $offset = intval($_POST['offset'] ?? 0);
                $limit = intval($_POST['limit'] ?? 20);
                
                // Get a batch of orders
                $sql = "SELECT * FROM orders 
                        WHERE DATE(creation) = ? AND facilityID = ? 
                        ORDER BY creation DESC 
                        LIMIT ?, ?";
                $stmt = $con->prepare($sql);
                $stmt->bind_param("siii", $date, $facilityID, $offset, $limit);
                $stmt->execute();
                $result = $stmt->get_result();
                
                $orders = [];
                while($row = $result->fetch_assoc()) {
                    $orders[] = $row;
                }
                
                if(!empty($orders)) {
                    // Process sync for this batch
                    $syncResult = syncOrdersBatch($orders);
                    
                    $response = [
                        'success' => $syncResult['success'],
                        'processed' => $syncResult['synced_count'],
                        'duplicates' => $syncResult['duplicate_count']
                    ];
                    
                    if(!$syncResult['success']) {
                        $response['error'] = $syncResult['error'];
                    }
                } else {
                    $response = [
                        'success' => true,
                        'processed' => 0,
                        'duplicates' => 0
                    ];
                }
                break;
            case 'get_stocks_count':
                // Get total stocks count
                $sql = "SELECT COUNT(*) as count FROM stocks WHERE facilityID = ?";
                $stmt = $con->prepare($sql);
                $stmt->bind_param("s", $facilityID);
                $stmt->execute();
                $result = $stmt->get_result();
                $row = $result->fetch_assoc();
                
                $response = [
                    'success' => true,
                    'count' => $row['count']
                ];
                break;
                
            case 'process_stocks_batch':
                $offset = intval($_POST['offset'] ?? 0);
                $limit = intval($_POST['limit'] ?? 20);
                
                // Get a batch of stocks
                $sql = "SELECT * FROM stocks WHERE facilityID = ? LIMIT ?, ?";
                $stmt = $con->prepare($sql);
                $stmt->bind_param("sii", $facilityID, $offset, $limit);
                $stmt->execute();
                $result = $stmt->get_result();
                
                $stocks = [];
                while($row = $result->fetch_assoc()) {
                    $stocks[] = $row;
                }
                
                if(!empty($stocks)) {
                    // Process sync for this batch
                    $syncResult = syncStocksBatch($stocks);
                    
                    $response = [
                        'success' => $syncResult['success'],
                        'processed' => $syncResult['synced_count'],
                        'duplicates' => $syncResult['duplicate_count']
                    ];
                    
                    if(!$syncResult['success']) {
                        $response['error'] = $syncResult['error'];
                    }
                } else {
                    $response = [
                        'success' => true,
                        'processed' => 0,
                        'duplicates' => 0
                    ];
                }
                break;
            case 'get_expenses_count':
                // Get total orders count for the date
                $sql = "SELECT COUNT(id) as count FROM expense 
                        WHERE DATE(creation) = ? AND facilityID = ?";
                $stmt = $con->prepare($sql);
                $stmt->bind_param("si", $date, $facilityID);
                $stmt->execute();
                $result = $stmt->get_result();
                $row = $result->fetch_assoc();
                
                $response = [
                    'success' => true,
                    'count' => $row['count']
                ];
                break;
            case 'process_expenses_batch':
                $offset = intval($_POST['offset'] ?? 0);
                $limit = intval($_POST['limit'] ?? 20);
                
                // Get a batch of expenses
                $sql = "SELECT * FROM expense 
                        WHERE DATE(creation) = ? AND facilityID = ? 
                        ORDER BY creation DESC 
                        LIMIT ?, ?";
                $stmt = $con->prepare($sql);
                $stmt->bind_param("siii", $date, $facilityID, $offset, $limit);
                $stmt->execute();
                $result = $stmt->get_result();
                
                $orders = [];
                while($row = $result->fetch_assoc()) {
                    $orders[] = $row;
                }
                
                if(!empty($orders)) {
                    // Process sync for this batch
                    $facilityID = $_SESSION['facilityID'];
                    $syncResult = syncExpensesToOnline($facilityID);
                    
                    $response = [
                        'success' => $syncResult['success'],
                        'processed' => $syncResult['synced_count'],
                        'duplicates' => $syncResult['duplicate_count']
                    ];
                    
                    if(!$syncResult['success']) {
                        $response['error'] = $syncResult['error'];
                    }
                } else {
                    $response = [
                        'success' => true,
                        'processed' => 0,
                        'duplicates' => 0
                    ];
                }
                break;
                
            
                default:
                $response['error'] = 'Unknown action';
        }
    }
} catch(Exception $e) {
    $response['error'] = $e->getMessage();
}

echo json_encode($response);

function syncOrdersBatch($orders) {
    global $con;
    
    $response = [
        'success' => false,
        'synced_count' => 0,
        'duplicate_count' => 0,
        'error' => ''
    ];
    
    // Group orders by orderID
    $ordersByID = [];
    foreach($orders as $row) {
        $ordersByID[$row['orderID']][] = $row;
    }
    
    // First check which orders already exist online
    $existingOrders = checkExistingOrdersOnline(array_keys($ordersByID));
    $response['duplicate_count'] = count($existingOrders);
    
    // Prepare orders to sync (filter out existing ones)
    $ordersToSync = [];
    foreach($ordersByID as $orderID => $orderItems) {
        if(!in_array($orderID, $existingOrders)) {
            // Since we're using a single table structure now, we can send each item as a separate order
            foreach($orderItems as $item) {
                $orderData = [
                    'facilityID' => $item['facilityID'],
                    'staffID' => $item['staffID'],
                    'staff' => $item['staff'],
                    'orderID' => $item['orderID'],
                    'discount' => $item['discount'] ?? 0,
                    'status' => $item['status'] ?? 'completed',
                    'customerID' => $item['customerID'] ?? null,
                    'customer_name' => $item['customer_name'] ?? null,
                    'buyer_name' => $item['buyer_name'] ?? null,
                    'amount_paid' => $item['amount_paid'] ?? 0,
                    'change_given' => $item['change_given'] ?? 0,
                    'net_total' => $item['net_total'] ?? ($item['subtotal'] - ($item['discount'] ?? 0)),
                    'bank_name' => $item['bank_name'] ?? null,
                    'payment' => $item['payment'],
                    'cash' => $item['cash'],
                    'pos' => $item['pos'],
                    'transfer' => $item['transfer'],
                    'creation' => $item['creation'],
                    'item' => $item['item'],
                    'price' => $item['price'],
                    'quantity' => $item['quantity'],
                    'subtotal' => $item['subtotal']
                ];
                
                $ordersToSync[] = $orderData;
            }
        }
    }
    
    if(!empty($ordersToSync)) {
        $apiResponse = sendOrdersToOnlineAPI($ordersToSync);
        
        if($apiResponse['success']) {
            $response['synced_count'] = count($ordersToSync);
            $response['success'] = true;
            
            // Mark orders as synced in local database
            foreach($ordersToSync as $order) {
                markOrderAsSynced($order['orderID']);
            }
        } else {
            $response['error'] = $apiResponse['error'];
        }
    } else {
        $response['success'] = true;
    }
    
    return $response;
}

/**
 * Sync orders to online database via API
 */
function syncOrdersToOnline($orders) {
    global $con;
    
    $response = [
        'success' => false,
        'synced_count' => 0,
        'duplicate_count' => 0,
        'error' => ''
    ];
    
    // Group orders by orderID
    $ordersByID = [];
    while($row = mysqli_fetch_assoc($orders)) {
        $ordersByID[$row['orderID']][] = $row;
    }
    
    // First check which orders already exist online
    $existingOrders = checkExistingOrdersOnline(array_keys($ordersByID));
    $response['duplicate_count'] = count($existingOrders);
    
    // Prepare orders to sync (filter out existing ones)
    $ordersToSync = [];
    foreach($ordersByID as $orderID => $orderItems) {
        if(!in_array($orderID, $existingOrders)) {
            // Combine items for the same order
            $firstItem = $orderItems;
            $orderData = [
                'facilityID' => $firstItem['facilityID'],
                'staffID' => $firstItem['staffID'],
                'staff' => $firstItem['staff'],
                'orderID' => $firstItem['orderID'],
                'discount' => $firstItem['discount'],
                'status' => $firstItem['status'],
                'customerID' => $firstItem['customerID'],
                'customer_name' => $firstItem['customer_name'],
                'buyer_name' => $firstItem['buyer_name'],
                'amount_paid' => $firstItem['amount_paid'],
                'change_given' => $firstItem['change_given'],
                'net_total' => $firstItem['net_total'],
                'bank_name' => $firstItem['bank_name'],
                'payment' => $firstItem['payment'],
                'creation' => $firstItem['creation'],
                'item' => $firstItem['item'],
                'price' => $firstItem['price'],
                'quantity' => $firstItem['quantity'],
                'subtotal' => $firstItem['subtotal']
            ];
            
            // foreach($orderItems as $item) {
            //     $orderData['items'][] = [
            //         'item' => $item['item'],
            //         'price' => $item['price'],
            //         'quantity' => $item['quantity'],
            //         'subtotal' => $item['subtotal']
            //     ];
            // }
            
            $ordersToSync[] = $orderData;
        }
    }
    
    if(empty($ordersToSync)) {
        $response['success'] = true;
        return $response;
    }
    
    // Sync orders in batches
    $batchSize = 20;
    $batches = array_chunk($ordersToSync, $batchSize);
    
    foreach($batches as $batch) {
        $apiResponse = sendOrdersToOnlineAPI($batch);
        
        if($apiResponse['success']) {
            $response['synced_count'] += count($batch);
            
            // Mark orders as synced in local database
            foreach($batch as $order) {
                markOrderAsSynced($order['orderID']);
            }
            
            $response['success'] = true;
        } else {
            $response['error'] = $apiResponse['error'];
            $response['success'] = false;
            break;
        }
    }
    
    return $response;
}

/**
 * Check which orders already exist in online database
 */
function checkExistingOrdersOnline($orderIDs) {
    if(empty($orderIDs)) return [];
    
    $ch = curl_init();
    $url = ONLINE_API_URL.'/check-existing?orderIDs='.implode(',', $orderIDs);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        $data = json_decode($response, true);
        return $data['existing_orderIDs'] ?? [];
    }
    
    return [];
}

/**
 * Send orders to online API
 */
function sendOrdersToOnlineAPI($orders) {
    $ch = curl_init();
    $url = ONLINE_API_URL.'/bulk-create';
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['orders' => $orders]),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        return ['success' => true];
    } else {
        $error = "API Error: HTTP $httpCode";
        if($response) {
            $data = json_decode($response, true);
            $error = $data['error'] ?? $error;
        }
        return ['success' => false, 'error' => $error];
    }
}

/**
 * Mark order as synced in local database
 */
function markOrderAsSynced($orderID) {
    global $con;
    
    $query = "UPDATE orders SET sync_status = 'synced', last_sync = NOW() WHERE orderID = ?";
    $stmt = $con->prepare($query);
    $stmt->bind_param("s", $orderID);
    $stmt->execute();
}

function syncStocksBatch($stocks) {
    global $con, $facilityID;
    
    $response = [
        'success' => false,
        'synced_count' => 0,
        'duplicate_count' => 0,
        'error' => ''
    ];
    
    // First check which stocks already exist online
    $stockNames = array_column($stocks, 'name');
    $existingStocks = checkExistingStocksOnline($stockNames);
    $response['duplicate_count'] = count($existingStocks);
    
    // Prepare stocks to sync (filter out existing ones)
    $stocksToSync = [];
    foreach($stocks as $stock) {
        if(!in_array($stock['name'], $existingStocks)) {
            $stocksToSync[] = [
                'facilityID' => $stock['facilityID'],
                'name' => $stock['name'],
                'buying' => $stock['buying'],
                'selling' => $stock['selling'],
                'quantity' => $stock['quantity'],
                'Bsubtotal' => $stock['Bsubtotal'],
                'Ssubtotal' => $stock['Ssubtotal'],
                'expiry' => $stock['expiry'] ?? null,
                'creation' => $stock['creation']
            ];
        }
    }
    
    if(!empty($stocksToSync)) {
        $apiResponse = sendStocksToOnlineAPI($stocksToSync);
        
        if($apiResponse['success']) {
            $response['synced_count'] = count($stocksToSync);
            $response['success'] = true;
            
            // Mark stocks as synced in local database
            foreach($stocksToSync as $stock) {
                markStockAsSynced($stock['name'], $facilityID);
            }
        } else {
            $response['error'] = $apiResponse['error'];
        }
    } else {
        $response['success'] = true;
    }
    
    return $response;
}


/**
 * Sync stocks to online database via API
 */
function syncStocksToOnline($facilityID) {
    global $con;
    
    $response = [
        'success' => false,
        'inserted_count' => 0,
        'updated_count' => 0,
        'skipped_count' => 0,
        'error' => ''
    ];
    
    // Get all stocks for the facility
    $sql = "SELECT * FROM stocks WHERE facilityID = '$facilityID'";
    $result = mysqli_query($con, $sql);
    
    $stocks = [];
    while($row = mysqli_fetch_assoc($result)) {
        $stocks[] = [
            'name' => $row['name'],
            'buying' => $row['buying'],
            'selling' => $row['selling'],
            'quantity' => $row['quantity'],
            'Bsubtotal' => $row['Bsubtotal'],
            'Ssubtotal' => $row['Ssubtotal'],
            'expiry' => $row['expiry'],
            'creation' => $row['creation']
        ];
    }
    
    if(empty($stocks)) {
        $response['success'] = true;
        return $response;
    }
    
    // Prepare payload
    $payload = [
        'facilityID' => $facilityID,
        'stocks' => $stocks
    ];
    
    // Send to online API
    $apiResponse = sendStocksToOnlineAPI($payload);
    
    if($apiResponse['success']) {
        $response['success'] = true;
        $response['inserted_count'] = $apiResponse['inserted_count'];
        $response['updated_count'] = $apiResponse['updated_count'];
        $response['skipped_count'] = $apiResponse['skipped_count'];
        
        // Mark stocks as synced in local database
        foreach($stocks as $stock) {
            markStockAsSynced($stock['name'], $facilityID);
        }
    } else {
        $response['error'] = $apiResponse['error'];
    }
    
    return $response;
}

/**
 * Send stocks to online API (updated for create/update)
 */
function sendStocksToOnlineAPI($payload) {
    $ch = curl_init();
    $url = ONLINE_API_URL.'/api/stocks/bulk-create-update';
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['stocks' => $payload]),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        $data = json_decode($response, true);
        return [
            'success' => true,
            'inserted_count' => $data['inserted_count'] ?? 0,
            'updated_count' => $data['updated_count'] ?? 0,
            'skipped_count' => $data['skipped_count'] ?? 0
        ];
    } else {
        $error = "API Error: HTTP $httpCode";
        if($response) {
            $data = json_decode($response, true);
            $error = $data['error'] ?? $error;
        }
        return ['success' => false, 'error' => $error];
    }
}

/**
 * Check which stocks already exist in online database
 */
function checkExistingStocksOnline($stockNames) {
    if(empty($stockNames)) return [];
    
    $ch = curl_init();
    $url = ONLINE_API_URL.'/api/stocks/check-existing?names='.implode(',', $stockNames);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        $data = json_decode($response, true);
        return $data['existing_stocks'] ?? [];
    }
    
    return [];
}

/**
 * Mark stock as synced in local database
 */
function markStockAsSynced($stockName, $facilityID) {
    global $con;
    
    $query = "UPDATE stocks SET sync_status = 'synced', last_sync = NOW() WHERE name = ? AND facilityID = ?";
    $stmt = $con->prepare($query);
    $stmt->bind_param("ss", $stockName, $facilityID);
    $stmt->execute();
}

/**
 * Sync expenses to online database via API
 */
function syncExpensesToOnline($facilityID) {
    global $con;
    
    $response = [
        'success' => false,
        'synced_count' => 0,
        'duplicate_count' => 0,
        'error' => ''
    ];
    
    // Get all expenses for the facility
    $sql = "SELECT * FROM expense WHERE facilityID = '$facilityID'";
    $result = mysqli_query($con, $sql);
    
    $expenses = [];
    while($row = mysqli_fetch_assoc($result)) {
        $expenses[] = $row;
    }
    
    if(empty($expenses)) {
        $response['success'] = true;
        return $response;
    }
    
    // First check which expenses already exist online
    $expenseIDs = array_column($expenses, 'id');
    $existingExpenses = checkExistingExpensesOnline($expenseIDs);
    $response['duplicate_count'] = count($existingExpenses);
    
    // Prepare expenses to sync (filter out existing ones)
    $expensesToSync = [];
    foreach($expenses as $expense) {
        if(!in_array($expense['id'], $existingExpenses)) {
            $expenseData = [
                'facilityID' => $expense['facilityID'],
                'id' => $expense['id'],
                'item' => $expense['item'],
                'price' => $expense['price'],
                'type' => $expense['type'],
                'creation' => $expense['creation']
            ];
            $expensesToSync[] = $expenseData;
        }
    }
    
    if(!empty($expensesToSync)) {
        $apiResponse = sendExpensesToOnlineAPI($expensesToSync);
        
        if($apiResponse['success']) {
            $response['synced_count'] = count($expensesToSync);
            $response['success'] = true;
            
            // Mark expenses as synced in local database
            foreach($expensesToSync as $expense) {
                markExpenseAsSynced($expense['id'], $facilityID);
            }
        } else {
            $response['error'] = $apiResponse['error'];
        }
    } else {
        $response['success'] = true;
    }
    
    return $response;
}

/**
 * Check which expenses already exist in online database
 */
function checkExistingExpensesOnline($expenseIDs) {
    if(empty($expenseIDs)) return [];
    
    $ch = curl_init();
    $url = ONLINE_API_URL.'/api/expenses/check-existing?ids='.implode(',', $expenseIDs);
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        $data = json_decode($response, true);
        return $data['existing_expenseIDs'] ?? [];
    }
    
    return [];
}

/**
 * Send expenses to online API
 */
function sendExpensesToOnlineAPI($expenses) {
    $ch = curl_init();
    $url = ONLINE_API_URL.'/api/expenses/bulk-create';
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['expenses' => $expenses]),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer '.API_AUTH_TOKEN,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if($httpCode == 200) {
        return ['success' => true];
    } else {
        $error = "API Error: HTTP $httpCode";
        if($response) {
            $data = json_decode($response, true);
            $error = $data['error'] ?? $error;
        }
        return ['success' => false, 'error' => $error];
    }
}

/**
 * Mark expense as synced in local database
 */
function markExpenseAsSynced($expenseID, $facilityID) {
    global $con;
    
    $query = "UPDATE expense SET sync_status = 'synced', last_sync = NOW() WHERE id = ? AND facilityID = ?";
    $stmt = $con->prepare($query);
    $stmt->bind_param("ss", $expenseID, $facilityID);
    $stmt->execute();
}


?>
