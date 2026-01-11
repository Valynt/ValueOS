# Dev Environment Runbook (Failsafe)

This runbook is the canonical troubleshooting guide for ValueOS dev. It is designed to be copy-pastable and action-oriented.

---

## First Run Checklist

1. **Install toolchain**
   - Node.js from `.nvmrc`
   - Docker Desktop (or Linux Docker Engine)
   - Supabase CLI (only if using local Supabase)
2. **Bootstrap**
   ```bash
   npm run setup
   npm run dx
   ```
3. **Open the app**
   - Frontend: http://localhost:5173 (or `VITE_PORT`)
   - Backend: http://localhost:3001/health (or `API_PORT`)
4. **Preflight health**
   ```bash
   npm run dx:doctor
   npm run health
   ```

---

## Local Supabase Checks (DX Doctor & Setup)

The setup script and `dx:doctor` only validate the Supabase CLI and local Supabase runtime when you explicitly opt in:

- **Enable local checks:** set `DX_SUPABASE_LOCAL=1` _or_ set `VITE_SUPABASE_URL` to a localhost URL (e.g., `http://localhost:54321`).
- **Disable local checks:** unset `DX_SUPABASE_LOCAL` and point `VITE_SUPABASE_URL` at a hosted Supabase project.

Example:

```bash
DX_SUPABASE_LOCAL=1 npm run dx:doctor
DX_SUPABASE_LOCAL=1 npm run setup
```

---

## Common Failures + Exact Fixes

### 1) Port already in use

**Symptom:** `Port 5173 already in use` or `Port 3001 already in use`

**Fix:**

```bash
lsof -i :5173
kill -9 <PID>
```

Or allow reuse temporarily:

```bash
DX_ALLOW_PORT_IN_USE=1 npm run dx
```

### 2) Docker not running

**Symptom:** `Docker daemon is not responding`

**Fix:**

```bash
# macOS/Windows
open -a Docker

# Linux
sudo systemctl start docker
```

### 3) Wrong dev mode running (local vs docker)

**Symptom:** Doctor says full stack or deps already running

**Fix:**

```bash
npm run dx:down
npm run dx          # local app + deps
# or
npm run dx:docker   # full docker stack
```

### 4) .env.local missing

**Symptom:** `Local environment file is required`

**Fix:**

```bash
npm run setup
```

### 5) Supabase local not running

**Symptom:** `Expected Supabase at http://localhost:54321`

**Fix:**

```bash
supabase start
supabase db push
```

### 6) Stale containers/volumes

**Symptom:** Compose errors or inconsistent data

**Fix:**

```bash
npm run dx:reset
npm run dx
```

---

## Clean Slate Procedure

```bash
npm run dx:reset
rm -f .env
rm -f .env.local
npm run setup
npm run dx
```

---

## Switching Modes Safely

**Local → Docker**

```bash
npm run dx:down
npm run dx:docker
```

**Docker → Local**

```bash
npm run dx:down
npm run dx
```

---

## Quick Commands Reference

```bash
npm run dx           # Local app + Docker deps
npm run dx:docker    # Full Docker stack
npm run dx:doctor    # Fail-fast preflight checks
npm run dx:down      # Stop running dev services
npm run dx:reset     # Clean slate (volumes + locks)
npm run health       # Service health check
```
