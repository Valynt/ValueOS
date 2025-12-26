This helper creates a local dummy user for development and testing.

Options:

1. Preferred: Use Supabase Admin API (service role key)

- Required env vars:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE
  - JWT_SECRET (optional, used for generating a dev JWT)

Run:

```bash
node scripts/create_dummy_user.js
```

This will create an auth user via Supabase Admin API and print a dev JWT you can use for local testing.

2. SQL fallback: Insert a users row directly

If you don't have the service_role key, use the SQL seed which inserts a users row (and optional profile).

```bash
# Ensure DATABASE_URL points to your development DB
psql $DATABASE_URL -f scripts/seeds/create_dummy_user.sql
```

Post-setup notes:

- Remove any demo-mode sessionStorage fallback and ensure all client code uses `secureTokenManager` or Supabase client for session checks.
- Re-run app and verify login works with the created user. Use the printed JWT as needed for server-side tests.
