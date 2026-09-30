# Environment Reference

Never place real values in documentation. The repository contains local environment files; treat them as secrets even when a development database has no password.

## Backend Variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Optional | Node API listen port; defaults to `5000`. |
| `NODE_ENV` | Optional | Controls development logging and error detail. |
| `MONGODB_URI` | Required | MongoDB Atlas runtime connection string. |
| `MYSQL_MIGRATION_MODE` | Optional | Set `true` only for retained MySQL migration tooling. Not required for auth. |
| `DB_HOST` | Migration only | MySQL host read by migration-mode tooling. |
| `DB_PORT` | Migration only | MySQL port read by migration-mode tooling. |
| `DB_NAME` | Migration only | MySQL database name read by migration-mode tooling. |
| `DB_USER` | Migration only | MySQL user read by migration-mode tooling. |
| `DB_PASS` | Migration only | MySQL password read by migration-mode tooling. |
| `JWT_SECRET` | Required in production | JWT signing secret. Never use the fallback in production. |
| `JWT_EXPIRES_IN` | Optional | JWT lifetime; current default is `7d`. |
| `CORS_ORIGIN` | Optional | Allowed browser origin; defaults to `http://localhost:5173`. |
| `EMAILJS_SERVICE_ID` | Required for production reset email | EmailJS service identifier. |
| `EMAILJS_TEMPLATE_ID` | Required for production reset email | EmailJS template identifier. |
| `EMAILJS_PUBLIC_KEY` | Required for production reset email | EmailJS public key. |
| `EMAILJS_PRIVATE_KEY` | Optional | EmailJS server access token when configured. |

## Safe Example

```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_NAME=murg
DB_USER=root
DB_PASS=<local-password>
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
EMAILJS_SERVICE_ID=<service-id>
EMAILJS_TEMPLATE_ID=<template-id>
EMAILJS_PUBLIC_KEY=<public-key>
EMAILJS_PRIVATE_KEY=<private-key>
```

## Frontend Variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_DEV_API_TARGET` | Optional | Local Vite proxy target; defaults to `http://localhost:5000`. |
| `VITE_API_BASE_URL` | Production deployment | Absolute API base URL including `/api`, for example `https://your-api.example.com/api`. Leave unset for same-origin `/api` deployments. |

Vite uses the proxy only during development. A production static frontend must either share an origin/reverse proxy with the API or set `VITE_API_BASE_URL`; configure backend `CORS_ORIGIN` to the production frontend origin.
