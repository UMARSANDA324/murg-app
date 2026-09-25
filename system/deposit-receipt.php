<?php
include('../assets/mashaAllah/gyada.php');
session_start();
error_reporting(0);

if (strlen($_SESSION['email']) == 0) {
    header('location:../index.php');
    exit;
}

$deposit_id = intval($_GET['id']);

$dep_query = mysqli_query($con, "SELECT d.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.email as customer_email 
                                 FROM deposit_history d 
                                 LEFT JOIN customers c ON d.customerID = c.id 
                                 WHERE d.id = '$deposit_id' LIMIT 1");
$deposit = mysqli_fetch_assoc($dep_query);
?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MURG TEXTILE ENTERPRISES - Deposit Receipt</title>
    <link href="../assets/img/murglogo.jpg" rel="shortcut icon">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
        }

        body {
            background-color: #fff;
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            color: #000;
            margin: 0;
            padding: 20px 0;
            line-height: 1.4;
        }

        .receipt-container {
            background: #fff;
            width: 80mm;
            margin: 0 auto;
            padding: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            border-radius: 8px;
            position: relative;
        }

        .receipt-container::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: #000;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
        }

        .header {
            text-align: center;
            margin-bottom: 5px;
            padding-bottom: 0;
            border-bottom: none;
        }

        .header img {
            width: 85px;
            height: 85px;
            object-fit: contain;
            display: block;
            margin: 0 auto 10px;
            border: 1px solid #000;
            border-radius: 50%;
            padding: 5px;
            filter: grayscale(100%) contrast(1.2);
        }

        .header h1 {
            font-size: 18px;
            font-weight: 800;
            margin: 0 0 5px 0;
            color: #000;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .header .tagline {
            font-size: 11px;
            color: #000;
            font-style: italic;
            font-weight: 600;
            margin: 2px 0;
        }

        .header .address {
            font-size: 10px;
            color: #000;
            font-weight: 600;
            margin: 2px 0;
        }

        .header .contact-info {
            font-size: 10px;
            color: #000;
            font-style: italic;
            font-weight: 600;
            margin: 2px 0;
        }

        .separator {
            border-top: 1px dotted #000;
            margin: 15px 0;
        }

        .meta-section {
            margin-bottom: 12px;
            padding: 0;
        }

        .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 11px;
        }

        .meta-label {
            color: #000;
            font-weight: 600;
        }

        .meta-value {
            color: #000;
            font-weight: 800;
            text-align: right;
        }

        .status-badge {
            display: block;
            width: 100%;
            text-align: center;
            padding: 6px;
            background: #fff;
            color: #000;
            border: 1px solid #000;
            font-weight: 800;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin: 15px 0;
        }

        .totals-container {
            border-top: 2px solid #000;
            padding-top: 8px;
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 11px;
        }

        .total-row.main-total {
            margin-top: 5px;
            padding: 8px 0;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            font-size: 14px;
            font-weight: 800;
            color: #000;
        }

        .payment-breakdown {
            margin-top: 8px;
            padding: 6px;
            background: #fff;
            border-radius: 6px;
            border-left: 3px solid #000;
        }

        .payment-breakdown .total-row {
            font-size: 10px;
            color: #000;
        }

        .signature-section {
            margin-top: 25px;
            text-align: center;
        }

        .signature-line {
            width: 120px;
            border-top: 1px solid #000;
            margin: 0 auto 3px;
        }

        .signature-text {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            color: #000;
        }

        .footer {
            margin-top: 15px;
            text-align: center;
            border-top: 1px solid #000;
            padding-top: 10px;
        }

        .footer .thank-you {
            font-size: 11px;
            font-weight: 700;
            color: #000;
            margin-bottom: 3px;
        }

        .footer small {
            font-size: 8px;
            color: #000;
            display: block;
            line-height: 1.4;
        }

        .print-actions {
            text-align: center;
            margin-top: 30px;
        }

        .btn-print {
            background: #000;
            color: #fff;
            padding: 12px 30px;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 700;
            font-size: 14px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .btn-print:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            background: #222;
        }

        .btn-back {
            display: inline-block;
            background: #6c757d;
            color: #fff;
            padding: 12px 25px;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 700;
            font-size: 14px;
            text-decoration: none;
            margin-left: 10px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .btn-back:hover {
            background: #5a6268;
            color: #fff;
            transform: translateY(-2px);
            text-decoration: none;
        }

        .alert-box {
            padding: 15px;
            border: 1px solid #dc3545;
            background-color: #f8d7da;
            color: #721c24;
            border-radius: 6px;
            text-align: center;
            margin: 20px 0;
        }

        @media print {
            body {
                background: #fff;
                padding: 0;
            }

            .receipt-container {
                box-shadow: none;
                width: 100%;
                padding: 5mm;
                border-radius: 0;
            }

            .receipt-container::before {
                display: none;
            }

            .no-print {
                display: none !important;
            }

            @page {
                margin: 0;
                size: 80mm auto;
            }
        }
    </style>
</head>

<body>

    <div class="receipt-container">
        <div class="header">
            <img src="../assets/img/murglogo.jpg" alt="Logo">
            <h1>MURG TEXTILE ENTERPRISES</h1>
            <div class="tagline">Dealers on Fabrics, Shadda, Swiss, Coco, Shampo, Geznar, Menlace & More</div>
            <div class="address">Shop No. 1 & 2 Gidan Murtala Jega, Layin Kwarin Me Shayi, IBB way Kwari Market Kano</div>
            <div class="contact-info">08025493838, 08161792263</div>
        </div>

        <div class="separator"></div>

        <?php if (!$deposit): ?>
            <div class="alert-box">
                <strong>Error:</strong> Deposit record not found.
            </div>
            <div class="print-actions no-print">
                <a href="customer" class="btn-back" style="margin-left: 0;">Back to Customers</a>
            </div>
        <?php else: ?>

            <div class="meta-section">
                <div class="meta-row">
                    <span class="meta-label">Transaction ID:</span>
                    <span class="meta-value"><?php echo htmlspecialchars($deposit['transaction_id']); ?></span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Date:</span>
                    <span class="meta-value"><?php echo date('d M Y, h:i A', strtotime($deposit['deposit_date'])); ?></span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Processed By:</span>
                    <span class="meta-value"><?php echo htmlspecialchars($deposit['processed_by'] ?: ($_SESSION['name'] ?? 'Staff')); ?></span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Customer:</span>
                    <span class="meta-value"><?php echo htmlspecialchars($deposit['customer_name'] ?? 'N/A'); ?></span>
                </div>
                <?php if (!empty($deposit['customer_phone'])): ?>
                <div class="meta-row">
                    <span class="meta-label">Phone:</span>
                    <span class="meta-value"><?php echo htmlspecialchars($deposit['customer_phone']); ?></span>
                </div>
                <?php endif; ?>
            </div>

            <div class="status-badge">
                DEPOSIT RECEIPT
            </div>

            <div class="totals-container">
                <div class="total-row">
                    <span class="meta-label">Previous Balance:</span>
                    <span class="meta-value">₦<?php echo number_format($deposit['previous_balance'], 2); ?></span>
                </div>
                <div class="total-row main-total">
                    <span>AMOUNT DEPOSITED:</span>
                    <span>₦<?php echo number_format($deposit['amount'], 2); ?></span>
                </div>
                <div class="total-row" style="margin-top: 5px; font-weight: 700;">
                    <span class="meta-label">Remaining Balance:</span>
                    <span class="meta-value">
                        <?php 
                        if ($deposit['new_balance'] < 0) {
                            echo 'Credit: ₦' . number_format(abs($deposit['new_balance']), 2);
                        } elseif ($deposit['new_balance'] == 0) {
                            echo '₦0.00 (Cleared)';
                        } else {
                            echo '₦' . number_format($deposit['new_balance'], 2);
                        }
                        ?>
                    </span>
                </div>

                <div class="payment-breakdown">
                    <div class="total-row">
                        <span>Payment Method:</span>
                        <span style="font-weight: 700;"><?php echo htmlspecialchars($deposit['payment_method'] ?: 'N/A'); ?></span>
                    </div>
                    <?php if (!empty($deposit['description']) && $deposit['description'] !== 'N/A' && $deposit['description'] !== '-'): ?>
                    <div class="total-row">
                        <span>Notes / Description:</span>
                        <span><?php echo htmlspecialchars($deposit['description']); ?></span>
                    </div>
                    <?php endif; ?>
                </div>
            </div>

            <div class="signature-section">
                <div class="signature-line"></div>
                <div class="signature-text">Authorized Signature</div>
            </div>

            <div class="footer">
                <div class="thank-you">Thank you for your payment!</div>
                <small>Powered by MURG TEXTILE ENTERPRISES</small>
                <small>&copy; Teemassan Tech</small>
            </div>
        </div>

        <div class="print-actions no-print">
            <button class="btn-print" onclick="window.print()">Print This Receipt</button>
            <?php if (!empty($deposit['customerID'])): ?>
                <a href="view-customer?id=<?php echo $deposit['customerID']; ?>" class="btn-back">Back to Customer</a>
            <?php else: ?>
                <a href="customer" class="btn-back">Back</a>
            <?php endif; ?>
        </div>

        <?php endif; ?>

</body>

</html>
