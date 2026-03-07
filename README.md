# ValueOS

AI-powered value engineering platform for B2B SaaS. ValueOS helps customer success and sales teams quantify, track, and expand business value through a multi-agent orchestration system backed by Supabase, Redis, and CloudEvents messaging.

## Repository Layout

This is a pnpm monorepo managed with Turborepo.

```
apps/
  ValyntApp/        # Primary web application (React + Vite + Tailwind)
  VOSAcademy/       # Training and certification portal
  mcp-dashboard/    # MCP observability dashboard

packages/
  agent-fabric/     # Primary multi-agent framework and shared orchestration primitives
  agents/           # Standalone agent microservices (deprecated, mock-data based)
  backend/          # Express API server (billing, auth, workflows, agents)
  components/       # Shared UI component library and design system
  config-v2/        # Shared configuration schemas and validation
  infra/            # Infrastructure utilities and queue abstractions
  integrations/     # Third-party integrations (Stripe, CRM, etc.)
  mcp/              # Model Context Protocol tooling
  memory/           # Agent memory and vector store layer
  services/         # Cross-package services and adapters
  sdui/             # Server-Driven UI renderer
  sdui-types/       # Shared SDUI type system
  shared/           # Shared types, utilities, and constants
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

# Start local development (server + Vite client)
pnpm run dev
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
| `pnpm run dev` | Start local development (Express + Vite) |
| `pnpm run check` | Run TypeScript no-emit checks |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm run format` | Format code with Prettier |
| `pnpm run build` | Build client bundle and server entrypoint |
| `pnpm run start` | Run the production build |
| `pnpm run db:push` | Generate and apply Drizzle migrations |

## Architecture

ValueOS is a modular monolith deployed to Kubernetes with the following key layers:

```
+---------------------------------------------------------+
|  Frontend (React + Vite + Tailwind + Radix UI)          |
|  Route-level code splitting via React.lazy              |
+---------------------------------------------------------+
|  Backend API (Express)                                  |
|  REST endpoints · RBAC middleware · rate limiting        |
+---------------------------------------------------------+
|  Agent Fabric (6 lifecycle agents)                      |
|  Orchestrator · Memory · MCP tools · BullMQ queues      |
+---------------------------------------------------------+
|  Data Layer                                             |
|  Supabase (Postgres + RLS) · Redis · CloudEvents bus    |
+---------------------------------------------------------+
```

- **Multi-tenancy**: Shared-schema with `tenant_id` columns enforced by Postgres RLS policies.
- **Auth**: Supabase Auth with JWT, RBAC, WebAuthn/FIDO2, and MFA.
- **Observability**: OpenTelemetry SDK, Prometheus metrics, Sentry error tracking, Winston logging.
- **Deployment**: Blue-green on Kubernetes with HPA, network policies, and External Secrets Operator.

See [docs/architecture/](docs/architecture/) for detailed design documents.

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
2. Run `pnpm run dx:up --mode local` to start the local development stack.

1. Create a feature branch from `main`.
2. Make changes following the patterns in [docs/engineering/code-standards.md](docs/engineering/code-standards.md).
3. Ensure `pnpm run lint`, `pnpm test`, and `pnpm run typecheck:islands` pass.
4. Open a PR using the [pull request template](.github/pull_request_template.md).

## License

Proprietary. All rights reserved.
