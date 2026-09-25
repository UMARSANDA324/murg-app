# Testing

## Automated Commands

- Backend integration/regression: `npm test --prefix backend`.
- Frontend build: `npm run build --prefix frontend`.
- Frontend lint: `npm run lint --prefix frontend`.
- Backend syntax checks can use `node --check` on touched CommonJS files.

## Existing Coverage

`backend/tests/api.test.js` is an integration suite that starts the API, creates isolated test identities/data, exercises health/auth/password reset, management authorization, branch/sales modes, stock receiving, pricing authorization, checkout/credit, shipment conversion, goods requests, receipt verification/release, wrong-branch rejection, and replay prevention. `backend/tests/management.test.js` covers management behavior separately.

The suite uses the configured database and must be treated as a database-mutating integration test even when it cleans up test data. Never point it at production data without an approved isolation plan.

## Areas Not Fully Automated

Not currently covered by dedicated automated tests: browser print-dialog behavior, all responsive viewports, React component-level date grouping, every historical receipt shape, PHP page rendering, and complete cross-module manual regression. Perform manual checks for these when changing the related feature.

## Feature Smoke Checks

For receipt/ledger work verify: recent normal sale, credit sale, multiple-line sale, older sale, branch isolation, unchanged historical prices after catalog edits, date grouping across days, invalid/missing date resilience, receipt reprint, and no horizontal overflow at target mobile/desktop sizes.

For analytics verify: distinct order counting, credit inclusion, week/month boundaries, branch staff restriction, Admin aggregate, and exclusion of transfers/purchases/requests.
