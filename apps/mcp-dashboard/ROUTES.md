# MCP Dashboard Route Contract

## Public routes
- `/login` — authentication entry point.

## Protected routes (auth required)
- `/dashboard`
- `/companies`
- `/companies/:cik`
- `/sentiment`
- `/forecasting`
- `/api-management`

## Role-gated routes (admin)
- `/admin`

## Catch-alls / redirects
- `*` → `/dashboard` (unauthenticated users will land on `/login` via guard).

## Inactive/legacy routes (do not rely on these)
- None documented.

## Backend dependencies (per protected route)
- `/dashboard` → **TBD** (expected: metrics/health summary endpoint).
- `/companies` → **TBD** (expected: `GET /api/companies`, tenant-scoped).
- `/companies/:cik` → **TBD** (expected: `GET /api/companies/:cik`, tenant-scoped).
- `/sentiment` → **TBD** (expected: sentiment analysis endpoint).
- `/forecasting` → **TBD** (expected: forecasting endpoint).
- `/api-management` → **TBD** (expected: `GET/POST /api/admin/keys`, admin-scoped).
- `/admin` → **TBD** (expected: admin management endpoints).
