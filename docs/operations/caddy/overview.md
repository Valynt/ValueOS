# Caddy Reverse Proxy — Architecture & Runbook

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

- **Stage (`infra/docker/docker-compose.staging.yml`)**
  - Caddy terminates TLS (ACME staging CA by default) and serves static assets from `dist` mounted at `/srv/www`.
  - `/api/*` and `/ws/*` proxied to `backend:${API_PORT:-3001}` inside the compose network.
  - HTTP → HTTPS redirect; health at `/healthz` answered by Caddy.
  - To run behind a cloud LB, switch `tls` to `tls internal` in `infra/caddy/Caddyfile.stage` and rely on forwarded headers.

- **Prod (`infra/docker/docker-compose.prod.yml`)**
  - Same routing as stage with ACME production CA and stricter headers (HSTS).
  - Caddy serves static assets from `/srv/www` and proxies `/api/*` + `/ws/*` to `backend:${API_PORT:-3001}`.
  - HTTP → HTTPS redirect; Caddy health at `/healthz`.

## DNS & TLS strategy

- **Default:** Caddy terminates TLS using ACME. Configure `APP_DOMAIN` and `ACME_EMAIL` env vars in compose; `ACME_CA` defaults to the appropriate Let’s Encrypt directory.
- **Behind external LB:** Replace the `tls` blocks in stage/prod Caddyfiles with `tls internal` and ensure the LB forwards `X-Forwarded-Proto`/`Host`. HSTS remains enforced by Caddy.
- **Local dev:** HTTP only (no ACME). Local TLS can be enabled by mapping 8443 and updating the dev Caddyfile, but defaults avoid privileged ports.

## Routing contract

- SPA: fallback to `/public/public/index.html` via `spa_static` snippet in `infra/caddy/Caddyfile`.
- API: `handle_path /api/*` → `reverse_proxy {$API_UPSTREAM:http://backend:${API_PORT:-3001}}` with streaming-friendly `flush_interval -1` for SSE/WebSockets.
- WebSockets/SSE: `/ws/*` shares the API upstream block; headers pass `X-Forwarded-*` and `X-Request-ID`.
- Caching: immutable caching for hashed assets; HTML is `no-store` to prevent stale shells. Compression via `zstd` + `gzip` with safe MIME filters.
- Security headers: CSP defaults to same-origin (`connect-src 'self' https: wss:`), COOP/COEP, and permissions-policy. HSTS added for TLS sites.

## Caddyfiles

- Base snippets: `infra/caddy/Caddyfile` defines shared headers, compression, SPA/file-server rules, API proxy, and health responder. `STATIC_ROOT` defaults to `/srv/www`.
- Environment overlays:
  - `infra/caddy/Caddyfile.dev`: HTTP, admin API enabled, proxies to Vite + backend.
  - `infra/caddy/Caddyfile.stage`: ACME staging CA, HTTPS redirect, static serving, comment for LB offload.
  - `infra/caddy/Caddyfile.prod`: ACME production CA, HSTS, static serving, comment for LB offload.

## Docker Compose integration

- **Dev:** `docker compose -f infra/docker/docker-compose.caddy.yml up --build` → browse `http://localhost:8080`. Caddy upstreams are auto-wired to `frontend:5173` and `backend:3001`.
- **Stage/Prod:** build the SPA (`npm run build` to populate `dist/`), then:
  - Stage: `APP_DOMAIN=staging.example.com ACME_EMAIL=ops@example.com docker compose -f infra/docker/docker-compose.staging.yml up -d`
  - Prod: `APP_DOMAIN=app.example.com ACME_EMAIL=security@example.com docker compose -f infra/docker/docker-compose.prod.yml up -d`
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
- Verify routing: `curl -i https://$APP_DOMAIN/healthz` (Caddy), `curl -i https://$APP_DOMAIN/api/health` (backend), WebSockets via `wscat -c wss://$APP_DOMAIN/ws/sdui`.
- Verify headers: check CSP, HSTS (prod), `X-Request-ID`, and absence of `Server` header.
- Rollback: `docker compose ... down` and restore prior Caddyfile/compose versions; ACME data persists in `caddy-data` volume.
