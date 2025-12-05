# Security Header & Cookie Validation Runbook

This runbook provides a repeatable checklist to confirm that security headers and session cookies are enforced across environments.

## What to Validate

- **Gateway headers**: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.
- **Application middleware**: routes should apply the server-side security header middleware to mirror gateway defaults.
- **Session cookies**: `Secure`, `HttpOnly`, and `SameSite` flags align with the session configuration.

## Environments

Use the correct base URL and environment variables before running checks:

| Environment | Base URL | Notes |
| --- | --- | --- |
| Local | `http://localhost:3000` (frontend) / `http://localhost:3001` (billing API) | Use `VITE_APP_URL` and `API_PORT` from `.env.local`. |
| Staging | `https://staging.valuecanvas.com` | Ensure `SERVICE_IDENTITY_TOKEN` is configured for gateway-to-service calls. |
| Production | `https://app.valuecanvas.com` | Header values must match the strict policies in `docs/gateway_security_headers.md`. |

## Header Verification

1. **Fetch headers**
   ```bash
   curl -I <base-url> \
     | grep -Ei 'content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy'
   ```
2. **Compare values**
   - CSP should align with the directives defined in `src/security/SecurityHeaders.ts` (e.g., `frame-ancestors 'none'; base-uri 'self'; upgrade-insecure-requests`).
   - HSTS must include `max-age=31536000; includeSubDomains; preload` in staging and production.
   - `X-Frame-Options` should be `DENY`; `X-Content-Type-Options` should be `nosniff`.
3. **Application middleware spot-check**
   - Hit a representative API route (e.g., `/api/llm/health` or `/api/billing/usage`) and confirm the same headers are present, proving the middleware is active even when the gateway is bypassed.

## Cookie Verification

1. **Trigger a session cookie**
   - Authenticate through the UI (local/staging/prod) and capture response headers:
   ```bash
   curl -I -X POST <base-url>/auth/login \
     -H "x-csrf-token: <token>" -H "Cookie: csrf_token=<token>" \
     -d '{"email":"user@example.com","password":"password"}'
   ```
2. **Confirm flags**
   - `Set-Cookie` values must include `Secure`, `HttpOnly`, and `SameSite=strict|lax` per `session.sameSite` in `src/security/SecurityConfig.ts`.
   - Verify the `Path` and `Domain` values match the environment configuration.
3. **Cross-check idle/absolute timeout expectations**
   - Ensure expiration aligns with `session.timeout` and `session.absoluteTimeout` in `SecurityConfig`.

## Reporting

- Record header and cookie outputs in the security dashboard or ticket.
- Open an incident if any header is missing or any cookie flag deviates from configuration.
- Tag findings with the environment and the exact curl output for traceability.

