---
name: dev-environment-health
description: >
  Check the health of the ValueOS development environment before starting work.
  Use when services are unresponsive, ports are unavailable, or after a restart.
  Triggers on: "environment health", "services down", "backend not responding",
  "frontend not loading", "check environment", "is the dev env running".
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Dev Environment Health

## Quick status check

```bash
gitpod automations service list
```

All services should show `running`. If any show `stopped` or `failed`, start them:

```bash
gitpod automations service start backend
gitpod automations service start frontend
```

## Service health endpoints

```bash
# Backend (Express, port 3001)
curl http://localhost:3001/health
# Expected: {"status":"healthy",...}

# Frontend (Vite, port 5173)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Expected: 200
```

## Dependencies check

```bash
# Verify node_modules sentinel exists (installDeps completed)
ls node_modules/.modules.yaml

# Verify toolchain versions match versions.json
node scripts/dx/doctor.js
```

## Service logs

```bash
gitpod automations service logs backend
gitpod automations service logs frontend
```

## Common failure patterns

| Symptom | Diagnosis | Fix |
|---|---|---|
| Backend returns 503 or no response | Service stopped or crashed | `gitpod automations service start backend` |
| Frontend returns 502 | Vite not running | `gitpod automations service start frontend` |
| `node_modules/.modules.yaml` missing | `installDeps` did not complete | `gitpod automations task start installDeps` |
| Backend crashes immediately | Missing env var (`TCT_SECRET`, `SUPABASE_KEY`) | Check `ops/env/.env.backend.local` |
| Port 3001 or 5173 not open | Service started but port not registered | `gitpod environment port list` |

## Do not proceed with feature work if

- `curl http://localhost:3001/health` does not return `{"status":"healthy",...}`
- `installDeps` task has not completed successfully
- Required env vars are missing (backend will fail fast with a clear error message)
