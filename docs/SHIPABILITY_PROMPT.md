# ValueOS One-Shot Swarm Prompt — Make It Shippable

> Paste this entire document as a single prompt into your LLM of choice. It contains the full context, architecture map, codebase state, and parallel work streams needed to execute the entire remaining build in one shot.

---

## SYSTEM IDENTITY

You are a swarm of 7 specialist agents operating in parallel on the **ValueOS** monorepo. The repo lives at `/workspaces/ValueOS` and is a pnpm monorepo containing:

1. **apps/ValyntApp/** — React 18 + TypeScript + Vite + Tailwind frontend: the Value Engineering command console (hypothesis-driven value lifecycle dashboard, SDUI canvas, agent-orchestrated workflows)
2. **packages/backend/** — Node.js + Express backend: 11-agent fabric, 6 runtime services, BullMQ queues, CloudEvents messaging, Supabase (Postgres + RLS + Auth), Redis
3. **packages/shared/** — Canonical domain model (9 Zod schemas: Account, Opportunity, Stakeholder, ValueHypothesis, Assumption, Evidence, BusinessCase, RealizationPlan, ExpansionOpportunity)
4. **packages/memory/** — Persistent memory subsystem (semantic, episodic, vector, provenance) with tenant-scoped queries
5. **packages/sdui/** — Server-Driven UI component system with registry
6. **packages/components/** — Shared UI component library (Radix UI primitives, design system)
7. **packages/integrations/** — External service integrations
8. **packages/mcp/** — MCP servers (ground-truth, CRM, common)
9. **packages/infra/** — Infrastructure utilities (database, ESO, observability)

Your mission: **make the entire system shippable** — all tests green, all endpoints wired, frontend connected to backend, production-grade quality. Execute all 7 work streams below in parallel, resolving cross-dependencies in order.

---

## SYSTEM INTENT (Constitutional — never violate)

> **ValueOS is a system of intelligence that structures, validates, and operationalizes business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.**

### Constitutional Invariants

1. **Value truth over fluent generation** — improve truth, structure, and usability of business value claims
2. **Economic defensibility** — all outputs connect to economic logic: revenue uplift, cost savings, risk reduction, timing, confidence, or realization
3. **Evidence over assertion** — claims grounded in evidence, benchmarks, user inputs, or clearly labeled assumptions
4. **Auditability by default** — outputs must be inspectable; agents preserve reasoning chains
5. **Lifecycle continuity** — discovery → modeling → approval → realization → expansion as one continuous loop
6. **Integrity before convenience** — constrain, qualify, or block outputs when confidence is low
7. **Multi-tenant enterprise discipline** — tenant isolation, role-aware access, organizational trust boundaries
8. **Agents serve the value model** — agents are not the product; they maintain the value system of record

---

## REPO STATE SNAPSHOT (as of 2026-03-27)

### What exists and works:

**Agent Fabric (11 agents)** in `packages/backend/src/lib/agent-fabric/agents/`:
- `BaseAgent.ts` (32K) — `secureInvoke()`, hallucination detection, circuit breaker, Zod validation
- `OpportunityAgent.ts`, `TargetAgent.ts`, `FinancialModelingAgent.ts`, `IntegrityAgent.ts`, `RealizationAgent.ts`, `ExpansionAgent.ts`, `NarrativeAgent.ts`, `ComplianceAuditorAgent.ts`, `ContextExtractionAgent.ts`, `DealAssemblyAgent.ts`, `DiscoveryAgent.ts`
- `GroundTruthAnalyzer.ts` — supporting utility (not an agent, no BaseAgent inheritance)

**6 Runtime Services** in `packages/backend/src/runtime/`:
- `DecisionRouter`, `ExecutionRuntime`, `PolicyEngine`, `ContextStore`, `ArtifactComposer`, `RecommendationEngine`

**Backend Infrastructure:**
- `server.ts` (37K) — Express app with full middleware stack, graceful shutdown, RBAC invalidation
- `services/realtime/MessageBus.ts` — CloudEvents inter-agent messaging with `trace_id` propagation
- `services/billing/` — Stripe integration, metering pipeline, subscription lifecycle
- `services/auth/PermissionService.ts` — RBAC with Redis pub/sub invalidation
- `services/security/SecurityMonitor.ts` — webhook-based alert channels (email, Slack, PagerDuty)
- `services/security/AuditLogService.ts` — audit trail for all mutating actions
- `lib/agent-fabric/LLMGateway.ts` — multi-provider gateway (Together.ai implemented; OpenAI/Anthropic stubs)
- `lib/agent-fabric/MemorySystem.ts` — two-layer memory: in-process L1 → `SupabaseMemoryBackend` → `semantic_memory` table
- `lib/resilience/CircuitBreaker.ts` — canonical circuit breaker implementation

**Frontend (ValyntApp):**
- React 18 + Vite + Tailwind CSS 4 + Radix UI + Recharts + ReactFlow + Framer Motion
- `AppRoutes.tsx` — full route tree with lazy-loaded pages
- `views/` (94 items), `pages/` (51 items), `features/` (167 items), `components/` (209 items)
- `hooks/` (49 items) — data fetching, state management
- SDUI canvas integration, i18n support, accessibility infrastructure
- TanStack Query for data fetching, Zustand for state management, wouter for routing

**Domain Model** (`packages/shared/src/domain/`):
- 9 canonical Zod schemas with TypeScript types
- Canonical `LifecycleStage` type: `discovery | drafting | validating | composing | refining | realized | expansion`

**Database:**
- Supabase (PostgreSQL 15) with RLS on all tenant-scoped tables
- Alembic-style migrations in `infra/supabase/supabase/migrations/`
- High-volume table partitioning for `usage_ledger`, `rated_ledger`, `saga_transitions`, `value_loop_events`
- `state_events` table for event-sourcing with optimistic locking

**CI/CD (already extensive):**
- `pr-fast.yml` — 10+ parallel lanes: secret-scan, ts-type-ratchet, lint-runtime-packages (matrix: backend/valynt-app/shared), unit/component/schema (60+ guards), tenant-isolation-gate, accessibility-audit, e2e-critical, security-gate
- `main-verify.yml` — full-history secret scan, all PR gates + vitest package matrix, critical-workflows-gate, compliance-evidence-completeness, dev-routes-exclusion-gate
- Coverage thresholds: lines=75%, functions=70%, branches=70%, statements=75%
- `any` ratchet baseline: 0 (all 207 production `any` usages eliminated)
- TS error baseline: 0

**Compose stack** (`ops/compose/compose.yml`):
- `backend` (Express on 3001), `frontend` (Vite on 5173), `postgres` (15-alpine on 5432), `redis` (7-alpine on 6379)

**Testing:**
- Vitest with jsdom, globals enabled, sequential execution (`fileParallelism: false`)
- Tests co-located: `*.test.ts` / `*.spec.ts` next to source or in `__tests__/`
- RLS policy tests via `pnpm run test:rls`
- Agent security suite via `scripts/test-agent-security.sh`
- Playwright E2E for critical paths
- Dedicated security vitest config at `tests/security/vitest.security.config.ts`

### Known debt (only P2 — no blockers):

- **DEBT-012** — Migrate deprecated Supabase compat imports (`createServerSupabaseClient`, `getSupabaseClient`) to `src/lib/supabase/privileged/*` factories with `justification: "service-role:justified <reason>"` literals

### Key tech stack:

- **Frontend**: React 18, TypeScript 5.9, Vite 5, Tailwind CSS 4, Radix UI, Recharts, ReactFlow, Framer Motion, TanStack Query, Zustand, wouter, Zod, Lucide React
- **Backend**: Node.js 20, Express, BullMQ, Redis (ioredis), Supabase (Postgres + RLS + Auth + Realtime), OpenTelemetry, Winston, Zod, jose (JWT)
- **Package manager**: pnpm 10.4.1 (`--frozen-lockfile` enforced)
- **Build**: Turbo (tasks: build, test, lint, typecheck, dev)
- **Config**: ESLint 9, Prettier, TypeScript strict mode, Vitest

---

## THE 7 PARALLEL WORK STREAMS

Execute these simultaneously. Each stream is owned by one specialist agent. Cross-stream dependencies are noted — resolve them in the order listed.

---

### STREAM 1: TEST HARDENING AGENT
**Goal:** Get every test to pass. Identify and fix any remaining failures.

**Actions:**
1. Run `pnpm test` from `/workspaces/ValueOS` to get the current workspace test state
2. For every failure, trace to root cause:
   - If tenant isolation related → verify every Supabase query includes `organization_id` / `tenant_id`
   - If agent related → verify `secureInvoke` usage (never direct `llmGateway.complete()`)
   - If import errors → fix missing exports, check path aliases (`@/*`, `@lib/*`, `@shared/*`, `@backend/*`, `@valueos/<pkg>`)
   - If service-role boundary violations → verify imports only from allowed directories
   - If test logic errors → fix tests to match actual implementation behavior, NOT the other way around (unless implementation contradicts `docs/AGENTS.md` or an accepted ADR)
3. Run `pnpm run test:rls` to verify RLS policy tests pass
4. Run `bash scripts/test-agent-security.sh` to verify agent security suite passes
5. Run `pnpm test` and do not stop until output shows **0 failures**

**Constraints:**
- Never weaken a test to make it pass — fix the implementation
- Never delete a test
- If a test is testing wrong behavior per `docs/AGENTS.md` or an accepted ADR in `.windsurf/context/decisions.md`, fix the test AND add a comment citing which ADR/invariant it references

---

### STREAM 2: COVERAGE & MISSING UNIT TESTS AGENT
**Goal:** Hit and sustain CI coverage thresholds — ≥75% lines, ≥70% functions, ≥70% branches, ≥75% statements across shipped packages.

**Actions:**
1. Run `npx vitest run --coverage --coverage.provider=v8 --coverage.reporter=text-summary` to identify uncovered modules
2. For each uncovered module, write focused unit tests co-located with source (in `__tests__/` directories or as sibling `*.test.ts` files):

   - **Agent fabric** (`packages/backend/src/lib/agent-fabric/agents/__tests__/`):
     - Test `BaseAgent.secureInvoke()` for success, circuit breaker open, hallucination detected, Zod validation failure
     - Test each agent's `execute()` with mocked `LLMGateway` and `MemorySystem`
     - Test `AgentFactory.create()` returns correct agent type with tenant-scoped config
   
   - **Runtime services** (`packages/backend/src/runtime/*/`):
     - Test `DecisionRouter` routing logic for each lifecycle stage
     - Test `ExecutionRuntime` workflow execution and compensation handlers
     - Test `PolicyEngine` policy evaluation and tenant-scoped policy retrieval
     - Test `RecommendationEngine` event subscription and recommendation generation
   
   - **Services**:
     - Test `MessageBus` CloudEvents envelope creation, `trace_id` propagation, `tenant_id` enforcement
     - Test `PermissionService` RBAC evaluation, cache invalidation, Redis fallback
     - Test `AuditLogService` entry creation with tenant scoping
     - Test billing services: metering pipeline, subscription lifecycle
   
   - **Domain model** (`packages/shared/src/domain/`):
     - Test each Zod schema: valid input passes, invalid input rejects with descriptive errors
     - Test `LifecycleStage` adapter mapping

3. Every test must be pure in-memory — mock `LLMGateway`, `MemorySystem`, Supabase client, Redis
4. Use `vi.mock()` at module boundary for dependencies
5. After writing tests, re-run coverage and iterate until thresholds are met

**Test co-location convention:**
```
packages/backend/src/lib/agent-fabric/agents/__tests__/   — agent tests
packages/backend/src/runtime/<service>/__tests__/          — runtime service tests
packages/backend/src/services/<domain>/__tests__/          — service tests
packages/shared/src/domain/__tests__/                      — domain model tests
apps/ValyntApp/src/__tests__/                              — frontend tests
```

---

### STREAM 3: BACKEND PRODUCTION-READINESS AGENT
**Goal:** Harden the backend for production: graceful degradation, observability, security boundaries.

**Actions:**
1. **Environment validation at startup** in `server.ts`:
   - Verify all required env vars are present: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `TCT_SECRET`, `WEB_SCRAPER_ENCRYPTION_KEY`
   - Fail fast with descriptive error messages for missing vars
   - Graceful degradation: Redis unavailable → fall back to in-process cache (already partially implemented via RBAC decision)

2. **Health check hardening** at `/health`:
   - Return component-level status:
     ```json
     {
       "status": "healthy",
       "components": {
         "api": "healthy",
         "database": "connected" | "degraded",
         "redis": "connected" | "unavailable",
         "agents_loaded": 11,
         "runtime_services": 6,
         "message_bus": "healthy" | "degraded"
       },
       "version": "<from versioning.ts>"
     }
     ```

3. **LLM Gateway multi-provider completion:**
   - Implement the `openai` provider branch in `LLMGateway.ts` (currently throws `'Provider not implemented'`)
   - Wire circuit breaker per provider with independent failure tracking
   - Add `useFallbackModel` request property support (already declared in `express.d.ts`)
   - Do NOT change the `together` provider — it is production-verified

4. **Deprecated Supabase import migration (DEBT-012):**
   - Replace all imports of `createServerSupabaseClient`, `getSupabaseClient`, and bare `supabase` with `src/lib/supabase/privileged/*` factories
   - Add explicit `justification: "service-role:justified <reason>"` to every service-role call site
   - Verify only allowed directories use service-role: `privileged/`, `services/auth/`, `services/tenant/`, `workers/`, `jobs/`, `scripts/jobs/`

5. **Rate limiting hardening:**
   - Verify `express-rate-limit` is applied to all mutation endpoints (`POST`, `PUT`, `PATCH`, `DELETE`)
   - Add stricter limits for auth endpoints (login, token refresh)
   - Redis-backed rate limiting when available, in-memory fallback otherwise

6. **OpenTelemetry completeness:**
   - Verify trace context propagation across async boundaries (MessageBus, BullMQ workers)
   - Ensure every agent invocation creates a child span with `agent.name`, `agent.lifecycle_stage`, `tenant_id` attributes
   - Verify `req.requestId` is propagated to structured logs (Winston)

---

### STREAM 4: FRONTEND-BACKEND INTEGRATION AGENT
**Goal:** Ensure ValyntApp is fully wired to the backend API. No mock data in production paths.

**Actions:**
1. **Verify API client layer** (`apps/ValyntApp/src/api/`):
   - All API calls go through the centralized client with auth token injection
   - Verify `VITE_API_BASE_URL` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are read from environment
   - Verify error handling: network failures show user-friendly messages, not raw errors
   - Verify 401/403 responses trigger auth redirect

2. **Verify TanStack Query hooks** (`apps/ValyntApp/src/hooks/`):
   - All data-fetching hooks use `useQuery` / `useMutation` with proper cache invalidation
   - Optimistic updates for mutations where appropriate
   - Stale time and retry configuration appropriate per data type (real-time data: short stale time; reference data: longer)

3. **Verify SDUI integration:**
   - Every SDUI component is registered in BOTH `config/ui-registry.json` AND `packages/sdui/src/registry.tsx`
   - Canvas actions flow from backend through SDUI to rendered components
   - Agent-driven UI updates propagate via SSE / Realtime subscription

4. **Verify value lifecycle flow end-to-end:**
   - Discovery → create opportunity → agent generates hypothesis → model validation → integrity check → narrative generation → realization tracking → expansion
   - Each stage transition persists `WorkflowState` to Supabase
   - Each agent invocation creates an audit log entry
   - Frontend reflects stage transitions in real-time

5. **Verify guest access** (`apps/ValyntApp/src/GuestAccessService.ts`):
   - Guest permissions correctly restrict write operations
   - Guest users cannot access tenant-admin features
   - Token-based guest links work with proper expiry

6. **Wire any remaining stub pages** in `apps/ValyntApp/src/pages/` and `views/`:
   - Identify any pages still rendering hardcoded demo data
   - Replace with real API calls using existing hooks
   - Add loading states (skeleton screens), error states (retry), empty states (CTAs)

---

### STREAM 5: UI POLISH & UX AGENT
**Goal:** Make ValyntApp look and feel production-grade. Modern, accessible, responsive.

**Actions:**
1. **Verify Tailwind CSS 4 configuration:**
   - `@tailwindcss/vite` plugin is in `vite.config.ts`
   - `tailwindcss-animate` and `tw-animate-css` are properly integrated
   - Design tokens in `.config/.design-tokens.config.json` are applied consistently

2. **Component library consistency** (`packages/components/`):
   - All Radix UI primitives have consistent styling via `class-variance-authority`
   - `tailwind-merge` used for className composition (no conflicting utilities)
   - `lucide-react` icons used consistently (not mixed icon libraries)

3. **Value lifecycle UX:**
   - **Hypothesis Canvas**: ReactFlow-based node graph shows value hypothesis → evidence → model linkages
   - **Confidence indicators**: Radial progress or gauge components showing agent confidence scores (risk-tiered: financial 0.7–0.9, commitment 0.6–0.85, discovery 0.5–0.8)
   - **Lifecycle stage navigation**: Clear visual indicator of current stage with transitions animated via Framer Motion
   - **Agent activity feed**: Real-time streaming of agent actions via SSE with structured display

4. **Loading, error, and empty states:**
   - Every async view has a skeleton loader (not spinner)
   - Error boundaries with retry buttons at route level
   - Empty states with descriptive CTAs (e.g., "No hypotheses yet. Start a discovery session to generate your first value hypothesis.")

5. **Accessibility (WCAG 2.2 AA):**
   - All interactive elements have `aria-label` or `aria-labelledby`
   - Focus management: visible focus rings, keyboard navigation for all workflows
   - Color contrast ≥4.5:1 (verified by CI gate `check:contrast`)
   - Screen reader announcements for dynamic content updates (agent activity, stage transitions)

6. **Responsive design:**
   - Works on 320px–2560px
   - Mobile-first breakpoints
   - Navigation collapses to hamburger menu on mobile
   - Data tables switch to card layout on small screens

7. **Dark mode:**
   - Verify `next-themes` integration works (already a dependency)
   - All custom colors support `dark:` variants
   - Charts (Recharts) respect theme colors

---

### STREAM 6: CI/CD & GOVERNANCE HARDENING AGENT
**Goal:** Ensure CI gates are comprehensive, no regressions slip through, and deployment pipeline is production-ready.

**Actions:**
1. **Verify all CI gates pass locally** before pushing:
   ```bash
   pnpm run ci:verify
   ```
   This runs: lint → typecheck → legacy-path-imports → docs-boundaries → docs-secrets → docs-date-integrity → eventing-architecture → test → governance-self-check → required-checks-policy → workflow-pnpm-contract → any-ratchet → debt-ratchet → build

2. **Verify deployment workflow** (`.github/workflows/deploy.yml`):
   - Production deploy is gated on all `main-verify.yml` jobs passing
   - Environment secrets are injected, not hardcoded
   - Backend image built from `infra/docker/Dockerfile.backend`
   - Frontend build artifact deployed to CDN/hosting
   - Database migrations run before backend deployment
   - Rollback procedure documented

3. **Verify RLS test minimum counts:**
   - `tenant-isolation-gate` asserts ≥10 RLS tests pass (not silently skipped)
   - `e2e-critical` asserts ≥12 Playwright tests executed with ≥90% pass rate
   - `critical-workflows-gate` asserts ≥10 integration tests at 100% pass rate

4. **Verify security gate completeness:**
   - `pnpm audit` — no unwaived high/critical CVEs
   - gitleaks — no secrets in diff or history
   - Semgrep SAST — OWASP top 10 + secrets
   - Trivy — filesystem + container image scan (HIGH/CRITICAL = fail)
   - CycloneDX SBOM generated and non-empty
   - AppSec controls attestation gate passes

5. **Verify infrastructure readiness contract:**
   ```bash
   node scripts/ci/check-infra-readiness-contract.mjs
   ```
   Must verify: NATS deployment exists, LLMCache includes `tenantId`, RLS test count ≥10, UsageEmitter buffer bounded, BullMQ workers call `tenantContextStorage.run()`

6. **Verify architecture doc / runtime drift:**
   ```bash
   node scripts/ci/check-architecture-doc-drift.mjs
   ```
   Must verify: MessageBus file exists with CloudEvents envelope, BullMQ in package.json, NATS manifest exists, all 11 agent files exist, agent count matches docs, all 6 runtime service directories exist

---

### STREAM 7: DOCUMENTATION & DEMO-READINESS AGENT
**Goal:** Make the repo self-explanatory and demo-ready. A new developer can clone → start → see the value lifecycle in action within 15 minutes.

**Actions:**
1. **Verify README.md** at repo root:
   - "Quick Start" section: clone → `pnpm install --frozen-lockfile` → configure `.env` → `docker compose up -d` → `pnpm run dev` → open browser
   - Architecture overview diagram (Mermaid) showing: ValyntApp ↔ Express API ↔ Agent Fabric ↔ Runtime Services ↔ Supabase/Redis
   - Link to `/health` endpoint and FastAPI-style auto-docs if available
   - Badges: CI status, coverage, license

2. **Verify `CONTRIBUTING.md`:**
   - Development setup instructions (dev container, manual)
   - How to add a new agent (reference `.windsurf/skills/agent-onboarding/SKILL.md`)
   - How to add a new SDUI component (dual registration requirement)
   - How to add a new database migration (RLS policy required)
   - Code style: TypeScript strict, no `any`, named exports, functional React
   - PR template referencing CI gates and governance review

3. **Verify `DEPLOY.md`:**
   - Production deployment checklist
   - Environment variable reference (all required vars with descriptions)
   - Database migration procedure
   - Rollback procedure
   - Monitoring and alerting setup

4. **Create demo script** at `scripts/demo/run-lifecycle-demo.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   # Demonstrates the full value lifecycle through the API
   echo "=== ValueOS Lifecycle Demo ==="
   API_BASE="${API_BASE_URL:-http://localhost:3001}"
   
   echo "1. Health check..."
   curl -sf "$API_BASE/health" | node -e "process.stdin.pipe(require('stream').Transform({transform(c,_,cb){cb(null,c)}}))" | head -c 500
   
   echo -e "\n2. Creating opportunity..."
   # POST to create a new value case / opportunity
   # Track through discovery → hypothesis → model → integrity → narrative
   
   echo -e "\n3. Triggering discovery agent..."
   # Invoke discovery agent on the opportunity
   
   echo "=== Demo complete ==="
   ```

5. **Verify API documentation:**
   - OpenAPI spec exists and passes validation (`node scripts/ci/check-openapi-structure.mjs`)
   - All Express routes have corresponding OpenAPI definitions
   - Security posture documented per endpoint (`node scripts/ci/express-openapi-security-check.mjs`)

6. **Verify runbooks** (`docs/runbooks/`):
   - Incident response for common failures (DB connection loss, Redis unavailable, LLM provider outage)
   - Scaling procedures for agent workloads
   - Tenant onboarding procedure

---

## CROSS-STREAM DEPENDENCY ORDER

```
Stream 1 (Test Fixes) ──────────────┐
Stream 2 (Coverage)   ──────────────┤
                                     ├──→ Stream 6 (CI/CD) ──→ Stream 7 (Docs)
Stream 3 (Backend Prod) ────────────┤
Stream 4 (Frontend Integration) ────┤
Stream 5 (UI Polish) ───────────────┘
```

- Streams 1–5 can run in parallel
- Stream 6 depends on Streams 1–3 (needs passing tests, coverage thresholds, working backend)
- Stream 7 depends on everything (documents the final state)

---

## HARD CONSTRAINTS

1. **Never delete or weaken existing tests** — fix implementations to match tests, unless the test contradicts `docs/AGENTS.md` or an accepted ADR
2. **Never hardcode secrets** — use environment variables. Sensitive defaults must never be committed. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` where needed
3. **TypeScript strict mode enforced.** Zero `any` — use `unknown` + type guards. The `any` ratchet baseline is 0; any regression fails CI
4. **Preserve all existing comments and docstrings** — do not strip them
5. **Tenant isolation is non-negotiable:**
   - Every Supabase query MUST include `organization_id` or `tenant_id`
   - Every vector/memory query MUST filter on `tenant_id` in metadata
   - Every BullMQ worker MUST call `tenantContextStorage.run()` before processing
   - `service_role` only in: `lib/supabase/privileged/`, `services/auth/`, `services/tenant/`, `workers/`, `jobs/`, `scripts/jobs/`
   - No `(req as any)` casts — use typed `express.d.ts` augmentation
6. **Agent LLM calls via `secureInvoke` only** — never call `llmGateway.complete()` directly from agent code
7. **Named exports only** — no default exports anywhere in the codebase
8. **Functional React components** with hooks — no class components
9. **Imports at top of file** — never inline imports mid-function
10. **pnpm with `--frozen-lockfile`** — never `--no-frozen-lockfile` in automation
11. **SDUI dual registration** — every component in both `config/ui-registry.json` AND `packages/sdui/src/registry.tsx`
12. **Workflows are DAGs** — cycles forbidden. Every state mutation needs a compensation function (saga pattern). Persist `WorkflowState` to Supabase after every node transition
13. **Every new file needs a module-level JSDoc comment** explaining its purpose

---

## WHAT "DONE" LOOKS LIKE

```bash
# Unit tests
pnpm test                                              # 0 failures

# Coverage
npx vitest run --coverage --coverage.provider=v8 \
  --coverage.thresholds.lines=75 \
  --coverage.thresholds.functions=70 \
  --coverage.thresholds.branches=70 \
  --coverage.thresholds.statements=75                  # All thresholds met

# Type safety
pnpm run check                                         # 0 TypeScript errors

# Lint
pnpm run lint                                          # Clean

# RLS + Security
pnpm run test:rls                                      # ≥10 tests pass
bash scripts/test-agent-security.sh                    # All pass

# Governance
pnpm run ci:verify                                     # Full CI pipeline green

# Backend
pnpm run dev:backend                                   # Starts on :3001
curl -sf http://localhost:3001/health | jq .            # All components healthy

# Frontend
pnpm run dev:frontend                                  # Starts on :5173
# Opens dashboard, can navigate lifecycle, trigger agents

# Build
pnpm run build                                         # Both frontend + backend compile with 0 errors

# Docker
docker compose up -d                                   # All services healthy
docker compose ps                                      # backend, frontend, postgres, redis all running

# E2E
npx playwright test tests/e2e/workflows/wf-1.spec.ts  # Critical workflows pass

# Architecture drift
node scripts/ci/check-architecture-doc-drift.mjs       # No drift detected
node scripts/ci/check-infra-readiness-contract.mjs     # Contract satisfied
```

---

## BEGIN

You have complete read/write access to the repo at `/workspaces/ValueOS`. Start all 7 streams now. Prioritize Stream 1 (fix any failing tests) first, then fan out. Show your work for each stream with clear headers. When you encounter a decision point, choose the option that maximizes shipping velocity while preserving:

1. Tenant isolation guarantees
2. Agent governance safety (secureInvoke, hallucination detection, audit trail)
3. Evidence-backed value integrity (no hallucinated ROI, no ungrounded claims)

**The success metric:** *"Can a senior Value Engineer walk into a boardroom and defend a $10M claim using the ValueOS output without hand-waving or manual spreadsheet verification?"*

**Ship the System. Bound the Agents. Go.**
