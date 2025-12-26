# Caddy + Application Verification Checklist

## Local development (`infra/compose/compose.dev.yml`)

1. Start the stack (builds Vite + backend + Caddy):

```bash
docker compose -f infra/compose/compose.dev.yml up --build
```

2. Confirm Caddy is answering and proxying:

```bash
curl -i http://localhost:8080/healthz
curl -i http://localhost:8080/api/health
```

3. Check SPA + HMR pathing from the browser devtools: requests should target `http://localhost:8080` and WebSockets should upgrade to `ws://localhost:8080/ws/sdui`.

## Staging (`infra/compose/compose.stage.yml`)

1. Build the SPA locally: `npm run build` (ensures `dist/` is mounted into Caddy).
2. Start services:

```bash
APP_DOMAIN=staging.example.com ACME_EMAIL=ops@example.com docker compose -f infra/compose/compose.stage.yml up -d
```

3. Verify endpoints and headers:

```bash
curl -Ik https://staging.example.com/healthz
curl -Ik https://staging.example.com/api/health
curl -I https://staging.example.com/ | grep -E "strict-transport-security|content-security-policy|x-request-id"
```

4. WebSocket check (from a host with `wscat`):

```bash
wscat -c wss://staging.example.com/ws/sdui
```

## Production (`infra/compose/compose.prod.yml`)

Run the same sequence with `APP_DOMAIN` set to the production hostname. Confirm HSTS is present and CSP matches the expected origins.

## Rollback & troubleshooting

- Stop services: `docker compose -f infra/compose/compose.*.yml down`.
- Inspect Caddy logs: `docker compose -f infra/compose/compose.dev.yml logs caddy` (swap file per env).
- If ACME fails, set `ACME_CA` to the staging directory or use `tls internal` in the env-specific Caddyfile when running behind a TLS-terminating load balancer.
