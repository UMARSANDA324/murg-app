# Development Setup

## Prerequisites

- Windows development environment supported by the repository scripts.
- Node.js and npm. The guide in `docs/DEVELOPMENT_GUIDE.md` records the tested Node/npm range; package files are the authority for dependency versions.
- MongoDB Atlas URI and network access configured in `backend/.env`.

## Install

From `C:\xampp\htdocs\murg`:

```powershell
npm run install:all
```

This installs root, backend, and frontend dependencies where required.

## Configure

Create `backend/.env` from the variable reference in [ENVIRONMENT_CURRENT.md](ENVIRONMENT_CURRENT.md). Do not commit it. The root `.env` may be used by repository tooling, but backend runtime configuration is loaded by `backend` and the documented backend variables are the ones to configure.

Do not reset or recreate MongoDB to start the app. MySQL migration scripts and SQL backups are retained as historical tooling and are not part of MongoDB authentication.

## Start

From the repository root run:

```powershell
npm run dev
```

This starts Express and Vite without starting MySQL or Apache. Authentication and the migrated Mongo-backed routes use Atlas. Important: some business controllers still import SQL repositories, so their operations are not yet verified to work with MySQL disabled; see [ARCHITECTURE_CURRENT.md](ARCHITECTURE_CURRENT.md).

## URLs

- React gateway: `http://localhost:5173`
- Node API through Vite: `http://localhost:5173/api`
- Direct Node API: `http://localhost:5000`

Use the React gateway for development. Vite forwards `/api` to Express on port `5000`.

## Commands

```powershell
npm run dev
npm run build
npm run start
npm test --prefix backend
npm run lint --prefix frontend
```

For a migration helper, inspect the specific `backend/scripts/run-migration-*.js` file before running it. Migration state must be verified against the database, not inferred from filenames.
