const db = require('../config/database');

/**
 * Typed error for auth repository failures — allows the controller to log
 * the real reason without exposing SQL internals to the HTTP response.
 */
class AuthRepositoryError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'AuthRepositoryError';
    this.code = code; // e.g. 'DB_QUERY_FAILED', 'MISSING_COLUMNS'
    if (cause) this.cause = cause;
  }
}

/**
 * AuthRepository — Database operations for authentication.
 * Never exposes password/password_hash in returned user objects by default.
 */
class AuthRepository {
  /**
   * Find a user by email for login.
   * Returns full row including password/password_hash for verification.
   */
  async findByEmailForAuth(email) {
    try {
      const [rows] = await db.query(
        'SELECT id, facilityID, name, fname, email, phone, role, status, password, password_hash, permissions FROM facility WHERE email = ? LIMIT 1',
        [email]
      );
      return rows[0] || null;
    } catch (err) {
      // Surface a useful error code rather than a raw SQL exception
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        const missing = err.sqlMessage || err.message;
        throw new AuthRepositoryError(
          'MISSING_COLUMNS',
          `Required column missing in 'facility' table. Run migration: database/migrations/001_multibranch_and_stock_ledger.sql — SQL error: ${missing}`
        );
      }
      throw new AuthRepositoryError('DB_QUERY_FAILED', 'Database query failed during user lookup', err);
    }
  }

  /**
   * Upgrade legacy MD5 password to bcrypt (transparent background upgrade).
   * Failures here are non-fatal and logged as warnings only.
   */
  async upgradeToBcrypt(userId, bcryptHash) {
    await db.query(
      'UPDATE facility SET password_hash = ? WHERE id = ?',
      [bcryptHash, userId]
    );
  }

  /**
   * Get safe user profile by ID (no passwords).
   */
  async findById(userId) {
    const [rows] = await db.query(
      'SELECT id, facilityID, name, fname, email, phone, role, status, permissions FROM facility WHERE id = ? LIMIT 1',
      [userId]
    );
    return rows[0] || null;
  }

  /**
   * Check for recent password reset request for cooldown validation (60s).
   */
  async findRecentResetRequest(email) {
    const [rows] = await db.query(
      'SELECT id, created_at FROM password_resets WHERE email = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND) AND is_used = 0 ORDER BY id DESC LIMIT 1',
      [email]
    );
    return rows[0] || null;
  }

  /**
   * Create a new Password Reset OTP record.
   * Invalidates any previous unverified OTP requests for the same email.
   */
  async createPasswordReset({ userId, email, otpHash, expiresMinutes = 10 }) {
    await db.query(
      'UPDATE password_resets SET is_used = 1 WHERE email = ? AND is_verified = 0 AND is_used = 0',
      [email]
    );

    const [result] = await db.query(
      `INSERT INTO password_resets (user_id, email, otp_hash, attempts, max_attempts, is_verified, is_used, expires_at)
       VALUES (?, ?, ?, 0, 5, 0, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [userId, email, otpHash, expiresMinutes]
    );

    return result.insertId;
  }

  /**
   * Find latest unverified, unexpired reset record by email.
   */
  async findActiveResetByEmail(email) {
    const [rows] = await db.query(
      'SELECT * FROM password_resets WHERE email = ? AND is_verified = 0 AND is_used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [email]
    );
    return rows[0] || null;
  }

  /**
   * Increment verification attempt counter and invalidate if max attempts exceeded.
   */
  async incrementResetAttempts(resetId) {
    await db.query(
      'UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?',
      [resetId]
    );
    await db.query(
      'UPDATE password_resets SET is_used = 1 WHERE id = ? AND attempts >= max_attempts',
      [resetId]
    );
  }

  /**
   * Mark OTP as verified and assign single-use reset token.
   */
  async markResetVerified(resetId, resetToken) {
    await db.query(
      'UPDATE password_resets SET is_verified = 1, reset_token = ? WHERE id = ?',
      [resetToken, resetId]
    );
  }

  /**
   * Find active, verified reset token.
   */
  async findActiveResetToken(resetToken) {
    const [rows] = await db.query(
      'SELECT * FROM password_resets WHERE reset_token = ? AND is_verified = 1 AND is_used = 0 AND expires_at > NOW() LIMIT 1',
      [resetToken]
    );
    return rows[0] || null;
  }

  /**
   * Complete password reset atomically.
   */
  async resetUserPassword({ userId, resetId, bcryptHash, legacyMd5Hash, ipAddress = '' }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Update facility credentials
      await conn.query(
        'UPDATE facility SET password_hash = ?, password = ? WHERE id = ?',
        [bcryptHash, legacyMd5Hash, userId]
      );

      // Invalidate reset record
      await conn.query(
        'UPDATE password_resets SET is_used = 1 WHERE id = ?',
        [resetId]
      );

      // Get user name for audit log
      const [u] = await conn.query('SELECT name, facilityID FROM facility WHERE id = ?', [userId]);

      // Audit log entry
      await conn.query(
        `INSERT INTO audit_logs (action, user_id, user_name, facilityID, entity_type, entity_id, ip_address)
         VALUES ('PASSWORD_RESET_SUCCESS', ?, ?, ?, 'facility', ?, ?)`,
        [userId, u[0]?.name || 'User', u[0]?.facilityID || 'Global', userId, ipAddress]
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
}

module.exports = new AuthRepository();
module.exports.AuthRepositoryError = AuthRepositoryError;
