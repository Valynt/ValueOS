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
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp deploy/envs/.env.example .env.local

# Set up development environment (configures Supabase keys)
npm run env:dev
```

### 3. Start Development Stack

```bash
# Start all services (Supabase, Redis, Backend, Frontend)
npm run dx

# Or use the Caddy reverse proxy setup
./scripts/dev-caddy-start.sh
```

### 4. Verify Setup

```bash
# Run health check
npm run dx:check

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
npm run seed:demo
```

This creates a demo user with credentials displayed in the terminal output.

## Common Commands

| Command               | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `npm run dx`          | Start development environment                     |
| `npm run dx:down`     | Stop all services                                 |
| `npm run dx:check`    | Health check all services                         |
| `npm run dx:logs`     | View service logs                                 |
| `npm run db:reset`    | Reset local database                              |
| `npm run dev`         | Start frontend only (if services already running) |
| `npm run dev:backend` | Start backend only                                |
| `supabase start`      | Start Supabase locally                            |
| `supabase status`     | Check Supabase status                             |

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
PORT=5174 npm run dev
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
npm run env:dev

# Restart services
npm run dx:down && npm run dx
```

### Database Connection Failed

```bash
# Reset the database
npm run db:reset

# Check database logs
docker logs valueos-postgres
```

### Environment Variables Not Loading

```bash
# Validate configuration
npm run env:validate

# Check Vite environment loading
node -r dotenv/config -e "console.log('SUPABASE_URL:', process.env.VITE_SUPABASE_URL)"
```

For more detailed troubleshooting, see [Troubleshooting Guide](./troubleshooting.md).
