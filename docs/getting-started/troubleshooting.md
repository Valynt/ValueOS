# Troubleshooting Guide

Common issues and fixes for ValueOS development.

## Common Issues + Fixes

### Docker is not running

**Symptom:** `Cannot connect to the Docker daemon`

**Cause:** Docker Desktop (or Docker Engine) is not running.

**Fix:**

```bash
# macOS
open -a Docker

# Linux (systemd)
sudo systemctl start docker
sudo systemctl status docker
```

### Port already in use

**Symptom:** `Error: listen EADDRINUSE: address already in use :::5173`

**Cause:** Another process is already using the port.

**Fix:**

```bash
lsof -i :5173
kill -9 <PID>
```

### Environment file missing or wrong mode

**Symptom:** `ENVIRONMENT CONTRADICTION` or missing `.env.local`

**Cause:** `.env.local` was not generated or was generated for the wrong mode.

**Fix:**

```bash
pnpm run dx:env -- --mode local --force
```

### Supabase not responding

**Symptom:** `supabase status` shows not running or API returns connection errors

**Cause:** Supabase containers failed to start or were stopped.

**Fix:**

```bash
pnpm run dx:down
pnpm run dx
```

### Database connection refused

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:54322`

**Cause:** Supabase/Postgres container is not running or ports are misconfigured.

**Fix:**

```bash
pnpm run dx:down
pnpm run dx
pnpm run db:reset
```

### Demo user missing

**Symptom:** No demo credentials printed or login fails for demo user

**Cause:** Demo seed script was not run or failed.

**Fix:**

```bash
pnpm run seed:demo
```
