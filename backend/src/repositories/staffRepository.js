const db = require('../config/database');

/**
 * StaffRepository — Parameterized queries for staff management.
 * Always scoped by facilityID for non-admin users.
 */
class StaffRepository {
  /**
   * List all staff. If facilityID provided, scope to that branch only.
   */
  async findAll({ facilityID = null, role = null } = {}) {
    let sql = `
      SELECT f.id, f.facilityID, f.name, f.email, f.phone, f.gender,
             f.role, f.status, f.permissions, f.creation,
             b.name as branch_name
      FROM facility f
      LEFT JOIN branch b ON f.facilityID = b.facilityID
      WHERE 1=1
    `;
    const params = [];

    if (facilityID) {
      sql += ' AND f.facilityID = ?';
      params.push(facilityID);
    }
    if (role) {
      sql += ' AND f.role = ?';
      params.push(role);
    }

    sql += ' ORDER BY f.creation DESC';
    const [rows] = await db.query(sql, params);
    return rows;
  }

  /**
   * Get a single staff member by ID.
   */
  async findById(id, facilityID = null) {
    let sql = `
      SELECT f.id, f.facilityID, f.name, f.email, f.phone, f.gender,
             f.role, f.status, f.permissions, f.creation,
             b.name as branch_name
      FROM facility f
      LEFT JOIN branch b ON f.facilityID = b.facilityID
      WHERE f.id = ?
    `;
    const params = [id];

    if (facilityID) {
      sql += ' AND f.facilityID = ?';
      params.push(facilityID);
    }

    const [rows] = await db.query(sql, params);
    return rows[0] || null;
  }

  /**
   * Create a new staff member.
   */
  async create({ facilityID, name, email, phone, gender, role, passwordHash, legacyPassword, fname, address }) {
    const [result] = await db.query(
      `INSERT INTO facility 
       (facilityID, name, email, phone, gender, fname, address, role, password_hash, password, status, dob, country, state, lga, type, plan, price, paid, due)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '', '', '', '', '', '', '', '', '')`,
      [facilityID, name, email, phone, gender || 'Male', fname || name, address || '', role, passwordHash, legacyPassword || '']
    );
    return result.insertId;
  }

  /**
   * Update staff role and/or branch assignment.
   */
  async updateRole(id, { role, facilityID }) {
    const [result] = await db.query(
      'UPDATE facility SET role = ?, facilityID = ? WHERE id = ?',
      [role, facilityID, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Toggle staff active/suspended status.
   */
  async setStatus(id, status) {
    const [result] = await db.query(
      'UPDATE facility SET status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Update staff profile details.
   */
  async update(id, { name, phone, gender, address }, facilityID = null) {
    let sql = 'UPDATE facility SET name = ?, phone = ?, gender = ?, address = ? WHERE id = ?';
    const params = [name, phone, gender, address, id];

    if (facilityID) {
      sql += ' AND facilityID = ?';
      params.push(facilityID);
    }

    const [result] = await db.query(sql, params);
    return result.affectedRows > 0;
  }


  /**
   * Check if an email already exists (for registration validation).
   */
  async emailExists(email, excludeId = null) {
    let sql = 'SELECT id FROM facility WHERE email = ?';
    const params = [email];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    const [rows] = await db.query(sql, params);
    return rows.length > 0;
  }

  /**
   * Delete a staff member.
   */
  async delete(id) {
    const [result] = await db.query('DELETE FROM facility WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  /**
   * Update staff email address.
   */
  async updateEmail(id, email) {
    const [result] = await db.query('UPDATE facility SET email = ? WHERE id = ?', [email, id]);
    return result.affectedRows > 0;
  }

  /**
   * Update both bcrypt hash and legacy md5 hash.
   */
  async updatePassword(id, bcryptHash, legacyMd5Hash) {
    const [result] = await db.query(
      'UPDATE facility SET password_hash = ?, password = ? WHERE id = ?',
      [bcryptHash, legacyMd5Hash, id]
    );
    return result.affectedRows > 0;
  }}

module.exports = new StaffRepository();
