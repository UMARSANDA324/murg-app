# Migration Status

**Verified:** 2026-09-28

## Retired PHP Runtime

The tracked PHP and PHP-template files have been removed. React/Vite has no PHP endpoint or session call. Express authentication does not require Apache, PHP, or a PHP session. The old auth bridge and its UI caller have been removed. Historical migration documentation and SQL backups remain for reference/recovery.

## Authentication Runtime

Login and current-user validation use the MongoDB `User` collection. JWT subjects are Mongo ObjectIds; middleware verifies the signature and reloads the active user from MongoDB. Existing bcrypt hashes remain supported. A safe Atlas inventory found two bcrypt users and one MD5-only migrated user, so strict MD5 hash comparison remains temporarily necessary and upgrades the matching account to bcrypt after successful verification.

The frontend stores the JWT, validates it through `/api/auth/me` before rendering protected routes, preserves it through transient API outages, clears it on invalid/expired-token 401 responses, and explicitly clears it on logout.

## MongoDB Runtime Status

Active branch, analytics, staff, stock, customer/debt, expense, sales, return, shipment, shipment-receipt, goods-request, management, notification, and auth controller paths now use Mongoose repositories. The legacy SQL repository files remain dormant and are not imported by the active controller graph. `mysql2` remains for explicit migration scripts only; normal application routes do not require a MySQL connection.

The default backend test command is database-free. Write integration testing requires `MONGODB_TEST_URI` resolving exactly to `murg_test`. The legacy MySQL API test is not the default and must not be run against application data. Active business controllers now use MongoDB repositories; legacy SQL repository files remain dormant, and `mysql2` is retained for migration scripts only. Full transactional/API recovery remains unverified until isolated integration credentials and test users are configured.

## Environment and Secrets

- Runtime database: MongoDB Atlas via `MONGODB_URI`.
- Local Vite proxy target defaults to `http://localhost:5000`; override with `VITE_DEV_API_TARGET`.
- Production frontend API base may be configured with `VITE_API_BASE_URL` and must include `/api`.
- Production backend must receive `JWT_SECRET`, `MONGODB_URI`, and the deployed frontend origin as `CORS_ORIGIN` through the hosting provider's environment settings.
- Real `.env` files are ignored by Git. Commit placeholder examples only.

## Verification Performed

- Frontend production build completed successfully; Vite reported only the existing large-chunk advisory.
- Backend auth files passed Node syntax checks.
- Atlas health returned connected; unknown-user requests through direct Express and Vite returned 401.
- Browser test confirmed invalid persisted token is cleared and redirects to login.
- Browser test confirmed a simulated 503 preserves the token and displays a retry action.
- Valid credential login and protected dashboard data were not verified in this run because no test password was supplied. The isolated MongoDB integration connection test was also unavailable because `MONGODB_TEST_URI` was not configured.
