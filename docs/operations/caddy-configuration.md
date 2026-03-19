---
title: Caddy Configuration
owner: team-operations
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Caddy Configuration

**Last Updated**: 2026-03-19

**Consolidated from 1 source documents**

---

## Caddy Reverse Proxy — Architecture & Runbook

*Source: `operations/caddy/overview.md`*

This document explains how the new Caddy layer is wired for dev/stage/prod, the DNS/TLS posture, and what code/config to align so the Vite + React SPA and Express API work behind the proxy.

## Assumptions

- Frontend: Vite + React/TS (SPA) with SDUI fallbacks.
- Backend: Express + WebSockets at `/ws/sdui` (HTTP on `:3001` via `API_PORT`).
- API prefix: `/api/*` (same-origin preferred).
- Dev origin: `http://localhost:8080` via Caddy → Vite `:5173` and API `:3001`.
- Stage/Prod: public DNS on `APP_DOMAIN` with Caddy terminating TLS by default.

## Topology by environment

- **Dev (`infra/docker/docker-compose.caddy.yml`)**
  - Caddy on port 8080 → `/` proxied to Vite dev server (`frontend:5173`), `/api/*` + `/ws/*` → API (`backend:3001`).
  - HTTP only; admin API exposed on `:2019` for live reloads.
  - HMR stays same-origin via Caddy to avoid CORS.

- **Stage (`ops/compose/compose.staging.yml`)**
  - Caddy terminates TLS (ACME staging CA by default) and serves the frontend while proxying backend traffic only on `/api/*`.
  - The backend stays private to the compose network; external callers must not target a host-published backend port.
  - HTTP → HTTPS redirect remains in place, but there is no separate public `/healthz` ingress. Use `https://$APP_DOMAIN/api/health` for external health and run readiness checks from inside the compose network namespace.
  - To run behind a cloud LB, switch `tls` to `tls internal` in `infra/caddy/Caddyfile.staging` and rely on forwarded headers.

- **Prod (`infra/caddy/Caddyfile.prod`)**
  - Same routing policy as stage with ACME production CA and stricter headers (HSTS).
  - Caddy serves the frontend and proxies backend traffic only on `/api/*`; there is no separate public health endpoint outside `/api`.

## DNS & TLS strategy

- **Default:** Caddy terminates TLS using ACME. Configure `APP_DOMAIN` and `ACME_EMAIL` env vars in compose; `ACME_CA` defaults to the appropriate Let’s Encrypt directory.
- **Behind external LB:** Replace the `tls` blocks in stage/prod Caddyfiles with `tls internal` and ensure the LB forwards `X-Forwarded-Proto`/`Host`. HSTS remains enforced by Caddy.
- **Local dev:** HTTP only (no ACME). Local TLS can be enabled by mapping 8443 and updating the dev Caddyfile, but defaults avoid privileged ports.

## Routing contract

- SPA: fallback to `/public/public/index.html` via `spa_static` snippet in `infra/caddy/Caddyfile`.
- API: `handle /api/*` → `reverse_proxy {$API_UPSTREAM}`. `/api` is the only supported external/backend ingress prefix for browser clients and third-party callers.
- Internal-only health and readiness endpoints continue to live on the backend service itself (`/health`, `/health/ready`) and should be queried from inside the compose or cluster network namespace, not through a host-published backend port.
- Caching: immutable caching for hashed assets; HTML is `no-store` to prevent stale shells. Compression via `zstd` + `gzip` with safe MIME filters.
- Security headers: CSP defaults to same-origin (`connect-src 'self' https: wss:`), COOP/COEP, and permissions-policy. HSTS added for TLS sites.

## Caddyfiles

- Base snippets: `infra/caddy/Caddyfile` defines shared headers, compression, SPA/file-server rules, and the API proxy. `STATIC_ROOT` defaults to `/srv/www`.
- Environment overlays:
  - `infra/caddy/Caddyfile.dev`: HTTP, admin API enabled, proxies to Vite + backend.
  - `infra/caddy/Caddyfile.staging`: ACME staging CA, HTTPS redirect, static serving, comment for LB offload.
  - `infra/caddy/Caddyfile.prod`: ACME production CA, HSTS, static serving, comment for LB offload.

## Docker Compose integration

- **Dev:** `docker compose -f infra/docker/docker-compose.caddy.yml up --build` → browse `http://localhost:8080`. Caddy upstreams are auto-wired to `frontend:5173` and `backend:3001`.
- **Stage/Prod:** build the SPA (`npm run build` to populate `dist/`), then:
  - Stage: `APP_DOMAIN=staging.example.com ACME_EMAIL=ops@example.com docker compose -f ops/compose/compose.staging.yml --env-file ops/env/.env.staging up -d --build`
  - Prod: deploy the equivalent production compose or cluster manifest with the same `/api`-only ingress policy.
    Static assets mount from `dist` into Caddy at `/srv/www`; backend runs from source via `npm run backend:dev` (swap to a compiled server image if desired).

## Codebase refactors & validation checklist

- Backend now trusts proxy headers (`app.set('trust proxy', true)`) and derives CORS from `settings.security.corsOrigins`.
- `src/config/settings.ts` now exposes `security.corsOrigins` (defaults include `http://localhost:8080`) and coerces `API_PORT` to a number.
- Frontend defaults already use relative `/api` (`src/config/environment.ts`); avoid `process.env` in browser bundles.
- Verify WebSocket clients use relative paths (`/ws/sdui`) to stay same-origin through Caddy.
- If adding new API origins, update `CORS_ALLOWED_ORIGINS` env and keep CSP `connect-src` aligned.

## Operational checklist

- Build artifacts (stage/prod): `npm run build` → ensure `dist/` exists before starting Caddy.
- Start services with the compose files above.
- Verify external routing: `curl -i https://$APP_DOMAIN/api/health` and `curl -I https://$APP_DOMAIN/`.
- Verify internal readiness from inside the network namespace: `docker compose -f ops/compose/compose.staging.yml --env-file ops/env/.env.staging exec backend curl -i http://localhost:${BACKEND_PORT:-3001}/health/ready`.
- If emergency debugging requires direct backend access, add `-f ops/compose/profiles/staging-admin-debug.yml --profile admin-debug` temporarily; it binds to `127.0.0.1` only and must stay disabled in shared staging environments.
- Verify headers: check CSP, HSTS (prod), `X-Request-ID`, and absence of `Server` header.
- Rollback: `docker compose ... down` and restore prior Caddyfile/compose versions; ACME data persists in `caddy-data` volume.

---