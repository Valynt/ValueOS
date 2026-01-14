# ValueOS

The Value Operating System - An enterprise platform for value modeling, ROI intelligence, and lifecycle value management.

## Executive Overview

ValueOS is a sophisticated, agentic multi-service platform designed for enterprise SaaS environments. It enables value engineers, product leaders, and customer success teams to model, track, and optimize economic value throughout the customer lifecycle.

**What ValueOS solves:**

- Quantifies and tracks customer value realization across complex product ecosystems
- Provides ROI intelligence for sales, customer success, and product teams
- Automates value-based workflows through intelligent agent orchestration
- Maintains audit trails and provenance for compliance and trust

**Architectural differentiation:**
Unlike typical SaaS applications, ValueOS is built around a **value modeling core** with agent-driven workflows, server-driven UI rendering, and a Postgres-backed orchestration layer. The system treats value as a first-class data type with built-in provenance, auditability, and multi-tenant isolation.

## System Architecture

ValueOS follows a layered architecture with clear separation of concerns:

**Core Subsystems:**

- **Orchestration Layer** - Postgres-backed DAG orchestrator managing agent workflows and task routing
- **Agent Framework** - Autonomous agents for opportunity analysis, integrity validation, and value modeling
- **SDUI Renderer** - Server-driven UI system with versioned component registry
- **Value Engine** - Economic modeling and ROI calculation services
- **Compliance Layer** - Audit logging, provenance tracking, and tenant isolation

**Data Flow:**

1. Frontend requests flow through API gateway to service layer
2. Agent orchestration coordinates multi-step workflows with reflection and retry logic
3. Value models are computed with full audit trails and tenant isolation
4. SDUI manifests are generated and rendered with schema validation
5. All state changes are logged for compliance and observability

## Core Concepts

**Value Models**
Structured representations of economic value including ROI calculations, cost-benefit analyses, and lifecycle projections. Models are versioned, auditable, and support multi-currency scenarios.

**Agent Workflows**
Deterministic DAG-based workflows executed by specialized agents. Each workflow includes reflection cycles, quality scoring against an 18-point rubric, and automatic refinement when below threshold.

**Tenancy & Organization Boundaries**
Multi-tenant architecture with row-level security ensuring complete data isolation between organizations. All operations are scoped to tenant context with audit logging.

**Provenance & Trust**
Every value calculation and workflow execution maintains a cryptographic audit trail. Changes are tracked with user attribution, timestamps, and rollback capabilities.

## Repository Layout

The repository follows an opinionated structure optimized for developer experience and operational excellence:

```text
ValueOS/
├── .agent/                 # Agent orchestration and workflow definitions
├── .config/               # Centralized configuration (Vite, ESLint, Playwright)
├── .context/              # Development context and capability documentation
├── .devcontainer/         # Development container definitions and health checks
├── .github/               # CI/CD workflows, security scanning, and automation
├── .vscode/               # Workspace settings and recommended extensions
├── docs/                  # Comprehensive documentation (ADR, guides, runbooks)
├── infra/                 # Infrastructure as code (Docker, Caddy, monitoring)
├── packages/              # Shared libraries and component packages
├── scripts/               # Automation, tooling, and operational scripts
├── src/                   # Application source code
│   ├── adapters/          # Data access and external service adapters
│   ├── api/               # API endpoints and route handlers
│   ├── components/        # React components and UI primitives
│   ├── services/          # Business logic and domain services
│   └── types/             # TypeScript type definitions
├── tests/                 # Test suites (unit, integration, E2E)
└── deploy/                # Deployment configurations and environment files
```

**Structural principles:**

- **Configuration centralization** in `.config/` for consistency across tools
- **Agent-first development** with `.agent/` containing orchestration logic
- **Documentation-driven development** with comprehensive `docs/` hierarchy
- **Infrastructure as code** with reproducible environments in `infra/`

## Development Workflow

### Local Development Setup

ValueOS uses DevContainers for consistent development environments:

```bash
# Initialize development environment
npm run setup

# Start full development stack (Docker + Supabase + Frontend)
npm run dx

# Start with Docker services only
npm run dx:docker

# Health check all services
npm run health
```

### Environment Configuration

Environment management is handled through dedicated scripts:

```bash
# Switch to staging environment
npm run env:staging

# Switch to production environment
npm run env:production

# Check current environment
npm run env:status
```

### Port Management

Services are configured to avoid port conflicts:

- Frontend: 5173 (Vite dev server)
- API: 3000 (Backend services)
- Supabase: 54321 (Local development)
- Caddy: 80/443 (Reverse proxy)

### Quality Gates

All changes must pass automated quality checks:

```bash
# Run all quality checks
npm run ci:verify

# Individual checks
npm run lint              # Code quality
npm run typecheck         # TypeScript validation
npm run test              # Test suite
npm run build             # Build validation
```

## Testing & Quality

### Test Architecture

