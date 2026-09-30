# Deployment and Routing

## Architecture

```text
React/Vite frontend (Render Static Site)
        |
        | HTTPS requests to VITE_API_BASE_URL
        v
Node.js/Express backend (Render Web Service)
        |
        v
MongoDB Atlas
```

The frontend serves the React application only. Express serves `/` and `/api/*`;
it does not serve the frontend or its fallback page.

## Frontend routes

`frontend/src/App.jsx` uses React Router with `BrowserRouter`. The dashboard is
available at `/` and `/dashboard`; the latter is an alias for the same page.
Other registered routes are `/login`, `/forgot-password`, `/pos`, `/stock`,
`/shipments`, `/goods-requests`, `/customers`, `/expenses`, `/returns`,
`/management`, `/staff`, and `/branches`. Unmatched paths render the React
not-found page. The dashboard and business routes are protected by the existing
authentication and role checks.

The Render Static Site rewrites non-file paths to `/index.html`, allowing
React Router to handle direct navigation and refreshes. This rewrite applies
only to the frontend service.

## Backend routes and endpoint inventory

`GET /` returns backend service and database status. `GET /api/health` is the
Render health-check endpoint. Express mounts API routers under `/api/auth`,
`/api/branches`, `/api/staff`, `/api/stocks`, `/api/sales`, `/api/shipments`,
`/api/customers`, `/api/management`, `/api/goods-requests`,
`/api/notifications`, `/api/shipment-receipts`, `/api/realtime`,
`/api/analytics`, `/api/expenses`, and `/api/returns`.

The method/path inventory and route access notes are maintained in
[API_CURRENT.md](API_CURRENT.md) and were checked against the route modules in
`backend/src/routes/`. Unknown Express paths return JSON 404 responses; no SPA
fallback is registered in the backend.

## API URL and CORS

In development, Vite proxies `/api` to `VITE_DEV_API_TARGET` (default
`http://localhost:5000`). The frontend API client defaults to same-origin
`/api`, which is suitable for that proxy.

The production Static Site build sets `VITE_API_BASE_URL` to the absolute
backend URL ending in `/api`. This is a build-time Vite variable: keep it set in
the Render Static Site environment so browser API calls never go to the
frontend's SPA rewrite. The backend allows the configured frontend origin via
`CORS_ORIGIN`; the Render Blueprint sets it to the production frontend origin.
Outside production, Express also allows HTTP origins on `localhost` and
`127.0.0.1` at any port so a Vite fallback port works without relaxing
production CORS.

Do not put credentials or secret values in Vite variables. Any `VITE_*`
variable is included in the browser build.

## Render configuration

The root [`render.yaml`](../render.yaml) describes the existing services on
branch `murg-final`:

| Service | Type | Root | Build | Publish/start |
|---|---|---|---|---|
| `murg-frontend` | Static Site | `frontend` | `npm ci && npm run build` | `dist` |
| `backend-884q` | Node Web Service | `backend` | `npm ci` | `npm start` |

The frontend rewrite, frontend API URL, backend CORS origin, and backend health
check are stored in Git. Render supplies `PORT` automatically; the backend
listens on `process.env.PORT` and falls back to `5000` locally. No production
`PORT` value needs to be committed.

Configure these backend variables in Render's Environment settings:

- `MONGODB_URI`
- `JWT_SECRET`
- `EMAILJS_SERVICE_ID`
- `EMAILJS_TEMPLATE_ID`
- `EMAILJS_PUBLIC_KEY`
- `EMAILJS_PRIVATE_KEY` (only if the configured EmailJS flow requires it)

They are declared as unsynchronized variables in the Blueprint so their values
are not stored in Git. For existing services, retain their current secret
values; Render does not prompt again for `sync: false` variables on later
Blueprint updates. Add any new secret values through the Render dashboard.
Never commit `.env` files or put secrets in this document.

When linking this Blueprint to existing Render services, match the names
`murg-frontend` and `backend-884q` and retain the listed deploy branch. This
keeps the configuration attached to the current services rather than creating
additional services.

## Build and direct-URL checks

From the repository root:

```powershell
npm run build
npm test --prefix backend
npm run lint --prefix frontend
```

The frontend build must produce `frontend/dist/index.html`. Validate the
deployed site at `/`, `/login`, `/dashboard`, and `/management` by loading and
refreshing each URL. Protected routes should redirect to `/login` when no
valid session exists; a frontend server 404 indicates that the Static Site
rewrite is missing or not deployed.

Check the backend separately at `/` and `/api/health`. Test protected API
routes with a valid test identity and use non-mutating requests unless isolated
test data is available. The endpoint inventory in [API_CURRENT.md](API_CURRENT.md)
describes the registered routes; do not treat routes requiring unavailable
credentials, MongoDB, EmailJS, or business data as tested merely because they
are listed.

