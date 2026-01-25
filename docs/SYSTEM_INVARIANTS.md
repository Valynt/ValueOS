# System Invariants

**These values MUST NEVER change. Breaking these breaks reproducibility.**

## Demo User (Development Only)

```
UUID:     00000000-0000-0000-0000-000000000001
Email:    demouser@valynt.com
Password: passord
Role:     admin
```

**Contract:** This user must always exist after running seed scripts. Login with these credentials must always succeed in development.

## Pinned Versions

```
Node:     18.19.0 (see .nvmrc)
npm:      9.2.0 (see package.json packageManager)
Postgres: 15.1.0.117 (see docker-compose, CI)
```

**Contract:** These versions are locked. Changing them requires migration testing.

## Required Environment Variables

**Must exist at startup (fail-fast if missing):**

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

**Contract:** App crashes immediately if these are undefined.

## Database Reset Behavior

**Idempotent operations:**

- Seed scripts use UPSERT, not INSERT
- Running seed twice produces identical state
- No random UUIDs or timestamps in seed data

**Contract:** `npm run seed` can be run multiple times safely.

## Auth Contract

**Login flow:**

1. POST to `/auth/v1/token` with demo credentials
2. Receive `access_token` and `refresh_token`
3. Token must be valid for protected routes

**Contract:** If demo user exists, login must succeed.

## Health Check Contract

**Endpoint:** `GET /api/health`

**Expected response:**

```json
{
  "status": "ok",
  "timestamp": "<ISO8601>"
}
```

**Contract:** Returns 200 if app is operational.

## Build Reproducibility

**Deterministic outputs:**

- Same source → same build artifacts
- No timestamps in build output
- No hostname/username in artifacts

**Contract:** Two builds from same commit produce byte-identical results (excluding source maps).

---

**Violation Policy:**

If any invariant is violated, it is a **breaking change** requiring:

1. Migration guide
2. CI test updates
3. Documentation updates
4. Team notification
