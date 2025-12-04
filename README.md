# ValueCanvas

ValueCanvas is a multi-tenant AI workflow platform that combines a Vite/React front end, a Supabase-backed data layer, and agent services that orchestrate long-running workflows. The platform runs across a small set of composable services so teams can ship features quickly while keeping security controls (RLS, audit logging, and secrets hygiene) in place from day one.

## System context
- **Clients** use the React UI and call the backend over HTTPS.
- **API & Orchestrator** handle billing, routing, and agent workflow coordination for each tenant.
- **Supabase** provides Postgres (with RLS), storage, and edge functions for LLM proxying.
- **Background services** (Redis, observability stack) support caching, rate limiting, and telemetry.
- **Secrets manager** (AWS Secrets Manager or Vault) stores operational credentials; environment files are reserved for non-sensitive defaults.

## Service map
| Layer | What runs here | Key responsibilities |
| --- | --- | --- |
| Frontend | `vite` React app (see `src/`) | UI, session handling, client-side Supabase auth |
| API & Billing | Express server (`src/backend/server.ts`) | Billing routes, webhook handling, tenant-aware CORS |
| Agent Fabric | Orchestrator and agents (`src/lib`, `src/services`) | Workflow execution, tenant-aware rules, tool access |
| Data plane | Supabase Postgres, storage, Redis (`supabase/`, `infrastructure/`) | RLS policies, audit logging, caching |
| CI/CD & Security | GitHub Actions workflows | Lint/typecheck/tests, secret scanning, SBOM, container scanning, builds |

## Environment setup
1. **Prerequisites**: Node 20+, npm, Docker (for Supabase/local db), and the Supabase CLI (`supabase/setup-cli@v1` in CI).
2. **Install dependencies**: `npm ci`
3. **Secrets**: set `SECRETS_MANAGER_ENABLED=true` with `SECRETS_PROVIDER=aws` or `vault` and provide cloud credentials. Required keys (e.g., `SUPABASE_SERVICE_KEY`, `REDIS_URL`) are loaded from the secrets manager; `.env` should not contain production secrets.
4. **Database**: `npm run db:setup` to bootstrap Supabase locally. Regenerate types with `npm run db:types`.
5. **Run locally**: `npm run dev` (frontend) and `npm run backend:dev` (billing API).

## Testing
- Unit & integration: `npm test`
- Type checking: `npm run typecheck`
- RLS & multi-tenant policies: `npm run test:rls` (runs Supabase SQL suites in `supabase/tests/database`)
- Security scans: `npm run security:scan` and `npm run security:scan:snyk` (requires `SNYK_TOKEN`)

See [TESTING.md](TESTING.md) for detailed scenarios and coverage notes.

## Contributing
Pull requests follow the standard fork-and-branch flow. See [CONTRIBUTING.md](CONTRIBUTING.md) for coding standards, commit hygiene, and review expectations.

## CI/CD and supply chain controls
A dedicated GitHub Actions pipeline enforces lint → typecheck → unit/integration → RLS/multi-tenant → dependency audit/Snyk → SBOM/Trivy → build. Secret scanning (git-secrets + TruffleHog) runs before any build artifacts are produced, and SBOM plus image scanning gate deployments. See `.github/workflows/secure-ci.yml` for details.
