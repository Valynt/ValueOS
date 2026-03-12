# Spec: Auth Lifecycle Hardening

## Problem Statement

The original review identified three gaps (A/B/C) in the auth implementation. A codebase audit confirms:

- **Gap A** (Auth0 vs Supabase duplication): No Auth0 provider exists. The review was based on stale information. Not applicable.
- **Gap B** (protected routes commented out): Routes are fully wired in `AppRoutes.tsx`. Not applicable.
- **Gap C** (SecureTokenManager is a stub): `SecureTokenManager` is fully implemented with refresh token fingerprinting, replay detection, and HttpOnly cookie semantics. Not applicable.

The actual gaps found during audit are:

1. `AuthCallback` redirects to `/home` instead of `/dashboard` directly (double redirect).
2. Eight dead auth files exist alongside the live implementation, creating confusion and maintenance risk.
3. `AuthContext` has no unit tests. `ProtectedRoute` and `OnboardingGate` have no unit tests.
4. One existing test (`AuthCallback.test.tsx`) asserts the stale `/home` redirect.
5. No frontend integration test covers the full login → protected route → logout flow.
6. `computePermissions` in `types/security.ts` uses a flat role list (`ADMIN`, `ANALYST`) that does not align with the backend's role model (`ROLE_ADMIN`, `ROLE_EDITOR`, `owner`, `admin`, `member`, `viewer`).

---

## Requirements

### R1 — Fix AuthCallback redirect

`AuthCallback` must redirect to `/dashboard` on successful OAuth session exchange, not `/home`.

**Files:**
- `apps/ValyntApp/src/views/Auth/AuthCallback.tsx`

### R2 — Remove dead auth files

The following files are unreachable from the live app entry point (`main.tsx → App.tsx → AppRoutes.tsx`) and must be deleted:

| File | Reason |
|---|---|
| `src/app/routes/index.tsx` | Duplicate `AppRoutes` component, never mounted |
| `src/pages/auth/LoginPage.tsx` | Only imported by dead `app/routes/index.tsx` |
| `src/pages/auth/SignupPage.tsx` | Only imported by dead `app/routes/index.tsx` |
| `src/pages/auth/ResetPasswordPage.tsx` | Only imported by dead `app/routes/index.tsx` |
| `src/pages/auth/SetupPage.tsx` | Only imported by dead `app/routes/index.tsx` |
| `src/pages/auth/index.ts` | Only imported by dead `app/routes/index.tsx` |
| `src/views/Auth/SignupPage.tsx` | Shadowed by `ModernSignupPage`, not imported anywhere |
| `src/lib/authPersistence.ts` | Not imported anywhere in live code |
| `src/lib/sessionManager.ts` | Only imported by dead `authPersistence.ts` |

Also delete the test that targets a dead hook:
- `src/__tests__/useAuth.localstorage.test.tsx` — tests `client/src/_core/hooks/useAuth` which does not exist in this repo

### R3 — Fix stale AuthCallback test

`src/views/Auth/__tests__/AuthCallback.test.tsx` asserts `navigate("/home", ...)`. Update to assert `navigate("/dashboard", ...)`.

### R4 — Add AuthContext unit tests

Create `src/contexts/__tests__/AuthContext.test.tsx` covering:

- `login`: success path sets user/session/userClaims; error path throws
- `signup`: with session (immediate auth); without session (email verification required)
- `logout`: clears user/session state; calls `supabase.auth.signOut`
- `resetPassword`: calls `supabase.auth.resetPasswordForEmail`
- `signInWithProvider`: calls `supabase.auth.signInWithOAuth` with correct provider and redirectTo
- `onAuthStateChange SIGNED_OUT`: clears state and calls `secureTokenManager.clearSessionStorage`
- `onAuthStateChange SIGNED_IN`: sets state and calls `secureTokenManager.storeSession`
- `isAuthenticated`: true when user is set, false when null

Mock `supabase`, `secureTokenManager`, and `analyticsClient`.

### R5 — Add ProtectedRoute unit tests

Create `src/app/routes/__tests__/ProtectedRoute.test.tsx` covering:

- Unauthenticated user: redirects to `/login` with `state.from` set to current location
- Authenticated user: renders `<Outlet />`
- Loading state: renders "Authenticating..." and does not redirect

### R6 — Add frontend integration test for auth lifecycle

Create `src/contexts/__tests__/auth.integration.test.tsx` covering:

- Full flow: login → `isAuthenticated` becomes true → logout → `isAuthenticated` becomes false
- OAuth callback flow: `getSession` returns session → `onAuthStateChange` fires → user state populated
- Expired/invalid session: background auth check clears optimistic state

Use `renderHook` with a real `AuthProvider` wrapper. Mock the following modules:
- `lib/supabase` — prevent real Supabase calls
- `lib/auth/SecureTokenManager` — control session state
- `lib/env` (`getSupabaseConfig`) — return non-empty URL/key so `initAuth` does not early-exit, leaving `loading: true` indefinitely
- `lib/analyticsClient` — prevent side effects

