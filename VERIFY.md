# Caddy + App Verification Checklist

## Local Dev (Caddy + Vite)

1. Start stack (dev):

```bash
# Ensure infra/caddy/Caddyfile.dev exists
docker-compose -f docker-compose.caddy.yml up -d
```

2. Confirm Caddy is running and serving app:

```bash
curl -v http://localhost:8080/ -I
# Expect HTTP 200 or 302 to /index.html
```

3. Check API proxying

```bash
curl -v http://localhost:8080/api/health
# If backend on host:8000 is running, expect its health response
```

4. HMR WebSocket check

```bash
# From browser developer console observe WebSocket connection to ws://localhost:24678
# Or use websocket client
wscat -c ws://localhost:24678
```

## Stage/Prod

- Validate TLS (HTTPS) and ACME challenge logs in Caddy
- Test `/api/*` routes and WebSocket endpoints

## Headers

```bash
curl -I https://staging.example.com/ | jq .
# Expect security headers (HSTS, CSP, X-Frame-Options, etc.)
```

## Rollback: If Caddy config fails to start

- `docker-compose -f docker-compose.caddy.yml logs valuecanvas-caddy` to see Caddy parsing errors
- Use a working Caddyfile from `infra/caddy/Caddyfile.dev` and mount it explicitly
