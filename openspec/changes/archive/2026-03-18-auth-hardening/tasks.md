# Tasks

## 1. Fix AuthCallback Redirect

- [x] 1.1 Change `AuthCallback.tsx` redirect from `/home` to `/dashboard` on successful OAuth session exchange
- [x] 1.2 Verify redirect preserves original target URL for post-login return

## 2. Remove Dead Auth Files

- [x] 2.1 Delete `src/app/routes/index.tsx` (duplicate AppRoutes, never mounted)
- [x] 2.2 Delete `src/pages/auth/LoginPage.tsx` (only imported by dead routes)
- [x] 2.3 Delete `src/pages/auth/SignupPage.tsx` (only imported by dead routes)
- [x] 2.4 Delete `src/pages/auth/ResetPasswordPage.tsx` (only imported by dead routes)
- [x] 2.5 Delete `src/pages/auth/SetupPage.tsx` (only imported by dead routes)
- [x] 2.6 Delete `src/pages/auth/index.ts` (only imported by dead routes)
- [x] 2.7 Delete `src/views/Auth/SignupPage.tsx` (shadowed by ModernSignupPage, not imported)
- [x] 2.8 Delete `src/lib/authPersistence.ts` (not imported anywhere)
- [x] 2.9 Delete `src/lib/sessionManager.ts` (only imported by dead authPersistence)
- [x] 2.10 Delete `src/__tests__/useAuth.localstorage.test.tsx` (tests nonexistent hook)
- [x] 2.11 Verify no remaining imports reference deleted files

## 3. Fix Stale AuthCallback Test

- [x] 3.1 Update `AuthCallback.test.tsx` to assert redirect to `/dashboard` instead of `/home`

## 4. Role Model Alignment

- [x] 4.1 Update `computePermissions` in `types/security.ts` to use backend role model: owner, admin, member, viewer
- [x] 4.2 Remove stale role names: ADMIN, ANALYST, ROLE_ADMIN, ROLE_EDITOR
- [x] 4.3 Map roles to permission sets matching backend access rules

## 5. MFA Enforcement

- [x] 5.1 Add startup assertion: if `NODE_ENV=production` and `MFA_ENABLED !== "true"`, fail fast with clear error
- [x] 5.2 Verify MFA is required for billing mutations (subscription POST/PATCH)
- [x] 5.3 Document MFA requirement in `.env.example` and go-live checklist

## 6. Unit Tests

- [x] 6.1 Write `AuthContext.test.tsx`: test session establishment, token refresh, logout
- [x] 6.2 Write `ProtectedRoute.test.tsx`: test redirect for unauthenticated, render for authenticated
- [x] 6.3 Write `OnboardingGate.test.tsx`: test gate behavior for completed vs incomplete onboarding
- [x] 6.4 Write `auth-integration.test.tsx`: full login → protected route → logout flow

## 7. Verification

- [x] 7.1 Verify all auth files are reachable from main.tsx → App.tsx → AppRoutes.tsx entry point
- [x] 7.2 Run full test suite — no regressions
- [x] 7.3 Verify TypeScript compilation passes
