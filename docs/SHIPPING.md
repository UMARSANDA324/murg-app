# Stock Shipping & Inter-Branch Transfer Architecture

## 1. Overview & Business Objectives

When MURG Textile Enterprises operates multiple physical branches and central warehouses, inventory must frequently move between locations (e.g. from central warehouse in Kwari Market to a retail branch in another commercial district).

The **Shipping & Transfer System** guarantees:
1. **Zero Phantom Inventory**: Stock is never credited to the destination branch until goods are physically inspected, counted, and accepted by authorized staff at the destination.
2. **Accountability**: Every shipment tracks who created it, who approved/dispatched it, driver or tracking notes, and who confirmed receipt.
3. **Discrepancy Resolution**: In cases where quantities received do not match quantities sent (damaged in transit, loss), discrepancies are formally logged and audited.

---

## 2. Shipment Lifecycle & State Machine

```
              +-------------------+
              |       Draft       |  (Created by source branch or admin; editable)
              +-------------------+
                        |
                        | [ Dispatch Shipment ]
                        v
              +-------------------+
              |    In Transit     |  (Deducted from Source Branch; on transit)
              +-------------------+
                   |         |
     [ Accept Goods ]       [ Reject / Cancel ]
                   |         |
                   v         v
+-----------------------+   +-----------------------+
|       Received        |   |       Cancelled       |
| (Credited to Dest)    |   | (Restored to Source)  |
+-----------------------+   +-----------------------+
```

### 2.1 State Definitions & Inventory Effects

| Status | Trigger Event | Source Branch Stock | Destination Branch Stock | Immutable Movement Type |
|---|---|:---:|:---:|---|
| **Draft** | Source staff prepares transfer packing list | Unchanged | Unchanged | None |
| **In Transit** | Source staff or manager clicks "Dispatch" | **Deducted** (`-Qty`) | Unchanged (Not yet arrived) | `STOCK_OUT_TRANSFER` |
| **Received** | Destination staff inspects and accepts goods | Already deducted | **Credited** (`+Qty`) | `STOCK_IN_TRANSFER` |
| **Cancelled** | Shipment aborted before arrival | **Restored** (`+Qty`) | Unchanged | `STOCK_IN_RETURN` |

---

## 3. Database Schema

### 3.1 `shipments` Table
* `id`: Primary key
* `tracking_number`: Human-readable identifier (e.g. `TRF-20260922-0041`)
* `source_branch`: Origin branch (`facilityID`)
* `destination_branch`: Receiving branch (`facilityID`)
* `source_store_id`: Origin sub-store (optional)
* `destination_store_id`: Target sub-store (optional)
* `status`: `Draft`, `In Transit`, `Received`, `Cancelled`
* `created_by`: Staff ID who created draft
* `dispatched_by`: Staff ID who dispatched goods
* `dispatched_at`: Timestamp of dispatch
* `received_by`: Staff ID at destination who verified goods
* `received_at`: Timestamp of physical acceptance
* `notes`: Vehicle plate number, driver contact, transfer remarks

### 3.2 `shipment_items` Table
* `id`: Primary key
* `shipment_id`: Foreign key to `shipments.id`
* `stock_id`: Source product identifier
* `product_name`: Product title cached
* `quantity_sent`: Physical quantity loaded into vehicle
* `quantity_received`: Actual quantity verified upon arrival

---

## 4. Operational Transfer Procedure

### Step 1: Dispatch (Source Branch)
1. Staff selects destination branch and selects products from local inventory.
2. The system verifies that `quantity_sent <= available_stock`.
3. Upon clicking **Dispatch**:
   - Inside an atomic transaction, the source branch's `stocks.quantity` is decremented.
   - An entry is logged in `stock_movements`:
     `facilityID = source_branch`, `movement_type = 'STOCK_OUT_TRANSFER'`, `quantity_change = -quantity_sent`.
   - Shipment status transitions to `In Transit`.
   - A printable **Waybill / Transfer Manifest** is generated.

### Step 2: Receiving & Physical Count (Destination Branch)
1. When goods physically arrive at the destination branch:
   - The destination branch dashboard displays an alert: `"Incoming Shipment TRF-... Ready for Inspection"`.
2. Staff clicks **Inspect & Receive**:
   - The staff enters the physically counted quantity received for each product bolt/belt.
3. Upon clicking **Confirm Receipt**:
   - Inside an atomic transaction:
     - For each product, the destination branch stock record is found or created:
       `UPDATE stocks SET quantity = quantity + quantity_received WHERE name = ? AND facilityID = ?`.
     - An entry is logged in `stock_movements`:
       `facilityID = destination_branch`, `movement_type = 'STOCK_IN_TRANSFER'`, `quantity_change = +quantity_received`.
     - If `quantity_received < quantity_sent`, a discrepancy record is logged with reason notes in `audit_logs`.
     - Shipment status transitions to `Received`.

---

## 5. Security & Isolation in Shipping

* Branch A staff can only create shipments where `source_branch = user.facilityID`.
* Branch B staff can only receive shipments where `destination_branch = user.facilityID`.
* Staff cannot mark their own outgoing shipment as received at another branch.
* The Global Admin has authority to monitor, redirect, or cancel any transfer across all branches.
