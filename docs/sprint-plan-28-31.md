# Sprint Plan — Sprints 28–31: Type Safety Completion, Tenant Onboarding, and Integration Depth

**Author:** Ona (AI Engineering Agent)
**Date:** 2026-07-15
**Baseline:** Post-Sprint 27

---

## Baseline

### Current sprint: 28

### What is complete (✅ full traceability)

- All six lifecycle stages — full stack slices live (Stages 1–6)
- `ValueCommitmentTrackingService` — all stubs replaced with real DB operations (Sprint 20)
- Six runtime services wired: DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine
- `realtime/MessageBus` `CommunicationEvent` carries `tenant_id`; `publishMessage()` validates non-empty (Sprint 24)
- `RecommendationEngine` handlers have explicit `tenantId` guards (Sprint 24)
- Mixed-tenant async integration test suite in CI (Sprint 24)
- `useAuth` does not write user profile to `localStorage` (Sprint 25)
- `ReadThroughCacheService.invalidateEndpoint` uses cursor-based SCAN (Sprint 25)
- `RedTeamAgent` migrated to `secureInvoke` / `BaseAgent` (Sprint 25)
- `projects` router emits audit records on create/update/delete (Sprint 25)
- Partition scheduler wired (`pg_cron` or BullMQ fallback) (Sprint 26)
- `docs/runbooks/rbac-redis-unavailable.md` exists (Sprint 26)
- `packages/backend` `any` count reduced by ≥100 from 764 baseline (Sprint 26)
- `packages/sdui` `any` count below 50 (Sprint 27)
- `apps/ValyntApp` `any` count below 207 (Sprint 27)
- `TenantContextIngestionService` exists with Zod-validated interface and tenant-scoped memory storage (Sprint 27)

### Measured `any` baselines entering Sprint 28

| Module | Measured count | Sprint 28–31 target |
|---|---|---|
| `packages/backend` | 893 (re-measured 2026-07-15 with `--include` flags) | <700 by Sprint 31 |
| `apps/ValyntApp` | 409 (production files: ~207 after Sprint 27) | <100 by Sprint 31 |
| `packages/sdui` | 221 (production files: ~50 after Sprint 27) | <20 by Sprint 31 |
| `apps/VOSAcademy` | 99 | <50 by Sprint 31 |
| `packages/mcp` | 0 | maintain 0 |

### What is open (sequenced into this horizon)

