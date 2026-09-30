# Testing

## Automated Commands

- Backend database-free checks: `npm test --prefix backend`.
- MongoDB integration target check: `npm run test:integration --prefix backend` (requires `MONGODB_TEST_URI`).
- Frontend build: `npm run build --prefix frontend`.
- Frontend lint: `npm run lint --prefix frontend`.
- Backend syntax checks can use `node --check` on touched CommonJS files.

## Database Safety

All write integration tests must use `MONGODB_TEST_URI`, and the harness refuses to proceed unless the URI resolves exactly to the `murg_test` database. The test-only cleanup helper checks the active Mongoose connection and every model's connection before deleting test collections. Never point it at `murg`.

The legacy `backend/tests/api.test.js` mutates MySQL and has broad cleanup/reset behavior. It is no longer the `npm test` target and must not be run. No MongoDB write integration run is safe until a dedicated `MONGODB_TEST_URI` is configured.

## Current Coverage

The default suite covers URI safety/rejection, Lagos DAS/WAS/MAS date boundaries, branch-scoped aggregation shape, and controller/repository method presence without connecting to MongoDB. API workflows and transactional rollback require the isolated Atlas test database and valid test identities.

## Areas Not Fully Automated

Not currently covered by dedicated automated tests: browser print-dialog behavior, all responsive viewports, React component-level date grouping, every historical receipt shape, PHP page rendering, and complete cross-module manual regression. Perform manual checks for these when changing the related feature.

## Feature Smoke Checks

For receipt/ledger work verify: recent normal sale, credit sale, multiple-line sale, older sale, branch isolation, unchanged historical prices after catalog edits, date grouping across days, invalid/missing date resilience, receipt reprint, and no horizontal overflow at target mobile/desktop sizes.

For analytics verify: distinct order counting, credit inclusion, week/month boundaries, branch staff restriction, Admin aggregate, and exclusion of transfers/purchases/requests.
