# VOS Academy Route Contract

## Public routes
- `/` — marketing/landing entry point.
- `/404` — not found view.

## Protected routes (auth required)
- `/dashboard`
- `/pillar/:pillarNumber`
- `/quiz/:pillarNumber`
- `/ai-tutor`
- `/profile`
- `/resources`
- `/certifications`
- `/simulations`
- `/simulation-progress`
- `/analytics`
- `/value-tree-builder`

## Role-gated routes (admin)
- None active (role-gate support exists via `RouteGuard`).

## Catch-alls / redirects
- Catch-all route renders `NotFound`.
- Unauthenticated access to protected routes redirects to `/?redirect=<path>`.
- Role-gate failure redirects to `/?error=forbidden`.

## Inactive/legacy routes (do not rely on these)
- None documented.

## Backend dependencies (per protected route)
- `/dashboard` → **TBD** (tRPC: `auth.me`, `progress`, `pillars`, `quiz`, `maturity`).
- `/pillar/:pillarNumber` → **TBD** (tRPC: `pillars`, `progress`).
- `/quiz/:pillarNumber` → **TBD** (tRPC: `quiz`, `progress`).
- `/ai-tutor` → **TBD** (tRPC: `auth.me`, AI tutor endpoints).
- `/profile` → **TBD** (tRPC: `auth.me`, `user` mutations).
- `/resources` → **TBD** (tRPC: `resources`).
- `/certifications` → **TBD** (tRPC: `certifications`).
- `/simulations` → **TBD** (tRPC: `simulations`).
- `/simulation-progress` → **TBD** (tRPC: `progress`, `simulations`).
- `/analytics` → **TBD** (tRPC: `analytics`).
- `/value-tree-builder` → **TBD** (tRPC: value-tree services).