ValueOS employs a multi-layered testing strategy:

- **Unit Tests** (`npm run test:unit`) - Fast, isolated component and service tests
- **Integration Tests** (`npm run test:integration`) - Database and API integration scenarios
- **Workflow Tests** (`npm run test:chaos`) - End-to-end agent workflow validation
- **Accessibility Tests** (`npm run test:a11y`) - WCAG compliance validation
- **Performance Tests** (`npm run test:perf`) - Load testing and performance regression

### Coverage Requirements

- Unit test coverage: >90% for critical paths
- Integration coverage: >80% for API endpoints
- Workflow coverage: 100% for critical business flows

### CI Enforcement

All quality checks are enforced in CI with:

- Branch protection requiring status checks
- Automated security scanning (Snyk, npm audit)
- Dependency vulnerability analysis
- License compliance validation

## Security & Compliance Posture

### Authentication & Authorization

- Supabase Auth for identity management with SAML support
- Row-level security for tenant data isolation
- JWT-based API authentication with short-lived tokens
- Multi-factor authentication enforcement for admin access

### Tenant Isolation

All data access is scoped to tenant context through:

- Database-level RLS policies
- Application-level tenant scoping
- Audit logging of all cross-tenant access attempts
- Regular isolation validation tests

### Secrets Management

- Environment-specific configuration in `deploy/envs/`
- No hardcoded secrets in source code
- Vault integration for production secrets
- Automated secret rotation policies

### Audit & Provenance

- Immutable audit trails for all value calculations
- User attribution for workflow executions
- Cryptographic hash chaining for data integrity
- Compliance reporting capabilities

## Deployment Model

### Environment Strategy

ValueOS maintains three distinct environments:

- **Development** (`npm run dx`) - Local DevContainer with hot reload
- **Staging** (`npm run staging:start`) - Production mirror for testing
- **Production** - Customer-facing environment with blue-green deployment

### Build Process

```bash
# Development build
npm run build

# Minimal build (for testing)
npm run build:minimal

# Production build
NODE_ENV=production npm run build
```

### Database Migrations

Database changes are managed through Supabase migrations:

```bash
# Create new migration
npx supabase migration new <name>

# Apply migrations
npm run db:push

# Reset database (development only)
npm run db:reset
```

### Observability

- OpenTelemetry instrumentation for distributed tracing
- Prometheus metrics for system health
- Structured logging with Winston
- Health check endpoints for all services
- Chaos testing for resilience validation

## Contribution Standards

### Code Quality Expectations

- TypeScript strict mode with comprehensive type coverage
- ESLint with custom rules for ValueOS patterns
- Prettier for consistent formatting
- 100% test coverage for critical business logic
- Documentation for all public APIs

### Architectural Invariants

- No direct database access from frontend code
- All external service calls through adapters
- Immutable state updates with clear provenance
- Feature flags for all experimental features
- Backward compatibility for all API changes

### Change Process

1. Create feature branch from main
2. Implement with comprehensive tests
3. Update documentation and ADRs if needed
4. Pass all quality gates locally
5. Submit pull request for review
6. Merge after approval and CI validation

## Project Maturity & Roadmap

### Current Stability

ValueOS is a production-ready system with:

- Stable core architecture (ADR 0001-0004)
- Comprehensive test coverage
- Production deployment patterns
- Operational runbooks and monitoring

### Active Development Areas

- Agent workflow optimization
- Advanced value modeling algorithms
- Enhanced compliance reporting
- Performance scaling improvements

### Evolution Philosophy

The system follows evolutionary architecture principles:

- Stable interfaces with evolving implementations
- Gradual feature rollout through feature flags
- Backward compatibility maintenance
- Regular architecture review and ADR updates

---

## Quick Reference

### Essential Commands

```bash
# Development
npm run dx                    # Full development stack
npm run dev                   # Frontend only
npm run backend:dev           # Backend services

# Testing
npm run test:unit             # Unit tests
npm run test:integration      # Integration tests
npm run test:all              # Full test suite

# Database
npm run db:setup              # Initialize Supabase
npm run db:push               # Apply migrations
npm run db:types              # Generate TypeScript types

# Production
npm run build                 # Production build
npm run staging:start         # Staging environment
npm run docker:prod:up        # Production deployment
```

### Troubleshooting

```bash
# Service health
npm run health                # Check all services
npm run dev:diagnose          # Network diagnostics
npm run dx:logs               # Development logs

# Port conflicts
npm run dev:test-ports        # Test port availability
npm run dev:fix               # Auto-fix common issues
```

**Documentation**

- Comprehensive docs: `docs/`
- Architecture decisions: `docs/engineering/adr/`
- Operational runbooks: `docs/ops/`
- Development guides: `docs/guides/`

---

_ValueOS is developed with senior-level engineering discipline and operational excellence. For questions or contributions, see the documentation in `docs/` or review the contribution guidelines._
