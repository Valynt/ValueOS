---
description: Verify the ValueOS development environment is fully operational
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Environment Verification Checklist

Run this checklist before starting feature work or after a restart.

## 1. Automations status

```bash
gitpod automations task list
gitpod automations service list
```

Expected: `installDeps` task completed; `backend` and `frontend` services running.

## 2. Dependencies installed

```bash
ls node_modules/.modules.yaml
```

Expected: file exists. If missing, run `gitpod automations task start installDeps`.

## 3. Backend health

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"healthy",...}`. If failing, check `gitpod automations service logs backend`.

## 4. Frontend accessible

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

Expected: `200`. If failing, check `gitpod automations service logs frontend`.

## 5. Environment variables present

```bash
node scripts/dx/doctor.js
```

Expected: no missing required vars. Backend fails fast with a clear error if `TCT_SECRET` or `SUPABASE_KEY` is absent.

## 6. TypeScript clean

```bash
pnpm run check
```

Expected: no errors. Investigate any new errors before proceeding.

## 7. Tests passing

```bash
pnpm test
```

Expected: all unit tests pass. Do not proceed with feature work if tests are red.

## ✅ Success criteria

All of the following must be true before starting work:

- [ ] `gitpod automations service list` shows `backend` and `frontend` as running
- [ ] `curl http://localhost:3001/health` returns `{"status":"healthy",...}`
- [ ] `curl http://localhost:5173` returns HTTP 200
- [ ] `node_modules/.modules.yaml` exists
- [ ] `pnpm test` passes
- [ ] `pnpm run check` passes with no new errors

## Remediation

| Check fails | Fix |
|---|---|
| Service not running | `gitpod automations service start <backend\|frontend>` |
| `installDeps` not complete | `gitpod automations task start installDeps` |
| Missing env var | Add to `ops/env/.env.backend.local`; see `docs/skills/ona-environment/SKILL.md` |
| Lockfile out of sync | `pnpm install` locally, commit updated `pnpm-lock.yaml` |