**Feature gaps:**
- `TenantContextIngestionService` exists (Sprint 27) but has no UI entry point — US-007 onboarding flow is blocked
- Salesforce adapter is empty stubs (DEBT-008, issue #1349) — US-008 partially blocked
- `SandboxedExecutor` uses placeholder `fetch` calls instead of real E2B SDK (DEBT-011)

**Type safety debt (highest-density production files):**
- `packages/backend`: `api/admin.ts` (22), `api/referrals.ts` (20), `services/agents/AgentMemoryIntegration.ts` (15), `services/sdui/CanvasSchemaService.ts` (13), `services/post-v1/PlaygroundAutoSave.ts` (13), `services/post-v1/OfflineEvaluation.ts` (13), `config/ServiceConfigManager.ts` (13)
- `apps/ValyntApp`: `mcp-ground-truth/core/IntegratedMCPServer.ts` (39), `lib/safeExpressionEvaluator.ts` (10), `views/Admin/DocumentationCMS.tsx` (8), `utils/export.ts` (8), `types/vos.ts` (8)
- `packages/sdui`: `engine/renderPage.ts` (16), `realtime/WebSocketDataSource.ts` (14), `DataBindingResolver.ts` (14), `canvas/types.ts` (9)
- `apps/VOSAcademy`: `lib/icons.tsx` (40), `data/routers.d.ts` (18)

**DEBT-010 status correction:** `SecurityMonitor` alert channels are implemented via webhook URLs (email, Slack, PagerDuty, escalation). DEBT-010 is resolved; `debt.md` corrected and Resolved table updated (2026-07-15).

### What is deferred (post-Sprint 31)

- DEBT-011 — SandboxedExecutor E2B SDK (product decision on code execution scope pending)
- DEBT-012 — VOSAcademy content loader (content strategy pending)
- US-008 Salesforce adapter full implementation (product priority post-GA)
- ServiceNow, Slack, SharePoint integration adapters (DEBT-008 remainder)
- PPTX export; Kafka rollout
- Grafana alerting rules wired to incident runbooks
- `DeviceFingerprintService` GeoIP / threat intelligence
- `EnhancedParallelExecutor` progress-to-UI via WebSocket
- ADR-0005 Theme Precedence (proposed, not accepted)
- `packages/mcp` `any` below 20 (currently at 0; maintain 0 — no reduction work needed)
- `apps/VOSAcademy` `any` below 20 (Sprint 31 delivers below 50; below 20 is next horizon)

---

## Sprint 28 — Backend `any` Elimination: API and Agent Layers (Weeks 1–2)

**Objective:** `packages/backend` production `any` count is below 810. The five highest-density production files in the API and agent layers are fully typed.

**Success statement:** `grep -rn ": any\b\|as any\b\|<any>" packages/backend/src --include="*.ts" --include="*.tsx" | grep -v "__tests__\|\.test\.\|\.spec\." | wc -l` reports fewer than 810. `api/admin.ts`, `api/referrals.ts`, `services/agents/AgentMemoryIntegration.ts`, `services/sdui/CanvasSchemaService.ts`, and `config/ServiceConfigManager.ts` contain zero `any` usages. `pnpm test` green.

**Depends on:** Sprint 27 complete.

**Architectural rationale:** The API layer (`admin.ts`, `referrals.ts`) and the agent memory integration are the highest-risk `any` sites in the backend — request body types and agent message payloads are the most likely vectors for runtime type errors that bypass TypeScript's guarantees. Eliminating `any` here before the tenant onboarding UI sprint (Sprint 29) ensures the new ingestion endpoints are typed from day one. `CanvasSchemaService.ts` is targeted because SDUI rendering depends on it and Sprint 27 cleaned the SDUI package itself.

**Competitor context:** Gainsight's CS platform and Vivun's deal room both expose typed API contracts to enterprise integrators. Untyped request handlers are a SOC 2 audit finding.

### KR 28-1 — `api/admin.ts` fully typed (22 usages)

**Acceptance criteria:**
- All request body parameters typed with Zod schemas; `req.body` is never `any`
- All response types explicit — no `res.json(anything: any)`
- `grep -n ": any\b\|as any\b\|<any>" packages/backend/src/api/admin.ts` returns no matches
- Existing admin route tests pass without modification

### KR 28-2 — `api/referrals.ts` fully typed (20 usages)

**Acceptance criteria:**
- Request body and query parameter types defined with Zod; validated at handler entry
- Response shapes typed
- `grep -n ": any\b\|as any\b\|<any>" packages/backend/src/api/referrals.ts` returns no matches
- Existing referral route tests pass

### KR 28-3 — `services/agents/AgentMemoryIntegration.ts` fully typed (15 usages)

**Acceptance criteria:**
- Agent message payload `any` replaced with typed union sourced from `packages/shared/src/domain/` or a local `AgentMessage` union in `packages/backend/src/types/`
- Memory store call signatures typed end-to-end
- `grep -n ": any\b\|as any\b\|<any>" packages/backend/src/services/agents/AgentMemoryIntegration.ts` returns no matches
- `AgentMemoryIntegration.test.ts` passes

### KR 28-4 — `services/sdui/CanvasSchemaService.ts` and `config/ServiceConfigManager.ts` typed (13 + 13 usages)

**Acceptance criteria:**
- `CanvasSchemaService.ts`: schema node types defined; no `any` in schema traversal or mutation methods
- `ServiceConfigManager.ts`: config value types narrowed with discriminated unions or Zod; no `any` in getter/setter signatures
- `grep -n ": any\b\|as any\b\|<any>" packages/backend/src/services/sdui/CanvasSchemaService.ts packages/backend/src/config/ServiceConfigManager.ts` returns no matches
- `CanvasSchemaService.test.ts` passes

### KR 28-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- `grep -rn ": any\b\|as any\b\|<any>" packages/backend/src --include="*.ts" --include="*.tsx" | grep -v "__tests__\|\.test\.\|\.spec\." | wc -l` reports fewer than 810

**Risk flags:**
- `api/admin.ts` request body types may require new Zod schemas that touch shared validation logic. Contingency: define schemas inline in `admin.ts` first; extract to `packages/shared` in a follow-up if reuse is needed.
- `AgentMemoryIntegration.ts` message payload types may not have a canonical definition in `packages/shared`. Contingency: define `AgentMessage` union locally in `packages/backend/src/types/agent-messages.ts`; document in `tools.md` as a candidate for promotion to shared.

---

## Sprint 29 — Tenant Onboarding UI and Salesforce Adapter Foundation (Weeks 3–4)

**Objective:** A tenant admin can complete the onboarding flow in the UI, providing company context that is ingested into tenant-scoped semantic memory. The Salesforce adapter has a working OAuth connection and opportunity fetch.

**Success statement:** An admin navigating to Settings → Onboarding can submit company context (website URL, product description, ICP definition) and receive confirmation that it has been stored. `TenantContextIngestionService.ingest()` is called end-to-end. The Salesforce adapter's `getOpportunities()` returns real data when a valid OAuth token is present. `pnpm test` green.

**Depends on:** Sprint 28 complete. `TenantContextIngestionService` from Sprint 27 is the backend contract this sprint's UI calls.

**Architectural rationale:** US-007 (tenant onboarding) is the prerequisite for all cross-case learning — agents cannot reference firm-specific context until it is ingested. Sprint 27 delivered the backend service; this sprint closes the loop with a UI entry point. The Salesforce adapter (US-008) is sequenced here because the OAuth connection pattern is identical to HubSpot's existing implementation — the adapter can reuse `CrmConnectionService` and `tokenEncryption.ts` without new infrastructure.

**Competitor context:** Mediafly's content onboarding and Gainsight's account context ingestion are both single-session setup flows. A multi-step wizard that requires engineering intervention to configure is a sales blocker for enterprise deals.

### KR 29-1 — Tenant onboarding UI: context submission form

**Acceptance criteria:**
- New route `/settings/onboarding` renders a form with fields: company website URL, product description (textarea), ICP definition (textarea), competitor list (comma-separated)
- Form submits to `POST /api/v1/tenant/context` which calls `TenantContextIngestionService.ingest()`
- Success state shows confirmation with a summary of what was stored
- Empty state shows instructions; form is pre-filled if context already exists (GET on mount)
- No hardcoded demo data in the form or confirmation view
- `organization_id` is always passed from `req.tenantId` — never from the request body

### KR 29-2 — `POST /api/v1/tenant/context` endpoint

**Acceptance criteria:**
- Endpoint added to `packages/backend/src/api/` with Zod-validated request body
- Calls `TenantContextIngestionService.ingest(organizationId, contextPayload)`
- Returns `{ stored: true, memoryEntries: number }` on success
- `requireAuth` + `requirePermission('admin')` middleware applied
- Audit log entry created: `action: 'tenant_context_ingested'`, `actor_id`, `organization_id`
- Co-located integration test: valid payload → 200 + audit entry; missing `organization_id` → 400

### KR 29-3 — `GET /api/v1/tenant/context` endpoint

**Acceptance criteria:**
- Returns the most recent ingested context summary for the tenant (metadata only — not raw embeddings)
- Returns `{ data: null }` if no context has been ingested
- `requireAuth` + `requirePermission('viewer')` middleware applied
- Tenant-scoped: only returns context for `req.tenantId`

### KR 29-4 — Salesforce adapter: OAuth connection and opportunity fetch

**Ref:** `packages/integrations/src/salesforce/`; DEBT-008, issue #1349

**Acceptance criteria:**
- `SalesforceAdapter` implements the same `CrmAdapter` interface as `HubSpotAdapter`
- OAuth2 authorization code flow: `getAuthUrl()`, `exchangeCodeForToken()`, `refreshToken()` — all functional against Salesforce Connected App
- `getOpportunities(filters)` returns typed `CrmOpportunity[]` from Salesforce SOQL query
- Tokens stored via `CrmConnectionService` with `tokenEncryption.ts` (AES-256-GCM, same as HubSpot)
- `SalesforceAdapter` exported from `packages/integrations/src/index.ts`
- Unit tests: mock OAuth exchange → token stored; mock SOQL response → typed opportunities returned
- If Salesforce Connected App credentials are unavailable in CI: tests use recorded fixtures; a `SALESFORCE_MOCK=true` env flag bypasses live calls

### KR 29-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- No hardcoded demo data in onboarding UI components

**Risk flags:**
- `TenantContextIngestionService` interface from Sprint 27 may need extension to support the full context payload shape. Contingency: extend the service's `ingest()` method signature; do not break existing callers.
- Salesforce OAuth requires a Connected App with a callback URL. Contingency: document the required Connected App configuration in `docs/runbooks/salesforce-oauth-setup.md`; use mock fixtures in CI until credentials are available.
- The onboarding route may conflict with existing Settings page routing. Contingency: add as a tab within the existing Settings layout rather than a standalone route.

---

## Sprint 30 — Backend `any` Elimination: Services Layer and `apps/ValyntApp` (Weeks 5–6)

**Objective:** `packages/backend` production `any` count is below 400. `apps/ValyntApp` production `any` count is below 100. The five highest-density `ValyntApp` production files are fully typed.

**Success statement:** `grep -rn ": any\b\|as any\b\|<any>" packages/backend/src --include="*.ts" --include="*.tsx" | grep -v "__tests__\|\.test\.\|\.spec\." | wc -l` reports fewer than 400, and `grep -rn ": any\b\|as any\b\|<any>" apps/ValyntApp/src --include="*.ts" --include="*.tsx" | grep -v "__tests__\|\.test\.\|\.spec\." | wc -l` reports fewer than 100. `docs/debt/ts-any-dashboard.md` updated with actuals.

**Depends on:** Sprint 29 complete.

**Architectural rationale:** After Sprint 28 cleaned the API and agent layers, Sprint 30 targets the services layer (`PlaygroundAutoSave.ts`, `OfflineEvaluation.ts`, `ValueLifecycleOrchestrator.ts`, `SagaAdapters.ts`) and the frontend's highest-density file (`IntegratedMCPServer.ts`). These are sequenced after the onboarding sprint because the onboarding endpoints introduced in Sprint 29 must be typed before the broader services cleanup — otherwise the new endpoints would be counted in the baseline.

**Competitor context:** Vivun's pipeline influence platform and Gainsight's health scoring both expose typed SDK contracts. Frontend `any` in MCP integration code is a reliability risk for the agent-to-UI data path.

### KR 30-1 — `services/post-v1/PlaygroundAutoSave.ts` and `OfflineEvaluation.ts` typed (13 + 13 usages)

**Acceptance criteria:**
- `PlaygroundAutoSave.ts`: layout conflict resolution types defined; `serverLayout`/`clientLayout` parameters typed with a `CanvasLayout` interface; no `any` in merge or diff methods
- `OfflineEvaluation.ts`: evaluation result and queue entry types defined; no `any` in queue operations or result handlers
- `grep -n ": any\b\|as any\b\|<any>" packages/backend/src/services/post-v1/PlaygroundAutoSave.ts packages/backend/src/services/post-v1/OfflineEvaluation.ts` returns no matches
- Existing tests pass

### KR 30-2 — `services/post-v1/ValueLifecycleOrchestrator.ts` and `services/workflows/SagaAdapters.ts` typed (12 + 12 usages)

**Acceptance criteria:**
- `ValueLifecycleOrchestrator.ts`: lifecycle event payloads typed using domain types from `packages/shared/src/domain/`; no `any` in event dispatch or handler registration
- `SagaAdapters.ts`: saga state and compensation function signatures typed; no `any` in adapter methods
- `grep -n ": any\b\|as any\b\|<any>" packages/backend/src/services/post-v1/ValueLifecycleOrchestrator.ts packages/backend/src/services/workflows/SagaAdapters.ts` returns no matches
- Workflow compensation tests pass

### KR 30-3 — `apps/ValyntApp/src/mcp-ground-truth/core/IntegratedMCPServer.ts` typed (39 usages)

**Acceptance criteria:**
- MCP tool call request and response types defined (can reference `packages/mcp` types if available, otherwise define locally)
- No `any` in tool registration, invocation, or result handling
- `grep -n ": any\b\|as any\b\|<any>" apps/ValyntApp/src/mcp-ground-truth/core/IntegratedMCPServer.ts` returns no matches
- Existing MCP integration tests pass

### KR 30-4 — `apps/ValyntApp` remaining high-density files typed

**Target files:** `lib/safeExpressionEvaluator.ts` (10), `views/Admin/DocumentationCMS.tsx` (8), `utils/export.ts` (8), `types/vos.ts` (8), `lib/realtime/supabaseRealtime.ts` (8)

**Acceptance criteria:**
- `safeExpressionEvaluator.ts`: expression AST nodes typed; no `any` in evaluator return types
- `DocumentationCMS.tsx`: CMS content types defined; no `any` in component props or state
- `utils/export.ts`: export payload types defined; no `any` in serialization helpers
- `types/vos.ts`: all `any` replaced with typed alternatives or `unknown` + type guards
- `supabaseRealtime.ts`: Realtime payload types narrowed; no `any` in subscription callbacks
- `grep -n ": any\b\|as any\b\|<any>" apps/ValyntApp/src/lib/safeExpressionEvaluator.ts apps/ValyntApp/src/views/Admin/DocumentationCMS.tsx apps/ValyntApp/src/utils/export.ts apps/ValyntApp/src/types/vos.ts apps/ValyntApp/src/lib/realtime/supabaseRealtime.ts` returns no matches

### KR 30-5 — `docs/debt/ts-any-dashboard.md` updated

**Acceptance criteria:**
- Dashboard updated with measured actuals for `packages/backend`, `apps/ValyntApp`, `packages/sdui`, `apps/VOSAcademy`
- Monthly targets revised based on Sprint 28–30 actuals
- Sprint 31 targets stated

### KR 30-6 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- `packages/backend` production `any` confirmed below 400
- `apps/ValyntApp` production `any` confirmed below 100

**Risk flags:**
- `IntegratedMCPServer.ts` (39 usages) is the largest single file in this sprint. If MCP tool types are not defined in `packages/mcp`, defining them locally risks divergence. Contingency: define a `McpToolCall` and `McpToolResult` interface in `apps/ValyntApp/src/mcp-ground-truth/types/` and document as a candidate for promotion to `packages/mcp`.
- `SagaAdapters.ts` compensation function signatures may require changes to the saga pattern interfaces. Contingency: scope to typing the existing signatures without changing the runtime behavior; add a `debt.md` note if the interface needs a broader refactor.

---

## Sprint 31 — `packages/sdui` and `apps/VOSAcademy` Type Cleanup, and Integration Health Dashboard (Weeks 7–8)

**Objective:** `packages/sdui` production `any` count is below 20. `apps/VOSAcademy` `any` count is below 50. The integrations dashboard shows live connection health for HubSpot and Salesforce. `docs/debt/ts-any-dashboard.md` reflects the end-of-horizon state.

**Success statement:** `grep -rn ": any\b\|as any\b\|<any>" packages/sdui/src --include="*.ts" --include="*.tsx" | grep -v "__tests__\|\.test\.\|\.spec\." | wc -l` reports fewer than 20, and the same command scoped to `apps/VOSAcademy/src` reports fewer than 50. The integrations settings page shows a live health indicator for each connected CRM. `pnpm test` green. The `any` burn-down is on track for the <100 total target.

**Depends on:** Sprint 30 complete. Salesforce adapter from Sprint 29 is the second integration this sprint's health dashboard covers.

**Architectural rationale:** `packages/sdui` is the rendering engine for all SDUI components. Untyped rendering paths (`renderPage.ts`, `WebSocketDataSource.ts`, `DataBindingResolver.ts`) are the highest-risk surface for silent data corruption in the UI. Cleaning these before adding new SDUI components (next horizon) prevents the debt from compounding. The integration health dashboard is sequenced here because both adapters (HubSpot, Salesforce) are complete by Sprint 29 — a health view requires nothing new from the backend.

**Competitor context:** Mediafly and Gainsight both surface integration health in their admin UIs. An integrations page that shows "connected" without a live health check is a support burden.

### KR 31-1 — `packages/sdui` rendering engine typed: `renderPage.ts` and `WebSocketDataSource.ts` (16 + 14 usages)

**Acceptance criteria:**
- `renderPage.ts`: page schema node types defined; render function signatures typed end-to-end; no `any` in component resolution or prop passing
- `WebSocketDataSource.ts`: WebSocket message payload types defined; subscription callback signatures typed; no `any` in data binding path
- `grep -n ": any\b\|as any\b\|<any>" packages/sdui/src/renderPage.ts packages/sdui/src/WebSocketDataSource.ts` returns no matches
- SDUI rendering tests pass

### KR 31-2 — `packages/sdui` data binding typed: `DataBindingResolver.ts` and `canvas/types.ts` (14 + 9 usages)

**Acceptance criteria:**
- `DataBindingResolver.ts`: binding expression types defined; resolver return types explicit; no `any` in path traversal
- `canvas/types.ts`: all canvas node and layout types defined as discriminated unions; no `any` type aliases
- `grep -n ": any\b\|as any\b\|<any>" packages/sdui/src/DataBindingResolver.ts packages/sdui/src/canvas/types.ts` returns no matches
- `DataBindingResolver.test.ts` passes

### KR 31-3 — `apps/VOSAcademy` high-density files typed: `lib/icons.tsx` and `data/routers.d.ts` (40 + 18 usages)

**Acceptance criteria:**
- `lib/icons.tsx`: icon component props typed; no `any` in icon registry or render helpers
- `data/routers.d.ts`: router type declarations replaced with explicit typed interfaces; no `any` in route definitions
- `grep -n ": any\b\|as any\b\|<any>" apps/VOSAcademy/src/lib/icons.tsx apps/VOSAcademy/src/data/routers.d.ts` returns no matches
- VOSAcademy build passes

### KR 31-4 — Integration health dashboard

**Acceptance criteria:**
- Settings → Integrations page shows a health card per connected CRM (HubSpot, Salesforce)
- Each card shows: connection status (connected / disconnected / error), last successful sync timestamp, token expiry warning if within 7 days
- Health data fetched from `GET /api/crm/connections` (existing endpoint) — no new backend work required
- Disconnected state shows a "Connect" button that initiates the OAuth flow
- Error state shows the last error message (no raw stack traces)
- No hardcoded connection states

### KR 31-5 — `docs/debt/ts-any-dashboard.md` end-of-horizon update

**Acceptance criteria:**
- Dashboard updated with final measured actuals for all modules
- Sprint 28–31 burn-down charted (table of sprint-end counts)
- Next-horizon targets stated for `packages/mcp`, `apps/VOSAcademy` (below 20), and `packages/backend` (below 200)
- `debt.md` updated: ongoing `any` debt section reflects new baseline

### KR 31-6 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- `packages/sdui` production `any` confirmed below 20
- `apps/VOSAcademy` `any` confirmed below 50
- No new `any` introduced in Sprint 31 files

**Risk flags:**
- `renderPage.ts` types may require changes to the SDUI component registry interface. Contingency: type the render function's internal path without changing the public registry API; document any interface changes in `decisions.md`.
- `data/routers.d.ts` is a declaration file — replacing `any` may require changes to the router implementation. Contingency: if the router implementation is generated, add a lint rule blocking `any` in the declaration file and document the generator as a debt item.
- Integration health dashboard requires `GET /api/crm/connections` to return `last_sync_at` and `token_expires_at`. Contingency: if these fields are absent from the current response, add them to `CrmConnectionService.getConnections()` as part of this sprint's backend work.

---

## Cross-Sprint Invariants

These rules apply to every PR across all sprints. Sourced from `AGENTS.md`.

| Rule | Requirement |
|---|---|
| Tenant isolation | Every DB query on a tenant table includes `.eq("organization_id", orgId)`. Every vector/memory query includes `{ metadata: { tenant_id: orgId } }`. |
| LLM calls | All production agent LLM calls use `this.secureInvoke()`. No direct `llmGateway.complete()` calls from agent code. |
| `service_role` | Used only in AuthService, tenant provisioning, and cron jobs. |
| Cross-tenant transfer | No operation copies, moves, or exports data between tenants. |
| TypeScript | No new `any`. Use `unknown` + type guards. Every file touched must leave fewer `any` usages than before. |
| Named exports | No default exports anywhere. |
| SDUI registration | New SDUI components registered in both `config/ui-registry.json` and `packages/sdui/src/registry.tsx`. |
| Tool registration | Tools registered statically in `ToolRegistry.ts`. No dynamic creation. |
| Audit trail | `agent_audit_log` entries required for create/update/delete/export/approve/reject/grant/revoke. |
| RLS gate | `pnpm run test:rls` must pass on every PR that touches DB queries or migrations. |

---

## Deferred Items (post-Sprint 31)

| Item | Reason deferred |
|---|---|
| DEBT-011 — SandboxedExecutor E2B SDK | Product decision on code execution scope pending |
| DEBT-012 — VOSAcademy content loader | Content strategy pending |
| ServiceNow, Slack, SharePoint adapters (DEBT-008 remainder) | Product priority post-GA |
| US-007 onboarding UI — advanced context (competitor upload, ICP file import) | Sprint 29 delivers the foundation; file ingestion is next horizon |
| US-008 Salesforce — full field mapping and sync | Sprint 29 delivers OAuth + opportunity fetch; full sync is next horizon |
| PPTX export | Requires complete, stable product |
| Kafka rollout | Infrastructure decision pending |
| Grafana alerting rules wired to incident runbooks | Requires production deployment |
| `DeviceFingerprintService` GeoIP / threat intelligence | Product decision pending |
| `EnhancedParallelExecutor` progress-to-UI via WebSocket | Requires Kafka or SSE infrastructure decision |
| ADR-0005 Theme Precedence | Proposed, not accepted |
| `packages/mcp` `any` below 20 | Currently at 0; maintain 0 — no reduction work needed |
| `apps/VOSAcademy` `any` below 20 | Sprint 31 delivers below 50; below 20 is next horizon |
| `packages/backend` `any` below 200 | Next horizon |

---

## Sprint Dependency Chain

```
Sprint 28: backend API + agent layer any elimination
    ↓ (typed API layer ready for new endpoints)
Sprint 29: tenant onboarding UI + Salesforce adapter
    ↓ (both adapters live; onboarding backend complete)
Sprint 30: backend services layer + ValyntApp any elimination
    ↓ (all production any below targets; MCP integration typed)
Sprint 31: sdui + VOSAcademy any cleanup + integration health dashboard
    ↓ (any burn-down on track; integration surface complete)
```
