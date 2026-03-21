# AGENTS.md — ValueOS

Single source of truth for AI coding agents. Tool-specific configs (`.github/copilot-instructions.md`, `.windsurf/rules/`, `GEMINI.md`) should reference this file rather than duplicate its content.

## Architecture

pnpm monorepo. Frontend apps in `apps/` are `ValyntApp` (`valynt-app`) and `mcp-dashboard` (`mcp-dashboard`). Top-level directories under `packages/` are `backend`, `components`, `config-v2`, `infra`, `integrations`, `mcp`, `memory`, `sdui`, `services`, `shared`, and `test-utils`; workspace packages among them include `@valueos/backend`, `@valueos/components`, `@vos/config-v2`, `@valueos/infra`, `@valueos/integrations`, `@valueos/mcp`, `@valueos/memory`, `@valueos/sdui`, and `@valueos/shared`.

**Stack:** React + Vite + Tailwind (frontend), Node.js + Express (backend), Supabase (Postgres + RLS + Auth + Realtime), Redis, BullMQ queues, CloudEvents messaging.

**Agent system:** 8-agent fabric in `packages/backend/src/lib/agent-fabric/`. Agents: OpportunityAgent, TargetAgent, FinancialModelingAgent, IntegrityAgent, RealizationAgent, ExpansionAgent, NarrativeAgent, ComplianceAuditorAgent. Orchestration via six runtime services in `packages/backend/src/runtime/` (DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine). Vector memory with tenant-scoped queries. Inter-agent messaging via `MessageBus` (CloudEvents).

## Non-Negotiable Rules

### 1. Tenant isolation

Every database query MUST include `organization_id` or `tenant_id`. Every vector/memory query MUST filter on `tenant_id` in metadata. No exceptions.

```typescript
// ✅
await supabase.from("workflows").select("*").eq("organization_id", orgId);
await memorySystem.query(embedding, { metadata: { tenant_id: orgId }, limit: 10 });

// ❌ Data leak
await supabase.from("workflows").select("*");
await memorySystem.query(embedding, { limit: 10 });
```

Validate with: `pnpm run test:rls`

### 2. LLM calls via secureInvoke only

All production agent LLM calls use `this.secureInvoke(sessionId, prompt, zodSchema, options)` from `BaseAgent`. Never call `llmGateway.complete()` directly from agent code. See `.windsurf/skills/agent-onboarding/SKILL.md` for the full agent scaffold pattern.

### 3. service_role restrictions

`service_role` bypasses RLS. Use it only for: AuthService, tenant provisioning, cron jobs.

### 4. No cross-tenant data transfer

Block any operation that copies, moves, or exports data between tenants.

### 5. Express request properties — no `(req as any)` casts

`packages/backend/src/types/express.d.ts` augments `Express.Request` with all backend-specific properties. Access them directly — never cast to `any` to reach them.

```typescript
// ✅
const tenantId = req.tenantId;
const userId   = req.user?.id;

// ❌
const tenantId = (req as any).tenantId;
```

Declared properties: `user`, `tenantId`, `tenantSource`, `tenantContext`, `tenantSettings`, `session`, `sessionId`, `userId`, `requestId`, `organizationId`, `serviceIdentityVerified`, `useFallbackModel`, `supabase`, `supabaseUser`, `usageContext`, `_auditMiddlewareAttached`. Add new properties to `express.d.ts` rather than casting.

## Agent Development

Location: `packages/backend/src/lib/agent-fabric/agents/` — one class per file, named `XAgent.ts`.

Requirements:
- Extend `BaseAgent`
- Define `lifecycleStage`, `version`, `name`
- Use Zod schemas for LLM responses; include `hallucination_check: boolean`
- Store memory with `this.organizationId` (tenant isolation)
- Use Handlebars templates for prompts (no string concatenation)
- Confidence thresholds by risk: financial 0.7–0.9, commitment 0.6–0.85, discovery 0.5–0.8

See `.windsurf/skills/agent-onboarding/SKILL.md` for the full scaffold, validation checklist, and example implementation.

## Workflows & Messaging

- DAG definitions: `packages/backend/src/data/lifecycleWorkflows.ts`
- Orchestration: six runtime services in `packages/backend/src/runtime/`
- Inter-agent communication: `MessageBus` (CloudEvents) — propagate `trace_id` across async boundaries
- Workflows are DAGs; cycles are forbidden
- Saga pattern: every state mutation needs a compensation function
- Persist `WorkflowState` to Supabase after every node transition

