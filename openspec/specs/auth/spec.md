# Auth Specification

## Purpose

Authentication, session management, and role-based access control for ValueOS. Covers OAuth session exchange, protected routes, MFA enforcement, role alignment between frontend and backend, and auth lifecycle hardening.

Consolidated from: `docs/specs/spec-auth-hardening.md`

## Requirements

### Requirement: OAuth session exchange and redirect

The system SHALL exchange OAuth tokens and redirect authenticated users to the dashboard.

#### Scenario: Successful OAuth callback

- GIVEN a user completes OAuth authentication with the identity provider
- WHEN the callback is processed
- THEN a session is established
- AND the user is redirected to `/dashboard`

#### Scenario: Failed OAuth callback

- GIVEN an OAuth callback with an invalid or expired code
- WHEN the callback is processed
- THEN no session is created
- AND the user is redirected to the login page with an error message

### Requirement: Protected route enforcement

The system MUST protect all authenticated routes and redirect unauthenticated users to login.

#### Scenario: Unauthenticated access to protected route

- GIVEN a user is not authenticated
- WHEN they navigate to a protected route
- THEN they are redirected to the login page
- AND the original target URL is preserved for post-login redirect

#### Scenario: Authenticated access to protected route

- GIVEN a user has a valid session
- WHEN they navigate to a protected route
- THEN the route renders normally

### Requirement: MFA enforcement for sensitive operations

The system MUST require MFA for sensitive operations including billing mutations and password changes.

#### Scenario: Billing mutation without MFA

- GIVEN a user attempts a billing mutation (subscription POST/PATCH)
- WHEN the request lacks MFA verification
- THEN the request is rejected with HTTP 403

#### Scenario: Billing mutation with MFA

- GIVEN a user has completed MFA verification
- WHEN they submit a billing mutation
- THEN the request is processed normally

#### Scenario: MFA enforcement in production

- GIVEN the system is running in a production environment
- WHEN `MFA_ENABLED` is not set to `true`
- THEN the system MUST fail fast at startup with a clear error message

### Requirement: Role model alignment

The system SHALL use a consistent role model across frontend and backend.

#### Scenario: Frontend permission computation

- GIVEN a user has a backend role (owner, admin, member, viewer)
- WHEN the frontend computes permissions
- THEN the permission set matches the backend's role-based access rules
- AND no stale or divergent role names are used in permission checks

### Requirement: Session expiration

The system MUST expire sessions after a period of inactivity.

#### Scenario: Idle timeout

- GIVEN an authenticated session
- WHEN the configured inactivity period passes without activity
- THEN the session is invalidated
- AND the user must re-authenticate

### Requirement: Secure token management

The system SHALL manage refresh tokens with replay detection and secure storage.

#### Scenario: Token refresh

- GIVEN a user's access token has expired
- WHEN the refresh token is used
- THEN a new access token is issued
- AND the refresh token is rotated (old one invalidated)

#### Scenario: Replay detection

- GIVEN a refresh token has already been used
- WHEN the same token is presented again
- THEN the system detects the replay
- AND invalidates all tokens for the session

### Requirement: No dead auth code

The system SHOULD NOT contain unreachable or dead authentication code paths.

#### Scenario: Auth code audit

- GIVEN the authentication codebase
- WHEN a code audit is performed
- THEN no unreachable auth files, unused providers, or dead imports exist
- AND all auth-related files are reachable from the application entry point
