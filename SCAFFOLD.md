# ValueOS Repository Scaffold

## Overview

ValueOS is a sophisticated enterprise SaaS platform built as a monorepo using npm workspaces. It implements a multi-agent architecture for value modeling, ROI intelligence, and lifecycle value management.

## Architecture

### Monorepo Structure

```
ValueOS/
├── packages/              # Shared libraries and core packages
│   ├── agents/           # Agent runtime framework
│   ├── backend/          # Express API server
│   ├── components/       # Shared UI components
│   ├── infra/           # Infrastructure adapters
│   ├── integrations/    # Third-party integrations
│   ├── mcp/             # MCP protocol implementation
│   ├── memory/          # Memory layer (semantic, episodic, vector)
│   ├── sdui/            # Server-driven UI engine
│   ├── sdui-types/      # SDUI type contracts
│   ├── services/        # Business services
│   └── shared/          # Runtime-agnostic utilities
├── apps/                 # Applications
│   ├── ValyntApp/       # Main React frontend
│   └── mcp-dashboard/   # MCP server dashboard
├── infra/               # Infrastructure as code
├── scripts/             # Automation and tooling
├── tests/               # Test suites
└── docs/                # Documentation
```

### Package Dependencies

**Dependency Direction (STRICT):**

```
apps → backend → agents → memory → infra → shared
```

**Path Aliases:**

- `@shared/*` → `packages/shared/src/*`
- `@backend/*` → `packages/backend/src/*`
- `@infra/*` → `packages/infra/*`
- `@memory/*` → `packages/memory/*`
- `@agents/*` → `packages/agents/*`
- `@sdui/*` → `packages/sdui/src/*`
- `@mcp/*` → `packages/mcp/*`

## Core Packages

### @valueos/agents

Agent runtime framework with core, orchestration, tools, and evaluation modules.

**Structure:**

- `core/` - Base agent classes and interfaces
- `orchestration/` - Workflow orchestration and DAG execution
- `tools/` - Agent tool implementations
- `evaluation/` - Agent performance evaluation

**Key Features:**

- Multi-agent coordination
- Circuit breaker pattern
- Authority level restrictions
- Secure LLM invocation

### @valueos/backend

Express.js API server with middleware, routing, and service orchestration.

**Structure:**

- `src/server.ts` - Main server entry point
- `src/routes/` - API route handlers
- `src/middleware/` - Express middleware
- `src/services/` - Business logic services

**Key Features:**

- JWT authentication
- Rate limiting with Redis
- WebSocket support
- Comprehensive logging

### @valueos/shared

Runtime-agnostic utilities shared across all packages.

**Structure:**

- `src/logger/` - Winston logging configuration
- `src/supabase/` - Supabase client utilities
- `src/env/` - Environment validation
- `src/permissions/` - RBAC utilities
- `src/redis/` - Redis client configuration
- `src/health/` - Health check utilities

### @valueos/infra

Infrastructure adapters for external services.

**Structure:**

- `database/` - Database adapters and migrations
- `observability/` - Monitoring and metrics
- `queues/` - Message queue implementations
- `storage/` - File storage adapters

### @valueos/memory

Memory layer for semantic, episodic, and vector storage.

**Structure:**

- `semantic/` - Semantic memory implementation
- `episodic/` - Episodic memory storage
- `vector/` - Vector database integration
- `provenance/` - Audit trail tracking

## Applications

### ValyntApp

Main React frontend application built with Vite.

**Structure:**

- `src/app/` - Application routes and layouts
- `src/components/` - React components
- `src/features/` - Feature-specific modules
- `src/services/` - API client services

**Key Technologies:**

- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- React Query for state management
- React Router for navigation

### MCP Dashboard

Dashboard for monitoring MCP (Model Context Protocol) servers.

**Structure:**

- `src/` - Dashboard application source
- `index.html` - Entry point
- `package.json` - Dependencies

## Development Workflow

### Setup Commands

```bash
# Initial setup
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm run dx:env -- --mode local --force
pnpm run dx

# Development
pnpm run dev              # Start frontend
pnpm run backend:dev      # Start backend server
pnpm run agent:dev        # Start agent development

# Testing
pnpm run ci:verify        # Full CI verification
pnpm run test:unit        # Unit tests
pnpm run test:integration # Integration tests

# Database
pnpm run db:push          # Push migrations
pnpm run db:reset         # Reset database
```

### Key Scripts

**Development:**

- `pnpm run dx` - Start development environment
- `pnpm run dev` - Frontend development
- `pnpm run backend:dev` - Backend development
- `pnpm run agent:dev` - Agent development

**Testing:**

- `pnpm run test` - Full test suite
- `pnpm run test:unit` - Unit tests only
- `pnpm run test:integration` - Integration tests
- `pnpm run ci:verify` - CI verification pipeline

**Database:**

- `pnpm run db:push` - Apply migrations
- `pnpm run db:reset` - Reset database
- `pnpm run db:types` - Generate TypeScript types

**Building:**

- `pnpm run build` - Production build
- `pnpm run build:backend` - Backend compilation
- `pnpm run build:minimal` - Minimal frontend build

