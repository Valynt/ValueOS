# Auth Backend Enforcement Plan

This note captures backend changes to enforce MFA/password policy and breached-password checks in Supabase/auth.

## Password & MFA enforcement (Supabase)
- Enable MFA: `supabase.auth.mfa.enforce()` for targeted roles/tenants.
- Set password complexity: Configure GOTRUE settings or add edge validation:
  - `GOTRUE_PASSWORD_MIN_LENGTH=12`
  - `GOTRUE_PASSWORD_REQUIRE_SPECIAL_CHARS=true`
  - `GOTRUE_PASSWORD_REQUIRE_UPPERCASE=true`
  - `GOTRUE_PASSWORD_REQUIRE_LOWERCASE=true`
  - `GOTRUE_PASSWORD_REQUIRE_NUMBERS=true`
- Lockout policy: `GOTRUE_MAX_CONCURRENT_SIGNUPS`, `GOTRUE_MAX_CONCURRENT_SIGNINS`, and rate limits at gateway.

## Breached-password check via Edge Function
- Create Supabase Edge Function `password-breach-check` that:
  1) Accepts `{ password }`, hashes with SHA-1, queries HIBP k-anonymity (`/range/{prefix}`), and returns `breached: boolean`.
  2) Called during signup/password-change; block if `breached=true`.
- Hook from the client via `AuthService` (already checks) AND enforce server-side by:
  - Trigger in PostgREST RPC or Row Level Security check on `auth.users` profile table to require `breached=false` flag from the function before insert/update.

## SQL policy sketch (profiles)
```sql
-- Require MFA flag and non-breached passwords for insert/update
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY mfa_required ON profiles
  USING (current_setting('request.jwt.claim.mfa', true)::boolean = true);

CREATE POLICY password_not_breached ON profiles
  USING (current_setting('request.jwt.claim.password_breached', true)::boolean = false);

-- Ensure claim is present (set via Edge Function + JWT custom claims)
COMMENT ON POLICY password_not_breached ON profiles IS 'Blocks updates when password_breached=true';
```

## Gateway/rate limits for auth
- At API gateway, apply rate limits per IP + tenant for `/auth/v1/token` and `/auth/v1/signup`.
- Enable bot protection/captcha for signup if allowed.

## Deployment checklist
- Set GOTRUE env vars for complexity + MFA.
- Deploy Edge Function + add claim injection to JWT (`password_breached` + `mfa`).
- Apply RLS policies above; test with and without MFA/breached-password flags.
- Add monitoring/alerts on failed MFA and breach blocks.
