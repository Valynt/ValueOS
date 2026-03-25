---
description: Start the ValueOS development environment
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Start Development Environment

## Standard path (Ona automations — preferred)

Services start automatically on `postEnvironmentStart`. To start manually:

```bash
gitpod automations service start backend
gitpod automations service start frontend
```

Check status:

```bash
gitpod automations service list
```

View logs:

```bash
gitpod automations service logs backend
gitpod automations service logs frontend
```

## Verify services are up

```bash
# Backend (port 3001)
curl http://localhost:3001/health
# Expected: {"status":"healthy",...}

# Frontend (port 5173) — accessible via the Ona preview URL
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Expected: 200
```

## Manual fallback (if automations are unavailable)

Only use this if `gitpod automations` is not available:

```bash
# Ensure dependencies are installed first
ls node_modules/.modules.yaml || bash .devcontainer/scripts/bootstrap.sh

# Backend
pnpm run dev:backend &

# Frontend
pnpm run dev:frontend
```

## Prerequisites

- `installDeps` task must have completed (`node_modules/.modules.yaml` must exist)
- Required env vars must be set (see `docs/skills/ona-environment/SKILL.md`)

## Troubleshooting

| Symptom | Fix |
|---|---|
| Service shows `stopped` | `gitpod automations service start <id>` |
| Backend crashes on start | Check `gitpod automations service logs backend` for missing env var |
| Port not accessible | `gitpod environment port list` — services open ports automatically |
| `node_modules` missing | `gitpod automations task start installDeps` |