## Coding Conventions

- **TypeScript strict mode.** No `any` — use `unknown` + type guards.
- **Named exports only** (no default exports).
- **Functional React components** with hooks.
- **Zod** for runtime validation.
- **Path aliases** (defined in `tsconfig.app.json`):
  - `@/*` → `./src/*`
  - `@lib/*` → `./src/lib/*`
  - `@shared/*` → `./packages/shared/src/*`
  - `@backend/*` → `./packages/backend/src/*`
  - `@valueos/<pkg>` → `./packages/<pkg>/...`
- **SDUI components:** register in both `config/ui-registry.json` and `packages/sdui/src/registry.tsx`.
- **Tools:** implement `Tool<TInput, TOutput>` interface, register statically in `ToolRegistry.ts`. Dynamic creation forbidden.

### Service de-duplication

Before treating two same-named files as duplicates, read both. If they serve different concerns, document the distinction in each file's header and in `debt.md` — do not consolidate. See ADR-0017.

When a service file exceeds ~1000 lines, extract cohesive sub-concerns into separate files. The original file re-exports everything so callers need no import changes.

Canonical locations for extracted modules:
- Tenant tier limits and feature flags → `packages/backend/src/services/tenant/TenantLimits.ts`
- SDUI atomic action application → `packages/backend/src/services/sdui/CanvasActionApplier.ts`
- Agent retry/resilience types → `packages/backend/src/services/agents/resilience/AgentRetryTypes.ts`
- Domain types shared across packages → `packages/shared/src/domain/` (Zod schemas)

## Dev Commands

```bash
# Full stack
gitpod automations service start backend
gitpod automations service start frontend

# Individual services
pnpm run dev:frontend    # Vite, port 5173
pnpm run dev:backend     # Express, port 3001

# Database
pnpm run db:migrate

# Quality
pnpm run lint
pnpm run check           # TypeScript typecheck
pnpm test                # Workspace unit tests only (Vitest, sequential, fileParallelism: false)
pnpm run test:rls        # RLS policy validation
bash scripts/test-agent-security.sh

# Diagnostics
node scripts/dx/doctor.js
```

## Dev Container

| File | Purpose |
|---|---|
| `.devcontainer/Dockerfile` | Custom image: OS packages, Node, pnpm, kubectl, terraform |
| `.devcontainer/devcontainer.json` | Build args (with SHA256s), forwarded ports, VS Code extensions |
| `.devcontainer/versions.json` | Single source of truth for all pinned tool versions |
| `.devcontainer/scripts/bootstrap.sh` | Idempotent setup: toolchain validation, `.env`, `pnpm install` |
| `.ona/automations.yaml` | All automation tasks and dev server services |

**Custom Dockerfile** (`mcr.microsoft.com/devcontainers/base:ubuntu-24.04`). Do not switch to a pre-built language image — the project requires kubectl, terraform, postgresql-client, and redis-tools that are not present in `javascript-node`. Layer order is slowest→fastest-changing: OS packages → Node.js → pnpm → infra CLIs → user setup. BuildKit cache mounts are used on all `apt-get` layers.

**SHA256 verification.** Every downloaded binary (Node tarball, kubectl, terraform zip) is verified against a pinned SHA256 before installation. The hashes live in `devcontainer.json` `build.args` alongside the version strings. When upgrading a tool, update both the version and the hash.

**Version source of truth hierarchy:**
1. `.devcontainer/versions.json` — canonical; read by `bootstrap.sh` and `read-version.sh`
2. `.nvmrc` — must match `versions.json` `node`
3. `.tool-versions` — must match `versions.json` `node` and `pnpm`
4. `devcontainer.json` `build.args` — must match `versions.json` for all four tools

When bumping a version, update `versions.json` first, then propagate to the other three files and recompute the SHA256.

**No lifecycle hooks in `devcontainer.json`.** `postCreateCommand`, `onCreateCommand`, and `postStartCommand` are forbidden. All setup runs through automations:
- `installDeps` (`postDevcontainerStart`) — runs `bootstrap.sh`: validates toolchain versions, provisions `.env`, installs workspace dependencies with `--frozen-lockfile`, smoke-tests that `turbo` and `tsx` resolve.
- `backend` / `frontend` services (`postEnvironmentStart`) — wait on `node_modules/.modules.yaml` before starting dev servers.

