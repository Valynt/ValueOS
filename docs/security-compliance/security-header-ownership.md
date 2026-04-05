# Canonical security-header ownership (edge vs app)

This baseline defines the authoritative security-critical header matrix for ValueOS and the intended ownership model.

## Canonical matrix

| Header                      | Canonical value                                                                                                                                                                                                                     | Ownership                                                     | Rationale                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload`                                                                                                                                                                                      | **edge** (NGINX authoritative)                                | HSTS is most reliable when enforced at the TLS termination boundary.                                          |
| `Content-Security-Policy`   | Baseline directives: `default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests`                                                                                | **both** (edge baseline + app-specific strict CSP with nonce) | Edge guarantees a minimal hardening floor; app refines with route/runtime-aware directives and nonce support. |
| `X-Frame-Options`           | `DENY`                                                                                                                                                                                                                              | **both**                                                      | Legacy clickjacking protection remains in both layers while CSP `frame-ancestors` is primary.                 |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                                                                                                                                                                   | **both**                                                      | Keep deterministic behavior for direct edge responses and app responses.                                      |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=(), ambient-light-sensor=(), autoplay=(), encrypted-media=(), fullscreen=(), picture-in-picture=()` | **app** (mirrored at edge)                                    | App owns feature gating semantics; edge mirrors to keep a secure fallback posture.                            |

## Drift contract

CI must fail if security-critical headers diverge between:

- `infra/nginx/nginx.conf` (edge), and
- `packages/backend/src/middleware/securityHeaders.ts` + `packages/backend/src/config/securityConfig.ts` (app).

Implemented by `scripts/ci/check-security-header-drift.mjs`.
