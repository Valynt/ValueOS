# ValueOS — Capability-to-Implementation Audit

---

## 1\. Executive Summary

Overall verdict: Demo-grade frontend over a partially-implemented backend. The product is materially ahead of its backend support in several critical areas.

The frontend presents a polished, feature-complete product: active AI agents running in real time, a live integrity queue, version history, export/share, CRM sync, agent memory browsing, and a full settings/billing/admin surface. The backend has genuine, non-trivial infrastructure — real agent classes with LLM calls, Supabase schema with RLS, BullMQ workers, Stripe billing, and a working tenant provisioning RPC. However, the connection between the two is systematically broken or absent across the product's most prominent capabilities.

Highest-risk integrity gaps:

1. The entire ValueCaseCanvas is hardcoded demo data. Every value, confidence score, claim, milestone, and agent step shown is a static constant in the component file. No API call is made. No state persists. The "Run Stage" button has no onClick handler.  
2. The Dashboard is entirely hardcoded. Active cases, integrity queue items, recent iterations, and agent status are all const arrays defined inline. The "Go" button in QuickStart has no handler.  
3. The Agents page shows fabricated metrics. Success rates, run counts, and cost figures are static constants. The AgentDetail "Runs" and "Memory" tabs show hardcoded arrays.  
4. The Integrations page is purely decorative. "Connect" and "Configure" buttons have no onClick handlers. Salesforce shows "Connected" with a hardcoded "5m ago" sync time.  
5. Settings "Save Changes" has no handler. The entire SettingsPage is local state only — nothing persists.  
6. The useAgentOrchestrator hook is a simulation. It uses setTimeout loops to fake planning and execution steps. No backend call is made.  
7. workflow\_checkpoints table does not exist in any migration, yet HumanCheckpointService writes to it. The "Approve" button in AgentThread has no handler.  
8. The spec.md file explicitly documents that the core agentic workflow is not wired end-to-end, confirming this is a known internal state.

The product is demo-ready for investor/sales presentations. It is not production-credible for paying customers.

---

## 2\. Frontend Capability Inventory

| \# | Capability | Where in UI | What UI Implies | Explicit/Inferred | Confidence |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Create a Value Case from company name | Dashboard QuickStart, Opportunities page | Enter company → agent runs discovery automatically | Explicit | High |
| 2 | AI agent-driven hypothesis generation | ValueCaseCanvas → Hypothesis stage | Agents fetch EDGAR data, extract financials, build hypotheses | Explicit | High |
| 3 | Financial model with editable value tree | ValueCaseCanvas → Model stage | Live model with editable assumptions that recalculate | Explicit | High |
| 4 | Integrity verification of claims | ValueCaseCanvas → Integrity stage, Dashboard queue | Agent verifies claims against EDGAR/Gartner, flags issues | Explicit | High |
| 5 | Narrative generation and export | ValueCaseCanvas → Narrative stage | Agent generates executive summary; PDF/slide export | Explicit | High |
| 6 | Realization tracking against milestones | ValueCaseCanvas → Realization stage | Live milestone tracking with KPI progress | Explicit | High |
| 7 | Agent Hub with live metrics | /agents | Real-time success rates, run counts, cost per agent | Explicit | High |
| 8 | Agent run history and memory browser | /agents/:id | Browsable run log and semantic memory per agent | Explicit | High |
| 9 | Human approval checkpoints | AgentThread panel | Approve/reject agent decisions before proceeding | Explicit | High |
| 10 | CRM integration (Salesforce, HubSpot) | /integrations | Bi-directional sync, live sync status | Explicit | High |
| 11 | Version history (v12 shown) | ValueCaseCanvas header | Full version history with rollback | Explicit | High |
| 12 | Evidence drawer | ValueCaseCanvas | Browsable evidence sources per claim | Explicit | High |
| 13 | Settings: org, users, API keys, billing, security | /settings | Persistent org configuration | Explicit | High |
| 14 | Billing with plan management | /pages/billing | Live subscription, usage metering, invoice history | Explicit | High |
| 15 | Multi-tenant isolation | Entire app | Each org sees only its own data | Inferred | High |
| 16 | Domain packs (industry KPI overlays) | Opportunities page pack selector | Industry-specific KPI templates applied to cases | Explicit | High |
| 17 | Company knowledge base | /company | Persistent company context used by agents | Explicit | High |
| 18 | Onboarding with AI research | /onboarding | AI researches company during onboarding | Explicit | High |
| 19 | Real-time agent streaming | AgentThread, useAgentStream | Live streaming of agent thought process | Explicit | High |
| 20 | Audit trail | AuditTrailDashboard (not in router) | Immutable compliance audit log | Inferred | Medium |

---

## 3\. Backend Support Mapping

### Capability 1 — Create Value Case from Company Name

* Frontend evidence: Dashboard.tsx QuickStart input \+ "Go" button. Opportunities.tsx "New Case" flow with useCreateCase() mutation.  
* Backend evidence: POST /api/v1/value-cases exists in packages/backend/src/api/valueCases/index.ts. ValueCasesRepository writes to value\_cases table with tenant\_id.  
* Persistence evidence: value\_cases table exists in \_archived\_monolith\_20260213/20260212000001\_schema.sql. Stage column added in 20260303010000\_value\_cases\_stage\_and\_portfolio\_rpc.sql.  
* Gap: The Dashboard QuickStart "Go" button has no onClick handler. It is a dead button. The Opportunities page useCreateCase mutation is real and wired, but the Dashboard entry point is non-functional.  
* Classification: Partially implemented (Opportunities path works; Dashboard path is dead)

