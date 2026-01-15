# ValueCanvas Development Container

This directory contains the configuration for ValueCanvas development containers, providing a consistent and secure development environment.

## 🏗️ Architecture

ValueCanvas provides **two development container options**:

1. **VS Code Dev Container** (`.devcontainer/`) - Recommended for VS Code users
2. **Docker Compose Development** (`docker-compose.dev.yml`) - Standalone option

Both are hardened following **Operation Fortress** security standards while maintaining developer productivity.

## 🚀 Quick Start

### Option 1: VS Code Dev Container (Recommended)

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
   - ✅ Git credential helper configured
   - ✅ GitHub CLI and Git LFS included

### Option 2: Docker Compose Development

1. **Prerequisites:**
   - [Docker](https://docs.docker.com/get-docker/)
   - [Docker Compose](https://docs.docker.com/compose/install/)

2. **Setup:**
   ```bash
   # Copy environment template
   cp .env.dev.example .env.local

   # Edit .env.local with your credentials
   # IMPORTANT: Update Supabase URL, API keys, etc.

   # Start services
   docker-compose -f docker-compose.dev.yml up

   # Access the app at http://localhost:5173
   ```

3. **Stop Services:**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

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

| Component | Development Password | Production |
|-----------|---------------------|------------|
| PostgreSQL | `valuecanvas_dev_password_CHANGE_ME` | Strong, rotated secrets |
| Redis | `redis_dev_password_CHANGE_ME` | Strong, rotated secrets |
| Exposed Ports | 5432, 6379, 5173 | Internal only via reverse proxy |

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
├── devcontainer.json          # VS Code/Gitpod configuration
├── README.md                  # This file
└── scripts/
    ├── on-create.sh           # Runs once when container is created
    ├── post-create.sh         # Runs after container creation (installs deps)
    ├── post-start.sh          # Runs every time container starts
    ├── update-content.sh      # Runs when content is updated (git pull)
    ├── healthcheck.sh         # Container health verification
    └── lib/
        └── common.sh          # Shared shell functions

(Root directory)
├── docker-compose.deps.yml    # Development dependencies (Postgres, Redis)
├── infra/docker/
│   └── docker-compose.dev.yml # Full development compose configuration
├── .env.example               # Environment template
└── .env.local                 # Your local config (git-ignored)
```

## 🔧 Lifecycle Scripts

The devcontainer uses a series of scripts that run at different lifecycle stages:

| Script | When | Purpose | Failure Behavior |
|--------|------|---------|------------------|
| `on-create.sh` | Container first created | Git config, directories, aliases | Fails build on critical errors |
| `post-create.sh` | After content cloned | Install dependencies, generate clients | Fails on npm install failure |
| `post-start.sh` | Every container start | Quick health checks | Never fails (advisory only) |
| `update-content.sh` | After git pull | Incremental dependency updates | Fails on npm install failure |
| `healthcheck.sh` | On demand / Docker HEALTHCHECK | Verify container health | Returns exit code 0/1/2 |

### Script Design Principles

All scripts follow these principles for reliability:

1. **Fail fast on critical errors** - Uses `set -euo pipefail`
2. **Continue on non-critical errors** - Optional tools don't block setup
3. **Idempotent** - Safe to run multiple times
4. **Timeout protection** - Network operations have timeouts
5. **Retry with backoff** - Network failures retry automatically
6. **Clear error messages** - Includes recovery hints

### Health Check Usage

```bash
# Standard check
.devcontainer/scripts/healthcheck.sh

# Verbose output
.devcontainer/scripts/healthcheck.sh --verbose

# JSON output (for automation)
.devcontainer/scripts/healthcheck.sh --json

# Include service checks
.devcontainer/scripts/healthcheck.sh --services
```

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
