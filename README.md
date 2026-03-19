# ValueOS

AI-powered value engineering platform for B2B SaaS. ValueOS helps customer success and sales teams quantify, track, and expand business value through an eight-agent fabric backed by Supabase, Redis, and CloudEvents messaging.

## Repository Layout

pnpm monorepo. The runtime inventory is defined in [`runtime-inventory.json`](runtime-inventory.json). The core product boundary is now explicit: `apps/ValyntApp/src/**` is browser-only, while privileged Supabase access, secret providers, and Node-only configuration live under `packages/backend/src/**`.

```
apps/
  ValyntApp/        # Primary browser runtime (React + Vite + Tailwind)
  mcp-dashboard/    # Browser runtime for MCP observability workflows

packages/
  backend/          # Node.js runtime for API, workers, secrets, and privileged adapters
  shared/           # Canonical domain model (9 Zod-typed domain objects)
  core-services/    # Canonical service implementations (migrated from app-local copies)
  agent-fabric/     # Multi-agent framework primitives
  components/       # Shared UI component library
  config-v2/        # Shared configuration schemas
  infra/            # Infrastructure utilities and queue abstractions
  integrations/     # Third-party integrations (Stripe, CRM, etc.)
  mcp/              # Model Context Protocol tooling
  memory/           # Agent memory and vector store layer
  sdui/             # Server-Driven UI renderer
  sdui-types/       # Shared SDUI type system
  test-utils/       # Shared test helpers and fixtures

infra/
  k8s/              # Kubernetes manifests (blue-green, HPA, network policies)
  terraform/        # AWS infrastructure (ECS, RDS, ElastiCache, CloudFront)
  supabase/         # Database migrations and RLS policies
  observability/    # Prometheus, Grafana, OpenTelemetry configs
```

## Prerequisites

- Docker Desktop with WSL2 backend (Windows) or Docker Engine (Linux)
- VS Code with Dev Containers extension (or Windsurf)
- 8GB RAM minimum (16GB recommended)

## Quickstart (DevContainer)

The recommended development environment runs entirely in Docker containers with full Linux-to-production parity.

**1. Clone and open in container**

```bash
# From WSL2 terminal (Windows) or native terminal (Linux/Mac)
cd ~
git clone <repository-url> ValueOS
cd ValueOS
code .
# Then: F1 → "Dev Containers: Reopen in Container"
```

**2. Set up environment**

```bash
cp .devcontainer/.env.template .devcontainer/.env
# Optional: edit .devcontainer/.env to customize ports
```

**3. Install dependencies and start**

```bash
pnpm install
pnpm run dev        # Starts frontend (5173) and backend (3001)
```

The devcontainer provides:
- PostgreSQL 15, Redis 7, Supabase stack (Auth, REST, Realtime, Storage, Studio)
- Node.js 20, pnpm 10, all build tools
- MailHog for email testing
- No local installation required

See [.devcontainer/README.md](.devcontainer/README.md) for detailed setup, troubleshooting, and advanced configuration.

---

## Alternative: Cloud-Dev Setup

For teams preferring cloud-based Supabase (instead of local containerized stack):

```bash
cp ops/env/.env.cloud-dev.example          ops/env/.env.cloud-dev
cp ops/env/.env.frontend.cloud-dev.example ops/env/.env.frontend.cloud-dev
cp ops/env/.env.backend.cloud-dev.example  ops/env/.env.backend.cloud-dev
```

Fill in credentials from your Supabase dashboard (Project Settings → API). See [ops/env/README.md](ops/env/README.md) for details.

Then start with:
```bash
pnpm install
pnpm run dev:frontend
pnpm run dev:backend  # In another terminal
```

---

## Key Commands

| Command | Purpose |
|---|---|
| `pnpm run dev` | Start frontend and backend together |
| `pnpm run dev:frontend` | Start `apps/ValyntApp` (React + Vite) only |
| `pnpm run dev:backend` | Start `packages/backend` (Express API) only |
| `pnpm run build` | Build both `apps/ValyntApp` and `packages/backend` |
| `pnpm run start` | Start the production backend server |
| `pnpm run check` | Run TypeScript no-emit checks |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm run format` | Format code with Prettier |
| `pnpm run db:migrate` | Apply database migrations |
| `pnpm run dx:check` | Run preflight environment checks |

## Testing

### Running Tests

```bash
# Unit tests
pnpm test

# RLS tenant isolation tests
pnpm run test:rls

# Security scan
pnpm run security:scan

# E2E tests (requires dev server running)
pnpm run test:e2e:gate