### Capability 2 — AI Agent Hypothesis Generation

* Frontend evidence: HypothesisStage.tsx uses useMergedContext(caseId) and useHardenKPI() mutations. AgentThread.tsx shows agent steps.  
* Backend evidence: OpportunityAgent.ts is a real implementation — fetches from MCPGroundTruthService, calls LLM via secureInvoke, stores to memory, builds SDUI sections. POST /api/agents/:agentId/invoke exists and routes to getUnifiedAgentAPI().  
* Persistence evidence: Agent output stored via MemorySystem → SupabaseMemoryBackend → semantic\_memory table (when backend is configured).  
* Gap: AgentThread.tsx is entirely hardcoded — 6 static steps, no API call, no WebSocket, no streaming. The useAgentOrchestrator hook used in ConversationalAI.tsx uses setTimeout simulation. The HypothesisStage calls useMergedContext which falls back to DEMO\_BANKING\_CONTEXT when backend is unavailable. The "Run Stage" button in ValueCaseCanvas has no onClick handler.  
* Classification: Partially implemented (backend agent is real; frontend canvas is disconnected)

### Capability 3 — Financial Model with Editable Value Tree

* Frontend evidence: ModelStage.tsx shows editable value nodes, assumptions, scenario comparison.  
* Backend evidence: FinancialModelingAgent.ts exists. TargetAgent.ts exists. ValueTreeService.ts exists.  
* Persistence evidence: No value\_tree or financial\_model table found in active migrations. financial\_models table exists in archived monolith schema.  
* Gap: ModelStage.tsx is entirely hardcoded — useState with static arrays, onSave={() \=\> {}} no-ops on every editable field. No API call. No persistence. Edits are lost on page reload.  
* Classification: Mocked (backend agent exists but canvas is disconnected and edits don't persist)

### Capability 4 — Integrity Verification

* Frontend evidence: IntegrityStage.tsx shows claims with tier/confidence/status. Dashboard IntegrityQueue shows 3 items.  
* Backend evidence: IntegrityAgent.ts is a real implementation with Zod schemas. IntegrityValidationService.ts exists (852 lines). IntegrityAgentService.ts exists.  
* Persistence evidence: No claims or integrity\_results table in active migrations.  
* Gap: IntegrityStage.tsx is entirely hardcoded — 6 static Claim objects. "Revise Claim", "Override", "Remove" buttons have no onClick handlers. Dashboard IntegrityQueue is a static array. No API call anywhere in these components.  
* Classification: Mocked (backend agent is real; frontend is disconnected)

### Capability 5 — Narrative Generation and Export

* Frontend evidence: NarrativeStage.tsx shows executive summary, impact cascade, stakeholder map, export panel.  
* Backend evidence: No NarrativeAgent exists in packages/backend/src/lib/agent-fabric/agents/. The Agents.tsx page lists a "Narrative Agent" as active: false.  
* Persistence evidence: None.  
* Gap: NarrativeStage.tsx is entirely hardcoded static text. "Edit", "Regenerate", "Adjust Tone" buttons have no handlers. "PDF Report", "Slide Deck", "Copy to Clipboard" export buttons have no handlers. No NarrativeAgent implementation exists in the fabric.  
* Classification: Missing (no backend agent; frontend is static)

### Capability 6 — Realization Tracking

* Frontend evidence: RealizationStage.tsx shows KPI progress, milestone timeline, active risks.  
* Backend evidence: RealizationAgent.ts exists. RealizationFeedbackLoop.ts exists.  
* Persistence evidence: realization\_metrics table exists in archived schema.  
* Gap: RealizationStage.tsx is entirely hardcoded — static KPI arrays, static milestone list, static risks. No API call. No persistence.  
* Classification: Mocked (backend agent exists; frontend is disconnected)

### Capability 7 — Agent Hub with Live Metrics

* Frontend evidence: Agents.tsx shows 8 agents with success rates, run counts, cost/7d.  
* Backend evidence: AgentRegistry.ts exists. AgentAuditLogger.ts exists. GET /api/agents/:agentId/info returns model card.  
* Persistence evidence: agent\_audit\_log, agent\_metrics, llm\_usage tables exist in schema.  
* Gap: Agents.tsx is entirely hardcoded — static const agents \= \[...\] array with fabricated metrics (94% success, 38 runs, $12.40 cost). No API call. The "Research Agent" and "Narrative Agent" listed don't exist in the fabric.  
* Classification: Misleading (metrics are fabricated; no live data)

### Capability 8 — Agent Run History and Memory Browser

* Frontend evidence: AgentDetail.tsx shows Runs tab with 5 entries, Memory tab with 4 items.  
* Backend evidence: agent\_audit\_log table exists. MemorySystem with SupabaseMemoryBackend exists.  
* Gap: AgentDetail.tsx is entirely hardcoded — static const runs \= \[...\] and const memoryItems \= \[...\]. The useParams() id is read but never used to fetch data. Configuration tab shows hardcoded JSON. All data is fabricated.  
* Classification: Misleading (backend infrastructure exists; UI shows fabricated data)

### Capability 9 — Human Approval Checkpoints

* Frontend evidence: AgentThread.tsx shows "Approval Required" panel with Approve/Request Changes buttons.  
* Backend evidence: HumanCheckpointService.ts writes to workflow\_checkpoints table. ApprovalWorkflowService.ts exists. POST /api/checkpoints exists.  
* Persistence evidence: workflow\_checkpoints table does not exist in any migration. HumanCheckpointService will throw a Supabase error on every call.  
* Gap: AgentThread.tsx Approve/Request Changes buttons have no onClick handlers. The checkpoint table is missing from the schema. End-to-end path is broken at both ends.  
* Classification: Broken (frontend is dead; backend writes to non-existent table)

### Capability 10 — CRM Integration

* Frontend evidence: Integrations.tsx shows Salesforce "Connected" (5m ago), HubSpot "Not Connected", SharePoint "Error".  
* Backend evidence: IntegrationConnectionService.ts reads/writes tenant\_integrations table. CRMIntegrationService.ts has real HubSpot module. crmWorker.ts has BullMQ queues. OAuth flow exists in CRMOAuthService.ts.  
* Persistence evidence: tenant\_integrations table exists in schema.  
* Gap: Integrations.tsx "Connect" and "Configure" buttons have no onClick handlers. The page is purely decorative. The backend CRM infrastructure is real but the frontend provides no way to trigger it. CRMIntegrationService.fetchDeals() returns mock data when DEV\_MOCKS\_ENABLED=true and not connected.  
* Classification: Disconnected (backend is real; frontend is decorative)

### Capability 11 — Version History

* Frontend evidence: ValueCaseCanvas header shows "v12" button.  
* Backend evidence: VersionHistoryService.ts writes to settings\_versions table. No value\_case\_versions table found.  
* Gap: The "v12" button has no onClick handler. VersionHistoryService tracks settings changes, not value case versions. No value case versioning schema exists.  
* Classification: Missing (no backend support for case versioning; button is dead)

### Capability 12 — Evidence Drawer

* Frontend evidence: EvidenceDrawer.tsx opened via "Evidence" button in ValueCaseCanvas.  
* Backend evidence: None found.  
* Gap: EvidenceDrawer.tsx content is hardcoded. No API call.  
* Classification: Mocked

### Capability 13 — Settings Persistence

* Frontend evidence: SettingsPage.tsx with Org, Users, API Keys, Billing, Security tabs. "Save Changes" button.  
* Backend evidence: SettingsService.ts exists. UserSettingsService.ts exists. AdminUserService.ts exists.  
* Gap: SettingsPage.tsx "Save Changes" button has no onClick handler. Users tab shows hardcoded array. API Keys tab shows hardcoded keys. The entire page is local state only.  
* Classification: Mocked (backend services exist; frontend is disconnected)

### Capability 14 — Billing

* Frontend evidence: BillingPage.tsx uses useSubscription() → billingService.getSubscription(). Invoice list uses mockInvoices.  
* Backend evidence: Full Stripe integration exists — StripeService, SubscriptionStateMachine, InvoiceService, RatingEngine, billing\_price\_versions table, webhook handlers.  
* Persistence evidence: Billing schema is the most complete in the codebase — billing\_meters, billing\_price\_versions, rated\_ledger, usage\_ledger all exist with RLS.  
* Gap: Invoice list in BillingPage.tsx uses mockInvoices constant. billingService.getSubscription() path needs verification. Billing is the most production-credible area but the frontend invoice list is still mocked.  
* Classification: Partially implemented (backend is real; invoice UI is mocked)

### Capability 15 — Multi-Tenant Isolation

* Frontend evidence: TenantProvider, TenantGate, tenantContextMiddleware throughout.  
* Backend evidence: security.user\_has\_tenant\_access() RLS function. tenantContextMiddleware validates JWT. TenantIsolationService.ts exists. 4 RLS tables enabled in active migrations, 21 policies in archived monolith.  
* Persistence evidence: user\_tenants table with status='active' check. provision\_tenant RPC creates tenant atomically.  
* Gap: value\_cases.tenant\_id is text in the archived schema (not uuid), creating type inconsistency with the UUID-based RLS functions. Several tables in the archived monolith schema have RLS enabled but the active migration set only covers billing/domain-pack tables explicitly. The workflow\_checkpoints table (used by HumanCheckpointService) has no RLS because it doesn't exist.  
* Classification: Partially implemented (core path works; several tables lack RLS coverage)

### Capability 16 — Domain Packs

* Frontend evidence: useDomainPacks(), useMergedContext(), useHardenKPI() hooks. Pack selector in Opportunities page.  
* Backend evidence: DomainPackService.ts exists. GET /api/v1/domain-packs is wired. domain\_packs, domain\_pack\_kpis, domain\_pack\_assumptions tables exist with RLS.  
* Gap: useDomainPacks() and useMergedContext() both have explicit demo data fallbacks that activate silently when the backend is unavailable. The domainPacks/index.ts router comment says "Repository methods are stubbed — routes return 501 until wired." The top-level domainPacks.ts router is the real one (wired to DomainPackService), but the domainPacks/index.ts router (also imported) returns 501 for all operations.  
* Classification: Partially implemented (one router path works; another returns 501; frontend silently falls back to demo data)

### Capability 17 — Company Knowledge Base

* Frontend evidence: /company route → CompanyKnowledge.tsx.  
* Backend evidence: Onboarding hooks (useCreateCompanyContext, useAddCompetitors, etc.) call real API endpoints. researchWorker.ts processes BullMQ jobs.  
* Classification: Partially implemented (onboarding writes real data; knowledge browsing needs verification)

### Capability 18 — Onboarding with AI Research

* Frontend evidence: CompanyOnboarding.tsx uses useCreateResearchJob, useResearchJobStatus, useResearchSuggestions.  
* Backend evidence: researchWorker.ts is a real BullMQ worker. processResearchJob exists. LLMGateway is injected.  
* Gap: researchWorker.ts has a duplicate const logger declaration (lines 20 and 24\) — a compile error that would prevent the worker from starting.  
* Classification: Partially implemented (architecture is real; worker has a compile error)

### Capability 19 — Real-Time Agent Streaming

* Frontend evidence: useAgentStream hook, RedisStreamBroker, AgentThread panel.  
* Backend evidence: RedisStreamBroker is a real Redis Streams implementation. AgentOrchestratorAdapter routes to UnifiedAgentOrchestrator.  
* Gap: useAgentOrchestrator (used in ConversationalAI.tsx) is a pure simulation with setTimeout. AgentThread.tsx (the primary visible panel) is hardcoded. useAgentStream publishes to Redis but the backend consumer that would process agent.stream.update events and route them to agents is not verified as wired. The BACKEND\_WIRING\_IMPLEMENTATION.md describes the intended architecture but notes it as a plan, not a completed implementation.  
* Classification: Partially implemented (infrastructure exists; end-to-end path unverified)

### Capability 20 — Audit Trail

* Frontend evidence: AuditTrailDashboard.tsx exists with useAuditTrail hook.  
* Backend evidence: AuditLogService.ts is a real implementation with hash-chain integrity. audit\_logs table exists.  
* Gap: AuditTrailDashboard is not registered in AppRoutes.tsx — it is unreachable from the UI. The route does not exist.  
* Classification: Disconnected (backend is real; frontend view is unreachable)

---

## 4\. Gap Analysis

### GAP-01: ValueCaseCanvas is entirely hardcoded

* Frontend promises: A live, agent-driven workspace where users can run stages, edit models, verify claims, and generate narratives.  
* Backend currently does: Has real agent implementations that can execute these tasks.  
* Where chain breaks: Every canvas stage component (HypothesisStage, ModelStage, IntegrityStage, NarrativeStage, RealizationStage, AgentThread) uses hardcoded const data. The "Run Stage" button has no handler. onSave callbacks are () \=\> {} no-ops.  
* Missing technically: API calls from canvas stages to backend agents; state management to load/save case data; WebSocket/SSE connection for agent streaming into the canvas.  
* Gap type: Implementation  
* Severity: Critical — the product's primary value surface is a static mockup

### GAP-02: Dashboard is entirely hardcoded

* Frontend promises: A live workspace showing active cases, agent status, integrity queue, and recent work.  
* Backend currently does: useCasesList() hook exists and queries Supabase. CasesService is real.  
* Where chain breaks: Dashboard.tsx does not use useCasesList(). It defines const activeCases \= \[...\] inline. The QuickStart "Go" button has no handler.  
* Missing technically: Wire useCasesList() into Dashboard; implement case creation from QuickStart.  
* Gap type: Implementation  
* Severity: Critical — first screen users see is fabricated data

### GAP-03: Agent metrics are fabricated

* Frontend promises: Live agent monitoring with real success rates, run counts, and cost tracking.  
* Backend currently does: agent\_audit\_log, agent\_metrics, llm\_usage tables exist and are written to.  
* Where chain breaks: Agents.tsx and AgentDetail.tsx use hardcoded static arrays. useParams() id is never used to fetch.  
* Missing technically: API endpoints to query agent metrics by agent ID and time range; hooks to fetch and display live data.  
* Gap type: Implementation  
* Severity: High — presents fabricated operational data as real

### GAP-04: workflow\_checkpoints table missing from schema

* Frontend promises: Human approval checkpoints that pause agent execution.  
* Backend currently does: HumanCheckpointService.requestApproval() inserts into workflow\_checkpoints.  
* Where chain breaks: Table does not exist in any active migration. Every call to HumanCheckpointService will throw a Supabase error.  
* Missing technically: Migration to create workflow\_checkpoints table with RLS; onClick handlers on Approve/Request Changes buttons.  
* Gap type: Data model \+ Implementation  
* Severity: High — backend service is broken; frontend buttons are dead

### GAP-05: NarrativeAgent does not exist

* Frontend promises: AI-generated executive summaries, technical briefs, financial cases with tone adjustment.  
* Backend currently does: Nothing — no NarrativeAgent class exists in the fabric.  
* Where chain breaks: NarrativeStage.tsx shows static hardcoded text. Export buttons (PDF, Slide Deck, Copy) have no handlers.  
* Missing technically: NarrativeAgent.ts implementation; export service (PDF generation, slide generation).  
* Gap type: Implementation (agent missing entirely)  
* Severity: Critical — a named, prominent capability has no implementation

### GAP-06: Integrations page is decorative

* Frontend promises: Connect/disconnect CRM systems, view sync health, trigger manual sync.  
* Backend currently does: IntegrationConnectionService is real. OAuth flow exists. BullMQ CRM workers exist.  
* Where chain breaks: Integrations.tsx buttons have no onClick handlers. The page cannot initiate any action.  
* Missing technically: Wire Connect/Configure buttons to OAuth flow; wire sync status to live tenant\_integrations data.  
* Gap type: Implementation (frontend-backend disconnection)  
* Severity: High — integration capability exists in backend but is inaccessible

### GAP-07: Settings page does not persist

* Frontend promises: Persistent organization configuration, user management, API key management.  
* Backend currently does: SettingsService, AdminUserService, RbacService all exist.  
* Where chain breaks: "Save Changes" button has no handler. All inputs are uncontrolled or local state only.  
* Missing technically: Form submission handlers calling backend settings APIs.  
* Gap type: Implementation  
* Severity: High — settings appear to save but don't

### GAP-08: Version history is non-functional

* Frontend promises: Full version history (shows "v12") with rollback capability.  
* Backend currently does: VersionHistoryService tracks settings changes only, not value case versions.  
* Where chain breaks: "v12" button has no handler. No value case versioning schema exists.  
* Missing technically: Value case snapshot table; versioning service for cases; UI to browse/restore versions.  
* Gap type: Data model \+ Implementation  
* Severity: Medium — misleading UI element

### GAP-09: AuditTrailDashboard is unreachable

* Frontend promises: Compliance audit trail browsing.  
* Backend currently does: AuditLogService with hash-chain integrity is real and writes to audit\_logs.  
* Where chain breaks: AuditTrailDashboard is not registered in AppRoutes.tsx. No route exists.  
* Missing technically: Add route; wire useAuditTrail hook to backend API.  
* Gap type: Implementation (routing gap)  
* Severity: Medium

### GAP-10: researchWorker.ts has duplicate logger declaration

* Frontend promises: AI-powered company research during onboarding.  
* Backend currently does: BullMQ worker architecture is correct.  
* Where chain breaks: Lines 20 and 24 both declare const logger \= createLogger(...) — this is a compile error that prevents the worker from starting.  
* Gap type: Implementation (compile error)  
* Severity: High — onboarding research is broken in production

### GAP-11: MemorySystem defaults to in-memory Map

* Frontend promises: Persistent agent memory browsing.  
* Backend currently does: MemorySystem uses an in-memory Map by default. SupabaseMemoryBackend exists but is only attached when explicitly configured.  
* Where chain breaks: AgentFactory does not wire SupabaseMemoryBackend. Memory is lost on process restart.  
* Gap type: Implementation (persistence not wired)  
* Severity: Medium

### GAP-12: Domain packs have two conflicting routers

* Frontend promises: Industry-specific KPI overlays applied to cases.  
* Backend currently does: domainPacks.ts (top-level) is real and wired to DomainPackService. domainPacks/index.ts returns 501 for all operations.  
* Where chain breaks: Both are imported in server.ts. The comment in domainPacks/index.ts says "routes return 501 until wired." Frontend silently falls back to demo data.  
* Gap type: Implementation  
* Severity: Medium

### GAP-13: Kafka is disabled by default; agent execution path is unclear

* Frontend promises: Async agent execution with job polling.  
* Backend currently does: BACKEND\_WIRING\_IMPLEMENTATION.md describes a Kafka-backed execution path. kafkaConfig.ts shows Kafka is disabled by default (KAFKA\_ENABLED not set).  
* Where chain breaks: When Kafka is disabled, the described agent execution path (Frontend → EventProducer → Kafka → AgentExecutorService) does not exist. The fallback path is unclear.  
* Gap type: Async orchestration  
* Severity: High — the described execution architecture requires infrastructure that isn't running

---

## 5\. Integrity Risks / False-Front Risks

| Risk | Evidence | Severity |
| :---- | :---- | :---- |
| Dashboard shows fabricated active cases with fake company names, values, and agent status | Dashboard.tsx lines 130–137: const activeCases \= \[...\] | Critical |
| Agent Hub shows fabricated success rates and run counts | Agents.tsx lines 4–11: const agents \= \[...\] with hardcoded metrics | Critical |
| AgentDetail shows fabricated run history and memory | AgentDetail.tsx lines 14–38: const runs \= \[...\], const memoryItems \= \[...\] | Critical |
| "Financial Modeling Agent — running" shown in agent strip with animated pulse dot | Dashboard.tsx AgentStrip: status: "running" hardcoded | High |
| Salesforce shows "Connected · Last sync: 5m ago" with no actual connection | Integrations.tsx line 4: hardcoded status: "connected" | High |
| Integrity queue shows 3 specific claims needing review — all fabricated | Dashboard.tsx IntegrityQueue: static array | High |
| "Recent Work" shows 5 specific iteration events with timestamps — all fabricated | Dashboard.tsx RecentIterations: static array | High |
| Value case confidence score "87%" shown in canvas header — hardcoded | ValueCaseCanvas.tsx line 68: style={{ width: "87%" }} | High |
| "v12" version indicator implies rich version history — button is dead | ValueCaseCanvas.tsx line 97: no onClick | Medium |
| Domain pack hooks silently fall back to demo data without user indication | useDomainPacks.ts: catch { return DEMO\_PACKS; } | Medium |
| useAgentOrchestrator simulates agent execution with setTimeout | useAgentOrchestrator.ts lines 75–115: pure simulation | High |
| Export buttons (PDF, Slide Deck) imply document generation capability | NarrativeStage.tsx: buttons with no handlers | High |
| Settings "Save Changes" implies persistence | SettingsPage.tsx: no onClick on save button | High |

---

## 6\. Architectural Mismatches

M1: Frontend assumes synchronous canvas state; backend is async agent execution. The canvas stages display static data. When wired, agent execution is async (BullMQ jobs, polling). The canvas has no loading/streaming state management for async agent results.

M2: Frontend assumes value\_cases has a stage field matching UI stages; backend uses different stage names. UI stages: Discovery, Target, Realization, Expansion, Narrative. Backend LifecycleStage type: opportunity, modeling, target, realization, expansion, integrity. The spec.md defines yet another set: INITIATED, DRAFTING, VALIDATING, COMPOSING, REFINING, FINALIZED. Three incompatible stage vocabularies exist simultaneously.

M3: Frontend presents a "Narrative Agent" as active; no NarrativeAgent exists in the fabric. Agents.tsx lists narrative agent as \`active: false  
Now I have all the evidence needed. Continuing the report:

---

M3 (continued): Frontend presents agents that don't exist in the fabric. Agents.tsx lists "Research Agent" and "Narrative Agent". Neither exists in packages/backend/src/lib/agent-fabric/agents/. The fabric has: Opportunity, Target, FinancialModeling, Integrity, Realization, Expansion, ComplianceAuditor.

M4: useAgentStream uses user?.id as tenantId fallback. apps/ValyntApp/src/hooks/useAgentStream.ts line 87: const tenantId \= providedTenantId || user?.id || 'default-tenant'. Using a user ID as a tenant ID is a tenant isolation violation — it would scope memory and agent calls to the wrong boundary.

M5: Frontend assumes value\_cases.tenant\_id is UUID; schema defines it as text. The archived schema defines tenant\_id text on value\_cases. The RLS function security.user\_has\_tenant\_access(UUID) expects UUID. The CasesService passes tenantId as a string. Type coercion may work but is fragile.

M6: MessageBus defaults to in-process pub/sub; NATS/Redis are optional. MessageBus constructor uses in-memory Map when no Redis/NATS is provided. Inter-agent messaging described in AGENTS.md as CloudEvents via MessageBus is actually in-process only unless explicitly configured.

M7: Three incompatible lifecycle stage vocabularies. UI uses: Discovery/Target/Realization/Expansion/Narrative. Backend LifecycleStage type uses: opportunity/modeling/target/realization/expansion/integrity. spec.md defines: INITIATED/DRAFTING/VALIDATING/COMPOSING/REFINING/FINALIZED. No mapping layer exists between them.

---

## 7\. Production Readiness Assessment

| Area | Assessment | Evidence |
| :---- | :---- | :---- |
| Authentication | Production-credible | Supabase JWT, requireAuth middleware, local JWT fallback with emergency mode |
| Authorization / RBAC | Demo-grade | requirePermission middleware exists; user\_roles/user\_permissions tables exist; but most routes in the canvas/agents/integrations UI bypass this entirely because they make no API calls |
| Tenant isolation (DB) | Partially production-credible | RLS with security.user\_has\_tenant\_access() is well-designed; billing tables have strong RLS; but workflow\_checkpoints missing, value\_cases.tenant\_id is text not UUID, several tables in archived schema may lack active RLS policies |
| Tenant isolation (app layer) | Demo-grade | useAgentStream uses user?.id as tenant fallback; several components hardcode tenantId: "default" |
| Input validation | Production-credible | Zod schemas on all backend routes; requestSanitizationMiddleware; PII detection in piiFilter.ts |
| Output validation | Production-credible | Zod schemas on all LLM responses via secureInvoke |
| API error handling | Production-credible | Structured error responses; no stack trace leaks; correlation IDs |
| Idempotency | Partially implemented | Idempotency-Key header supported on agent invocation; not enforced on value case mutations |
| Retries / job resilience | Production-credible | BullMQ with exponential backoff, DLQ, max retries on CRM and research workers |
| Race conditions | Unverified | compute\_portfolio\_value RPC is STABLE not VOLATILE; concurrent case mutations have no optimistic locking |
| Transactional boundaries | Partially production-credible | provision\_tenant RPC is atomic; value case mutations are not transactional |
| Secrets management | Production-credible | SecretsService, SecretVolumeWatcher, SecretValidator on startup; no hardcoded secrets found |
| Observability | Demo-grade | OpenTelemetry configured but browser uses no-op tracer; OTEL\_ENDPOINT not set by default; metrics exist but no alerting configured |
| Audit logging | Production-credible | Hash-chain AuditLogService is real; but unreachable from UI; not called from canvas operations |
| Migration safety | Production-credible | Rollback scripts exist for every migration; IF NOT EXISTS guards throughout |
| Rollback tolerance | Production-credible | Rollback SQL files present for all recent migrations |
| Dependency failure behavior | Production-credible | Circuit breakers on LLM, ground truth, external APIs |
| Feature flag safety | Partially production-credible | Feature flags exist; ENABLE\_DOMAIN\_PACK\_CONTEXT gates domain pack loading; but several flags are env-var-only with no runtime toggle |
| Deployment assumptions | Demo-grade | Kafka disabled by default; NATS in compose but optional; Redis required but TLS config references non-existent cert paths |
| Config hygiene | Production-credible | validateEnvOrThrow() on startup; .env.example well-documented |

---

## 8\. Test Reality Check

Total test files found: 750

| Test Category | Reality |
| :---- | :---- |
| Agent fabric unit tests | Real — OpportunityAgent.test.ts, BaseAgent.test.ts, IntegrityAgent.test.ts, etc. Mock LLMGateway and MemorySystem correctly. Test actual agent logic. |
| ValueLifecycleOrchestrator.integration.test.ts | Mocked end-to-end — mocks Supabase, LLMGateway, MemorySystem, AuditLogger. Tests orchestrator wiring but not real persistence. |
| RLS SQL tests | Real — tenant\_rls\_isolation.test.sql, billing\_rls\_cross\_tenant.test.sql test actual DB isolation. Require live Supabase. |
| E2E tests (startup.spec.ts) | Shallow — only checks that the page loads without env errors. Does not test any user journey. |
| CRMIntegrationService.test.ts | Likely mocked — CRM service uses mock data when DEV\_MOCKS\_ENABLED=true. |
| Workflow tests (WorkflowDAGDefinitions.test.ts, SagaExecution.test.ts) | Likely unit tests against in-memory state, not real DB. |
| VOSAcademy tests | Separate product; not relevant to ValueOS canvas. |

Critical paths with no end-to-end test:

* Create value case → run agent → persist result → display in canvas  
* Human checkpoint approval flow  
* CRM OAuth connect → sync → display in integrations page  
* Narrative generation end-to-end  
* Version history create → browse → restore

Fake confidence sources:

* 750 test files sounds comprehensive but the majority test isolated utilities, not user-facing capability chains.  
* ValueLifecycleOrchestrator.integration.test.ts is named "integration" but mocks every external dependency.  
* No test validates that the Dashboard shows real data from the database.

---

## 9\. Prioritized Remediation Plan

### P0 — Misleading or broken capability gaps (fix immediately)

| Issue | Why it matters | Fix | Layers | Effort |
| :---- | :---- | :---- | :---- | :---- |
| Dashboard uses hardcoded data | First screen users see is fabricated | Wire useCasesList() into Dashboard; remove static arrays | Frontend | S |
| "Run Stage" button has no handler | Primary action in the product does nothing | Implement handler that calls POST /api/agents/:agentId/invoke with case context | Frontend | M |
| Agent Hub shows fabricated metrics | Presents false operational data | Add GET /api/agents/:agentId/metrics endpoint; wire Agents.tsx to fetch live data | Frontend \+ Backend | M |
| workflow\_checkpoints table missing | HumanCheckpointService throws on every call | Write migration to create table with RLS; wire Approve button | DB \+ Frontend | S |
| researchWorker.ts duplicate logger | Worker fails to compile/start | Remove duplicate declaration on line 24 | Backend | XS |
| useAgentStream uses user?.id as tenantId | Tenant isolation violation | Fix fallback to use currentTenant?.id from TenantContext | Frontend | XS |

### P1 — Core backend implementations needed to justify current UI

| Issue | Why it matters | Fix | Layers | Effort |
| :---- | :---- | :---- | :---- | :---- |
| Canvas stages are all hardcoded | Product's primary surface is a mockup | Wire each stage to load/save via API; implement state management for async agent results | Frontend \+ Backend | XL |
| NarrativeAgent does not exist | Named capability has no implementation | Implement NarrativeAgent.ts in fabric | Backend | L |
| Integrations page buttons are dead | Backend CRM infrastructure is wasted | Wire Connect button to OAuth flow; wire status to live tenant\_integrations | Frontend | M |
| Settings page doesn't persist | Settings appear to save but don't | Wire form submissions to backend settings APIs | Frontend | M |
| MemorySystem not wired to Supabase | Agent memory lost on restart | Wire SupabaseMemoryBackend in AgentFactory | Backend | S |
| AuditTrailDashboard not in router | Compliance view is unreachable | Add route; wire to AuditLogService API | Frontend | S |
| Reconcile three stage vocabularies | Agents, DB, and UI use different stage names | Define canonical stage enum; create mapping layer | Backend \+ Frontend | M |

### P2 — Hardening and operational improvements

| Issue | Why it matters | Fix | Layers | Effort |
| :---- | :---- | :---- | :---- | :---- |
| value\_cases.tenant\_id is text not uuid | Type mismatch with RLS UUID functions | Migration to alter column type | DB | S |
| Domain packs have two conflicting routers | One returns 501 silently | Remove domainPacks/index.ts router or complete its implementation | Backend | S |
| MessageBus defaults to in-process | Inter-agent messaging not durable | Require Redis connection for MessageBus in production | Backend | M |
| Kafka disabled by default | Described execution path doesn't run | Document the non-Kafka execution path clearly; or enable Redis-backed fallback | Backend | M |
| No optimistic locking on case mutations | Race conditions on concurrent edits | Add updated\_at check on updates | DB \+ Backend | S |
| Frontend demo data fallbacks are silent | Users can't tell if they're seeing real or demo data | Add visible indicator when demo fallback is active | Frontend | S |
| Invoice list uses mockInvoices | Billing page shows fake invoices | Wire to GET /api/billing/invoices | Frontend | S |

### P3 — Optional future enhancements

| Issue | Recommended fix | Effort |
| :---- | :---- | :---- |
| Version history for value cases | Implement case snapshot table and versioning service | L |
| Export (PDF/Slide Deck) | Integrate PDF generation service | L |
| Evidence drawer with real sources | Wire to ground truth citation data | M |
| Admin routes not in AppRoutes | Add admin section to router with role guard | M |
| E2E test coverage for critical paths | Add Playwright tests for create case → run agent → view result | L |

---

## 10\. Final Capability Truth Table

| Capability | Frontend Presents It? | Backend Actually Supports It? | End-to-End Path Complete? | Persistence Real? | Status | Risk | Key Evidence |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Create Value Case | ✅ | ✅ | Partial (Opportunities yes; Dashboard no) | ✅ | Partial | High | Dashboard.tsx QuickStart has no handler; useCases.ts is real |
| AI Hypothesis Generation | ✅ | ✅ | ❌ | Partial | Partial | Critical | AgentThread.tsx hardcoded; OpportunityAgent.ts real |
| Financial Model / Value Tree | ✅ | ✅ | ❌ | ❌ | Mocked | Critical | ModelStage.tsx onSave={() \=\> {}} no-ops |
| Integrity Verification | ✅ | ✅ | ❌ | ❌ | Mocked | Critical | IntegrityStage.tsx static claims; buttons have no handlers |
| Narrative Generation | ✅ | ❌ | ❌ | ❌ | Missing | Critical | No NarrativeAgent in fabric; NarrativeStage.tsx static text |
| Realization Tracking | ✅ | ✅ | ❌ | ❌ | Mocked | High | RealizationStage.tsx static arrays |
| Agent Hub / Live Metrics | ✅ | Partial | ❌ | Partial | Misleading | High | Agents.tsx fabricated metrics |
| Agent Run History | ✅ | ✅ | ❌ | ✅ | Misleading | High | AgentDetail.tsx hardcoded runs |
| Agent Memory Browser | ✅ | ✅ | ❌ | Partial | Misleading | High | AgentDetail.tsx hardcoded memory; MemorySystem not wired to Supabase |
| Human Approval Checkpoints | ✅ | Partial | ❌ | ❌ | Broken | High | workflow\_checkpoints table missing; buttons have no handlers |
| CRM Integration | ✅ | ✅ | ❌ | ✅ | Disconnected | High | Integrations.tsx buttons have no handlers |
| Version History | ✅ | ❌ | ❌ | ❌ | Missing | Medium | "v12" button has no handler; no case versioning schema |
| Evidence Drawer | ✅ | ❌ | ❌ | ❌ | Mocked | Medium | EvidenceDrawer.tsx hardcoded |
| Settings Persistence | ✅ | ✅ | ❌ | ❌ | Mocked | High | "Save Changes" has no handler |
| Billing | ✅ | ✅ | Partial | ✅ | Partial | Medium | Invoice list uses mockInvoices; subscription path real |
| Multi-Tenant Isolation | ✅ | ✅ | Partial | ✅ | Partial | High | RLS real; user?.id used as tenantId fallback in stream hook |
| Domain Packs | ✅ | ✅ | Partial | ✅ | Partial | Medium | Silent demo fallback; conflicting routers |
| Company Knowledge | ✅ | ✅ | Partial | ✅ | Partial | Medium | Onboarding writes real data |
| Onboarding AI Research | ✅ | ✅ | Partial | ✅ | Partial | High | Worker has compile error (duplicate logger) |
| Real-Time Agent Streaming | ✅ | Partial | Unverified | Partial | Partial | High | useAgentOrchestrator is simulation; RedisStreamBroker is real |
| Audit Trail | ✅ | ✅ | ❌ | ✅ | Disconnected | Medium | AuditTrailDashboard not in AppRoutes.tsx |
| Export (PDF/Slides) | ✅ | ❌ | ❌ | ❌ | Missing | High | Export buttons have no handlers; no export service |
| Admin / Governance | ✅ | ✅ | ❌ | ✅ | Disconnected | Medium | Admin views exist but not in router |

---

Summary verdict: The backend has earned the right to present authentication, tenant provisioning, billing, domain packs, and value case CRUD. It has not earned the right to present the ValueCaseCanvas workflow, agent monitoring, CRM integration, settings persistence, version history, narrative generation, or human checkpoints. The product's most prominent and differentiating surface — the agentic value case workspace — is a static mockup with no live data, no persistence, and no functional controls.  
