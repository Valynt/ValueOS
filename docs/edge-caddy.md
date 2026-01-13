# Caddy Edge/Proxy Runbook

## Overview

The ValueOS edge layer uses Caddy as the front door for DEV, STAGING, and PROD. It terminates TLS, enforces security headers, proxies `/api/*` to the backend, and serves the SPA with a fallback to `index.html`.

### Architecture (text diagram)

```
Client
  │
  ▼
Caddy (TLS termination + security headers + routing)
  ├─ /api/*  → backend (Node/Express)
  ├─ /healthz → Caddy health
  └─ /*      → SPA assets (static build)
```

## Request Flow

1. Caddy receives the request on 80/443.
2. `/api/*` is proxied to `API_UPSTREAM`.
3. `/healthz` returns a Caddy-only health response.
4. All other routes serve static files from `STATIC_ROOT` with SPA fallback.

## TLS Modes

| Environment | Default         | Notes                                               |
| ----------- | --------------- | --------------------------------------------------- |
| DEV         | `tls internal`  | Self-signed certs (Caddy local CA). Trust required. |
| STAGING     | ACME staging    | `ACME_CA` points to Let’s Encrypt staging.          |
| PROD        | ACME production | Uses Let’s Encrypt production CA.                   |

## Environment & Secrets

- Local runs use `.env.dev`, `.env.staging`, or `.env.prod` (see example files).
- CI/CD should inject secrets via GitHub Actions secrets or your deployment platform’s secret store.
- Production compose expects secret files at `./secrets/supabase_service_key.txt` and `./secrets/openai_api_key.txt`; swap these for your secret manager mounts in real deployments.

### External/Enterprise PKI

Set `TLS_MODE` to a certificate + key path pair (space-separated) and mount the certs into the Caddy container.

Example:

```
TLS_MODE=/etc/caddy/certs/tls.crt /etc/caddy/certs/tls.key
```

## Local HTTPS Trust (DEV)

1. Start the dev stack:
   ```bash
   npm run dx:caddy:start
   ```
2. Trust the local CA:
   ```bash
   npm run dx:caddy:trust
   ```
3. Restart your browser and visit `https://localhost:8443`.

## Logs & Debugging

- Logs are JSON and rotated at `/var/log/caddy/access.log`.
- Inspect logs:
  ```bash
  npm run dx:caddy:logs
  ```
- Validate config:
  ```bash
  npm run dx:caddy:validate
  ```

## Zero-Downtime Reloads

Caddy supports in-place reloads without dropping active connections:

```bash
npm run dx:caddy:reload:prod
```

## Rollback Steps

1. Revert the Caddyfile or compose changes.
2. Reload Caddy:
   ```bash
   npm run dx:caddy:reload:prod
   ```
3. Confirm `/healthz` and `/api/health` are healthy.

## Incident Checklist

- Verify DNS points to the edge IP.
- Confirm certificates: `npm run dx:caddy:certs`.
- Check `access.log` for 4xx/5xx spikes.
- Validate upstream health:
  - `curl https://$APP_DOMAIN/healthz`
  - `curl https://$APP_DOMAIN/api/health`
- Ensure `API_UPSTREAM` is reachable from the Caddy container.

## Abuse Protection

Rate limiting is not enabled in core Caddy without plugins. For enterprise-grade abuse protection, place a WAF or CDN in front of the edge (Cloudflare, Fastly, AWS WAF) or build a Caddy image with a rate-limit plugin.
