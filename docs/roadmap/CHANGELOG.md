# Changelog

## [Unreleased]

### Added

- infra/caddy: Add `Caddyfile.dev`, `Caddyfile.stage`, `Caddyfile.prod` with secure defaults and SPA + /api routing. ✅
- infra/docs: `docs/caddy/overview.md` and `VERIFY.md` with verification and runbook steps. ✅
- infra/compose: Added `compose.dev.yml`, `compose.stage.yml`, and `compose.prod.yml` wiring Caddy, Vite, and the API with shared volumes and ACME-aware defaults. ✅
- infra/caddy: Shared base snippets for security headers, SPA fallback, and SSE-friendly proxying reused across all environments. ✅

### Changed

- `vite.config.ts` HMR defaults set to use configurable host and protocol for containerized HMR. ✅
- `src/config/environment.ts` default `VITE_APP_URL` changed to `http://localhost:8080` and `VITE_API_BASE_URL` default changed to `/api` to prefer same-origin API usage. ✅
- `src/backend/server.ts` CORS config updated to rely on `security.corsOrigins`, and Express now trusts proxy headers for accurate scheme/host detection. ✅
- `src/config/settings.ts` now exposes `security.corsOrigins`, coerces `API_PORT` to a number, and accepts staging `NODE_ENV` values. ✅
- `docs/caddy/overview.md` updated with the dev/stage/prod topology, TLS strategy, and operational checklist aligned to the new Caddyfiles and compose bundles. ✅
- `VERIFY.md` refreshed with environment-specific verification commands and rollback guidance. ✅

### Fixes

- Fixed Caddy docker mount to ensure the Caddyfile is mounted as a file to avoid "is a directory" parsing errors. ✅

Rationale: These changes improve developer experience (single origin for HMR and APIs), security (no process.env leakage in browser bundles), and operational stability (Caddy-managed TLS and robust routing for WebSockets and SPA fallbacks).
