# ValueOS

AI-powered value engineering platform for B2B SaaS. ValueOS helps customer success and sales teams quantify, track, and expand business value through an eight-agent fabric backed by Supabase, Redis, and CloudEvents messaging.

## Repository Layout

pnpm monorepo. Two runtimes: one frontend, one backend.

```
apps/
  ValyntApp/        # Web application (React + Vite + Tailwind) — the only frontend runtime
  VOSAcademy/       # Training and certification portal
  mcp-dashboard/    # MCP observability dashboard

packages/
  backend/          # API server (Express) — the only backend runtime
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

- Node.js >= 20.19.0
- pnpm >= 9.15.0
- Docker and Docker Compose

## Quickstart

```bash
# Install dependencies
pnpm install

# Start frontend and backend together
pnpm run dev

# Or start each runtime independently
pnpm run dev:frontend   # apps/ValyntApp — React + Vite on port 5173
pnpm run dev:backend    # packages/backend — Express API
```

### Environment variables

Copy the template and fill in your Supabase and LLM provider credentials:

```bash
cp .env.example .env.local
```

See [docs/environments/local-development.md](docs/environments/local-development.md) for the full variable reference.

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
| `pnpm run db:push` | Generate and apply Drizzle migrations |

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

- **Single runtime rule**: `apps/ValyntApp` is the only frontend. `packages/backend` is the only backend. No other entry points.
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
