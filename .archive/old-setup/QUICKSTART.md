# ValueOS Development Environment - Quick Start Guide

Get your ValueOS development environment up and running in 5 minutes!

## Prerequisites Check

Before starting, ensure you have:

- [ ] Docker Desktop installed and running
- [ ] At least 8GB RAM available
- [ ] At least 20GB free disk space
- [ ] Git installed
- [ ] VS Code with Dev Containers extension (optional)

## Step-by-Step Setup

### 1. Extract Files to Your Repository

```bash
# Navigate to your ValueOS repository
cd /path/to/ValueOS

# Extract the dev environment files
tar -xzf valueos-dev-environment-setup.tar.gz --strip-components=1

# Verify files are in place
ls -la .devcontainer/
```

### 2. Configure Environment

```bash
# Copy environment template
cd .devcontainer
cp .env.template .env

# Edit .env file - REQUIRED CHANGES:
# - Set POSTGRES_PASSWORD to a secure password
# - Set REDIS_PASSWORD to a secure password
# - Set JWT_SECRET (generate with: openssl rand -base64 32)
# - Set OPENAI_API_KEY to your OpenAI API key

# Example:
nano .env  # or use your preferred editor
```

**Minimum required changes in `.env`:**

```bash
POSTGRES_PASSWORD=your_secure_postgres_password_here
REDIS_PASSWORD=your_secure_redis_password_here
JWT_SECRET=your_generated_jwt_secret_here
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Start the Environment

**Option A: Using VS Code (Recommended)**

```bash
# Open repository in VS Code
code .

# Press F1 and select:
# "Dev Containers: Reopen in Container"

# Wait 5-10 minutes for first-time setup
# All services will start automatically
```

**Option B: Using Docker Compose**

```bash
# From the .devcontainer directory
cd .devcontainer

# Start all services
docker compose up -d

# Watch logs
docker compose logs -f

# Run initialization (if not using VS Code)
bash scripts/on-create.sh
```

### 4. Verify Everything Works

```bash
# Check service health
make health

# Or manually check each service:
curl http://localhost:3001        # Frontend
curl http://localhost:54324       # Supabase Studio
curl http://localhost:8000        # Kong Gateway
curl http://localhost:3000        # PostgREST
```

### 5. Access Services

Open in your browser:

- **Frontend**: http://localhost:3001
- **Supabase Studio**: http://localhost:54324
- **Kong Admin**: http://localhost:8001

Connect to database:

```bash
psql -h localhost -p 54323 -U valueos -d valueos_dev
# Password: (from your .env file)
```

## Common Commands

```bash
# Start services
make up

# Stop services
make down

# View logs
make logs

# Apply migrations
make migrate

# Run tests
make test

# Open database shell
make db-shell

# Check service status
make ps
```

## Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker ps

# Check for port conflicts
lsof -i :3001  # Check if port is in use

# Full reset
make clean
make up
```

### Database connection fails

```bash
# Check PostgreSQL is running
docker compose ps postgres

# View logs
docker compose logs postgres

# Restart PostgreSQL
docker compose restart postgres
```

### Migration errors

```bash
# Dry run migrations
make migrate-dry

# Check migration files
ls -la infra/postgres/migrations/

# View migration history
make db-shell
SELECT * FROM public.migration_history ORDER BY started_at DESC;
```

### Agent issues

```bash
# Check agent status
make agents-status

# View agent logs
docker compose logs opportunity-agent
docker compose logs target-agent

# Restart agents
docker compose restart opportunity-agent target-agent realization-agent expansion-agent
```

## Next Steps

1. **Install dependencies**: `pnpm install`
2. **Start development**: `pnpm dev`
3. **Run tests**: `pnpm test`
4. **Read full documentation**: See `README.md`

## Getting Help

- **Full documentation**: See `README.md`
- **Makefile commands**: Run `make help`
- **Service logs**: Run `make logs`
- **Health check**: Run `make health`

## Architecture Overview

```
┌─────────────┐
│   Caddy     │ ← Reverse Proxy (Port 80/443)
└──────┬──────┘
       │
   ┌───┴────┬─────────┬─────────┐
   │        │         │         │
┌──▼──┐  ┌─▼──┐   ┌──▼───┐  ┌──▼────┐
│Front│  │Kong│   │Supa  │  │Agents │
│end  │  │    │   │base  │  │Fabric │
└─────┘  └─┬──┘   └──┬───┘  └───┬───┘
           │         │          │
        ┌──▼─────────▼──────────▼──┐
        │  PostgreSQL + Redis + NATS│
        └───────────────────────────┘
```

## Security Notes

⚠️ **Important**: The default configuration is for **development only**

- Change all passwords before production use
- Never commit `.env` file to version control
- Use secrets management in production
- Enable SSL/TLS for production deployments

## Success Indicators

You'll know everything is working when:

- ✅ `make health` shows all services as healthy
- ✅ Frontend loads at http://localhost:3001
- ✅ Supabase Studio loads at http://localhost:54324
- ✅ Database connection works: `make db-shell`
- ✅ All agents respond: `make agents-status`

---

**Estimated Setup Time**: 5-10 minutes (first time)

**Need help?** Check `README.md` for detailed documentation or run `make help` for available commands.
