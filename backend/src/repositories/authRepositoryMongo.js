const { User, PasswordReset } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');
const { recordAuditLog } = require('../services/auditLogService');

function resetDTO(reset) {
  return reset ? { ...reset, id: reset._id.toString() } : null;
}

/**
 * Typed error for auth repository failures — allows the controller to log
 * the real reason without exposing MongoDB internals to the HTTP response.
 */
class AuthRepositoryError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'AuthRepositoryError';
    this.code = code; // e.g. 'DB_QUERY_FAILED', 'MISSING_FIELDS'
    if (cause) this.cause = cause;
  }
}

/**
 * AuthRepositoryMongo — MongoDB-based authentication operations.
 * Preserves all business logic from MySQL version.
 */
class AuthRepositoryMongo {
  /**
   * Find a user by email for login.
   * Returns full document including password/password_hash for verification.
   */
  async findByEmailForAuth(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() }).lean();
      return user || null;
    } catch (err) {
      throw new AuthRepositoryError('DB_QUERY_FAILED', 'Database query failed during user lookup', err);
    }
  }

  /**
   * Upgrade legacy MD5 password to bcrypt (transparent background upgrade).
   * Failures here are non-fatal and logged as warnings only.
   */
  async upgradeToBcrypt(userId, bcryptHash) {
    await User.updateOne({ mysqlId: userId }, { password_hash: bcryptHash });
  }

  /**
   * Get safe user profile by ID (no passwords).
   */
  async findById(userId) {
    const user = await User.findById(userId)
      .select('-password -password_hash')
      .lean();
    return user || null;
  }

  /**
   * Check for recent password reset request for cooldown validation (60s).
   */
  async findRecentResetRequest(email) {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const reset = await PasswordReset.findOne({
      email: email.toLowerCase(),
      createdAt: { $gte: sixtySecondsAgo },
      is_used: false,
    })
      .sort({ _id: -1 })
      .lean();
    return resetDTO(reset);
  }

  /**
   * Create a new Password Reset OTP record.
   * Invalidates any previous unverified OTP requests for the same email.
   */
  async createPasswordReset({ userId, email, otpHash, expiresMinutes = 10 }) {
    const session = await mongoose.startSession();
    let resetId;
    try {
      await session.withTransaction(async () => {
        await PasswordReset.updateMany(
          { email: email.toLowerCase(), is_verified: false, is_used: false },
          { is_used: true },
          { session }
        );
        const [mysqlId] = await reserveLegacyIds(PasswordReset, 'passwordResetId', 1, session);
        const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
        const [reset] = await PasswordReset.create([{
          user_id: userId,
          email: email.toLowerCase(),
          otp_hash: otpHash,
          attempts: 0,
          max_attempts: 5,
          is_verified: false,
          is_used: false,
          expires_at: expiresAt,
          mysqlId,
        }], { session });
        resetId = reset._id;
      });
      return resetId;
    } finally { await session.endSession(); }
  }

  /**
   * Find latest unverified, unexpired reset record by email.
   */
  async findActiveResetByEmail(email) {
    const reset = await PasswordReset.findOne({
      email: email.toLowerCase(),
      is_verified: false,
      is_used: false,
      expires_at: { $gt: new Date() },
    })
      .sort({ _id: -1 })
      .lean();
    return resetDTO(reset);
  }

  /**
   * Increment verification attempt counter and invalidate if max attempts exceeded.
   */
  async incrementResetAttempts(resetId) {
    const reset = await PasswordReset.findById(resetId);
    if (!reset) return;

    reset.attempts += 1;
    if (reset.attempts >= reset.max_attempts) {
      reset.is_used = true;
    }
    await reset.save();
  }

  /**
   * Mark OTP as verified and assign single-use reset token.
   */
  async markResetVerified(resetId, resetToken) {
    await PasswordReset.findByIdAndUpdate(resetId, {
      is_verified: true,
      reset_token: resetToken,
    });
  }

  /**
   * Find active, verified reset token.
   */
  async findActiveResetToken(resetToken) {
    const reset = await PasswordReset.findOne({
      reset_token: resetToken,
      is_verified: true,
      is_used: false,
      expires_at: { $gt: new Date() },
    }).lean();
    return resetDTO(reset);
  }

  /**
   * Complete password reset atomically.
   */
  async resetUserPassword({ userId, resetId, bcryptHash, ipAddress = '' }) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Get user for audit log
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Update facility credentials
      await User.updateOne(
        { _id: userId },
        { $set: { password_hash: bcryptHash, updatedAt: new Date() }, $unset: { password: 1 } },
        { session }
      );

      // Invalidate reset record
      await PasswordReset.findByIdAndUpdate(resetId, { is_used: true }, { session });

      // Audit log entry
      await recordAuditLog({
        action: 'PASSWORD_RESET_SUCCESS',
        user_id: user._id,
        user_name: user.name,
        facilityID: user.facilityID,
        entity_type: 'facility',
        entity_id: String(userId),
        ip_address: ipAddress,
      }, session);

      await session.commitTransaction();
      return true;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new AuthRepositoryMongo();
module.exports.AuthRepositoryError = AuthRepositoryError;
