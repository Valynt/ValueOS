# ValueOS Fully Containerized Development Environment

This DevContainer provides a **100% Linux-to-production parity** development environment where every service, tool, and dependency runs exclusively inside Docker containers orchestrated by docker-compose.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Windows Host (Invisible to development workflow)          │
│  └─ WSL2 (Lightweight Linux kernel host only)              │
│     └─ Docker Desktop                                      │
│        └─ Docker Compose Stack                            │
│           ┌───────────────────────────────────────────┐   │
│           │  DevContainer (IDE, dev tools, runtime)   │   │
│           │  ┌─ Node.js 20.19.5                       │   │
│           │  ├─ pnpm 10.4.1                           │   │
│           │  ├─ PostgreSQL Client                     │   │
│           │  ├─ Redis CLI                             │   │
│           │  └─ All dev dependencies                  │   │
│           └───────────────────────────────────────────┘   │
│           ┌───────────────────────────────────────────┐   │
│           │  PostgreSQL (Supabase-compatible)         │   │
│           │  Port: 5432 (localhost only)              │   │
│           └───────────────────────────────────────────┘   │
│           ┌───────────────────────────────────────────┐   │
│           │  Redis 7                                  │   │
│           │  Port: 6379                              │   │
│           └───────────────────────────────────────────┘   │
│           ┌───────────────────────────────────────────┐   │
│           │  Supabase Stack                            │   │
│           │  ├─ Kong (API Gateway) :54321             │   │
│           │  ├─ Auth (GoTrue)                          │   │
│           │  ├─ REST (PostgREST)                       │   │
│           │  ├─ Realtime                               │   │
│           │  ├─ Storage                                │   │
│           │  ├─ Studio (UI) :54324                    │   │
│           │  └─ Meta                                   │   │
│           └───────────────────────────────────────────┘   │
│           ┌───────────────────────────────────────────┐   │
│           │  MailHog (Email Testing)                  │   │
│           │  SMTP: 1025  Web: 8025                   │   │
│           └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Principles

1. **WSL2 as Kernel Only**: WSL2 serves only as a lightweight Linux kernel host with no installed software beyond Docker
2. **100% Containerized**: Every service, tool, and dependency runs inside Docker containers
3. **Windows Invisible**: Windows is rendered invisible to the development workflow
4. **9P Filesystem Mount**: Source code is mounted via WSL2's 9P filesystem for native Linux performance
5. **Port Exposure**: All container ports are exposed through localhost
6. **Production Parity**: Development environment matches production exactly

## Quick Start

### Prerequisites

- Windows 10/11 with WSL2 installed
- Docker Desktop with WSL2 backend enabled
- VS Code with Dev Containers extension

### Setup

1. **Clone the repository in WSL2**:

   ```bash
   # From WSL2 terminal (NOT Windows CMD/PowerShell)
   cd ~
   git clone <repository-url> ValueOS
   cd ValueOS
   ```

2. **Copy environment template and set required local secrets**:

   ```bash
   cp .devcontainer/.env.template .devcontainer/.env
   # Fill in the required blank secrets before starting the stack.
   # Generate a 32-byte hex key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Open in VS Code**:

   ```bash
   code .
   ```

4. **Reopen in Container**:
   - Press `F1` → "Dev Containers: Reopen in Container"
   - Or click the green icon in bottom-left corner → "Reopen in Container"

5. **Wait for initialization**:
   - The first build takes 5-10 minutes
   - Subsequent starts are much faster

6. **Install dependencies** (first time only):

   ```bash
   pnpm install
   ```

7. **Start development**:
   ```bash
   pnpm dev
   ```

## Available Services

| Service              | URL                    | Description               |
| -------------------- | ---------------------- | ------------------------- |
| ValyntApp (Frontend) | http://localhost:5173  | Vite React application    |
| Backend API          | http://localhost:3001  | Express API server        |
| Supabase Kong        | http://localhost:54321 | Supabase API gateway      |
| Supabase Studio      | http://localhost:54324 | Database management UI    |
| Kong Admin           | http://localhost:8001  | API gateway admin         |
| Kong GUI             | http://localhost:8002  | API gateway GUI           |
| MailHog              | http://localhost:8025  | Email testing UI          |
| PostgreSQL           | localhost:5432         | Database (localhost only) |
| Redis                | localhost:6379         | Cache/queue server        |

## Development Commands

```bash
# Start development servers
pnpm dev

# Run tests
pnpm test

# Run linter
pnpm lint

# Format code
pnpm format

# Database operations
make -f .devcontainer/Makefile db-shell    # Open PostgreSQL shell
make -f .devcontainer/Makefile redis-cli   # Open Redis CLI

# Service management
make -f .devcontainer/Makefile up            # Start all services
make -f .devcontainer/Makefile down          # Stop all services
make -f .devcontainer/Makefile logs          # View all logs
make -f .devcontainer/Makefile clean         # Clean everything

