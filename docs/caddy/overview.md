# Caddy Reverse Proxy — Overview

## Architecture Summary

- Purpose: Provide a secure, performant reverse proxy for the ValueCanvas frontend and backend, supporting SPA routing, API reverse-proxying, WebSockets/SSE, and automatic HTTPS for stage/prod.
- Components:
  - Caddy (TLS, routing, compression, header injection, logging)
  - Vite dev server (frontend) in development
  - Backend API server (HTTP + WebSockets)
  - Optional static frontend served by Caddy in stage/prod

## Topology

- Dev:
  - Caddy runs in Docker container and proxies:
    - `/` → Vite dev server (`app:5173`) for SPA and HMR
    - `/api/*` → backend (`host.docker.internal:8000` by default) or container `backend:8000` if present
  - Unified origin: http://localhost:8080 (Caddy listens on container port 80; mapped to host 8080)

- Stage/Prod:
  - Caddy runs at edge (container or VM) and terminates TLS (default)
  - Caddy serves built frontend from `root /srv/frontend` and proxies `/api/*` to `backend:8000`
  - Automatic HTTPS (ACME) used by default unless TLS is terminated upstream

## DNS & TLS Strategy

- Dev: self-signed or HTTP only (default) - use `localhost:8080` to avoid privileged ports. Local TLS is optional (see notes).
- Stage/Prod: Automatic HTTPS via ACME (Caddy performs ACME); if you have an external LB, set Caddy to operate behind the LB and disable ACME in Caddy (`tls internal` or `tls off`).

## Separation of Concerns

- Proxy: Caddy handles routing and TLS termination.
- Headers: Caddy injects security and forwarded headers; backend trusts `X-Forwarded-*` headers.
- Caching/Compression: Caddy applies `gzip`/`zstd` for static assets; `Cache-Control` for immutable assets.
- Logging: Structured JSON logs are written to stdout and optionally to files in stage/prod with redaction for sensitive fields.

## Operational Notes

- Avoid exposing backend directly to browser; prefer same-origin `/api` paths.
- For HMR/WebSocket to work in containers, set `VITE_HMR_HOST` to `0.0.0.0` and `VITE_HMR_PROTOCOL` to `ws` (already applied in repo).
