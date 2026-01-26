# ValueOS DX Architecture

## Overview

The ValueOS Developer Experience (DX) provides a reliable, deterministic way to set up and run the full development environment across different platforms (local, DevContainer, CI).

## Mental Model

```
DX Command Flow:
setup:local/ci → dx → orchestrator → [deps, supabase, migrations, backend, frontend]
```

### Environment Boundaries

- **Local Development**: Full DX with Docker dependencies, Supabase, and hot reloading
- **DevContainer**: Same as local, but with Docker socket mounting for Docker-in-Docker
- **CI**: No DX - use `setup:ci` + build commands only

### Supabase Lifecycle

1. **Detection**: Check `DX_FORCE_SUPABASE=1`, `DX_SKIP_SUPABASE=1`, or Docker availability
2. **Start**: If Docker works, start Supabase CLI
3. **Health Check**: Verify API availability (skip in containers due to port forwarding)
4. **Migrations**: Use Supabase DB URL with `?sslmode=disable` for local instances
5. **Fallback**: If Supabase fails, continue with dx postgres container

### Docker Socket Requirements

- **DevContainer**: Must mount `/var/run/docker.sock` for Docker access
- **Local**: Docker Desktop provides socket access
- **CI**: No Docker socket needed (DX banned in CI)

### Migration Flow

1. **Resolve DB URL**: Get from `supabase status` if running, else use postgres container
2. **Append SSL mode**: Always add `?sslmode=disable` for local Postgres
3. **Error Handling**:
   - "already applied" → Success
   - "connection failed" → Fatal (exit)
   - "schema error" → Fatal (exit)
   - Other → Warn (may be safe)

### Telemetry Control

- **Default**: Telemetry enabled for observability
- **Disable**: Set `ENABLE_TELEMETRY=false` for lightweight DX
- **Conditional Imports**: Backend loads telemetry modules only when enabled

## Troubleshooting

### Docker Socket Issues

```
Error: Docker socket not found
Fix: Add to .devcontainer/devcontainer.json:
"mounts": ["source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind"]
```

### Supabase Not Starting

```
Check: DX_FORCE_SUPABASE=1 pnpm run dx
Or: DX_SKIP_SUPABASE=1 pnpm run dx (uses postgres container)
```

### Migration Failures

```
Connection errors: Check DATABASE_URL and Docker
Schema errors: Review migration files
Already applied: Safe to ignore
```

### CI DX Ban

```
Error: DX must not run in CI
Fix: Use setup:ci and build commands instead
```

## Commands

- `pnpm run setup:local` - Local environment setup
- `pnpm run setup:ci` - CI environment setup
- `pnpm run dx` - Start full development environment
- `pnpm run dx:doctor` - Diagnose environment issues
- `pnpm run dx:down` - Stop all services

## Environment Variables

- `DX_FORCE_SUPABASE=1` - Always start Supabase
- `DX_SKIP_SUPABASE=1` - Never start Supabase
- `ENABLE_TELEMETRY=false` - Disable observability
- `CI=true` - CI environment (bans DX)
