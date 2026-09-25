const db = require('../config/database');

/**
 * Generates a human-readable goods request code.
 * Format: GR-YYYYMMDD-NNNNN
 */
function generateRequestCode() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 90000 + 10000));
  return `GR-${datePart}-${rand}`;
}

/**
 * Generates an approval receipt code from a request code.
 * Format: RCP-YYYYMMDD-NNNNN
 */
function generateReceiptCode() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 90000 + 10000));
  return `RCP-${datePart}-${rand}`;
}

/**
 * Generates a final collection receipt code.
 * Format: COL-YYYYMMDD-NNNNN
 */
function generateCollectionCode() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 90000 + 10000));
  return `COL-${datePart}-${rand}`;
}

class GoodsRequestRepository {
  /**
   * Create a new goods request from a staff member.
   * stockId is nullable for CUSTOM product requests.
   * productSource must be 'CATALOG' or 'CUSTOM'.
   * Staff identity (staffId, staffName, requestingBranch) comes ONLY from JWT — never from client.
   */
  async createRequest({
    staffId,
    staffName,
    requestingBranch,
    stockId,
    productName,
    productSource = 'CATALOG',
    requestedQuantity,
    unitType = 'belt',
    reason = '',
  }) {
    const requestCode = generateRequestCode();

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Get requesting branch display name for the notification message
      const [branchRows] = await conn.query(
        'SELECT name FROM branch WHERE facilityID = ? LIMIT 1',
        [requestingBranch]
      );
      const branchName = branchRows[0]?.name || requestingBranch;

      const [result] = await conn.query(
        `INSERT INTO goods_requests
         (request_code, staff_id, staff_name, requesting_branch, stock_id, product_source, product_name,
          requested_quantity, unit_type, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [requestCode, staffId, staffName, requestingBranch, stockId || null,
         productSource, productName, requestedQuantity, unitType, reason]
      );

      const requestId = result.insertId;

      // Notify all Global Admins about the new request
      // The notification message is rich enough for the Admin to understand the request
      const notifTitle = `New Goods Request — ${branchName}`;
      const notifMessage =
        `Staff: ${staffName}\n` +
        `Branch: ${branchName} (${requestingBranch})\n` +
        `Product: ${productName}${productSource === 'CUSTOM' ? ' [Custom]' : ''}\n` +
        `Quantity: ${requestedQuantity} ${unitType}(s)\n` +
        `Reason: ${reason || 'N/A'}\n` +
        `Requested: ${new Date().toLocaleString('en-GB')}`;

      await conn.query(
        `INSERT INTO notifications (role_target, title, message, type, reference_id)
         VALUES ('Admin', ?, ?, 'GOODS_REQUEST', ?)`,
        [notifTitle, notifMessage, String(requestId)]
      );

      await conn.commit();
      return { id: requestId, requestCode };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Find requests submitted by a specific staff member or branch.
   */
  async findByStaff({ staffId = null, branchId = null, limit = 50 }) {
    let sql = `
      SELECT gr.*,
             b.name as requesting_branch_name,
             sb.name as source_branch_name,
             fa.name as approved_by_name_display,
             fr.name as released_by_name_display
      FROM goods_requests gr
      LEFT JOIN branch b ON gr.requesting_branch = b.facilityID
      LEFT JOIN branch sb ON gr.source_branch = sb.facilityID
      LEFT JOIN facility fa ON gr.approved_by = fa.id
      LEFT JOIN facility fr ON gr.released_by = fr.id
      WHERE 1=1
    `;
    const params = [];

    if (staffId) {
      sql += ' AND gr.staff_id = ?';
      params.push(staffId);
    }
    if (branchId) {
      sql += ' AND gr.requesting_branch = ?';
      params.push(branchId);
    }

    sql += ' ORDER BY gr.id DESC LIMIT ?';
    params.push(limit);

    const [rows] = await db.query(sql, params);
    return rows;
  }

  /**
   * Find all requests for Admin review.
   */
  async findAll({ status = null, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT gr.*,
             b.name as requesting_branch_name,
             sb.name as source_branch_name,
             fa.name as approved_by_name_display
      FROM goods_requests gr
      LEFT JOIN branch b ON gr.requesting_branch = b.facilityID
      LEFT JOIN branch sb ON gr.source_branch = sb.facilityID
      LEFT JOIN facility fa ON gr.approved_by = fa.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND gr.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY gr.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    return rows;
  }

  /**
   * Find requests visible to a source branch (for release interface).
   * Returns APPROVED requests where source_branch matches the authenticated staff branch.
   */
  async findApprovedForBranch({ sourceBranch, limit = 50 } = {}) {
    const [rows] = await db.query(
      `SELECT gr.*,
              b.name as requesting_branch_name,
              sb.name as source_branch_name,
              fa.name as approved_by_name_display
       FROM goods_requests gr
       LEFT JOIN branch b ON gr.requesting_branch = b.facilityID
       LEFT JOIN branch sb ON gr.source_branch = sb.facilityID
       LEFT JOIN facility fa ON gr.approved_by = fa.id
       WHERE gr.source_branch = ? AND gr.status = 'APPROVED'
       ORDER BY gr.approved_at DESC
       LIMIT ?`,
      [sourceBranch, limit]
    );
    return rows;
  }

  /**
   * Find single goods request by ID — enriched with branch and staff names.
   */
  async findById(id) {
    const [rows] = await db.query(
      `SELECT gr.*,
              b.name as requesting_branch_name,
              sb.name as source_branch_name,
              fa.name as approved_by_name_display,
              fr.name as released_by_name_display
       FROM goods_requests gr
       LEFT JOIN branch b ON gr.requesting_branch = b.facilityID
       LEFT JOIN branch sb ON gr.source_branch = sb.facilityID
       LEFT JOIN facility fa ON gr.approved_by = fa.id
       LEFT JOIN facility fr ON gr.released_by = fr.id
       WHERE gr.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find goods request by receipt code (approval receipt).
   * Used by branch staff during the release process.
   */
  async findByReceiptCode(receiptCode) {
    const [rows] = await db.query(
      `SELECT gr.*,
              b.name as requesting_branch_name,
              sb.name as source_branch_name,
              fa.name as approved_by_name_display
       FROM goods_requests gr
       LEFT JOIN branch b ON gr.requesting_branch = b.facilityID
       LEFT JOIN branch sb ON gr.source_branch = sb.facilityID
       LEFT JOIN facility fa ON gr.approved_by = fa.id
       WHERE gr.receipt_code = ?`,
      [receiptCode]
    );
    return rows[0] || null;
  }

  /**
   * Find goods request by collection code (final receipt).
   */
  async findByCollectionCode(collectionCode) {
    const [rows] = await db.query(
      `SELECT gr.*,
              b.name as requesting_branch_name,
              sb.name as source_branch_name,
              fa.name as approved_by_name_display,
              fr.name as released_by_name_display
       FROM goods_requests gr
       LEFT JOIN branch b ON gr.requesting_branch = b.facilityID
       LEFT JOIN branch sb ON gr.source_branch = sb.facilityID
       LEFT JOIN facility fa ON gr.approved_by = fa.id
       LEFT JOIN facility fr ON gr.released_by = fr.id
       WHERE gr.collection_code = ?`,
      [collectionCode]
    );
    return rows[0] || null;
  }

  /**
   * Find eligible source branches that currently have sufficient stock for the requested product.
   * For CATALOG requests: looks up by stock_id.
   */
  async getEligibleBranchesForProduct(stockId, requestedQuantity) {
    const [stockInfo] = await db.query('SELECT name, unit_type FROM stocks WHERE id = ?', [stockId]);
    if (!stockInfo[0]) return [];

    const productName = stockInfo[0].name;

    const [rows] = await db.query(
      `SELECT s.id as stock_id, s.facilityID, b.name as branch_name, s.quantity as available_quantity, s.unit_type, b.sales_mode
       FROM stocks s
       JOIN branch b ON s.facilityID = b.facilityID
       WHERE s.name = ?
         AND s.status = 'active'
         AND b.status = 'active'
         AND CAST(s.quantity AS DECIMAL(15,2)) >= ?
       ORDER BY CAST(s.quantity AS DECIMAL(15,2)) DESC`,
      [productName, requestedQuantity]
    );

    return rows.map((r) => ({
      stockId: r.stock_id,
      facilityID: r.facilityID,
      branchName: r.branch_name,
      availableQuantity: parseFloat(r.available_quantity),
      unitType: r.unit_type,
      salesMode: r.sales_mode,
    }));
  }

  /**
   * Find eligible source branches for a CUSTOM product request, matching by product name.
   */
  async getEligibleBranchesByName(productName, requestedQuantity) {
    const [rows] = await db.query(
      `SELECT s.id as stock_id, s.facilityID, b.name as branch_name, s.quantity as available_quantity, s.unit_type, b.sales_mode
       FROM stocks s
       JOIN branch b ON s.facilityID = b.facilityID
       WHERE s.name = ?
         AND s.status = 'active'
         AND b.status = 'active'
         AND CAST(s.quantity AS DECIMAL(15,2)) >= ?
       ORDER BY CAST(s.quantity AS DECIMAL(15,2)) DESC`,
      [productName, requestedQuantity]
    );

    return rows.map((r) => ({
      stockId: r.stock_id,
      facilityID: r.facilityID,
      branchName: r.branch_name,
      availableQuantity: parseFloat(r.available_quantity),
      unitType: r.unit_type,
      salesMode: r.sales_mode,
    }));
  }

  /**
   * PART 5 — Admin rejects a goods request.
   * Notifies the requesting staff.
   */
  async rejectRequest(id, adminId, adminName, adminNotes = '') {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [grRows] = await conn.query(
        'SELECT * FROM goods_requests WHERE id = ? FOR UPDATE',
        [id]
      );
      if (!grRows[0]) throw new Error('Request not found');

      const gr = grRows[0];
      if (gr.status !== 'PENDING') {
        throw new Error(`Cannot reject request with status '${gr.status}'. Only PENDING requests can be rejected.`);
      }

      await conn.query(
        `UPDATE goods_requests
         SET status = 'REJECTED',
             rejection_reason = ?,
             admin_notes = ?,
             reviewed_by = ?,
             reviewed_at = NOW()
         WHERE id = ?`,
        [adminNotes, adminNotes, adminId, id]
      );

      // Notify requesting staff
      await conn.query(
        `INSERT INTO notifications (user_id, facility_id, title, message, type, reference_id)
         VALUES (?, ?, ?, ?, 'GOODS_REQUEST_REJECTED', ?)`,
        [
          gr.staff_id,
          gr.requesting_branch,
          `Goods Request Rejected — ${gr.request_code}`,
          `Your request ${gr.request_code} for "${gr.product_name}" (Qty: ${parseFloat(gr.requested_quantity)} ${gr.unit_type}s) has been rejected by Admin.\nReason: ${adminNotes || 'No reason provided.'}`,
          String(id),
        ]
      );

      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * PART 6 — Admin approves a goods request.
   * This is the new APPROVED transition:
   *   - Does NOT deduct stock yet.
   *   - Assigns source_branch, source_stock_id, approved_by, approved_at.
   *   - Generates a unique receipt_code (approval receipt).
   *   - Notifies requesting staff with receipt details.
   *
   * Stock deduction happens ONLY during releaseGoods() when the branch actually releases.
   */
  async approveRequest({
    requestId,
    adminId,
    adminName,
    sourceBranch,
    sourceStockId,
    adminNotes = '',
  }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Lock goods request
      const [grRows] = await conn.query(
        'SELECT * FROM goods_requests WHERE id = ? FOR UPDATE',
        [requestId]
      );
      if (!grRows[0]) throw new Error('Goods request not found');

      const gr = grRows[0];
      if (gr.status !== 'PENDING') {
        throw new Error(`Cannot approve request with status '${gr.status}'. Only PENDING requests can be approved.`);
      }

      if (sourceBranch === gr.requesting_branch) {
        throw new Error('Source branch cannot be the same as the requesting branch.');
      }

      // 2. Verify the source stock exists in the specified branch (no lock yet — we only check existence)
      const [sourceStockRows] = await conn.query(
        'SELECT id, name, quantity, unit_type FROM stocks WHERE id = ? AND facilityID = ? AND status = "active"',
        [sourceStockId, sourceBranch]
      );

      if (!sourceStockRows[0]) {
        throw new Error(`Product not found in source branch ${sourceBranch}.`);
      }

      const sourceStock = sourceStockRows[0];
      const reqQty = parseFloat(gr.requested_quantity);
      const availQty = parseFloat(sourceStock.quantity);

      // Pre-flight stock check — stock is NOT deducted here, just validated
      if (reqQty > availQty) {
        throw new Error(
          `Insufficient stock in source branch. Available: ${availQty} ${sourceStock.unit_type}(s), Requested: ${reqQty} ${gr.unit_type}(s).`
        );
      }

      // 3. Generate approval receipt code
      let receiptCode;
      let attempts = 0;
      while (attempts < 10) {
        receiptCode = generateReceiptCode();
        const [existing] = await conn.query(
          'SELECT id FROM goods_requests WHERE receipt_code = ? LIMIT 1',
          [receiptCode]
        );
        if (existing.length === 0) break;
        attempts++;
      }
      if (attempts >= 10) throw new Error('Failed to generate unique receipt code. Please retry.');

      // 4. Get branch names for notification
      const [sourceBranchRows] = await conn.query(
        'SELECT name FROM branch WHERE facilityID = ? LIMIT 1',
        [sourceBranch]
      );
      const sourceBranchName = sourceBranchRows[0]?.name || sourceBranch;

      // 5. Transition to APPROVED
      await conn.query(
        `UPDATE goods_requests
         SET status = 'APPROVED',
             source_branch = ?,
             source_stock_id = ?,
             receipt_code = ?,
             admin_notes = ?,
             approved_by = ?,
             approved_by_name = ?,
             approved_at = NOW(),
             reviewed_by = ?,
             reviewed_at = NOW()
         WHERE id = ?`,
        [sourceBranch, sourceStockId, receiptCode, adminNotes, adminId, adminName, adminId, requestId]
      );

      // 6. Notify requesting staff with approval receipt
      await conn.query(
        `INSERT INTO notifications (user_id, facility_id, title, message, type, reference_id)
         VALUES (?, ?, ?, ?, 'GOODS_REQUEST_APPROVED', ?)`,
        [
          gr.staff_id,
          gr.requesting_branch,
          `Goods Request Approved — ${gr.request_code}`,
          `Your goods request has been APPROVED!\n\nReceipt Code: ${receiptCode}\nProduct: ${gr.product_name}\nQuantity: ${reqQty} ${gr.unit_type}(s)\nSource Branch: ${sourceBranchName} (${sourceBranch})\n\nPlease print your receipt and collect goods from the source branch.\nApproved by: ${adminName}`,
          String(requestId),
        ]
      );

      await conn.commit();
      return {
        requestId,
        receiptCode,
        sourceBranch,
        sourceBranchName,
        productName: gr.product_name,
        quantity: reqQty,
        unitType: gr.unit_type,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * PART 10-13 — Validate receipt before release (lookup only, no state change).
   * Called by branch staff to preview what they are about to release.
   * Backend enforces: receipt is APPROVED, source_branch matches authenticated staff's branch.
   */
  async validateReceiptForRelease(receiptCode, authenticatedStaffBranch) {
    const gr = await this.findByReceiptCode(receiptCode);

    if (!gr) {
      // Do not leak whether the code exists or not — use a generic message
      throw new Error('Receipt not found. Please verify the receipt code and try again.');
    }

    // Status checks
    if (gr.status === 'REJECTED') {
      throw new Error('This request was rejected by Admin. Goods cannot be released.');
    }
    if (gr.status === 'RELEASED') {
      throw new Error('This receipt has already been fulfilled. Goods have already been released.');
    }
    if (gr.status === 'CANCELLED') {
      throw new Error('This request has been cancelled. Goods cannot be released.');
    }
    if (gr.status !== 'APPROVED') {
      throw new Error(`Receipt is not in APPROVED state (current: ${gr.status}). Cannot release.`);
    }

    // Branch authorization — must match the approved source branch
    if (gr.source_branch !== authenticatedStaffBranch) {
      throw new Error(
        `Access Denied: This receipt is designated for branch ${gr.source_branch_name || gr.source_branch}. ` +
        `Your branch (${authenticatedStaffBranch}) is not authorized to release this receipt.`
      );
    }

    return gr;
  }

  /**
   * PART 12-14 — Release goods atomically (state machine: APPROVED → RELEASED).
   *
   * Inside a single transaction:
   *   1. Re-lock and re-validate the goods request (defense against TOCTOU).
   *   2. Lock the source stock row.
   *   3. Check sufficient stock (prevents negative stock).
   *   4. Deduct stock from source branch.
   *   5. Record stock movement ledger entry.
   *   6. Mark goods request as RELEASED.
   *   7. Record releasing staff, timestamp.
   *   8. Generate final collection receipt code.
   *   9. Notify requesting staff with collection receipt.
   *  10. Commit all atomically.
   *
   * @param {object} params
   * @param {string} params.receiptCode - The approval receipt code
   * @param {number} params.releasingStaffId - From JWT — never from client body
   * @param {string} params.releasingStaffName - From JWT
   * @param {string} params.releasingStaffBranch - From JWT — never from client body
   */
  async releaseGoods({ receiptCode, releasingStaffId, releasingStaffName, releasingStaffBranch }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // ── Step 1: Lock goods request row ─────────────────────────────────────
      const [grRows] = await conn.query(
        'SELECT * FROM goods_requests WHERE receipt_code = ? FOR UPDATE',
        [receiptCode]
      );

      if (!grRows[0]) {
        throw new Error('Receipt not found. Please verify the receipt code.');
      }

      const gr = grRows[0];

      // Re-validate status inside the transaction (TOCTOU protection)
      if (gr.status !== 'APPROVED') {
        if (gr.status === 'RELEASED') {
          throw new Error('Receipt already fulfilled. Goods have already been released for this receipt.');
        }
        throw new Error(`Cannot release goods. Receipt status is '${gr.status}' — expected APPROVED.`);
      }

      // Re-validate source branch authorization
      if (gr.source_branch !== releasingStaffBranch) {
        throw new Error(
          `Unauthorized: Your branch (${releasingStaffBranch}) is not the authorized source branch (${gr.source_branch}) for this receipt.`
        );
      }

      const reqQty = parseFloat(gr.requested_quantity);

      // ── Step 2: Lock source stock ───────────────────────────────────────────
      let sourceStock;
      if (gr.source_stock_id) {
        // CATALOG product — use the exact stock ID approved
        const [stockRows] = await conn.query(
          'SELECT id, name, quantity, store_id, unit_type FROM stocks WHERE id = ? AND facilityID = ? FOR UPDATE',
          [gr.source_stock_id, releasingStaffBranch]
        );
        if (!stockRows[0]) {
          throw new Error(`Approved stock item (ID: ${gr.source_stock_id}) not found in branch ${releasingStaffBranch}.`);
        }
        sourceStock = stockRows[0];
      } else {
        // CUSTOM product — find by product name in source branch
        const [stockRows] = await conn.query(
          'SELECT id, name, quantity, store_id, unit_type FROM stocks WHERE name = ? AND facilityID = ? AND status = "active" LIMIT 1 FOR UPDATE',
          [gr.product_name, releasingStaffBranch]
        );
        if (!stockRows[0]) {
          throw new Error(`Product "${gr.product_name}" not found in branch ${releasingStaffBranch}. Cannot release.`);
        }
        sourceStock = stockRows[0];
      }

      // ── Step 3: Stock sufficiency check ────────────────────────────────────
      const currentQty = parseFloat(sourceStock.quantity);
      if (reqQty > currentQty) {
        throw new Error(
          `Insufficient stock. Available: ${currentQty} ${sourceStock.unit_type}(s), ` +
          `Required: ${reqQty} ${gr.unit_type}(s). Release rejected.`
        );
      }

      const newQty = currentQty - reqQty;

      // ── Step 4: Deduct stock ────────────────────────────────────────────────
      await conn.query(
        'UPDATE stocks SET quantity = ?, out_stocks = out_stocks + ? WHERE id = ?',
        [newQty, reqQty, sourceStock.id]
      );

      // ── Step 5: Stock movement ledger ──────────────────────────────────────
      await conn.query(
        `INSERT INTO stock_movements
         (facilityID, store_id, stock_id, movement_type, quantity_change, quantity_before, quantity_after,
          reference_type, reference_id, notes, performed_by)
         VALUES (?, ?, ?, 'STOCK_OUT_TRANSFER', ?, ?, ?, 'goods_requests', ?, ?, ?)`,
        [
          releasingStaffBranch,
          sourceStock.store_id || null,
          sourceStock.id,
          -reqQty,
          currentQty,
          newQty,
          gr.id,
          `Goods release for ${gr.receipt_code} to ${gr.requesting_branch}. Released by: ${releasingStaffName}`,
          releasingStaffId,
        ]
      );

      // ── Step 6-8: Generate collection code and mark RELEASED ───────────────
      let collectionCode;
      let attempts = 0;
      while (attempts < 10) {
        collectionCode = generateCollectionCode();
        const [existing] = await conn.query(
          'SELECT id FROM goods_requests WHERE collection_code = ? LIMIT 1',
          [collectionCode]
        );
        if (existing.length === 0) break;
        attempts++;
      }
      if (attempts >= 10) throw new Error('Failed to generate unique collection code. Please retry.');

      await conn.query(
        `UPDATE goods_requests
         SET status = 'RELEASED',
             released_by = ?,
             released_by_name = ?,
             released_at = NOW(),
             collection_code = ?
         WHERE id = ?`,
        [releasingStaffId, releasingStaffName, collectionCode, gr.id]
      );

      // ── Step 9: Notify requesting staff ────────────────────────────────────
      await conn.query(
        `INSERT INTO notifications (user_id, facility_id, title, message, type, reference_id)
         VALUES (?, ?, ?, ?, 'GOODS_RELEASED', ?)`,
        [
          gr.staff_id,
          gr.requesting_branch,
          `Goods Released — ${gr.request_code}`,
          `Your goods have been released!\n\nCollection Receipt: ${collectionCode}\nProduct: ${gr.product_name}\nQuantity: ${reqQty} ${gr.unit_type}(s)\nReleased by: ${releasingStaffName} (${releasingStaffBranch})\nDate: ${new Date().toLocaleString('en-GB')}\n\nThis is your permanent proof of goods collection.`,
          String(gr.id),
        ]
      );

      // ── Step 10: Audit log ─────────────────────────────────────────────────
      await conn.query(
        `INSERT INTO audit_logs
         (facilityID, user_id, user_name, action, entity_type, entity_id, new_values)
         VALUES (?, ?, ?, 'GOODS_RELEASED', 'goods_requests', ?, ?)`,
        [
          releasingStaffBranch,
          releasingStaffId,
          releasingStaffName,
          String(gr.id),
          JSON.stringify({
            request_id: gr.id,
            request_code: gr.request_code,
            receipt_code: gr.receipt_code,
            collection_code: collectionCode,
            product: gr.product_name,
            quantity: reqQty,
            source_branch: releasingStaffBranch,
            destination_branch: gr.requesting_branch,
            released_at: new Date().toISOString(),
          }),
        ]
      );

      await conn.commit();

      return {
        requestId: gr.id,
        requestCode: gr.request_code,
        receiptCode: gr.receipt_code,
        collectionCode,
        productName: gr.product_name,
        quantity: reqQty,
        unitType: gr.unit_type,
        sourceBranch: releasingStaffBranch,
        requestingBranch: gr.requesting_branch,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Legacy: approve + create shipment (preserved for backward compatibility with old records and tests).
   * New workflow uses approveRequest() + releaseGoods() instead.
   * @deprecated Use approveRequest() for new requests.
   */
  async approveAndShipRequest({
    requestId,
    adminId,
    adminName,
    sourceBranch,
    sourceStockId,
    adminNotes = '',
  }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Lock goods request
      const [grRows] = await conn.query(
        'SELECT * FROM goods_requests WHERE id = ? FOR UPDATE',
        [requestId]
      );
      if (!grRows[0]) throw new Error('Goods request not found');
      const gr = grRows[0];

      // 2. Lock stock in source branch
      const [stockRows] = await conn.query(
        'SELECT id, name, quantity, unit_type FROM stocks WHERE id = ? AND facilityID = ? FOR UPDATE',
        [sourceStockId, sourceBranch]
      );
      if (!stockRows[0]) throw new Error('Product not found in source branch.');

      const sourceStock = stockRows[0];
      const reqQty = parseFloat(gr.requested_quantity);
      const availQty = parseFloat(sourceStock.quantity);

      if (reqQty > availQty) {
        throw new Error(`Insufficient stock in source branch. Available: ${availQty}, Requested: ${reqQty}.`);
      }

      // 3. Deduct stock from source branch
      const newSourceQty = availQty - reqQty;
      await conn.query(
        'UPDATE stocks SET quantity = ? WHERE id = ?',
        [newSourceQty, sourceStockId]
      );

      // Record stock movement
      await conn.query(
        `INSERT INTO stock_movements 
         (facilityID, stock_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes, performed_by)
         VALUES (?, ?, 'STOCK_OUT_TRANSFER', ?, ?, ?, 'goods_requests', ?, ?, ?)`,
        [sourceBranch, sourceStockId, -reqQty, availQty, newSourceQty, String(requestId), `Dispatched to ${gr.requesting_branch}`, adminId]
      );

      // 4. Create shipment
      const trackingNumber = `TRK-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
      const [shipmentResult] = await conn.query(
        `INSERT INTO shipments 
         (tracking_number, source_branch, destination_branch, status, dispatched_by, dispatched_at, notes, created_by)
         VALUES (?, ?, ?, 'In Transit', ?, NOW(), ?, ?)`,
        [trackingNumber, sourceBranch, gr.requesting_branch, adminId, adminNotes, adminId]
      );
      const shipmentId = shipmentResult.insertId;

      await conn.query(
        `INSERT INTO shipment_items (shipment_id, stock_id, product_name, quantity_sent, quantity_received)
         VALUES (?, ?, ?, ?, 0)`,
        [shipmentId, sourceStockId, gr.product_name, reqQty]
      );

      // 5. Generate receipt code
      let receiptCode;
      let attempts = 0;
      while (attempts < 10) {
        receiptCode = generateReceiptCode();
        const [existing] = await conn.query(
          'SELECT id FROM goods_requests WHERE receipt_code = ? LIMIT 1',
          [receiptCode]
        );
        if (existing.length === 0) break;
        attempts++;
      }

      // 6. Insert into shipment_receipts
      await conn.query(
        `INSERT INTO shipment_receipts
         (receipt_code, shipment_id, request_id, source_branch, destination_branch, product_name, quantity, unit_type, dispatched_by, dispatched_by_name, consumed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [receiptCode, shipmentId, requestId, sourceBranch, gr.requesting_branch, gr.product_name, reqQty, gr.unit_type, adminId, adminName]
      );

      // 7. Update goods request
      await conn.query(
        `UPDATE goods_requests
         SET status = 'APPROVED',
             source_branch = ?,
             source_stock_id = ?,
             receipt_code = ?,
             shipment_id = ?,
             admin_notes = ?,
             approved_by = ?,
             approved_by_name = ?,
             approved_at = NOW(),
             reviewed_by = ?,
             reviewed_at = NOW()
         WHERE id = ?`,
        [sourceBranch, sourceStockId, receiptCode, shipmentId, adminNotes, adminId, adminName, adminId, requestId]
      );

      await conn.commit();
      return {
        requestId,
        receiptCode,
        shipmentId,
        trackingNumber,
        sourceBranch,
        requestingBranch: gr.requesting_branch,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new GoodsRequestRepository();
