# Environment Reference

Never place real values in documentation. The repository contains local environment files; treat them as secrets even when a development database has no password.

## Backend Variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Optional | Node API listen port; defaults to `5000`. |
| `NODE_ENV` | Optional | Controls development logging and error detail. |
| `DB_HOST` | Optional | MySQL host; defaults to `localhost`. |
| `DB_PORT` | Optional | MySQL port; defaults to `3306`. |
| `DB_NAME` | Optional | Database name; defaults to `murg`. |
| `DB_USER` | Optional | Database user; defaults to `root`. |
| `DB_PASS` | Optional | Database password. |
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

The frontend has no documented `VITE_*` runtime variable; it calls relative `/api` paths and relies on Vite proxy configuration.