**`pnpm install` uses `--frozen-lockfile`.** This matches `.npmrc` and fails fast if `pnpm-lock.yaml` is out of sync. Never pass `--no-frozen-lockfile` in automation — fix the lockfile instead.

**`turbo` and `tsx` are workspace devDependencies**, not global image installs. They are available after `pnpm install` via `pnpm exec turbo` / `pnpm exec tsx`. Do not add them to the Dockerfile.

**`PNPM_HOME`:** `/home/vscode/.local/share/pnpm` — the container runs as the `vscode` user (uid 1000). This directory is created by the Dockerfile and owned by `vscode`.

**Ports forwarded:** 5173 (ValyntApp), 3001 (Backend API). These ports are opened by the service start commands.

## Dev Environment Notes

**Backend port:** Express binds to `API_PORT` (default **3001**). Health check: `http://localhost:3001/health`. Do not assume port 8000.

**`SUPABASE_KEY` env var:** Three files read `process.env.SUPABASE_KEY` rather than `SUPABASE_ANON_KEY` — set both to the same anon key value. If the backend crashes with `supabaseKey is required`, this var is missing.

**Required env vars** (set in `ops/env/.env.backend.local`):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `TCT_SECRET` — backend startup fails fast if missing
- `WEB_SCRAPER_ENCRYPTION_KEY` — 32-byte hex; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Testing Conventions

- Framework: Vitest with jsdom, globals enabled.
- Tests co-located: `*.test.ts` / `*.spec.ts` next to source, or in `__tests__/` directories.
- Sequential execution (`fileParallelism: false`).
- `pnpm test` is the unit-only default lane. Backend integration (`*.integration.{test,spec}.ts`, `*.int.{test,spec}.ts`, integration-only directories), performance (`*.perf.{test,spec}.ts`), load (`*.load.{test,spec}.ts`), E2E (`*.e2e.{test,spec}.ts`), and security/RLS suites run through dedicated commands or configs instead of the default workspace Vitest run.
- Mock `LLMGateway` and `MemorySystem` in agent tests.
- Detailed contract: `docs/testing/pnpm-test-contract.md`.

## Safety & Compliance

- PII detection: block SSN, CC, email lists, phone, passport, DOB, healthcare IDs. Never log PII.
- Dangerous command blocking: DROP/TRUNCATE without WHERE, `rm -rf`, `sudo`, `chmod 777`, `eval`, `kill -9`.
- Cost limits per session: dev $5, staging $10, prod $25 (warn at 80%).
- Audit trail required for create/update/delete/export/approve/reject/grant/revoke actions.

Full policy-as-code: `.windsurf/rules/global.md`

## Key Files

| File | Purpose |
|---|---|
| `packages/shared/src/domain/` | Canonical domain model — 9 Zod schemas (Account, Opportunity, Stakeholder, ValueHypothesis, Assumption, Evidence, BusinessCase, RealizationPlan, ExpansionOpportunity) |
| `packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts` | `secureInvoke`, hallucination detection, agent base class |
| `packages/backend/src/runtime/` | Six runtime services: DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine |
| `packages/backend/src/types/express.d.ts` | Express `Request` augmentation — extend here, never cast |
| `packages/backend/src/services/tenant/TenantLimits.ts` | Canonical tier limits and feature flags |
| `packages/backend/src/services/MessageBus.ts` | CloudEvents inter-agent messaging |
| `packages/backend/src/services/ToolRegistry.ts` | Static tool registration |
| `packages/memory/` | Persistent memory subsystem (semantic, episodic, vector, provenance) |
| `.windsurf/rules/global.md` | Safety and compliance policy |
| `.github/CODEOWNERS` | Review routing by team |

Full file map: `.windsurf/context/traceability.md`

## Context Engineering Layer

`.windsurf/context/` gives agents the right knowledge at the right time. Read before acting:

| File | Read when |
|---|---|
| `decisions.md` | Before changing system boundaries, data flows, or agent config |
| `debt.md` | Before sprint planning or touching files with known stubs |
| `user-stories.md` | Before implementing a feature or writing lifecycle tests |
| `traceability.md` | Before touching any lifecycle stage |
| `memory.md` | Before submitting a PR touching agent code, DB queries, or UI |
| `tools.md` | Before adding or calling a tool |

**Context file staleness:** `debt.md` is manually maintained — read the referenced file before treating a debt item as open. Re-measure `any` counts with grep before writing targets; do not trust table values as current.

Update context files when their domain changes. See `.windsurf/context/README.md` for the update protocol.
