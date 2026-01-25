# ValueOS Quickstart Guide

Get up and running with ValueOS in under 10 minutes.

## Prerequisites

- **Docker Desktop**: Install and ensure it's running
- **Node.js**: Version 20+ (check with `node --version`)
- **Git**: For cloning the repository
- **IDE**: VS Code recommended with ESLint and Prettier extensions

## Quick Start (5 minutes)

### 1. Clone and Install

```bash
git clone https://github.com/valynt/valueos.git
cd valueos
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm run setup
```

### 2. Configure Environment

```bash
# Regenerate local environment files if needed
pnpm run dx:env -- --mode local --force
```

### 3. Start Development Stack

```bash
# Start all services (deps, backend, frontend)
pnpm run dx

# Or use the Caddy reverse proxy setup
pnpm run dx:caddy:start
```

### 4. Verify Setup

```bash
# Run health check
pnpm run dx:check

# Or check individual services
curl http://localhost:3001/health
```

### 5. Access the Application

- **Frontend**: http://localhost:5173 (or http://localhost with Caddy)
- **Backend API**: http://localhost:3001
- **Supabase Studio**: http://localhost:54323
- **Caddy Admin** (if using Caddy): http://localhost:2019

## Creating a Demo User

```bash
pnpm run seed:demo
```

This creates a demo user with credentials displayed in the terminal output.

## Common Commands

| Command               | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `pnpm run dx`          | Start development environment                     |
| `pnpm run dx:down`     | Stop all services                                 |
| `pnpm run dx:check`    | Health check all services                         |
| `pnpm run dx:logs`     | View service logs                                 |
| `pnpm run db:reset`    | Reset local database                              |
| `pnpm run dev`         | Start frontend only (if services already running) |
| `pnpm run backend:dev` | Start backend only                                |
| `supabase start`       | Start Supabase locally                            |
| `supabase status`      | Check Supabase status                             |

## Service Ports

| Service           | Port    | Purpose                |
| ----------------- | ------- | ---------------------- |
| Frontend (Vite)   | 5173    | Main application       |
| Backend (Express) | 3001    | API server             |
| Supabase API      | 54321   | Database API           |
| Supabase Studio   | 54323   | Database management UI |
| PostgreSQL        | 5432    | Database server        |
| Redis             | 6379    | Cache & sessions       |
| Caddy (optional)  | 80/8080 | Reverse proxy          |

## Next Steps

- [Local Development Guide](./local-setup.md) - Detailed setup instructions
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
- [Architecture Overview](../architecture/overview.md) - System design

## Troubleshooting Quick Fixes

### Port Already in Use

```bash
# Check what's using the port
lsof -i :5173

# Kill the process
kill -9 <PID>

# Or use a different port
VITE_PORT=5174 pnpm run dev
```

### Docker Not Running

```bash
# Start Docker Desktop
# On macOS: open -a Docker
# On Linux: sudo systemctl start docker
```

### Missing Supabase Keys

```bash
# Regenerate environment
pnpm run dx:env -- --mode local --force

# Restart services
pnpm run dx:down && pnpm run dx
```

### Database Connection Failed

```bash
# Reset the database
pnpm run db:reset

# Check database logs
docker logs valueos-postgres
```

### Environment Variables Not Loading

```bash
# Validate configuration
pnpm run env:validate

# Check Vite environment loading
node -r dotenv/config -e "console.log('SUPABASE_URL:', process.env.VITE_SUPABASE_URL)"
```

For more detailed troubleshooting, see [Troubleshooting Guide](./troubleshooting.md).
