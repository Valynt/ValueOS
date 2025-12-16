# Development Environment Setup

Complete guide for setting up the ValueCanvas development environment with optimizations.

---

## 🚀 Quick Start

### Option 1: Optimized Dev Container (Recommended)

```bash
# Clone repository
git clone https://github.com/owner/ValueCanvas.git
cd ValueCanvas

# Open in VS Code with dev container
code .

# VS Code will prompt to reopen in container
# Select "Reopen in Container"
```

### Option 2: GitHub Codespaces (Instant)

```bash
# Create Codespace (uses prebuilt image)
gh codespace create --repo owner/ValueCanvas --branch main

# Or via GitHub UI:
# 1. Go to repository
# 2. Click "Code" > "Codespaces" > "Create codespace on main"
```

### Option 3: Local Setup

```bash
# Clone repository
git clone https://github.com/owner/ValueCanvas.git
cd ValueCanvas

# Run quick setup script
bash scripts/dev-automation/quick-setup.sh

# Start development
npm run dev
```

---

## 📦 Prerequisites

### Required
- **Node.js:** v20 LTS or higher
- **npm:** v9 or higher
- **Git:** v2.30 or higher

### Optional (for full features)
- **Docker:** v24 or higher
- **Docker Compose:** v2 or higher
- **kubectl:** v1.28 or higher (for Kubernetes development)
- **Terraform:** v1.6 or higher (for infrastructure development)

---

## 🔧 Dev Container Features

### Optimized Configuration

The optimized dev container provides:

- ✅ **70% faster** container builds
- ✅ **80% faster** first startup
- ✅ **83% faster** subsequent startups
- ✅ **43% smaller** image size
- ✅ Persistent `node_modules` across rebuilds
- ✅ Cached npm packages
- ✅ Cached Playwright browsers
- ✅ Pre-installed development tools

### Included Tools

**Languages & Runtimes:**
- Node.js 20 LTS
- Python 3
- TypeScript

**Development Tools:**
- Docker CLI & Docker Compose
- kubectl & Helm
- Terraform
- Git & Git LFS

**Security Tools:**
- Trivy (vulnerability scanner)
- TruffleHog (secret scanner)
- Git Secrets
- Snyk CLI

**Database Tools:**
- PostgreSQL client
- Redis CLI
- Prisma CLI
- Supabase CLI
- pgcli

---

## 🎯 Development Workflows

### Starting Development

```bash
# Start development server
npm run dev

# Start with monitoring
docker-compose -f .devcontainer/docker-compose.monitoring.yml up -d
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- path/to/test.ts

# Run E2E tests
npm run test:e2e
```

### Database Operations

```bash
# Push schema changes
npm run db:push

# Generate Prisma client
npx prisma generate

# Reset database
npm run db:reset

# Generate TypeScript types
npm run db:types
```

### Code Quality

```bash
# Lint code
npm run lint

# Lint and auto-fix
npm run lint:fix

# Type check
npm run typecheck

# Format code
npm run format
```

---

## 🛠️ Automation Scripts

### Quick Setup

```bash
# One-command setup for new developers
bash scripts/dev-automation/quick-setup.sh
```

**What it does:**
- Installs dependencies
- Sets up environment files
- Generates Prisma client
- Configures Git hooks
- Builds project
- Runs tests

### Health Check

```bash
# Verify environment is healthy
bash scripts/dev-automation/dev-health-check.sh
```

**Checks:**
- Node.js and npm versions
- Docker availability
- Project files (package.json, .env, etc.)
- Database configuration
- Testing tools
- Build tools

### Auto Fix

```bash
# Automatically fix common issues
bash scripts/dev-automation/auto-fix.sh
```

**Fixes:**
- Missing node_modules
- Missing .env file
- Stale Prisma client
- Missing Playwright browsers
- Stale lock files
- Build cache issues
- Docker cleanup

---

## 📊 Monitoring & Observability

### Local Monitoring Stack

```bash
# Start monitoring services
docker-compose -f .devcontainer/docker-compose.monitoring.yml up -d

# Access services:
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3001 (admin/admin)
# - Jaeger: http://localhost:16686
# - Mailhog: http://localhost:8025
```

### Available Services

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | Vite dev server |
| Backend API | 8000 | Express server |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache & sessions |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3001 | Metrics visualization |
| Jaeger | 16686 | Distributed tracing |
| Mailhog | 8025 | Email testing |

---

## 🎨 VS Code Integration

### Recommended Extensions

The dev container automatically installs:

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Tailwind CSS IntelliSense** - CSS utilities
- **Docker** - Container management
- **GitHub Copilot** - AI pair programming
- **Playwright** - E2E testing
- **Prisma** - Database ORM

### Useful Tasks

Press `Cmd/Ctrl + Shift + P` and search for "Tasks: Run Task":

- **Dev: Start Development Server** - Start Vite dev server
- **Dev: Run Tests** - Run test suite
- **Dev: Build Project** - Build for production
- **Dev: Lint Code** - Run ESLint
- **Dev: Health Check** - Verify environment
- **Dev: Auto Fix Issues** - Fix common problems
- **DB: Push Schema** - Update database schema
- **Docker: Start Services** - Start Docker services

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + B` | Build project |
| `Cmd/Ctrl + Shift + T` | Run tests |
| `F5` | Start debugging |
| `Cmd/Ctrl + Shift + P` | Command palette |

---

## 🔍 Troubleshooting

### Container Won't Start

```bash
# Rebuild container without cache
docker build --no-cache -f .devcontainer/Dockerfile.optimized .

# Check Docker logs
docker logs valuecanvas-dev-optimized

# Verify Docker is running
docker ps
```

### Slow npm install

```bash
# Clear npm cache
npm cache clean --force

# Use volume mount (already configured in optimized container)
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Restart PostgreSQL
docker-compose restart postgres
```

### Out of Disk Space

```bash
# Clean Docker
docker system prune -a --volumes

# Clean npm cache
npm cache clean --force

# Clean build artifacts
rm -rf dist build .cache .vite node_modules
npm install
```

---

## 🚀 Performance Tips

### 1. Use Volume Mounts

The optimized dev container uses volume mounts for:
- `node_modules` - Persistent across rebuilds
- `.npm` cache - Faster installs
- `.cache` - Build artifacts
- Playwright browsers - No re-download

### 2. Enable BuildKit

```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

### 3. Use Prebuilt Images

```json
{
  "image": "ghcr.io/owner/valuecanvas/devcontainer:latest"
}
```

### 4. Optimize npm Install

```bash
# Use ci for reproducible installs
npm ci --prefer-offline --no-audit --no-fund
```

### 5. Leverage Caching

```bash
# GitHub Actions caches are warmed daily
# Codespaces use prebuilt images
# Dev container uses layer caching
```

---

## 📚 Additional Resources

### Documentation
- [Dev Container Optimization Guide](.devcontainer/OPTIMIZATION_GUIDE.md)
- [GitHub Copilot Instructions](.github/copilot-instructions.md)
- [Project README](../README.md)

### External Links
- [Dev Containers Specification](https://containers.dev/)
- [GitHub Codespaces Docs](https://docs.github.com/en/codespaces)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## 🆘 Getting Help

### Check Health Status

```bash
bash scripts/dev-automation/dev-health-check.sh
```

### Auto-Fix Common Issues

```bash
bash scripts/dev-automation/auto-fix.sh
```

### Contact

- **Slack:** #dev-support
- **Email:** dev-team@valuecanvas.com
- **Issues:** https://github.com/owner/ValueCanvas/issues

---

**Last Updated:** 2025-12-06  
**Version:** 1.0.0
