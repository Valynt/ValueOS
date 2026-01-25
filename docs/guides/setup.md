# Setup Guide

This guide covers the prerequisites and initial setup for developing ValueOS.

## Prerequisites

### System Requirements

- **Node.js**: 20+ (LTS recommended, managed via `.nvmrc`)
- **Docker**: Desktop 4.0+ with Docker Compose V2
- **Git**: 2.30+
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space for containers and dependencies

### Development Environment

```bash
# Install Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install required Node.js version
nvm install
nvm use

# Verify installations
node --version
pnpm --version
docker --version
docker compose version
```

## Development Workflow

### Local Development Setup

ValueOS provides a deterministic local development environment with automated setup. For the canonical quickstart, see [docs/getting-started/quickstart.md](../getting-started/quickstart.md).

```bash
# First-time setup
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm run dx:env -- --mode local --force
pnpm run dx
pnpm run db:reset
pnpm run seed:demo

# Daily development
pnpm run dx
pnpm run dx:down

# Health verification
pnpm run dx:check
```

### Environment Configuration

Environment management is handled through dedicated scripts:

```bash
# Setup local development environment
pnpm run dx:env -- --mode local --force

# Switch to staging environment
pnpm run env:staging

# Switch to production environment
pnpm run env:production

# Check current environment
pnpm run env:status

# Validate environment configuration
pnpm run dx:env:validate
```

### Port Management

Services are configured to avoid port conflicts:

- Frontend: 5173 (Vite dev server)
- Backend API: 3001 (Backend services)
- Supabase API: 54321 (Local development)
- Supabase Studio: 54323 (Database admin)
- PostgreSQL: 5432 (Database)
- Redis: 6379 (Cache)

### Development Stack Management

```bash
# Stack operations
pnpm run dx                # Start full development stack
pnpm run dx:down           # Stop development stack
pnpm run dx:reset          # Full reset (removes volumes)
pnpm run dx:clean          # Complete cleanup
pnpm run dx:check          # Health verification
pnpm run dx:doctor         # Preflight checks
pnpm run dx:logs           # View logs
pnpm run dx:ps             # Show containers
```

### Quality Gates

All changes must pass automated quality checks:

```bash
# Run all quality checks
pnpm run ci:verify

# Individual checks
pnpm run lint              # ESLint
pnpm run typecheck         # TypeScript
pnpm run test              # Unit tests
pnpm run build             # Build verification
```

### Testing Strategy

```bash
# Run test suites
pnpm run test:all          # Unit + Integration
pnpm run test:unit         # Unit tests only
pnpm run test:integration  # Integration tests only
pnpm run test:watch        # Watch mode
pnpm run test:docker       # Docker-based tests
```

### Code Quality Tools

```bash
# Linting and formatting
pnpm run lint              # ESLint check
pnpm run lint:fix          # Auto-fix ESLint issues
pnpm run format            # Prettier formatting
pnpm run format:check      # Prettier check

# Type checking
pnpm run typecheck

# Build verification
pnpm run build
pnpm run build:backend
```

## Repository Structure

The repository follows an opinionated structure optimized for developer experience and operational excellence:

```
ValueOS/
├── .config/               # Centralized configuration (Vite, ESLint, Playwright)
├── .context/              # Development context and capability documentation
├── .devcontainer/         # Development container definitions and health checks
├── .github/               # CI/CD workflows, security scanning, and automation
├── .husky/                # Git hooks configuration
├── .roo/                  # MCP server configurations
├── .storybook/            # Storybook configuration
├── .vscode/               # Workspace settings and recommended extensions
├── .vscode-extension/     # VS Code extension development
├── .windsurf/             # Windsurf workflows and agents
├── audit/                 # Security and compliance audit reports
├── caddy/                 # Caddy web server configuration
├── deploy/                # Deployment configurations and environment files
├── docs/                  # Comprehensive documentation (ADR, guides, runbooks)
├── infra/                 # Infrastructure as code (Docker, monitoring)
├── mcp-dashboard/         # MCP server dashboard
├── operations/            # Operational runbooks and procedures
├── operations/            # Operational scripts and configurations
├── packages/              # Shared libraries and component packages
├── public/                # Static assets
├── scripts/               # Automation, tooling, and operational scripts
├── src/                   # Application source code
│   ├── adapters/          # Data access and external service adapters
│   ├── api/               # API endpoints and route handlers
│   ├── components/        # React components and UI primitives
│   ├── services/          # Business logic and domain services
│   ├── types/             # TypeScript type definitions
│   └── __tests__/         # Test suites (unit, integration, E2E)
├── tests/                 # Additional test suites and configurations
└── docker-compose.deps.yml # Dependency services configuration
```

**Structural principles:**

- **Configuration centralization** in `.config/` for consistency across tools
- **Agent-first development** with `.windsurf/` containing orchestration logic and workflows
- **Documentation-driven development** with comprehensive `docs/` hierarchy
- **Infrastructure as code** with reproducible environments in `infra/`
