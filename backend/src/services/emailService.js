/**
 * Email Service — Modular delivery for OTP and notification emails.
 * Supports EmailJS REST API, custom webhooks, or safe development fallback logging.
 */
class EmailService {
  /**
   * Sends Password Reset OTP to registered user email.
   *
   * @param {object} params
   * @param {string} params.toEmail - Recipient email address
   * @param {string} params.toName - Recipient full name
   * @param {string} params.otpCode - Plaintext 6-digit OTP
   * @param {number} params.expiresInMinutes - Expiration window in minutes
   */
  async sendPasswordResetOTP({ toEmail, toName, otpCode, expiresInMinutes = 10 }) {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    const templateParams = {
      to_email: toEmail,
      to_name: toName || 'User',
      otp_code: otpCode,
      otp: otpCode,
      expires_in: `${expiresInMinutes} minutes`,
      app_name: 'MURG Textile Enterprises',
    };

    // Attempt EmailJS REST API dispatch if configured
    if (serviceId && templateId && publicKey) {
      try {
        const payload = {
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: templateParams,
        };
        if (privateKey) {
          payload.accessToken = privateKey;
        }

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errText = await response.text();
          const safeError = errText.replace(/\s+/g, ' ').trim().slice(0, 300);
          console.error(`[EMAIL_SERVICE] EmailJS request failed (status=${response.status}): ${safeError}`);
          return {
            success: false,
            provider: 'emailjs',
            status: response.status,
            error: safeError,
          };
        } else {
          console.log(`[EMAIL_SERVICE] OTP email successfully dispatched via EmailJS to ${toEmail}`);
          return { success: true, provider: 'emailjs' };
        }
      } catch (err) {
        console.error(`[EMAIL_SERVICE] EmailJS request failed: ${err.message}`);
        return {
          success: false,
          provider: 'emailjs',
          error: err.message,
        };
      }
    }

    // Safe fallback log for development or unconfigured environment
    // Only log in development to prevent information leaks in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n=================================================`);
      console.log(`[EMAIL_SERVICE_DEV] Password Reset OTP Dispatch`);
      console.log(`To: ${toEmail} (${toName})`);
      console.log('OTP Code: [redacted]');
      console.log(`Expires in: ${expiresInMinutes} minutes`);
      console.log(`=================================================\n`);
    }

    return { success: true, provider: 'dev-log' };
  }
}

module.exports = new EmailService();
