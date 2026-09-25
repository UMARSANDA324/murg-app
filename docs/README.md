# MURG Documentation

This directory is the source of truth for the current MURG Textile Enterprises application. It documents the code and database that exist in this repository, not planned architecture.

## Start Here

1. [Project Overview](PROJECT_OVERVIEW.md)
2. [Development Setup](DEVELOPMENT_SETUP.md)
3. [Architecture](ARCHITECTURE_CURRENT.md)
4. [Authentication](AUTHENTICATION.md)
5. [Authorization and Branches](AUTHORIZATION_AND_BRANCHES.md)
6. [API Reference](API_CURRENT.md)
7. [Database](DATABASE_CURRENT.md)
8. [Frontend](FRONTEND_CURRENT.md)
9. [Sales and Debts](SALES_AND_DEBTS.md)
10. [Inventory](INVENTORY_CURRENT.md)
11. [Receipts](RECEIPTS_CURRENT.md)
12. [Stock Movement Ledger](STOCK_MOVEMENT_LEDGER.md)
13. [Goods Requests](GOODS_REQUESTS_CURRENT.md)
14. [Management and Notifications](MANAGEMENT_AND_NOTIFICATIONS.md)
15. [DAS/WAS/MAS](ANALYTICS_DAS_WAS_MAS.md)
16. [Legacy PHP and Migration Map](LEGACY_PHP_AND_MIGRATION.md)
17. [Environment Reference](ENVIRONMENT_CURRENT.md)
18. [Testing](TESTING_CURRENT.md)
19. [Security and Troubleshooting](SECURITY_AND_TROUBLESHOOTING.md)
20. [AI Development Guide](AI_DEVELOPMENT_GUIDE.md)
21. [Changelog](CHANGELOG_CURRENT.md)

## Documentation Status

The older files in `docs/` such as `ARCHITECTURE.md`, `DATABASE.md`, and `API.md` contain valuable historical and design context. The `*_CURRENT.md` files linked above are the implementation-oriented references for the current tree and should take precedence when they differ.

## Source-of-Truth Rules

- Database state is authoritative for users, branches, stock, orders, debts, movements, requests, notifications, and receipts.
- Backend authorization is authoritative; frontend role checks are UX only.
- Backend checkout and stock/receipt repositories own financial and inventory calculations.
- Persistent order rows are the source for historical sales receipts.
- Existing APIs and components must be reused before adding parallel systems.

> Whenever a developer or AI changes architecture, business rules, API contracts, database schema, authentication, authorization, migration status, or major features, the relevant documentation must be updated in the same change.
