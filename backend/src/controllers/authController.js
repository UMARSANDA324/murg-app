const jwt = require('jsonwebtoken');
const authRepo = require('../repositories/authRepository');
const { AuthRepositoryError } = require('../repositories/authRepository');
const { verifyPassword, hashPassword, md5Hash } = require('../utils/passwordUtils');
const { success, error, unauthorized } = require('../utils/responseUtils');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return error(res, 'Email and password are required', 400);
      }

      // --- Step 1: User lookup ---
      let user;
      try {
        user = await authRepo.findByEmailForAuth(email.trim().toLowerCase());
      } catch (err) {
        if (err instanceof AuthRepositoryError) {
          // Logs the real DB reason internally — NEVER sent to the browser
          console.error(`[AUTH_LOGIN_FAILED] DB error during user lookup — code: ${err.code} — ${err.message}`);
        } else {
          console.error('[AUTH_LOGIN_FAILED] Unexpected error during user lookup:', err.code || err.message);
        }
        return unauthorized(res, 'Invalid email or password');
      }

      if (!user) {
        // Safe internal log — does NOT log the email in production to avoid PII exposure in logs
        const logEmail = process.env.NODE_ENV === 'development' ? email.trim().toLowerCase() : '[redacted]';
        console.warn(`[AUTH_LOGIN_FAILED] user_not_found — email: ${logEmail}`);
        return unauthorized(res, 'Invalid email or password');
      }

      // --- Step 2: Account status check ---
      if (user.status !== 1) {
        console.warn(`[AUTH_LOGIN_FAILED] account_suspended — user_id: ${user.id} email: ${user.email}`);
        return unauthorized(res, 'Account suspended. Contact system administrator.');
      }

      // --- Step 3: Password verification ---
      const { valid, needsUpgrade, method } = await verifyPassword(password, user);
      if (!valid) {
        console.warn(`[AUTH_LOGIN_FAILED] password_mismatch — user_id: ${user.id} method: ${method}`);
        return unauthorized(res, 'Invalid email or password');
      }

      // --- Step 4: Transparently upgrade legacy MD5 hash to bcrypt ---
      if (needsUpgrade) {
        try {
          const bcryptHash = await hashPassword(password);
          await authRepo.upgradeToBcrypt(user.id, bcryptHash);
          console.log(`[AUTH] Upgraded password hash from MD5 to bcrypt for user_id: ${user.id}`);
        } catch (err) {
          // Non-fatal: upgrade failure does not block login
          console.error('[AUTH] Failed to upgrade password to bcrypt for user_id:', user.id, '—', err.message);
        }
      }

      // --- Step 5: Build permissions ---
      let permissions;
      try {
        permissions = user.permissions
          ? JSON.parse(user.permissions)
          : (user.role === 'Admin' ? ['*'] : []);
      } catch (err) {
        // Corrupt JSON in permissions column — fall back gracefully
        console.error(`[AUTH] Corrupt permissions JSON for user_id: ${user.id} — falling back to role-based default.`);
        permissions = user.role === 'Admin' ? ['*'] : [];
      }

      // --- Step 6: Generate JWT ---
      const token = jwt.sign(
        {
          sub: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          facilityID: user.facilityID,
          isGlobalAdmin: user.role === 'Admin',
          permissions,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Safe user object for client (no passwords, no hashes)
      const safeUser = {
        id: user.id,
        name: user.name,
        fname: user.fname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        facilityID: user.facilityID,
        isGlobalAdmin: user.role === 'Admin',
        permissions,
      };

      console.log(`[AUTH] Login successful — user_id: ${user.id} role: ${user.role} facilityID: ${user.facilityID}`);
      return success(res, { token, user: safeUser }, 'Login successful');
    } catch (err) {
      console.error('[AUTH_LOGIN_FAILED] Unhandled exception:', err.message);
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      const user = await authRepo.findById(req.user.id);
      if (!user) {
        console.warn(`[AUTH] /me — user_not_found for user_id: ${req.user.id}`);
        return unauthorized(res, 'User not found');
      }

      let permissions;
      try {
        permissions = user.permissions
          ? JSON.parse(user.permissions)
          : (user.role === 'Admin' ? ['*'] : []);
      } catch (e) {
        permissions = user.role === 'Admin' ? ['*'] : [];
      }

      return success(res, {
        ...user,
        isGlobalAdmin: user.role === 'Admin',
        permissions,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Step A: Request Password Reset OTP
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const genericMsg = 'If an account exists for this email, a password reset code will be sent.';

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return error(res, 'Please provide a valid email address', 400);
      }

      const cleanEmail = email.trim().toLowerCase();

      // Look up account silently (do not expose existence)
      const user = await authRepo.findByEmailForAuth(cleanEmail);
      if (!user || user.status !== 1) {
        return success(res, { message: genericMsg });
      }

      // Check for recent request (60-second resend cooldown)
      const recent = await authRepo.findRecentResetRequest(cleanEmail);
      if (recent) {
        return success(res, { message: genericMsg });
      }

      // Generate cryptographically secure 6-digit OTP
      const crypto = require('crypto');
      const emailService = require('../services/emailService');
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

      // Dispatch OTP via email service first
      const emailResult = await emailService.sendPasswordResetOTP({
        toEmail: cleanEmail,
        toName: user.name,
        otpCode,
        expiresInMinutes: 10,
      });

      // Only save reset record if email dispatch succeeds
      if (!emailResult.success || (process.env.NODE_ENV === 'production' && emailResult.provider !== 'emailjs')) {
        return error(res, 'The password reset email could not be sent. Please try again later.', 503);
      }

      // Save reset record after successful email dispatch
      await authRepo.createPasswordReset({
        userId: user.id,
        email: cleanEmail,
        otpHash,
        expiresMinutes: 10,
      });

      return success(res, { message: genericMsg });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Step B: Verify Password Reset OTP
   */
  async verifyResetOTP(req, res, next) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return error(res, 'Email and verification code are required', 400);
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanOtp = String(otp).trim();

      const reset = await authRepo.findActiveResetByEmail(cleanEmail);
      if (!reset) {
        return error(res, 'Invalid or expired password reset code. Please request a new code.', 400);
      }

      const crypto = require('crypto');
      const inputHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');

      if (inputHash !== reset.otp_hash) {
        await authRepo.incrementResetAttempts(reset.id);
        return error(res, 'Invalid verification code. Please check and try again.', 400);
      }

      // Generate single-use reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      await authRepo.markResetVerified(reset.id, resetToken);

      return success(res, { resetToken }, 'Verification successful. Please set a new password.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Step C: Set New Password
   */
  async resetPassword(req, res, next) {
    try {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        return error(res, 'Reset token and new password are required', 400);
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return error(res, 'New password must be at least 6 characters long', 400);
      }

      const reset = await authRepo.findActiveResetToken(resetToken);
      if (!reset) {
        return error(res, 'Invalid or expired password reset session. Please request a new code.', 400);
      }

      const bcryptHash = await hashPassword(newPassword);
      const legacyMd5Hash = md5Hash(newPassword);
      const clientIp = req.ip || req.headers['x-forwarded-for'] || '';

      await authRepo.resetUserPassword({
        userId: reset.user_id,
        resetId: reset.id,
        bcryptHash,
        legacyMd5Hash,
        ipAddress: String(clientIp),
      });

      return success(res, null, 'Password successfully reset. You may now log in with your new password.');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
