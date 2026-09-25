# Security and Troubleshooting

## Security Boundaries

- JWT signature and active-user lookup are checked by `authenticate`.
- Role/branch checks occur in backend middleware and controllers.
- SQL uses parameterized mysql2 queries.
- Admin price changes are restricted and unauthorized attempts are audited.
- Receipt and goods-release identifiers are not authorization credentials; the backend checks ownership/branch/state.
- Reset OTPs are stored as hashes, expire, have attempt limits, and are not returned in API responses.
- Do not log passwords, hashes, JWTs, reset tokens, OTPs, EmailJS private keys, or full customer records.

## Common Problems

### MySQL unavailable
Start MySQL through XAMPP. `scripts/dev-orchestrator.js` deliberately does not start `mysqld.exe`.

### Backend starts but login fails
Check `backend/.env`, database connectivity, migration columns, active `facility.status`, and the backend log. The browser receives a generic login error by design.

### Password reset returns 503
Production requires configured EmailJS values and server-side EmailJS access. Check `backend/EMAILJS_SETUP.md`; do not make the API claim success when provider delivery fails.

### Legacy page redirects to login
Use the React Management bridge to create a fresh ticket. Confirm Apache is running, the target is in the role allowlist, and the bridge migration exists.

### Branch data appears wrong
Trace `req.user.facilityID`, `requireBranchScope`, controller-resolved `req.branchId`, and the repository `WHERE` clause. Never fix branch leakage with frontend filtering.

### Date rendering fails
Keep SQL/API date contracts explicit. For ledger dates, use the backend `business_date` and Africa/Lagos parsing. Invalid historical dates must remain visible as `Date unavailable`, never be replaced with today or epoch.
