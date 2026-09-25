<?php
include('../assets/mashaAllah/gyada.php');
session_start();
error_reporting(0);

$did = intval($_GET['id']);
$orderId = $_GET['orderid'];

$order_query = $con->query("SELECT * FROM orders WHERE staffID='$did' AND orderID='$orderId' ");
$order_row = $order_query->fetch_array();
?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MURG TEXTILE ENTERPRISES - Receipt</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');


        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
        }

        body {
            background-color: #f5f5f5;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            color: #333;
            margin: 0;
            padding: 10px 0;
            line-height: 1.3;
        }

        .receipt-container {
            background: #fff;
            width: 80mm;
            margin: 0 auto;
            padding: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }

        .header {
            text-align: center;
            margin-bottom: 8px;
            border-bottom: 1px dashed #ddd;
            padding-bottom: 8px;
        }

        .header img {
            width: 110px;
            height: auto;
            display: block;
            margin: 0 auto 5px;
            filter: grayscale(100%);
        }

        .header h1 {
            font-size: 18px;
            font-weight: 700;
            margin: 0;
            color: #000;
            text-transform: uppercase;
        }

        .header p {
            margin: 2px 0;
            font-size: 11px;
            color: #666;
            font-style: italic;
        }

        .meta-info {
            margin-bottom: 10px;
            font-size: 12px;
        }

        .meta-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
        }

        .meta-label {
            color: #777;
            font-weight: 600;
        }

        .meta-value {
            color: #000;
            font-weight: 700;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }

        .items-table th {
            text-align: left;
            border-bottom: 1px solid #000;
            padding: 6px 0;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .items-table td {
            padding: 4px 0;
            border-bottom: 1px solid #eee;
            vertical-align: top;
        }

        .item-name {
            font-weight: 600;
            display: block;
        }

        .item-details {
            font-size: 11px;
            color: #666;
        }

        .text-right {
            text-align: right;
        }

        .totals-section {
            border-top: 2px solid #000;
            padding-top: 5px;
            margin-bottom: 10px;
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
        }

        .total-row.grand-total {
            margin-top: 5px;
            padding: 8px 0;
            border-top: 1px solid #eee;
            font-size: 16px;
            font-weight: 800;
            color: #000;
        }

        .footer {
            text-align: center;
            font-size: 11px;
            color: #888;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #ddd;
        }

        .footer p {
            margin: 3px 0;
        }

        .print-btn-container {
            text-align: center;
            margin-top: 20px;
        }

        .print-btn {
            background: #000;
            color: #fff;
            padding: 10px 25px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: 0.3s;
        }

        .print-btn:hover {
            background: #333;
        }

        .payment-status {
            text-align: center;
            margin: 10px 0;
            font-weight: 700;
            text-transform: uppercase;
            border: 1px solid #000;
            padding: 5px;
            letter-spacing: 2px;
        }

        @media print {
            @page {
                margin: 0;
                size: 80mm auto;
            }

            .no-print {
                display: none !important;
            }

            body {
                margin: 0 !important;
                padding: 0 !important;
                background-color: #fff !important;
            }

            .receipt-container {
                width: 100% !important;
                margin: 0 !important;
                padding: 5px !important;
                box-shadow: none !important;
            }

            .header img {
                width: 80px !important;
                height: auto !important;
                display: block !important;
                margin: 0 auto 5px auto !important;
                filter: grayscale(100%) contrast(1.2) !important;
                -webkit-filter: grayscale(100%) contrast(1.2) !important;
            }
        }
    </style>
</head>

<body>

    <div class="receipt-container">
        <div class="header">
            <img src="assets/img/murglogo.jpg" alt="Logo">
            <h1>MURG TEXTILE ENTERPRISES</h1>
            <p><b>Dealer in all kind of fabrics Shadda, Swiss, Coco-Shampo, Gezner, Men-lace & many more</b></p>
            <p><b>shop No. 1 & 2 Gidan Murtala Jega, Layin kwari me shayi IBB way Kwari Market, Kano</b></p>
            <p><b>08025493838, 08161792263</b></p>
        </div>

        <div class="meta-info">
            <div class="meta-line">
                <span class="meta-label">Receipt No:</span>
                <span class="meta-value">#<?php echo $order_row['orderID']; ?></span>
            </div>
            <div class="meta-line">
                <span class="meta-label">Date:</span>
                <span class="meta-value"><?php echo date('d M Y, h:i A', strtotime($order_row['creation'])); ?></span>
            </div>
            <div class="meta-line">
                <span class="meta-label">Staff:</span>
                <span class="meta-value"><?php echo htmlspecialchars($_SESSION['name']); ?></span>
            </div>
            <div class="meta-line">
                <span class="meta-label">Customer:</span>
                <span class="meta-value"><?php echo htmlspecialchars($order_row['buyer_name'] ?? 'Guest'); ?></span>
            </div>
        </div>

        <div class="payment-status">
            <?php echo ($order_row['payment'] == 'Split Payment') ? 'Invoice' : htmlspecialchars($order_row['payment']); ?>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th>Item Description</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                <?php
                $sql = mysqli_query($con, "SELECT * FROM orders WHERE orderID='$orderId' ");
                $subtotal = 0;
                while ($row = mysqli_fetch_array($sql)) {
                    $itemTotal = $row['price'] * $row['quantity'];
                    $subtotal += $itemTotal;
                    ?>
                    <tr>
                        <td>
                            <span class="item-name"><?php echo htmlspecialchars($row['item']); ?></span>
                        </td>
                        <td class="text-right"><?php echo number_format($row['quantity']); ?></td>
                        <td class="text-right">₦<?php echo number_format($row['price']); ?></td>
                        <td class="text-right">₦<?php echo number_format($itemTotal); ?></td>
                    </tr>
                <?php } ?>
            </tbody>
        </table>

        <div class="totals-section">
            <div class="total-row">
                <span>Subtotal</span>
                <span>₦<?php echo number_format($subtotal); ?></span>
            </div>
            <?php if ($order_row['discount'] > 0): ?>
                <div class="total-row">
                    <span>Discount</span>
                    <span>- ₦<?php echo number_format($order_row['discount']); ?></span>
                </div>
            <?php endif; ?>

            <div class="total-row grand-total">
                <span>TOTAL</span>
                <span>₦<?php echo number_format($subtotal - $order_row['discount']); ?></span>
            </div>

            <div style="margin-top: 10px; font-size: 11px; color: #555;">
                <div class="total-row">
                    <span>Amount Paid</span>
                    <span>₦<?php echo number_format($order_row['amount_paid'] ?? 0); ?></span>
                </div>

                <?php
                $balance = ($subtotal - $order_row['discount']) - ($order_row['amount_paid'] ?? 0);
                if ($balance > 0):
                    ?>
                    <div class="total-row" style="color: red; font-weight: bold;">
                        <span>Balance Due</span>
                        <span>₦<?php echo number_format($balance); ?></span>
                    </div>
                <?php endif; ?>
            </div>
        </div>

        <div class="footer">
            <p>Thank you for your business!</p>
            <p>Powered by <strong>MURG TEXTILE ENTERPRISES</strong></p>
            <p>&copy;Teemassan Tech</p>
        </div>
    </div>

    <div class="print-btn-container no-print">
        <button class="print-btn" onclick="window.print()">Print Receipt</button>
    </div>

    <?php
    $staffID = $_SESSION['id'];
    mysqli_query($con, "UPDATE orders SET status='1' WHERE staffID='$staffID' AND orderID='$orderId'");
    ?>

</body>

</html>

