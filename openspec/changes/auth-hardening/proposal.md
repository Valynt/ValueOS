# Proposal: Auth Hardening

## Intent

Close remaining auth lifecycle gaps: fix redirect paths, remove dead auth code, align frontend/backend role models, add missing unit tests, and enforce MFA in production.

## Scope

In scope:
- Fix AuthCallback redirect to /dashboard
- Remove 9 dead auth files
- Fix stale AuthCallback test
- Add unit tests for AuthContext, ProtectedRoute, OnboardingGate
- Add frontend integration test for login → protected route → logout
- Align frontend role model with backend (owner, admin, member, viewer)

Out of scope:
- New auth providers
- SSO/SAML integration (V2)
- Passwordless auth (V2)

## Approach

Surgical fixes to existing auth implementation. No architectural changes — the core auth stack (Supabase, SecureTokenManager, ProtectedRoute) is sound. Focus on cleanup, testing, and alignment.
