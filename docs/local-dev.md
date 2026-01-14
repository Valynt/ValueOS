# ValueOS Local Development Guide

This guide covers setting up and running ValueOS for local development with deterministic, repeatable workflows.

## Prerequisites

- **Docker Desktop** - Required for local services (PostgreSQL, Redis, Supabase)
- **Node.js** - Version specified in `.nvmrc` (run `nvm use` if using nvm)
- **Git** - For version control

## Quick Start

For a complete first-time setup:

```bash
# 1. Clone and install
git clone <repository-url>
cd ValueOS
npm install

# 2. Setup environment
npm run env:dev

# 3. Start development stack
npm run dx

# 4. Setup database and demo user
npm run db:reset
npm run seed:demo

# 5. Open application
open http://localhost:5173
```

Login with the credentials displayed after running `npm run seed:demo`.

## Environment Scripts

### Development Environment

- `npm run env:dev` - Setup local development environment with real keys
- `npm run env:staging` - Switch to staging environment
- `npm run env:production` - Switch to production environment
- `npm run env:status` - Show current environment
- `npm run env:validate` - Validate environment configuration

### Development Stack (DX)

- `npm run dx` - Start local development stack
- `npm run dx:down` - Stop development stack
- `npm run dx:reset` - Full reset (removes volumes)
- `npm run dx:clean` - Complete cleanup (removes containers, volumes, env files)
- `npm run dx:doctor` - Run preflight checks
- `npm run dx:check` - Comprehensive health check
- `npm run dx:ps` - Show running containers
- `npm run dx:logs` - Show all logs

### Database Operations

- `npm run db:reset` - Reset local database
- `npm run db:setup` - Initial database setup
- `npm run seed:demo` - Create demo tenant and user
- `npm run db:types` - Generate TypeScript types from local schema

## Environment Files

### File Locations and Precedence

1. **`.env.local`** - Primary local environment file
   - Loaded by frontend (Vite) and backend
   - Contains Supabase keys, URLs, and local configuration
   - **Never commit this file**

2. **`deploy/envs/.env.ports`** - Container environment
   - Loaded by Docker Compose for all containers
   - Contains port mappings and container-specific variables
   - Must include Supabase keys for container runtime

3. **`deploy/envs/.env.staging`** - Staging environment template
4. **`deploy/envs/.env.production`** - Production environment template

### Required Environment Variables

#### Supabase Configuration

```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<real-jwt-token>
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<same-jwt-token>
```

#### Application URLs

```bash
VITE_APP_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
API_PORT=3001
```

#### Database (Local)

```bash
DATABASE_URL=postgresql://postgres:dev_password@localhost:5432/valuecanvas_dev
POSTGRES_DB=valuecanvas_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dev_password
```

## Daily Workflow

### Starting Development

```bash
# Start the stack
npm run dx

# In another terminal, view logs
npm run dx:logs

# Check health
npm run dx:check
```

### Making Changes

- Frontend changes auto-reload via Vite HMR
- Backend changes require container restart:

```bash
  docker restart valueos-backend
```

### Database Changes

```bash
# Reset database (destructive)
npm run db:reset

# Create new migration
# Add SQL file to appropriate migrations directory
# Run db:reset to apply
```

### Stopping Development

```bash
# Stop containers
npm run dx:down

# Or full cleanup
npm run dx:clean
```

## Service URLs

When running `npm run dx`, these services are available:

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`
- **Backend Health**: `http://localhost:3001/health`
- **Supabase API**: `http://localhost:54321`
- **Supabase Studio**: `http://localhost:54323`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

## Authentication

### Demo User Setup

```bash
npm run seed:demo
```

This creates:

- Demo tenant: "Demo Organization"
- Demo user: `demo@valueos.dev` / `demo123456`
- Sample projects and data

### Manual User Creation

1. Open Supabase Studio: `http://localhost:54323`
2. Go to Authentication > Users
3. Create new user
4. Create tenant record in `tenants` table
5. Create user-tenant relationship in `user_tenants` table

## Troubleshooting

### DX Lock Issues

**Problem**: "DX lock indicates local (docker-compose.deps.yml). Run 'npm run dx:down' before starting docker."

**Solution**:

```bash
npm run dx:down
npm run dx
```

**Manual fix**:

```bash
rm -f .dx-lock .dx-state.json
npm run dx
```

### Missing Supabase Keys

**Problem**: "SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY are blank"

**Solution**:

```bash
npm run env:dev
```

This automatically sets up real local Supabase keys.

### Port Conflicts

**Problem**: Services fail to start due to port conflicts

**Solution**:

```bash
# Check what's using ports
lsof -i :54321 -i :54322 -i :5173 -i :3001

# Force restart
npm run dx:reset && npm run dx
```

### Docker Issues

**Problem**: Docker daemon not responding

**Solution**:

1. Start Docker Desktop
2. Or run: `sudo systemctl start docker`
3. Check context: `docker context use default`

### Database Connection Issues

**Problem**: Cannot connect to database

**Solution**:

```bash
# Check database container
docker logs valueos-postgres

# Reset database
npm run db:reset

# Verify connectivity
docker exec valueos-postgres pg_isready -U postgres
```

### Environment Variable Issues

**Problem**: Frontend not loading environment variables

**Solution**:

```bash
# Check environment loading
node -r dotenv/config -e "console.log('VITE_SUPABASE_ANON_KEY length:', process.env.VITE_SUPABASE_ANON_KEY.length)"

# Reset environment
npm run env:dev

# Validate configuration
npm run env:validate
```

### RLS/Tenant Issues

**Problem**: User can't access data after login

**Solution**:

1. Check user has tenant assignment:

   ```sql
   SELECT * FROM user_tenants WHERE user_id = '<user_id>';
   ```

2. Verify RLS policies allow tenant access

3. Run `npm run seed:demo` to ensure proper setup

## Architecture

### Container Stack

- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **Backend**: Node.js API server
- **Frontend**: Nginx + React build

### Environment Flow

1. `npm run dx` starts Docker Compose
2. Compose loads `deploy/envs/.env.ports`
3. Backend container also loads `deploy/envs/.env.local`
4. Frontend build-time variables from `.env.ports`
5. Frontend runtime variables from browser environment

### Key Sources

- **Supabase Keys**: Hardcoded local development key in setup script
- **Database**: Local PostgreSQL via Docker
- **Authentication**: Supabase Auth with local JWT secret

## Development Tips

### Fast Iteration

- Use `npm run dx:check` to verify setup
- Keep `npm run dx:logs` running in separate terminal
- Use browser dev tools to verify environment variable loading

### Code Quality

- Run `npm run lint` before committing
- Use `npm run typecheck` to verify TypeScript
- Run `npm run test` for unit tests

### Performance

- Monitor container resource usage
- Use `docker stats` to check memory/CPU
- Restart containers if they become sluggish

## Migration from Previous Setup

If you're coming from an older setup:

1. **Clean old setup**:

   ```bash
   npm run dx:clean
   ```

2. **Use new scripts**:
   - Replace any manual env file copying with `npm run env:dev`
   - Use `npm run dx:check` instead of manual verification
   - Use `npm run seed:demo` for user setup

3. **Update references**:
   - Backend port is now 3001 (was 3000)
   - Environment scripts have changed (no more `env:dev` missing)

## Support

If you encounter issues not covered here:

1. Run `npm run dx:check` for comprehensive diagnosis
2. Check the troubleshooting section above
3. Review the verification checklist in `.windsurf/plans/verification-checklist.md`
4. Check container logs: `npm run dx:logs`

For additional help, refer to the project documentation or create an issue in the repository.
