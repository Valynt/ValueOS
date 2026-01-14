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
npm --version
docker --version
docker compose version
```

## Development Workflow

### Local Development Setup

ValueOS provides a deterministic local development environment with automated setup:

```bash
# First-time setup
npm install
npm run env:dev          # Setup environment with real keys
npm run dx               # Start development stack
npm run db:reset         # Reset database
npm run seed:demo        # Create demo user

# Daily development
npm run dx               # Start stack
npm run dx:down          # Stop stack

# Health verification
npm run dx:check         # Comprehensive health check
```

**Quick Start (5 minutes):**

1. Install Docker Desktop and ensure it's running
2. Run: `npm install && npm run env:dev && npm run dx`
3. Run: `npm run db:reset && npm run seed:demo`
4. Open: `http://localhost:5173`
5. Login with credentials from `seed:demo` output

### Environment Configuration

Environment management is handled through dedicated scripts:

```bash
# Setup local development environment
npm run env:dev           # Configures local dev with real keys

# Switch to staging environment
npm run env:staging

# Switch to production environment
npm run env:production

# Check current environment
npm run env:status

# Validate environment configuration
npm run env:validate
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
npm run dx                # Start full development stack
npm run dx:down           # Stop development stack
npm run dx:reset          # Full reset (removes volumes)
npm run dx:clean          # Complete cleanup
npm run dx:check          # Health verification
npm run dx:doctor         # Preflight checks
npm run dx:logs           # View logs
npm run dx:ps             # Show containers
```

### Quality Gates

All changes must pass automated quality checks:

```bash
# Run all quality checks
npm run ci:verify

# Individual checks
npm run lint              # ESLint
npm run typecheck         # TypeScript
npm run test              # Unit tests
npm run build             # Build verification
```

### Testing Strategy

```bash
# Run test suites
npm run test:all          # Unit + Integration
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch        # Watch mode
npm run test:docker       # Docker-based tests
```

### Code Quality Tools

```bash
# Linting and formatting
npm run lint              # ESLint check
npm run lint:fix          # Auto-fix ESLint issues
npm run format            # Prettier formatting
npm run format:check      # Prettier check

# Type checking
npm run typecheck

# Build verification
npm run build
npm run build:backend
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
├── ops/                   # Operational scripts and configurations
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