# See all commands
make -f .devcontainer/Makefile help
```

## Project Structure

```
.devcontainer/
├── docker-compose.devcontainer.yml   # Full stack definition
├── docker-compose.yml                # Thin wrapper for compatibility
├── Dockerfile.optimized              # Dev container image
├── devcontainer.json                 # VS Code DevContainer config
├── .env.template                     # Environment variables template
├── Makefile                          # Convenient commands
├── scripts/                          # Lifecycle scripts
│   ├── on-create.sh
│   ├── post-create.sh
│   ├── post-start.sh
│   └── ensure-dotenv.sh
└── README.md                         # This file
```

## Toolchain Versions

Toolchain versions for the devcontainer are pinned in `pragmatic-reproducibility/ci/versions.json`.

Use this file as the single source of truth for updating pinned versions (for example: `node`, `pnpm`, `kubectl`, and `terraform`). Devcontainer scripts should read from this JSON file instead of hardcoded literals.

## Environment Files

- `.env.ports` is the canonical port mapping file for local/devcontainer compose flows.
- `.env.ports.example` contains default non-secret port values.
- `.env.local` is for secrets only (API keys, tokens, connection strings) and should not define port mappings.
- `.devcontainer/.env.template` - Template for the fully containerized environment with required secret fields intentionally left blank.
- `.devcontainer/.env` - Your local environment overrides (copy from template and populate with real local-only secrets).

### Required secret bootstrap values

`docker compose` interpolation and the devcontainer preflight both require these values before the stack starts:

- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `SECRET_KEY_BASE`
- `TCT_SECRET`
- `WEB_SCRAPER_ENCRYPTION_KEY`

The startup preflight also rejects placeholder/demo values and validates optional encryption keys such as `ENCRYPTION_KEY`, `APP_ENCRYPTION_KEY`, and `CACHE_ENCRYPTION_KEY` when they are provided. Run the check manually with:

```bash
bash .devcontainer/scripts/validate-devcontainer-secrets.sh
```

> Troubleshooting: if DevContainer startup fails with an interpolation error such as
> `required variable SUPABASE_SERVICE_ROLE_KEY is missing a value`, Docker Compose
> could not find the value for interpolation. Compose reads variables from the
> shell or a `.env` file in the compose project directory — it does **not** read
> service `env_file` entries for interpolation.
>
> Quick fix: `cp .devcontainer/.env.template .devcontainer/.env`, then populate the required blank secrets.

## Environment Variables

All configuration is in `.devcontainer/.env`. Key variables:

| Variable                     | Default  | Description                         |
| ---------------------------- | -------- | ----------------------------------- |
| `FRONTEND_PORT`              | 5173     | Vite dev server port                |
| `BACKEND_PORT`               | 3001     | API server port                     |
| `PGPORT`                     | 5432     | PostgreSQL port (localhost only)    |
| `KONG_PROXY_PORT`            | 54321    | Supabase API port                   |
| `STUDIO_PORT`                | 54324    | Supabase Studio port                |
| `REDIS_PORT`                 | 6379     | Redis port                          |
| `PGPASSWORD`                 | postgres | PostgreSQL password                 |
| `JWT_SECRET`                 | required | JWT signing secret (32+ chars)      |
| `SECRET_KEY_BASE`            | required | Realtime/Phoenix secret (32+ chars) |
| `TCT_SECRET`                 | required | Backend secret (32+ chars)          |
| `WEB_SCRAPER_ENCRYPTION_KEY` | required | 64-character hex encryption key     |

## Local HTTP-only Caddy exception

The devcontainer Caddy instances remain HTTP-only **only** for this localhost-scoped development profile:

- `.devcontainer/caddy/Caddyfile` keeps `auto_https off` because the ingress is intentionally local-only and does not provision trusted certificates inside the devcontainer.
- `.devcontainer/frontend/Caddyfile` now uses an explicit `http://` site address instead of a global `auto_https off` switch, keeping the HTTP-only behavior scoped to the frontend container itself.
- This exception must not be copied into shared, staging, or production Caddy profiles without a separate review.

## Troubleshooting

### Port Conflicts

If ports are already in use, edit `.devcontainer/.env`:

```bash
FRONTEND_PORT=5174
BACKEND_PORT=3002
# etc.
```

Then restart: `make -f .devcontainer/Makefile restart`

### Container Won't Start

Check logs:

```bash
docker compose -f .devcontainer/docker-compose.devcontainer.yml logs
```

### Permission Issues

The container runs as `vscode` user (UID 1000). If you have permission issues:

```bash
# Inside container
sudo chown -R vscode:vscode /workspaces/ValueOS
```

### Database Connection Issues

Services use internal Docker networking. From the devcontainer:

- PostgreSQL: `postgres:5432`
- Redis: `redis:6379`
- Kong: `kong:8000`

From the Windows host:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Kong: `localhost:54321`

### Troubleshooting Guide

See [DEVCONTAINER-TROUBLESHOOTING.md](DEVCONTAINER-TROUBLESHOOTING.md) for additional troubleshooting steps.

## Advanced Configuration

### Custom Domain (localhost replacement)

