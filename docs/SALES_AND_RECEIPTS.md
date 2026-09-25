# Sales Workflow, Receipt Generation & Mobile Thermal Printing

## 1. Sales Workflow Architecture

MURG Textile Enterprises supports two core sales channels:
1. **Direct POS Sales (Cash, Transfer, Card POS, Split Payments)**
2. **Dealer Credit Sales (Outstanding balance with periodic customer deposits)**

```
                                  [ Select Branch / Store ]
                                             |
                                             v
                           +-----------------------------------+
                           |        POS Cashier Terminal       |
                           +-----------------------------------+
                                             |
                     +-----------------------+-----------------------+
                     |                                               |
             [ Direct / Cash Sale ]                          [ Credit Sale ]
                     |                                               |
         - Enter Buyer Name (Optional)                   - Select Customer / Dealer
         - Scan / Select Products                        - Display Existing Debt Balance
         - Specify Discounts                             - Split Payment (Initial Paid)
         - Split Payment (Cash/POS/Transfer)             - Remainder Added to `outstand`
                     |                                               |
                     +-----------------------+-----------------------+
                                             |
                                             v
                           +-----------------------------------+
                           |    ACID Transaction Commit:       |
                           | 1. Record line items in `orders`  |
                           | 2. Deduct inventory from `stocks` |
                           | 3. Log `stock_movements`          |
                           | 4. Update customer balance        |
                           | 5. Generate Receipt #             |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           |     Print Thermal Receipt (80mm)  |
                           +-----------------------------------+
```

---

## 2. Receipt Data Requirements & Fixes

### 2.1 Legacy Bug: Hardcoded Header
In `system/invoice.php` and `front/invoice.php`, the header was hardcoded:
```html
<h1>MURG TEXTILE ENTERPRISES</h1>
<div class="address">Shop No. 1 & 2 Gidan Murtala Jega, Layin Kwarin Me Shayi, IBB way Kwari Market Kano</div>
```
Regardless of which branch issued the receipt, it always displayed the same shop address.

### 2.2 Multi-Branch Dynamic Receipt Structure
Receipts are now dynamically generated using the **issuing branch's profile**:

| Receipt Element | Data Source |
|---|---|
| **Company & Branch Name** | `MURG TEXTILE ENTERPRISES - [branch.name]` |
| **Branch Physical Address**| `branch.address` |
| **Branch Phone Contacts** | `branch.phone` |
| **Receipt / Invoice No.** | `#` + `orders.orderID` (Unique Timestamp + Random) |
| **Date & Time** | `orders.creation` (e.g. 22 Sep 2026, 02:45 PM) |
| **Issuing Cashier** | `orders.staff` (`facility.name`) |
| **Customer / Buyer** | `orders.buyer_name` or `orders.customer_name` |
| **Sub-Store Location** | `stores.store_name` (e.g. "RUMFA") |
| **Line Items Table** | Item Name, Unit Price, Unit Discount, Qty, Line Total |
| **Financial Summary** | Gross Total, Total Discounts, Net Payable |
| **Payment Breakdown** | Cash, Card POS, Bank Transfer (with Bank Name) |
| **Debt / Credit Balance** | Previous Balance, Amount Paid, New Outstanding Balance |
| **Disclaimer & Barcode** | Branch return policy and barcode/QR code for verification |

---

## 3. Mobile Thermal Printer Support Strategy

The business requires receipts to be printable directly from **Android phones, iPhones, tablets, and desktop terminals** to 58mm and 80mm mobile Bluetooth/Network thermal printers.

### 3.1 Browser & OS Limitations Research

| Platform / Browser | Direct Bluetooth SPP (ESC/POS) | OS Print Dialog (`window.print()`) | Third-Party App Intent |
|---|---|---|---|
| **Android (Chrome / Edge)** | **Yes** via Web Bluetooth API (with user pairing prompt) | **Yes** (via Android Print Spooler / BT Print Service) | **Yes** (via `intent://` or `rawbt:` URL scheme) |
| **iOS (Safari / Chrome on iOS)**| **No** (Apple WebKit blocks Web Bluetooth SPP printer profiles) | **Yes** (AirPrint or AirPrint-compatible thermal printers) | **Yes** (via URL scheme to apps like RawBT or POS-Printer) |
| **Desktop (Windows / Mac)** | **Yes** (via Web Serial, Web Bluetooth, or System Driver) | **Yes** (standard CUPS / Windows print driver) | N/A |

### 3.2 Implemented 3-Tier Printing Architecture

To provide 100% device compatibility without forcing all users to purchase specialized hardware, we implement a **three-tier printing strategy**:

```
                              User Clicks [ Print Receipt ]
                                             |
                 +---------------------------+---------------------------+
                 |                           |                           |
                 v                           v                           v
         [ Tier 1: Universal ]       [ Tier 2: Web Bluetooth ]   [ Tier 3: Native App Helper ]
          Responsive 80mm CSS           Direct ESC/POS stream       RawBT / Print App Scheme
          Works on: All Devices         Works on: Android Chrome    Works on: Dedicated Mobile
          (iOS, Android, PC)            No drivers needed           Fast background printing
```

#### Tier 1: Universal Responsive CSS Web Printing (Default)
* Standard HTML page with CSS `@page { size: 80mm auto; margin: 0; }`.
* Automatically formatted with high-contrast monochrome styles, crisp typography, and barcode rendering.
* Triggered via `window.print()`.
* Works out of the box on iPhone (via AirPrint or AirPrint-enabled Bluetooth adapters) and Android (via Android Print Service / Bluetooth Print plugins).

#### Tier 2: Web Bluetooth ESC/POS Direct Streaming (Chrome on Android / Desktop)
* For Android devices using Google Chrome, the React app uses the **Web Bluetooth API** (`navigator.bluetooth.requestDevice({ filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }] })`).
* A client-side ESC/POS builder converts the receipt JSON into standard thermal command bytes (bolding, centering, cut paper commands `GS V 0`).
* Directly sends raw binary bytes over the Bluetooth GATT Characteristic without triggering any OS print modal.

#### Tier 3: External Helper URI Integration (For Offline / Hardened Mobile Setups)
* Supports custom URL schemes like `rawbt:data:base64,...` for merchants with standard Bluetooth thermal printers on Android.
