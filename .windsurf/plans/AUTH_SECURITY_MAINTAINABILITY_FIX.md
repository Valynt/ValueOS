# AuthContext Security and Maintainability Fix

This plan outlines steps to remove the hardcoded authentication bypass vulnerability and refactor the long AuthProvider function into smaller, maintainable components.

## Security Vulnerability: Remove Hardcoded Authentication Bypass

The login function contains a development-only bypass that allows login with email "dev@valynt.com" and password "bypass", creating mock user and session objects. This poses a security risk if deployed accidentally.

- Remove the bypass condition and mock user creation from the login function.
- Eliminate the `bypassUser` state variable.
- Update logout logic to remove bypass handling.
- Adjust the context value to remove bypass references.

## Code Maintainability: Refactor Long AuthProvider Function

The AuthProvider component is overly long with extensive useEffect and multiple auth methods, violating single responsibility.

- Extract authentication state management (useState, useEffect) into a custom `useAuthState` hook.
- Extract authentication methods (login, signup, logout, etc.) into a custom `useAuthMethods` hook that uses the state hook.
- Simplify AuthProvider to compose these hooks and provide the context.

## Implementation Order

1. Remove bypass logic and state.
2. Create `useAuthState` hook for state and effects.
3. Create `useAuthMethods` hook for auth functions.
4. Refactor AuthProvider to use new hooks.
5. Test authentication flows to ensure no regressions.

## Risks and Mitigations

- Ensure removal of bypass doesn't break dev workflows; consider environment-specific flags if needed, but prioritize security.
- Maintain all existing functionality during refactoring.
- Run tests post-changes to verify auth works correctly.