Edit your Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`):

```
127.0.0.1  valueos.local
127.0.0.1  api.valueos.local
127.0.0.1  db.valueos.local
```

Then update `.devcontainer/.env`:

```
SITE_URL=http://valueos.local:5173
FRONTEND_ORIGIN=http://valueos.local:5173
```

### Using External Supabase

To use a cloud Supabase instance instead of local:

1. Update `.devcontainer/.env`:

   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=<your-project-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-project-service-role-key>
   ```

2. Disable local Supabase services by editing `docker-compose.devcontainer.yml`

## Differences from Traditional Setup

| Aspect        | Traditional            | Fully Containerized         |
| ------------- | ---------------------- | --------------------------- |
| Node.js       | Installed on WSL2      | Inside container only       |
| Database      | Local install or cloud | Containerized PostgreSQL    |
| Redis         | Local install or cloud | Containerized Redis         |
| Supabase      | Cloud only             | Local + cloud options       |
| File watching | WSL2 filesystem events | Container filesystem events |
| Build tools   | WSL2 packages          | Container packages only     |

## Security Hardening

This DevContainer follows security best practices for isolated development:

### Isolation Principles

| Layer              | Access Level         | Isolation Mechanism                     |
| ------------------ | -------------------- | --------------------------------------- |
| Windows Host       | IDE only             | No dev tools, no shell access           |
| WSL2 Host          | Docker daemon only   | No installed software beyond Docker     |
| DevContainer       | Full dev environment | Container boundaries, no-new-privileges |
| Service Containers | Internal only        | Bridge network, no host exposure        |

### Security Features

- **No Docker socket mount**: Container cannot control host Docker daemon (eliminates escape risk)
- **No-new-privileges**: Container processes cannot gain additional privileges
- **Non-root user**: Runs as `vscode` user (UID 1000), not root
- **Secrets via env_file**: All secrets loaded from `.env` (gitignored), never hardcoded
- **Minimal port exposure**: Only 5 essential ports forwarded (reduced from 12)
- **Deterministic builds**: Pinned tool versions in Dockerfile

### WSL Cleanup for Maximum Isolation

To prevent host state from leaking into containers, ensure WSL shell startup files don't export:

**Files to check:**

```
~/.bashrc
~/.bash_profile
~/.profile
~/.zshrc
~/.zprofile
```

**Remove or comment out:**

```bash
# ❌ Windows PATH pollution
export PATH="/mnt/c/Program Files/...:$PATH"

# ❌ NVM/Node (container provides Node)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# ❌ Docker Desktop shell integration (if causing issues)
# Remove Docker Desktop's shell PATH modifications
```

**What WSL should contain:**

```bash
# ✅ Only Docker daemon access
# No Node.js, no npm, no pnpm, no build tools
# Check with: which node npm pnpm python go
# Should return nothing
```

### Pre-Flight Verification

Before opening the DevContainer, verify host isolation:

```bash
# From WSL2 terminal
cd ~
git clone <repo> ValueOS
cd ValueOS

# Verify no host tools
which node && echo "❌ Node.js found on host - uninstall for isolation"
which pnpm && echo "❌ pnpm found on host - uninstall for isolation"

# Verify clean environment
ls -la ~/.bashrc ~/.zshrc 2>/dev/null || echo "✅ No shell config files"

# Open in container
code .
# Then: F1 → "Dev Containers: Reopen in Container"
```

### Anti-Patterns to Avoid

| Anti-Pattern          | Why Bad                   | Solution                         |
| --------------------- | ------------------------- | -------------------------------- |
| Mount docker.sock     | Container escapes to host | Use Docker Desktop CLI from host |
| Install tools in WSL  | Host coupling             | All tools in container only      |
| Use `/mnt/c/` paths   | Slow 9P, breaks watching  | Clone to `~` in WSL              |
| Hardcoded secrets     | Security risk             | env_file only                    |
| Privileged containers | Full host access          | Never use for dev                |

### Security Checklist

- [ ] No `docker.sock` mount in compose (verified: commented out)
- [ ] `no-new-privileges` security option set
- [ ] No hardcoded secrets in compose files
- [ ] `.env` is gitignored
- [ ] Non-root user in container
- [ ] WSL has no Node.js/npm/pnpm installed
- [ ] WSL shell files don't modify PATH with Windows paths
- [ ] Fresh clone works without host dependencies

## Windows Host Isolation

The following are **NOT** required or used:

- ❌ Node.js installed on Windows
- ❌ Node.js installed on WSL2
- ❌ PostgreSQL installed on WSL2
- ❌ Redis installed on WSL2
- ❌ Any build tools on WSL2
- ❌ Windows file paths in development
- ❌ Windows environment variables in development

Everything is 100% contained within Docker containers.

## Contributing

When adding new services:

1. Add to `docker-compose.devcontainer.yml`
2. Update port forwarding in `devcontainer.json`
3. Add health checks to `scripts/post-start.sh`
4. Document in this README

## Resources

- [Dev Containers Specification](https://containers.dev/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