## Local test results

The local production build produced `frontend/dist/index.html` and included
`https://backend-884q.onrender.com/api` when built with the production API
variable. Local preview returned HTTP 200 on direct navigation and refresh for
all registered frontend routes; protected routes redirected to `/login`
without a session. Backend unit tests passed (6 tests), and local Express smoke
checks returned JSON 200 for `/` and `/api/health`, 401 for unauthenticated
`/api/auth/me`, and JSON 404 for an unknown path. MongoDB integration tests
were not run because `MONGODB_TEST_URI` was unavailable.

## Production test results

Live checks on 2026-09-30 observed:

| Check | Result |
|---|---|
| `GET https://backend-884q.onrender.com/` | HTTP 404 JSON: Express reports `API route GET / not found`. |
| `GET https://backend-884q.onrender.com/api/health` | HTTP 200; MongoDB status is `connected`. |
| Unauthenticated `GET /api/auth/me` | HTTP 401 JSON, as expected. |
| Unknown backend API path | HTTP 404 JSON, as expected. |
| Frontend `/` | HTTP 200 in one browser load; the app redirected to `/login`. |
| Frontend direct paths and refreshes | HTTP 404 for `/login`, `/forgot-password`, `/dashboard`, `/pos`, `/stock`, `/shipments`, `/goods-requests`, `/customers`, `/expenses`, `/returns`, `/management`, `/staff`, and `/branches`. Refreshing `/login` also returned 404. |
| Browser CORS from frontend origin | Credentialed browser fetch to backend health succeeded with HTTP 200. |
| Browser CORS from an unrelated origin | Browser blocked the fetch because the allowed-origin response did not match the request origin. |

The confirmed deployed-source causes are that the current GitHub `murg-final`
revision does not register backend `GET /`, and does not contain `render.yaml`
or a frontend SPA rewrite. The observed backend health result is no longer
503; it reports MongoDB connected. No Render deployment logs or environment
settings were available to this audit, so the cause of the earlier 503 and the
current build/start commands, deploy branch, and secret-variable presence have
not been verified from the Render service configuration.

## Deployment status (2026-09-30)

The updated code including:
- Backend root GET / endpoint (backend/src/app.js lines 60-77)
- Enhanced CORS allowing localhost/127.0.0.1 at any port in development
- render.yaml with SPA rewrite configuration
- Updated documentation

has been committed to `murg-final` (commit 14df1da) and pushed to GitHub.

However, the existing Render services (`murg-frontend` and `backend-884q`) were
created manually and are not linked to the `render.yaml` blueprint. Therefore,
the Git push did not trigger an automatic deployment.

### Required manual deployment steps

To complete the production deployment:

1. **Link Blueprint to existing services** (recommended approach):
   - In Render dashboard, navigate to the Blueprint tab
   - Link the repository's `render.yaml` to the existing services
   - Match service names: `murg-frontend` and `backend-884q`
   - Ensure the deploy branch is `murg-final`
   - This will enable future auto-deploys on push

2. **Alternative: Manual redeploy** (if Blueprint linking is not preferred):
   - In Render dashboard, manually trigger a new deployment for `backend-884q`
   - In Render dashboard, manually trigger a new deployment for `murg-frontend`
   - Ensure environment variables are set correctly (see "Render configuration" above)

3. **Verify environment variables**:
   - Backend: `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `EMAILJS_*` variables
   - Frontend: `VITE_API_BASE_URL=https://backend-884q.onrender.com/api`

After deployment, verify:
- Backend GET / returns HTTP 200 with API metadata
- Frontend routes (/login, /dashboard, /management) work on direct navigation and refresh
- Production API communication works between frontend and backend

The service IDs for the existing services are `srv-daskfr17lnhs739jimo0` (backend)
and `srv-dasina0jo6nc73bv6210` (frontend). These IDs are for reference only;
do not create duplicate services. Production authentication, valid login, the
full business API inventory, and a post-deployment route check remain unverified
until the deployment is completed.

## Troubleshooting

| Symptom | Checks |
|---|---|
| Frontend route returns 404 | Confirm Render Static Site service, publish directory `dist`, deployed `render.yaml`, and the `/*` rewrite. |
| Backend root returns 404/503 | Check the backend service deployment/logs and request `/` directly; `/` is handled by Express, not the static frontend. |
| API calls return HTML or hit the frontend | Inspect the built `VITE_API_BASE_URL`; it must be the backend URL ending in `/api`. |
| CORS error | Confirm `CORS_ORIGIN` exactly matches the browser's frontend origin, including scheme and hostname. |
| MongoDB connection failure | Verify `MONGODB_URI`, Atlas network access, and backend logs without copying credentials into logs or tickets. |
