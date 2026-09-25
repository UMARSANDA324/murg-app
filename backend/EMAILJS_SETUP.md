# EmailJS Configuration for Password Reset OTP

## Problem Diagnosis

The password reset OTP email flow was failing with HTTP 503. Root cause analysis revealed:

1. **Missing Environment Variables**: The EmailJS configuration variables were not set in the backend environment.
2. **EmailJS Account Setting**: The EmailJS account had "API access from non-browser environments" disabled, which blocked server-side REST API calls from Node.js.

## Required Environment Variables

Add the following variables to your `backend/.env` file:

```bash
# EmailJS Configuration
EMAILJS_SERVICE_ID=your_service_id_here
EMAILJS_TEMPLATE_ID=your_template_id_here
EMAILJS_PUBLIC_KEY=your_public_key_here
EMAILJS_PRIVATE_KEY=your_private_key_here
```

### How to Obtain These Values

1. Log in to your [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Navigate to **Email Services** → Select your email service → Copy **Service ID**
3. Navigate to **Email Templates** → Select your password reset template → Copy **Template ID**
4. Navigate to **Account** → **General** → Copy **Public Key**
5. Navigate to **Account** → **General** → Copy **Private Key**

## EmailJS Account Configuration

### Critical Setting: Enable Server-Side API Access

By default, EmailJS restricts API access to browser environments only. To enable server-side (Node.js) access:

1. Go to [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Navigate to **Account** → **General**
3. Find the setting: **"API access from non-browser environments"**
4. **Enable this setting** (toggle to ON)
5. Save changes

**Without this setting enabled**, the EmailJS REST API will return HTTP 403 with message:
```
"API access from non-browser environments is currently disabled"
```

## Email Template Requirements

Your EmailJS template must include the following parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `to_email` | Recipient email address | `user@example.com` |
| `to_name` | Recipient full name | `John Doe` |
| `otp_code` | 6-digit OTP code | `123456` |
| `otp` | Alternate OTP parameter (same value) | `123456` |
| `expires_in` | Expiration time window | `10 minutes` |
| `app_name` | Application name | `MURG Textile Enterprises` |

### Example Email Template Content

```
Subject: Password Reset Code for {{to_name}}

Hello {{to_name}},

You requested a password reset for your {{app_name}} account.

Your verification code is: {{otp_code}}

This code will expire in {{expires_in}}.

If you did not request this reset, please ignore this email.
```

## Security Notes

- **Private Key**: Must remain server-side only. Never expose to frontend.
- **Public Key**: Can be exposed to frontend, but this implementation uses it server-side.
- **OTP Logging**: OTP values are never logged in production. Development logs show `[redacted]`.
- **Email Logging**: Recipient emails are only logged in development mode (`NODE_ENV=development`).

## Implementation Details

### Flow Sequence

1. User requests password reset via frontend
2. Backend validates email format
3. Backend looks up user (silently, no existence disclosure)
4. Backend checks for recent requests (60-second cooldown)
5. Backend generates cryptographically secure 6-digit OTP
6. Backend hashes OTP with SHA-256 for storage
7. **Backend attempts EmailJS dispatch first**
8. **Only if dispatch succeeds, backend saves OTP to database**
9. Backend returns HTTP 200 with generic success message
10. User receives email with OTP
11. User enters OTP for verification
12. Backend verifies OTP hash
13. Backend generates single-use reset token
14. User sets new password
15. Backend bcrypt-hashes new password
16. Backend updates user password
17. Backend invalidates reset token

### Error Handling

- **EmailJS 403**: Returns HTTP 503 to client with safe message
- **EmailJS timeout**: Returns HTTP 503 to client
- **Missing credentials**: Returns HTTP 503 to client
- **Invalid OTP**: Returns HTTP 400 with "Invalid verification code"
- **Expired OTP**: Returns HTTP 400 with "Invalid or expired password reset code"
- **Network failures**: Returns HTTP 503 to client

### OTP Security

- Generated using `crypto.randomInt(100000, 999999)` (cryptographically secure)
- Hashed with SHA-256 before database storage
- Expires after 10 minutes
- Single-use (marked as used after verification)
- Maximum 5 verification attempts before invalidation
- Previous unverified OTPs invalidated when new OTP requested

### Database Safety

- OTP is only saved to database **after** successful email dispatch
- If email dispatch fails, no OTP record is created
- This prevents orphaned OTP records that could be exploited
- Password reset transaction is atomic (password updated + token invalidated together)

## Testing

### Test with Dev-Log Fallback (No EmailJS)

If EmailJS is not configured, the system falls back to development logging:

```bash
# backend/.env
# Leave EMAILJS_* variables empty or unset
NODE_ENV=development
```

The OTP will be logged to console:
```
[EMAIL_SERVICE_DEV] Password Reset OTP Dispatch
To: user@example.com (John Doe)
OTP Code: [redacted]
Expires in: 10 minutes
```

**Note**: This fallback only works in `NODE_ENV=development`. In production, missing EmailJS configuration will return HTTP 503.

### Test with EmailJS Configured

1. Set all EMAILJS_* environment variables
2. Enable "API access from non-browser environments" in EmailJS dashboard
3. Restart backend server
4. Request password reset with a registered email
5. Check email inbox for OTP
6. Verify OTP and reset password

## Troubleshooting

### HTTP 503 on Password Reset

**Possible causes:**
1. EmailJS environment variables not set
2. EmailJS account has server-side API access disabled
3. Network connectivity issues to api.emailjs.com
4. Invalid EmailJS credentials

**Debug steps:**
1. Check backend logs for `[EMAIL_SERVICE]` error messages
2. Verify environment variables are loaded: `node -e "require('dotenv').config(); console.log(process.env.EMAILJS_SERVICE_ID)"`
3. Check EmailJS dashboard for server-side API access setting
4. Test EmailJS template directly from EmailJS dashboard

### Email Not Received

**Possible causes:**
1. Email in spam folder
2. Email service provider blocking
3. Invalid recipient email
4. EmailJS quota exceeded

**Debug steps:**
1. Check EmailJS dashboard email history
2. Verify recipient email is correct
3. Check spam folder
4. Verify EmailJS email service status

### OTP Verification Fails

**Possible causes:**
1. OTP expired (10-minute window)
2. Too many failed attempts (max 5)
3. OTP already used
4. Wrong OTP entered

**Debug steps:**
1. Request a new OTP
2. Enter OTP within 10 minutes
3. Ensure correct 6-digit code

## Production Deployment Checklist

- [ ] Set all EMAILJS_* environment variables in production
- [ ] Enable "API access from non-browser environments" in EmailJS dashboard
- [ ] Set `NODE_ENV=production` in production
- [ ] Verify OTP logging is disabled in production logs
- [ ] Test complete password reset flow end-to-end
- [ ] Verify email delivery to real email addresses
- [ ] Verify OTP expiration works correctly
- [ ] Verify OTP cannot be reused
- [ ] Verify password is bcrypt-hashed after reset
- [ ] Verify login works with new password
- [ ] Verify existing authentication remains intact
