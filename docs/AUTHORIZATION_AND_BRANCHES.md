# Authorization and Branch Isolation

## Roles

The implemented role strings are `Admin`, `Sub-admin`, and `Staff`. The database also supports a JSON `permissions` column. Admins are treated as global administrators and implicitly have all permissions; non-admin permission checks use the JSON list where a route invokes `requirePermission`.

| Capability | Admin | Sub-admin | Staff |
|---|---:|---:|---:|
| View global management overview/audit logs | Yes | No | No |
| Create/update/status branches | Yes | No | No |
| Create/update/delete staff | Yes | No | No |
| Change product prices | Yes | No | No |
| Use branch-scoped POS, customers, stock, shipments | Yes | Yes | Yes, subject to endpoint workflow |
| Create goods request | Yes/branch-aware | Yes | Yes |
| Approve/reject goods request | Yes | No | No |
| Release approved goods at source branch | Admin or source-branch user | Yes | Yes |
| View/print authorized sales receipts | Yes | Own branch | Own branch |

The exact route middleware and controller checks take precedence over this summary.

## Branch Resolution

Users carry `facilityID` in `facility` and in the verified JWT. `requireBranchScope` derives `req.branchId` from the route/query/body only for a global Admin; non-admin users are always forced to their JWT `facilityID`, and a mismatched requested branch receives 403. Repository queries then use the resolved branch.

> Frontend branch IDs are display/filter information only. Authorization is enforced server-side.

Receipt lookup performs an explicit branch-constrained query for non-admin users. Goods request lookup/release also compares the authenticated branch to requesting/source branch. Analytics restricts non-admin users to their own branch; Admin may request one branch or the application-wide aggregate.

## Security Rules

- Do not trust `branchId`, `facilityID`, staff IDs, receipt IDs, or roles from the browser.
- Do not widen a repository query without an authorization decision.
- Price endpoints use `requireAdminPriceControl` and record unauthorized attempts in `audit_logs`.
- Cross-branch access should fail with the existing 403/400 behavior rather than revealing data.