# Workflow DAG validation
pnpm run test:workflow-dag-validation
```

### Test Structure

- **Unit tests**: `packages/backend/src/services/__tests__/` - Service-level unit tests
- **Integration tests**: `packages/backend/src/services/__tests__/integration/` - End-to-end service integration
- **Security tests**: `tests/security/` - RLS policies, tenant isolation
- **Test helpers**: `packages/backend/src/services/__tests__/integration/helpers/testHelpers.ts`

### Mock Configuration

External APIs are mocked in tests:
- **HubSpot CRM**: `CRMConnector` tests mock HubSpot API responses
- **SEC EDGAR**: `SECEdgarClient` tests mock filing data
- **LLM Gateway**: Agent tests use deterministic test fixtures via `secureInvoke` mocking

### Test Data Factories

Located in `testHelpers.ts`:
```typescript
factories.benchmark({ metric_name: "ROI" })
factories.assumption({ name: "Test Assumption" })
factories.case({ title: "Test Case" })
```

## Architecture

ValueOS is a modular monolith deployed to Kubernetes.

```
+---------------------------------------------------------+
|  apps/ValyntApp  (React + Vite + Tailwind)              |
|  Route-level code splitting · HTTP calls to backend     |
+---------------------------------------------------------+
|  packages/backend  (Express API)                        |
|  REST endpoints · RBAC · rate limiting                  |
|                                                         |
|  Runtime services (packages/backend/src/runtime/):      |
|    DecisionRouter   — selects agent/action by domain    |
|    ExecutionRuntime — task lifecycle, queues, retries   |
|    PolicyEngine     — safety, compliance, HITL          |
|    ContextStore     — assembles domain state for agents |
|    ArtifactComposer — generates business case outputs   |
|    RecommendationEngine — next-best-action generation   |
+---------------------------------------------------------+
|  Agent Fabric (packages/backend/src/lib/agent-fabric/)  |
|  8 agents · BaseAgent · secureInvoke                    |
|  OpportunityAgent · TargetAgent · FinancialModelingAgent|
|  IntegrityAgent · RealizationAgent · ExpansionAgent     |
|  NarrativeAgent · ComplianceAuditorAgent                |
+---------------------------------------------------------+
|  Domain Model (packages/shared/src/domain/)             |
|  9 Zod-typed objects: Account, Opportunity, Stakeholder,|
|  ValueHypothesis, Assumption, Evidence, BusinessCase,   |
|  RealizationPlan, ExpansionOpportunity                  |
+---------------------------------------------------------+
|  Data Layer                                             |
|  Supabase (Postgres + RLS) · Redis · CloudEvents bus    |
+---------------------------------------------------------+
```

- **Authoritative runtime inventory**: [`runtime-inventory.json`](runtime-inventory.json) defines browser entrypoints, allowed browser env prefixes, and the server-owned modules that must stay in `packages/backend`.
- **Browser/server split**: `apps/ValyntApp/src/**` is browser-only. Server-owned secrets, privileged Supabase clients, and Node-dependent settings live in `packages/backend/src/config/secrets/`, `packages/backend/src/lib/supabase.ts`, and `packages/backend/src/config/settings.ts`.
- **Agent routing**: All agent decisions are driven by structured domain state, not keyword matching.
- **Multi-tenancy**: Shared-schema with `organization_id` / `tenant_id` enforced by Postgres RLS on every table.
- **LLM safety**: All agent LLM calls go through `BaseAgent.secureInvoke()` — circuit breaker, hallucination detection, Zod validation.
- **Auth**: Supabase Auth with JWT, RBAC, WebAuthn/FIDO2, and MFA.
- **Observability**: OpenTelemetry SDK, Prometheus metrics (`packages/backend/src/observability/`), Sentry, Winston.
- **Deployment**: Blue-green on Kubernetes with HPA, network policies, and External Secrets Operator.

See [docs/architecture/](docs/architecture/) for detailed design documents and [AGENTS.md](AGENTS.md) for agent development conventions.

## Security

- **CI security gate**: TruffleHog (secrets), CodeQL + Semgrep (SAST), Trivy (containers + filesystem), Checkov (IaC), Hadolint (Dockerfiles). Critical/high findings block merge.
- **Pre-commit**: Gitleaks scans staged files.
- **Secrets**: Vault / AWS Secrets Manager via External Secrets Operator. No secrets in code or config.
- **RLS**: All tenant-scoped tables enforce row-level security. Dedicated CI check validates policies.

See [docs/security-compliance/](docs/security-compliance/) for the full security overview and compliance guide, and review [SECURITY.md](SECURITY.md) for coordinated vulnerability disclosure.

## Documentation

| Category | Path | Contents |
|---|---|---|
| Getting Started | [docs/getting-started/](docs/getting-started/) | Introduction, quickstart, installation, FAQ |
| Architecture | [docs/architecture/](docs/architecture/) | System overview, agent design, API design, data layer |
| Engineering | [docs/engineering/](docs/engineering/) | Code standards, ADRs, database guide, testing |
| Operations | [docs/operations/](docs/operations/) | CI/CD, deployment, monitoring, backup/recovery |
| Runbooks | [docs/runbooks/](docs/runbooks/) | Deployment, database, infrastructure, emergency procedures |
| Security | [docs/security-compliance/](docs/security-compliance/) | Auth, audit logging, compliance, data protection |
| Environments | [docs/environments/](docs/environments/) | Local dev, staging, production setup |
| Features | [docs/features/](docs/features/) | Agents, billing, design system, integrations |
| DX | [docs/developer-experience/](docs/developer-experience/) | Dev environment, tooling, troubleshooting |
| Processes | [docs/processes/](docs/processes/) | Code review, incident management, releases |

## Deployment

See [DEPLOY.md](DEPLOY.md) for production deployment instructions using Docker Compose with Caddy, or the Kubernetes manifests in `infra/k8s/`.

## Contributing

### Supported contributor workflow

1. Open this repository in the Dev Container.
2. Run `pnpm install` to install dependencies.
3. Run `pnpm run dev` to start both runtimes, or `pnpm run dev:frontend` / `pnpm run dev:backend` independently.
4. Create a feature branch from `main`.
5. Make changes following the patterns in [docs/engineering/code-standards.md](docs/engineering/code-standards.md) and [AGENTS.md](AGENTS.md).
6. Ensure `pnpm run lint`, `pnpm test`, and `pnpm run check` pass locally.
7. Open a PR using the [pull request template](.github/pull_request_template.md).

## License

Proprietary. All rights reserved.
