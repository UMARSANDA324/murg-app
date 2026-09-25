# Development Setup

## Prerequisites

- Windows development environment supported by the repository scripts.
- Node.js and npm. The guide in `docs/DEVELOPMENT_GUIDE.md` records the tested Node/npm range; package files are the authority for dependency versions.
- XAMPP Apache and MySQL/MariaDB when using PHP or the shared database.

## Install

From `C:\xampp\htdocs\murg`:

```powershell
npm run install:all
```

This installs root, backend, and frontend dependencies where required.

## Configure

Create `backend/.env` from the variable reference in [ENVIRONMENT_CURRENT.md](ENVIRONMENT_CURRENT.md). Do not commit it. The root `.env` may be used by repository tooling, but backend runtime configuration is loaded by `backend` and the documented backend variables are the ones to configure.

Apply additive migrations in order against the `murg` database. Migration files are under `database/migrations/001_...sql` through `007_...sql`. Do not reset or recreate the database to apply them.

## Start

1. Start MySQL in XAMPP.
2. From the repository root run:

```powershell
npm run dev
```

The orchestrator never auto-starts MySQL. It may start Apache from `C:\xampp\apache\bin\httpd.exe` when port 80 is free; otherwise it uses the existing Apache process.

## URLs

- React gateway: `http://localhost:5173`
- Node API through Vite: `http://localhost:5173/api`
- Direct Node API: `http://localhost:5000`
- Legacy PHP direct: `http://localhost/murg/`
- Apache: port `80`
- MySQL/MariaDB: port `3306`

Use the React gateway during normal development because it proxies both modern and legacy paths.

## Commands

```powershell
npm run dev
npm run build
npm run start
npm test --prefix backend
npm run lint --prefix frontend
```

For a migration helper, inspect the specific `backend/scripts/run-migration-*.js` file before running it. Migration state must be verified against the database, not inferred from filenames.
