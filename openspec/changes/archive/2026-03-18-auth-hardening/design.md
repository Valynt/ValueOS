# Design: Auth Hardening

## Technical Approach

Direct code fixes and test additions. No new services or architectural changes.

## Architecture Decisions

### Decision: Align to backend role model

Replace frontend flat role list (`ADMIN`, `ANALYST`) in `computePermissions` with the backend's role model (`owner`, `admin`, `member`, `viewer`). The frontend maps roles to permission sets locally.

### Decision: Delete dead code, not deprecate

Dead auth files are unreachable from the app entry point. Delete them outright rather than marking deprecated — they add confusion and maintenance risk.

## File Changes

### Deleted
- `apps/ValyntApp/src/app/routes/index.tsx`
- `apps/ValyntApp/src/pages/auth/LoginPage.tsx`
- `apps/ValyntApp/src/pages/auth/SignupPage.tsx`
- `apps/ValyntApp/src/pages/auth/ResetPasswordPage.tsx`
- `apps/ValyntApp/src/pages/auth/SetupPage.tsx`
- `apps/ValyntApp/src/pages/auth/index.ts`
- `apps/ValyntApp/src/views/Auth/SignupPage.tsx`
- `apps/ValyntApp/src/lib/authPersistence.ts`
- `apps/ValyntApp/src/lib/sessionManager.ts`
- `apps/ValyntApp/src/__tests__/useAuth.localstorage.test.tsx`

### Modified
- `apps/ValyntApp/src/views/Auth/AuthCallback.tsx` — Redirect to /dashboard
- `apps/ValyntApp/src/types/security.ts` — Align computePermissions role model

### New (Tests)
- `apps/ValyntApp/src/__tests__/AuthContext.test.tsx`
- `apps/ValyntApp/src/__tests__/ProtectedRoute.test.tsx`
- `apps/ValyntApp/src/__tests__/OnboardingGate.test.tsx`
- `apps/ValyntApp/src/__tests__/auth-integration.test.tsx`
