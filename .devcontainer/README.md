# ValueOS Development Container

This directory contains the configuration for the unified ValueOS development container, providing a consistent and secure development environment with all services included.

## 🏗️ Architecture

ValueOS uses a **single unified development container** that includes:

- VS Code Dev Container with all Supabase services
- Kong API gateway for service routing
- Redis for caching
- Full database and authentication stack

This replaces the previous split architecture. Legacy configurations are archived in `docs/legacy/`.

## 🚀 Quick Start

### VS Code Dev Container (Only Option)

1. **Prerequisites:**
   - [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - [VS Code](https://code.visualstudio.com/)
   - [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Open in Container:**
   - Open this repository in VS Code
   - Press `F1` and select `Dev Containers: Reopen in Container`
   - Wait for the container to build and dependencies to install
   - Start developing! 🎉

3. **Features:**
   - ✅ Non-root user (`vscode`)
   - ✅ Pre-installed VS Code extensions
   - ✅ Auto-formatting and linting
   - ✅ Persistent bash history
   - ✅ Hot module reloading
   - ✅ Security hardened
   - ✅ Git configuration shared from host
   - ✅ GitHub CLI and Git LFS included
   - ✅ Full Supabase stack (DB, Auth, REST, Realtime, Storage, Meta)
   - ✅ Kong API gateway
   - ✅ Redis caching

## 🔒 Security Features

### Security Hardening Applied

Both development environments include:

- ✅ **Non-root users** - Containers run as `vscode` or `nodeuser`
- ✅ **Security updates** - Latest security patches installed
- ✅ **Capability dropping** - `--cap-drop=ALL` and `no-new-privileges`
- ✅ **Signed packages** - GPG verification for Node.js installation
- ✅ **Log rotation** - Prevents disk exhaustion
- ✅ **Health checks** - Monitor container health
- ✅ **Password protection** - Redis requires authentication (dev password)
- ✅ **Network isolation** - Services communicate via internal network

### ⚠️ Development vs Production

**IMPORTANT:** Development containers use **WEAK PASSWORDS** suitable only for local development:

| Component     | Development Password                 | Production                      |
| ------------- | ------------------------------------ | ------------------------------- |
| PostgreSQL    | `valuecanvas_dev_password_CHANGE_ME` | Strong, rotated secrets         |
| Redis         | `redis_dev_password_CHANGE_ME`       | Strong, rotated secrets         |
| Exposed Ports | 5432, 6379, 5173                     | Internal only via reverse proxy |

**Security features relaxed in development:**

- Circuit breaker: Disabled (for easier debugging)
- Rate limiting: Disabled (no request throttling)
- Port exposure: Database ports exposed to host (convenience)

**Security features enforced in production:**

- All security features enabled
- Strong passwords from environment variables
- No ports exposed except via nginx reverse proxy
- Read-only filesystems
- Resource limits (CPU/memory)

## 📁 File Structure

```
.devcontainer/
├── Dockerfile.optimized       # Multi-stage optimized dev container (preferred)
├── Dockerfile                 # Minimal fallback Dockerfile
├── devcontainer.json          # VS Code configuration
├── docker-compose.devcontainer.yml # Unified development stack
├── README.md                  # This file
├── scripts/                   # Devcontainer lifecycle scripts
├── SELF_HEALING.md            # Troubleshooting guide
└── monitoring/                # Monitoring configurations

scripts/dev/
├── setup.sh                  # Idempotent dependency installation
└── migrate.sh                 # Database migration script

docs/legacy/                   # Archived deprecated configurations
├── devcontainer/              # Old docker-compose files
└── scripts/                   # Old scripts and Nix files
```

## 🔧 Lifecycle Scripts

The devcontainer uses a simplified lifecycle:

| Script                               | When                        | Purpose                                                     | Failure Behavior         |
| ------------------------------------ | --------------------------- | ----------------------------------------------------------- | ------------------------ |
| `.devcontainer/scripts/on-create.sh` | On container creation       | Verify repo layout and preflight basics                     | Fails on critical errors |
| `.devcontainer/scripts/update-content.sh` | On repository updates   | Re-sync dependencies via `scripts/dev/setup.sh`             | Fails on critical errors |
| `scripts/dev/setup.sh`               | After container creation    | Install dependencies, run migrations                        | Fails on critical errors |
| `.devcontainer/scripts/post-start.sh` | On container start         | Share readiness note and onboarding guidance                | Fails on critical errors |

**Intended workflow:** on-create performs a quick repository preflight, post-create runs the full setup (`scripts/dev/setup.sh`), update-content re-runs setup whenever the repository changes, and post-start confirms readiness whenever the container starts.

### Script Design Principles

All scripts follow these principles for reliability:

1. **Fail fast on critical errors** - Uses `set -euo pipefail`
2. **Idempotent** - Safe to run multiple times
3. **Timeout protection** - Network operations have timeouts
4. **Clear error messages** - Includes recovery hints

## 🛠️ Customization

### Adding VS Code Extensions

Edit `.devcontainer/devcontainer.json`:

```json
"customizations": {
  "vscode": {
    "extensions": [
      "your-publisher.extension-name"
    ]
  }
}
```

### UI Seed Fixtures (Optional)

To generate local JSON fixtures for common UI states (empty/error/long-text), set `UI_SEED=1` before running the devcontainer setup script:

```bash
UI_SEED=1 bash scripts/dev/setup.sh
```

This writes fixtures to `apps/ValyntApp/public/ui-fixtures/` (served by the Vite dev server), so your UI can load them at `/ui-fixtures/empty.json`, `/ui-fixtures/error.json`, or `/ui-fixtures/long-text.json`.

### Modifying Security Settings

**Dev Container:**

```json
"runArgs": [
  "--security-opt=no-new-privileges",
  "--cap-drop=ALL"
]
```

**Docker Compose:**

```yaml
security_opt:
  - no-new-privileges:true
```

### Environment Variables

Create or edit `.env.local`:

```bash
# Supabase (REQUIRED)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# LLM API (REQUIRED)
VITE_LLM_API_KEY=your-api-key
VITE_LLM_PROVIDER=together

# Database (Optional - for local testing)
POSTGRES_PASSWORD=change-this-password
REDIS_PASSWORD=change-this-password
```

## 🐛 Troubleshooting

### Container won't start

```bash
# Rebuild the container
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up
```

### Permission errors

Development containers run as non-root users. If you encounter permission errors:

```bash
# Fix node_modules ownership (if needed)
docker-compose -f docker-compose.dev.yml exec app chown -R nodeuser:nodejs /app/node_modules
```

### Port already in use

```bash
# Check what's using the port
# Windows PowerShell:
netstat -ano | findstr :5173

# Stop the process or change the port in .env.local:
VITE_PORT=5174
```

### Can't connect to database

1. Verify `.env.local` has correct credentials
2. Check container is running: `docker ps`
3. Test connection:
   ```bash
   docker-compose -f docker-compose.dev.yml exec postgres psql -U valuecanvas -d valuecanvas
   ```

### Git not working or asking for credentials

The dev container shares your `.gitconfig` from the host:

1. **Verify git config is mounted:**

   ```bash
   # Inside container
   cat ~/.gitconfig
   ```

2. **Configure git if needed:**

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

3. **For GitHub authentication:**
   - Use the built-in GitHub CLI: `gh auth login`
   - Or use a personal access token
   - Credentials are stored via `credential.helper store`

## 📚 Resources

- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
- [Docker Compose](https://docs.docker.com/compose/)
- [Operation Fortress Security Standards](../docs/security/)
- [ValueCanvas Documentation](../docs/)

## 🔐 Security Best Practices

1. **Never commit `.env.local`** - It's git-ignored for a reason
2. **Change default passwords** - Even in development
3. **Rotate API keys regularly** - Especially if shared
4. **Use separate credentials** - Development vs production
5. **Review security settings** - Understand what they do
6. **Keep containers updated** - Rebuild regularly for security patches

## 🤝 Contributing

When modifying dev container configurations:

1. Test both VS Code and Docker Compose setups
2. Maintain security hardening features
3. Document changes in this README
4. Update `.env.dev.example` if adding new variables
5. Follow Operation Fortress security standards

## 📝 Changelog

- **2.1** - Failsafe and reproducible builds
  - Refactored all lifecycle scripts with failsafe patterns
  - Added retry logic with exponential backoff for network operations
  - Improved idempotency (safe to run multiple times)
  - Added JSON output for healthcheck (automation support)
  - Pinned tool versions in Dockerfile for reproducibility
  - Added shared shell library (`lib/common.sh`)
  - Better error messages with recovery hints
  - Timeout protection on all network operations

- **2.0** - Security hardening with Operation Fortress standards
  - Added non-root users
  - Implemented security options
  - GPG verification for packages
  - Password protection for services
  - Log rotation
  - Health checks

---

**Questions?** Check the [main documentation](../docs/) or open an issue.
