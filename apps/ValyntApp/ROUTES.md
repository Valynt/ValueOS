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
- `src/routes/_legacy/routes.placeholder.tsx` (deprecated placeholders, not imported).

## Backend dependencies (per protected route)
- None active. Auth flows depend on the authentication provider (Supabase/OAuth) — **TBD**.
