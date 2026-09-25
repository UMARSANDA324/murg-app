# AI Development Guide

This guide is for coding agents and developers who have not seen MURG before.

## Before Coding

1. Read `docs/README.md`, the relevant current feature document, and this guide.
2. Inspect the actual route, controller, repository/service, page, and database tables involved.
3. Search for existing endpoints/components before proposing a new one.
4. Identify the authoritative source of truth: database row, backend transaction, middleware, or persistent receipt data.
5. Check whether the operation is React/Node-owned or still PHP-owned.

## Architecture Rules

- React is the modern UI; Node/Express is the modern API; MySQL is shared by modern and PHP systems.
- Backend repositories own SQL and transaction boundaries.
- JWT-derived identity and branch scope are security inputs; browser branch state is not.
- `orders` preserve sale line snapshots; `stocks` is current inventory; `stock_movements` is history.
- Admin-wide metrics are backend/database aggregates, never frontend sums.
- Legacy PHP is still active for several modules. Do not remove or duplicate it casually.

## Safety Rules

- Do not reset, truncate, delete, or rewrite historical business data.
- Do not recalculate old receipts with current catalog values.
- Do not add frontend-only authorization.
- Do not hardcode business totals, branches, prices, or analytics.
- Do not introduce a second auth, receipt, ledger, goods-request, or analytics system.
- Do not put credentials, tokens, hashes, OTPs, or private keys in code or docs.
- Preserve compatibility with PHP and the shared schema.
- Add numbered, backward-compatible migrations for real schema needs.
- Do not widen branch queries without a server-side authorization decision.

## Change Workflow

```text
Understand -> Inspect -> Identify source of truth -> Plan minimally
-> Implement -> Run focused test -> Run regression tests -> Update docs
```

After editing, validate the narrow behavior first, then build/lint/test the affected system. Treat integration tests as database-mutating. Record known gaps rather than claiming unverified behavior.

## Feature Decision Checklist

Before adding a feature, answer:

- Does a React page already expose it?
- Does an API route/controller/repository already implement it?
- Does PHP still own it?
- Which table and fields are authoritative?
- What branch and role restrictions apply?
- Is the feature historical/financial/inventory-sensitive?
- Can the existing service be extended without a parallel path?

## Database Changes

Inspect current columns/indexes first. Write an additive numbered migration, preserve old columns/rows, avoid destructive defaults, and document rollout/rollback considerations. Do not assume a migration ran because its file exists; verify the live schema.

## Legacy PHP Changes

Keep Apache/Vite proxy behavior, PHP session expectations, and shared database compatibility intact. New legacy destinations must be allowlisted in the Node bridge and PHP bridge consistently. Prefer the existing Auth Bridge over credential/session duplication.

## Documentation Maintenance

Update the feature document, API/database/migration map, testing notes, and known limitations in the same change whenever behavior changes.

> Whenever a developer or AI changes architecture, business rules, API contracts, database schema, authentication, authorization, migration status, or major features, the relevant documentation must be updated in the same change.
