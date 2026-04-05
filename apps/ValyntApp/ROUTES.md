# ValyntApp Route Contract

## Public routes
- `/login`
- `/signup`
- `/reset-password`
- `/auth/callback`
- `/` → redirects to `/login`

## Protected routes (auth required)
- None active (auth shell only).

## Role-gated routes (admin)
- None active.

## Catch-alls / redirects
- Root redirect: `/` → `/login`.

## Inactive/legacy routes (do not rely on these)
- Legacy placeholder routes are fully retired and are **not** expected to exist on disk under `src/routes/_legacy/`.

## Legacy placeholder policy
- Legacy route placeholders are fully retired in this app; do not recreate `src/routes/_legacy/*` placeholder files unless a future process requirement explicitly reinstates them in this contract.

## Backend dependencies (per protected route)
- None active. Auth flows depend on the authentication provider (Supabase/OAuth) — **TBD**.
