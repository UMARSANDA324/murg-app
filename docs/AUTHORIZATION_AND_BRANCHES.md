# Authorization and Branch Isolation

## Roles

The implemented role strings in the MongoDB user model are `Admin` and `Staff`; the UI calls Staff users Cashiers where applicable. `Sub-admin` is not an accepted persisted User role in the current schema. Admins are global administrators; Staff/Cashier users are branch-scoped.

| Capability | Admin | Sub-admin | Staff |
|---|---:|---:|---:|
| View global management overview/audit logs | Yes | No | No |
| Create/update/status branches | Yes | No | No |
| Create/update/delete staff | Yes | No | No |
| Change product prices | Yes | No | No |
| Use POS | Yes | Yes | Yes |
| Access stock management, shipments, customers/debt management, expenses, reports | Yes | No | No |
| Create goods request | Yes/branch-aware | Yes | Yes |
| Approve/reject goods request | Yes | No | No |
| Release approved goods at source branch | Admin or source-branch user | Yes | Yes |
| View/print authorized sales receipts | Yes | Own branch | Own branch |

The exact route middleware and controller checks take precedence over this summary. Frontend route guards and hidden navigation are UX only; backend endpoint authorization is mandatory.

## Branch Resolution

Users carry `facilityID` in `facility` and in the verified JWT. `requireBranchScope` derives `req.branchId` from the route/query/body only for a global Admin; non-admin users are always forced to their JWT `facilityID`, a mismatched requested branch receives 403, and users of inactive/missing branches are denied branch-scoped operations. Repository queries then use the resolved branch.

> Frontend branch IDs are display/filter information only. Authorization is enforced server-side.

Receipt lookup performs an explicit branch-constrained query for non-admin users. Goods request lookup/release also compares the authenticated branch to requesting/source branch. Financial analytics/report/print endpoints are Admin-only; they accept one branch or all branches. Customer lists used by POS omit outstanding balance and deposit totals for Staff/Cashier.

Future AI consumers must use authenticated backend services/tools and inherit the caller's role and branch scope. AI must not have direct unrestricted MongoDB access.

## Security Rules

- Do not trust `branchId`, `facilityID`, staff IDs, receipt IDs, or roles from the browser.
- Do not widen a repository query without an authorization decision.
- Price endpoints use `requireAdminPriceControl` and record unauthorized attempts in `audit_logs`.
- Cross-branch access should fail with the existing 403/400 behavior rather than revealing data.
