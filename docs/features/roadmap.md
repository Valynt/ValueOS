# Roadmap

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## Changelog

*Source: `features/roadmap/CHANGELOG.md`*

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

---
## Localization & Regional Compliance Roadmap (2026)

### Phase 1 — Foundation (Q1)
- Expand supported locales from `en`, `es` to include `fr`, `de`, and `pt-BR` for North America + LATAM + Western Europe customer coverage.
- Add CI translation coverage gates for missing keys, unused keys, and fallback-ratio thresholds.
- Establish localization standards for formatting, pluralization, and RTL-readiness.

### Phase 2 — Regional Expansion (Q2)
- Add `ja` and `ko` support for APAC enterprise pilots.
- Introduce regional legal/compliance content packs (privacy notices, consent copy, billing terms) with locale-specific review owners.
- Enforce release-level localization QA for all user-facing feature changes.

### Phase 3 — Compliance Hardening (Q3)
- Add locale-specific regulatory messaging support for customer-facing flows (data rights, consent, retention notices) aligned to regional legal counsel approvals.
- Add pseudo-localization test runs to catch truncation, overflow, and hardcoded string regressions.
- Track translation SLA and fallback ratio as launch-readiness metrics.

### Region and Compliance Mapping
- **North America (US/Canada):** `en`, `es`, `fr-CA` readiness; accessibility-first copy review and bilingual support where contractually required.
- **European Union:** `en`, `fr`, `de`, `es`, `it` roadmap; GDPR-required notices, consent language accuracy, and legal sign-off workflow.
- **United Kingdom & Ireland:** `en-GB` terminology variant support for legal and finance language.
- **LATAM:** `es-419`, `pt-BR`; tax/billing language and customer support flows localized for commercial onboarding.
- **APAC pilots:** `ja`, `ko`; date/time, address, and honorific conventions validated before GA in-region.
- **Middle East (as needed):** `ar`/RTL readiness gate before go-live, including mirrored layout and bidirectional QA checks.
