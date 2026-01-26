# DX Architecture Fix: Supabase Auto-Start

## Problem

The original DX design had a footgun:

- `pnpm run setup` → Supabase **optional** (skipped if `SUPABASE_PROJECT_ID` not set)
- `pnpm run dx` → Supabase **required** but not auto-started

This caused confusion and failures when developers ran `pnpm run dx` expecting Supabase to start automatically.

## Solution

Updated `scripts/dx/orchestrator.js` to:

1. **Always attempt to start Supabase in local mode** (unless `DX_SKIP_SUPABASE=1` is explicitly set)
2. **Use `pnpm dlx supabase` as fallback** if the CLI is not globally installed
3. **Gracefully fall back to dx postgres** if Supabase cannot start

## Changes Made

### File: `scripts/dx/orchestrator.js`

**Before:**
```javascript
if (!commandExists("supabase")) {
  log.error("Supabase CLI not found. Install with: pnpm install -g supabase");
  process.exit(1);  // Hard exit - breaks DX
}
```

**After:**
```javascript
let useDlx = false;
if (!commandExists("supabase")) {
  log.warn("Supabase CLI not found locally. Will attempt to run via 'pnpm dlx supabase' fallback.");
  try {
    runCommand("pnpm dlx supabase --version", { silent: true });
    useDlx = true;
    log.info("pnpm dlx supabase is available as a fallback");
  } catch (err) {
    log.warn("Could not run 'pnpm dlx supabase' - Supabase CLI not available");
    // Do not exit here: continue and allow dx to fall back to dx postgres
  }
}
```

And updated the start command:
```javascript
const supabaseStartCmd = useDlx 
  ? "pnpm dlx supabase start --workdir infra/supabase" 
  : "supabase start --workdir infra/supabase";
runCommand(supabaseStartCmd);
```

## Behavior Now

### Local Mode (`pnpm run dx` or `pnpm run dx --mode local`)

1. DX starts Docker dependencies (postgres, redis, kafka, etc.)
2. DX automatically attempts to start Supabase:
   - Uses `supabase` CLI if installed globally
   - Falls back to `pnpm dlx supabase` if not
   - If Supabase fails to start, logs a warning and continues with the `valueos-postgres` container
3. Runs DB migrations (against Supabase DB if available, otherwise dx postgres)
4. Seeds database if `--seed` flag is present
5. Starts backend and frontend

### Docker Mode (`pnpm run dx --mode docker`)

- Supabase runs as part of the Docker Compose stack (no CLI invocation needed)

## Override Flags

- `DX_FORCE_SUPABASE=1` → Force Supabase startup even if Docker is unavailable
- `DX_SKIP_SUPABASE=1` → Skip Supabase entirely and use dx postgres container

## Next Steps for Developers

Just run:

```bash
pnpm run setup
pnpm run dx
```

Supabase will start automatically. No manual CLI installation required (thanks to `pnpm dlx` fallback).

If you want to install the Supabase CLI globally for faster startup:

```bash
pnpm install -g supabase
```

---

**Fixed on:** 2026-01-26  
**By:** GitHub Copilot (Agent)