## Infrastructure

### Docker Configuration

**Development:**

- `ops/compose/dev.yml` - Development services
- `infra/docker/docker-compose.test.yml` - Test environment

**Production:**

- `infra/docker/docker-compose.prod.yml` - Production deployment
- `infra/docker/Dockerfile` - Application container

### Monitoring

**Stack:**

- Prometheus for metrics collection
- Grafana for visualization
- Winston for application logging
- OpenTelemetry for distributed tracing

### Services

**Core Services:**

- PostgreSQL (via Supabase)
- Redis for caching and sessions
- Caddy for reverse proxy
- Nginx for static serving

## Configuration

### Environment Files

- `.env.local` - Local environment variables
- `.env.ports` - Port configuration
- `deploy/envs/` - Environment-specific configs

### Path Aliases

Configured in `tsconfig.json` and Vite for clean imports:

```typescript
import { logger } from "@shared/logger";
import { BaseAgent } from "@agents/core";
```

## Testing Strategy

### Test Types

**Unit Tests:**

- Vitest configuration in `.config/configs/vitest.config.unit.ts`
- Fast execution with mocked dependencies
- Coverage requirements: >90% critical paths

**Integration Tests:**

- Docker-based test environment
- Real database and services
- End-to-end API testing

**E2E Tests:**

- Playwright for browser automation
- Accessibility testing with axe-core
- Performance testing with k6

### Test Organization

```
tests/
├── accessibility/       # Accessibility compliance tests
├── agents/             # Agent framework tests
├── api/                # API endpoint tests
├── backend/            # Backend service tests
└── smoke/              # Smoke tests
```

## Security

### Authentication

- Supabase Auth with SAML 2.0
- JWT-based API authentication
- Multi-factor authentication
- Social login providers

### Authorization

- Role-based access control (RBAC)
- Row-level security (RLS)
- Multi-tenant data isolation
- API rate limiting

### Compliance

- SOC 2 Type II ready
- GDPR compliant
- Audit logging
- Data encryption

## Deployment

### Environments

- **Development:** Local Docker compose
- **Staging:** Pre-production testing
- **Production:** Enterprise deployment

### CI/CD Pipeline

- Automated testing on every commit
- Security scanning before merge
- Performance regression testing
- Automated deployment to staging

### Monitoring

- Real-time health checks
- Performance metrics
- Error tracking and alerting
- Log aggregation and analysis

## Agent Architecture

### Agent Types

1. **Orchestrator Agent** (Level 5) - Master coordinator
2. **Company Intelligence Agent** (Level 3) - Market research
3. **Opportunity Agent** (Level 3) - Business opportunities
4. **Target Agent** (Level 3) - Lead generation
5. **Value Mapping Agent** (Level 3) - Value propositions
6. **Financial Modeling Agent** (Level 4) - Financial analysis
7. **Integration Agent** (Level 4) - System integration
8. **Compliance Agent** (Level 5) - Regulatory compliance
9. **Reporting Agent** (Level 2) - Dashboard generation
10. **Notification Agent** (Level 1) - Alert delivery

### Agent Communication

- **Request/Response:** Synchronous task execution
- **Event Streaming:** Real-time updates
- **Workflow Coordination:** DAG-based orchestration
- **Context Sharing:** Memory persistence

## Documentation

### Key Documentation

- `docs/architecture/` - System architecture and ADRs
- `docs/guides/` - Setup and development guides
- `docs/engineering/` - Technical specifications
- `docs/ops/` - Operational procedures

### Active Architectural Decisions

Documented in `docs/architecture/active-architectural-decisions.md` with current production requirements and design rationale.

## Contributing

### Development Standards

- TypeScript strict mode
- ESLint with custom rules
- Prettier for formatting
- 100% test coverage for critical paths
- Documentation for all public APIs

### Git Workflow

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches
- `hotfix/*` - Emergency fixes

### Code Review

- Security review for auth changes
- DBA review for schema changes
- AI safety review for agent changes
- DevOps review for infrastructure changes

## Quick Start

Follow the canonical quickstart to avoid drift:
- [docs/getting-started/quickstart.md](docs/getting-started/quickstart.md)

## Support

### Documentation

- [Setup Guide](docs/guides/setup.md)
- [Architecture Overview](docs/architecture/system-overview.md)
- [API Documentation](docs/engineering/api/)
- [Troubleshooting Guide](docs/getting-started/troubleshooting.md)

### Commands Reference

| Task              | Command               | Documentation    |
| ----------------- | --------------------- | ---------------- |
| Local setup       | `pnpm run dx`         | Setup Guide      |
| Run tests         | `pnpm run ci:verify`  | Testing Guide    |
| Deploy to staging | `pnpm run env:staging` | Deployment Guide |
| Database reset    | `pnpm run db:reset`   | Database Guide   |
| Health check      | `pnpm run dx:check`   | Monitoring Guide |

---

This scaffold provides the foundation for understanding and working with the ValueOS codebase. The architecture is designed for scalability, security, and maintainability while supporting sophisticated multi-agent workflows.
