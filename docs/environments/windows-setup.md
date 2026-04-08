# ValueOS Windows Local Development Setup Guide

This guide provides permanent fixes for setting up ValueOS on Windows without requiring WSL or DevContainers.

## Prerequisites

1. **Node.js 20.19.5** (exact version required)
2. **pnpm 10.4.1** (exact version required)
3. **Docker Desktop** with WSL2 backend
4. **Git** for Windows

## Quick Start

### 1. Install Prerequisites

```powershell
# Install Node.js 20.19.5 via Chocolatey (run as Administrator)
choco install nodejs --version=20.19.0 -y

# Install pnpm globally
npm install -g pnpm@10.4.1

# Verify installations
node --version  # Should show v20.19.x
pnpm --version  # Should show 10.4.1
```

### 2. Clone and Setup Repository

```powershell
git clone <repository-url>
cd ValueOS

# Install dependencies (requires frozen-lockfile=false for first install)
# Edit .npmrc temporarily: change frozen-lockfile=true to false
pnpm install

# Restore frozen-lockfile=true in .npmrc
```

### 3. Configure Environment

Copy the environment templates:

```powershell
# The environment files are already configured at:
# - ops/env/.env.local
# - ops/env/.env.backend.local

# Verify Docker is running
docker ps
```

### 4. Start Infrastructure

```powershell
# Start PostgreSQL and Redis (if not already running)
docker compose -f ops/compose/compose.yml up -d postgres redis --wait

# Verify services are healthy
docker ps
```

### 5. Run Database Migrations

```powershell
# Preferred canonical migration entrypoint (works in Git Bash environments)
pnpm run db:migrate

# Windows-specific fallback (PowerShell/cmd environments)
pnpm run db:migrate:windows
```

**Note:** The migrations may show warnings about existing policies. These are safe to ignore for local development.

### 6. Build and Start Backend

```powershell
# Build the backend first
cd packages/backend
pnpm run build

# Start the backend using Windows script
cd ../..
pnpm run dev:backend:windows
```

### 7. Start Frontend

In a new PowerShell window:

```powershell
cd ValueOS
pnpm run dev:frontend:windows
```

## Permanent Fixes Applied

### 1. Added Missing Dependency

**File:** `packages/backend/package.json`

Added `zustand: ^5.0.10` to dependencies to fix runtime module resolution error.

### 2. Created Windows-Compatible Scripts

**Files Created:**
- `scripts/dev/start-backend-windows.cmd` - Windows backend startup
- `scripts/dev/start-frontend-windows.cmd` - Windows frontend startup
- `scripts/db/apply-migrations-windows.cmd` - Windows migration runner

**Files Modified:**
- `package.json` - Added Windows-compatible npm scripts
- `.npmrc` - Temporarily disabled frozen-lockfile for initial install

### 3. Database Schema Fixes

For local development without full Supabase:

1. Created required PostgreSQL roles: `anon`, `authenticated`, `service_role`, `supabase_admin`
2. Created `auth` schema with `auth.uid()` function stub
3. Created `auth.users` and `auth.identities` tables
4. Applied canonical identity baseline migration

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm run db:migrate` | Run canonical database migrations (cross-platform) |
| `pnpm run dev:backend:windows` | Start backend on Windows |
| `pnpm run dev:frontend:windows` | Start frontend on Windows |
| `pnpm run db:migrate:windows` | Windows fallback for database migrations |
| `pnpm run dev:bootstrap:windows` | Full Windows setup (install + migrate + start) |

## Troubleshooting

### Issue: "Cannot find package 'zustand'"
**Fix:** Run `pnpm install` to install the newly added dependency.

### Issue: "role 'anon' does not exist"
**Fix:** The Windows migration script automatically creates required roles.

### Issue: "node: not found" in bash scripts
**Fix:** Use the Windows-compatible `*:windows` scripts instead of bash scripts.

### Issue: Port 5432 already in use
**Fix:** Stop existing PostgreSQL service or use different port:
```powershell
docker compose -f ops/compose/compose.yml down
```

## Development URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

## Next Steps

1. Run Playwright tests to verify the setup
2. Configure Infisical for production-like secret management
3. Review and apply remaining database migrations
4. Set up IDE integration (VS Code recommended)
