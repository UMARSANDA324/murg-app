const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Computes MD5 hash to match legacy PHP md5($password).
 * @param {string} password - Plain text password
 * @returns {string} MD5 hex digest
 */
function md5Hash(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

/**
 * Verifies a password against modern bcrypt hash and/or legacy MD5 hash.
 * 
 * Multi-layer fallback strategy:
 * 1. If user has a modern bcrypt hash (`password_hash`), attempt bcrypt comparison.
 *    If valid, return success immediately ({ valid: true, needsUpgrade: false, method: 'bcrypt' }).
 * 2. If bcrypt comparison fails OR if `password_hash` is NULL:
 *    Fallback to verify against `user.password` using MD5.
 *    This ensures that:
 *      a) Legacy users with only MD5 hashes can log in seamlessly.
 *      b) If a user changed their password via the legacy PHP interface (which updates `password`
 *         with MD5 but does not touch `password_hash`), their new password will still be accepted.
 *      c) Once MD5 matches, `needsUpgrade: true` triggers an automatic background upgrade to bcrypt
 *         in `password_hash`, re-synchronizing the two hashes.
 * 3. If neither hash matches, return { valid: false, needsUpgrade: false, method: ... }.
 *
 * @param {string} plainPassword - Plain text password from login form
 * @param {object} user - User row from facility table
 * @returns {Promise<{ valid: boolean, needsUpgrade: boolean, method: string }>}
 */
async function verifyPassword(plainPassword, user) {
  if (!plainPassword || !user) {
    return { valid: false, needsUpgrade: false, method: 'none' };
  }

  // Priority 1: Check modern bcrypt hash if present
  if (user.password_hash && typeof user.password_hash === 'string' && user.password_hash.startsWith('$2')) {
    try {
      const validBcrypt = await bcrypt.compare(plainPassword, user.password_hash);
      if (validBcrypt) {
        return { valid: true, needsUpgrade: false, method: 'bcrypt' };
      }
    } catch (err) {
      console.error('[PasswordUtils] bcrypt comparison error:', err.message);
    }
  }

  // Priority 2: Fallback to legacy MD5 hash (password column)
  if (user.password && typeof user.password === 'string') {
    const md5Input = md5Hash(plainPassword);
    if (md5Input.toLowerCase() === user.password.trim().toLowerCase()) {
      return { valid: true, needsUpgrade: true, method: 'md5' };
    }
  }

  return {
    valid: false,
    needsUpgrade: false,
    method: user.password_hash ? 'bcrypt' : 'md5'
  };
}

/**
 * Hashes a password with bcrypt (12 rounds).
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 12);
}

module.exports = { md5Hash, verifyPassword, hashPassword };