### R7 — Align frontend role constants with backend

`computePermissions` in `src/types/security.ts` checks for `ADMIN` and `ANALYST` roles. Two role systems exist:

- **Tenant roles** (`owner`, `admin`, `member`, `viewer`) — used by `AdminUserService` and `useAdminPermissions`
- **RBAC roles** (`ROLE_ADMIN`, `ROLE_EDITOR`, `ROLE_OPERATOR`, `ROLE_AUDITOR`, `ROLE_VIEWER`) — used by `RbacService` and present in JWT claims

`computePermissions` must handle both. The target mapping, expressed in the frontend's existing permission strings (`admin`, `read`, `write`, `delete`):

| Role | Permissions |
|---|---|
| `owner` / `ROLE_ADMIN` | `admin`, `read`, `write`, `delete` |
| `admin` / `ROLE_EDITOR` | `read`, `write`, `delete` |
| `member` / `ROLE_OPERATOR` | `read`, `write` |
| `viewer` / `ROLE_AUDITOR` / `ROLE_VIEWER` | `read` |

The legacy `ADMIN` and `ANALYST` strings must continue to work during the transition (map to `owner` and `member` equivalents respectively) and can be removed once confirmed unused in production JWT claims.

---

## Acceptance Criteria

| # | Criterion |
|---|---|
| AC1 | OAuth sign-in redirects to `/dashboard` without an intermediate `/home` hop |
| AC2 | All 9 dead auth files and 1 dead test are deleted; no import errors introduced |
| AC3 | `AuthCallback.test.tsx` passes with `/dashboard` assertion |
| AC4 | `AuthContext.test.tsx` exists with ≥8 test cases covering all auth methods |
| AC5 | `ProtectedRoute.test.tsx` exists with ≥3 test cases |
| AC6 | `auth.integration.test.tsx` exists with ≥3 integration scenarios |
| AC7 | `computePermissions` maps all tenant roles (`owner`, `admin`, `member`, `viewer`) and all RBAC roles (`ROLE_ADMIN`, `ROLE_EDITOR`, `ROLE_OPERATOR`, `ROLE_AUDITOR`, `ROLE_VIEWER`) to the correct permission sets per the R7 table; legacy `ADMIN`/`ANALYST` strings continue to resolve |
| AC8 | `pnpm test` passes with no regressions |

---

## Implementation Order

1. **Delete dead files** (R2) — removes noise before any other changes; verify no import errors with `pnpm run typecheck`
2. **Fix AuthCallback redirect** (R1) — one-line change in `AuthCallback.tsx`
3. **Fix stale test** (R3) — update `AuthCallback.test.tsx` to assert `/dashboard`
4. **Align role constants** (R7) — update `computePermissions` in `types/security.ts`
5. **Add AuthContext unit tests** (R4) — new test file
6. **Add ProtectedRoute unit tests** (R5) — new test file
7. **Add auth integration test** (R6) — new test file
8. **Run full test suite** — `pnpm test` must pass

---

## Files Changed

| File | Action |
|---|---|
| `apps/ValyntApp/src/views/Auth/AuthCallback.tsx` | Edit: `/home` → `/dashboard` |
| `apps/ValyntApp/src/views/Auth/__tests__/AuthCallback.test.tsx` | Edit: assert `/dashboard` |
| `apps/ValyntApp/src/types/security.ts` | Edit: align `computePermissions` role strings |
| `apps/ValyntApp/src/app/routes/index.tsx` | Delete |
| `apps/ValyntApp/src/pages/auth/LoginPage.tsx` | Delete |
| `apps/ValyntApp/src/pages/auth/SignupPage.tsx` | Delete |
| `apps/ValyntApp/src/pages/auth/ResetPasswordPage.tsx` | Delete |
| `apps/ValyntApp/src/pages/auth/SetupPage.tsx` | Delete |
| `apps/ValyntApp/src/pages/auth/index.ts` | Delete |
| `apps/ValyntApp/src/views/Auth/SignupPage.tsx` | Delete |
| `apps/ValyntApp/src/lib/authPersistence.ts` | Delete |
| `apps/ValyntApp/src/lib/sessionManager.ts` | Delete |
| `apps/ValyntApp/src/__tests__/useAuth.localstorage.test.tsx` | Delete |
| `apps/ValyntApp/src/contexts/__tests__/AuthContext.test.tsx` | Create |
| `apps/ValyntApp/src/app/routes/__tests__/ProtectedRoute.test.tsx` | Create |
| `apps/ValyntApp/src/contexts/__tests__/auth.integration.test.tsx` | Create |

---

## Out of Scope

- MFA enrollment/verification in the frontend
- Backend auth service changes (already well-tested)
- Admin API route tests (separate concern)
- Session timeout UI (warning dialogs, idle detection)
