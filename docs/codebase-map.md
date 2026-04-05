# ValueOS Codebase Structure Map

## Stats

| Metric | Count |
|---|---|
| Total TS/TSX/JS lines | ~142,134 |
| ValyntApp source files | 797 |
| Backend service files | 532 |
| Client TS/TSX files | 127 |
| Packages TS files | 1,468 |
| Scripts | 229 files, 44 subdirectories |
| Active CI/CD workflows | 8 |
| Archived CI/CD workflows | 65 |

---

## Monorepo Layout

**Build system:** Turborepo (`turbo.json`) — task graph: `build → test → lint/typecheck`  
**Package manager:** pnpm workspaces (`pnpm-workspace.yaml`)

```
ValueOS/
├── apps/                    # 3 applications
├── packages/                # 12 shared packages
├── client/                  # Secondary frontend (Drizzle/MySQL, tRPC)
├── drizzle/                 # Drizzle ORM schema + 5 migrations (MySQL, client/ only)
├── scripts/                 # 229 scripts across 44 subdirectories
├── .github/workflows/       # 8 active + 65 archived CI/CD workflows
├── infra/                   # Docker, Terraform, Caddy, Grafana, K8s
├── ops/                     # Compose profiles (backend, frontend)
├── tests/                   # 36 test subdirectories (e2e, integration, load, etc.)
├── conductor/               # Product track docs (billing-v2, mcp-ground-truth, etc.)
├── docs/                    # 20 documentation directories
├── schemas/                 # JSON schemas
├── seeds/                   # Database seed data
└── [root config]            # tsconfig, vite, vitest, eslint, tailwind, playwright
```

---

## apps/ — 3 Applications

| App | Files | Description |
|-----|-------|-------------|
| `ValyntApp/` | 797 | Main React + Vite frontend. Feature-module architecture. |
| `agentic-ui-pro/` | ~20 | Agentic UI prototype app. |
| `mcp-dashboard/` | ~50 | MCP monitoring dashboard (React + Vite, 8 pages). |

### ValyntApp Feature Modules (`apps/ValyntApp/src/features/`)

`academy`, `agents`, `audit`, `auth`, `billing`, `canvas`, `chat`, `compliance`, `onboarding`, `opportunities`, `sdui`, `team`, `templates`, `workflow`, `workspace`

### ValyntApp Source Directories

`app/`, `features/`, `views/`, `pages/`, `components/`, `hooks/`, `lib/`, `stores/`, `contexts/`, `types/`, `utils/`, `mcp-common/`, `mcp-crm/`, `mcp-ground-truth/`, `repositories/`, `security/`, `observability/`, `i18n/`, `adapters/`, `causal/`, `dashboards/`, `data/`, `integrations/`, `layouts/`, `legacy-migrated/`

---

## packages/ — 12 Shared Packages

| Package | Files | Purpose |
|---------|-------|---------|
| `backend` | 532 | Express API server — core backend |
| `components` | ~40 | Shared React components + design system (Storybook) |
| `config-v2` | ~5 | Shared ESLint, Prettier, TSConfig base |
| `core-services` | 10 | BenchmarkService, FinancialCalculator, LLMCache |
| `infra` | ~20 | DB, queues, storage, Supabase, ESO data connectors |
| `integrations` | ~20 | HubSpot, Salesforce, ServiceNow, SharePoint, Slack |
| `mcp` | ~60 | Model Context Protocol (3 sub-packages: common, crm, ground-truth) |
| `memory` | ~20 | Multi-layer memory (episodic, semantic, vector, provenance, lifecycle) |
| `sdui` | ~80 | Server-Driven UI engine (schema, renderer, data binding, actions) |
| `services` | ~40 | Standalone microservices (domain-validator, github-code-optimizer) |
| `shared` | ~30 | Shared types, domain models, config |
| `test-utils` | ~5 | Test utilities (CostAwareReporter) |

---

## Domain Model (`packages/shared/src/domain/`)

9 first-class domain objects as Zod schemas. All agent reasoning operates on these types.

`Account`, `Opportunity`, `Stakeholder`, `ValueHypothesis`, `Assumption`, `Evidence`, `BusinessCase`, `RealizationPlan`, `ExpansionOpportunity`

---

## Backend API Endpoints (`packages/backend/src/api/`)

Mounted in `packages/backend/src/server.ts`:

| Route | Router | Notes |
|-------|--------|-------|
| `/health` | `api/health/` | K8s probes, dependency checks |
| `/metrics` | inline | Prometheus metrics |
| `/api/csp-report` | inline | CSP violation reporting |
| `/health/secrets` | `secretHealthMiddleware` | Secret health check |
| `/.well-known/mcp-capabilities.json` | inline | MCP capability discovery |
| `/api/auth` | `api/auth.ts` | Login, signup, OAuth, password |
| `/api/admin` | `api/admin.ts` | Admin operations |
| `/api/admin/security` | `api/securityMonitoring.ts` | Security monitoring |
| `/api/admin/compliance` | `api/compliance.ts` | Compliance controls |
| `/api/agents` | `api/agents.ts` | Agent execution, SSE streaming |
| `/api/llm` | `api/llm.ts` | LLM proxy (concurrency guarded) |
| `/api/mcp` | `api/mcpDiscovery.ts` | MCP capability discovery |
| `/api/workflow` | `api/workflow.ts` | Workflow management |
| `/api/docs` | `docs-api/` | Documentation API |
| `/api/referrals` | `api/referrals.ts` | Referral program |
| `/api/usage` | `api/usage.ts` | Usage data |
| `/api/analytics` | `api/analytics.ts` | Analytics |
| `/api/dsr` | `api/dataSubjectRequests.ts` | GDPR data subject requests |
| `/api/teams` | `api/teams.ts` | Team management |
| `/api/integrations` | `api/integrations.ts` | Integration management |
| `/api/crm` | `api/crm.ts` | CRM operations |
| `/api/onboarding` | `api/onboarding.ts` | Onboarding (concurrency guarded) |
| `/api/v1/domain-packs` | `api/domainPacks.ts` | Domain pack management |
| `/api/v1/cases` | `api/valueCases/` | Value case CRUD |
| `/api/compliance/evidence` | `api/complianceEvidence.ts` | Compliance evidence |
| `/api/approvals/webhooks` | `api/approvalWebhooks.ts` | Approval webhooks |
| `/api/billing/*` | `api/billing/` | 8 billing sub-routes (see below) |
| `/api/projects` | `api/projects.ts` | Project management |
| `/api/initiatives` | `api/initiatives/` | Initiative management |
| `/api/groundtruth` | `api/groundtruth.ts` | Ground truth data |
| `/api/checkpoints` | `api/checkpoints.ts` | Human checkpoints |
| `/api/notifications` | `api/notifications.ts` | Notifications |
| `/api/queue` | `api/queue.ts` | Queue management |
| `/api/documents` | `api/documents.ts` | Document management |
| `/api/knowledge-upload` | `api/knowledgeUpload.ts` | Knowledge upload |

**Billing sub-routes (`/api/billing/`):** `webhooks`, `subscription`, `plans`, `plan-change`, `invoices`, `payment-methods`, `usage`, `summary`, `execution-control`

**Additional API modules:** `api/artifacts/`, `api/conversations/`, `api/customer/`, `api/valueDrivers/`, `api/config/`, `api/services/`, `api/client/`

---

## Backend Services (`packages/backend/src/services/`)

### Top-level service files (42 files)

`AssumptionService`, `BaseService`, `CalculationEngine`, `CaseValueTreeService`, `CausalTruthService`, `CircuitBreaker`, `CircuitBreakerManager`, `ConfidenceMonitor`, `ContextOptimizer`, `ConversationHistoryService`, `DemoAnalyticsService`, `DocumentParserService`, `EmailService`, `GroundTruthIntegrationService`, `GroundTruthMetrics`, `GroundtruthAPI`, `HumanCheckpointService`, `HypothesisOutputService`, `IntegrationConnectionService`, `IntegrationControlService`, `IntentRegistry`, `MCPGroundTruthService`, `MCPTools`, `PdfExportService`, `PersistenceService`, `ROIFormulaInterpreter`, `ReadThroughCacheService`, `RetryService`, `SemanticMemory`, `StructuralTruthModule`, `ToolRegistry`, `UnifiedAgentAPI`, `ValueCaseService`, `ValueFabricService`, `ValueKernel`, `ValueMetricsTracker`, `ValuePredictionTracker`, `ValueTreeService`, `VectorSearchService`, `VersionHistoryService`, `WorkspaceStateService`

### Service subdirectories

| Subdirectory | Key Services |
|---|---|
| `agents/` | AgentRegistry, AgentChatService, AgentExecutorService, AgentRoutingLayer, AgentMessageQueue, AgentStateStore |
| `auth/` | AuthService, MFAService, SessionManager, PermissionService, RbacService, TokenRotationService |
| `billing/` | StripeService, SubscriptionService, InvoiceService, RatingEngine, UsageMeteringService, WebhookService |
| `post-v1/` | CostAwareRouter, PlaygroundSessionService, WebScraperService, IntegrityAgentService, ValueLifecycleOrchestrator |
| `crm/` | CrmProviderRegistry, HubSpotProvider, SalesforceProvider, CrmSyncService, CRMOAuthService |
| `realtime/` | MessageBus, EventConsumer, EventProducer, WebSocketManager, RealtimeBroadcastService, PresenceService |
| `tenant/` | TenantProvisioning, TenantContextResolver, TenantIsolationService, CustomerAccessService |
| `llm/` | LLMFallback, LLMCostTracker, ModelService, GeminiProxyService, FallbackAIService |
| `security/` | AuditLogService, ComplianceEvidenceService, APIKeyRotationService, SecurityMonitor |
| `sdui/` | CanvasSchemaService, ComponentMutationService, LayoutEngine, SDUICacheService, TemplateLibrary |
| `workflow/` | WorkflowStateMachine, SagaCoordinator, WorkflowCompensation, WorkflowSDUIAdapter |
| `workflows/` | WorkflowDAGDefinitions, WorkflowRunner, IntegrityVetoService, AgentAdapters |
| `memory/` | MemoryService, MemoryPipeline, RetrievalEngine, NarrativeEngine, ModelRunEngine |
| `metering/` | UsageEmitter, UsageQueueProducer, UsageQueueConsumerWorker, UsageAggregator, GracePeriodService |
| `onboarding/` | WebCrawler, SuggestionExtractor, ValueHypothesisGenerator, ResearchJobWorker, DripCampaignService |
| `middleware/` | AdaptiveRefinement, Adversarial, Checkpoint, Embedding, Handover, PrivacyScrubber (30+ modules) |
| `monitoring/` | AgentPerformanceMonitor, MemoryPressureMonitor, SystemResourceMonitor |
| `messaging/` | RedisStreamBroker, EventSchemas |
| `value/` | KpiTargetService, RoiModelService, ValueCommitService, ValueTreeService |
| `policy/` | AgentPolicyService, PolicyEnforcement |
| `integrity/` | VetoController |
| `reasoning/` | AdvancedCausalEngine |
| `collaboration/` | AgentCollaborationService |
| `approvals/` | ApprovalWebhookService, NotificationActionSigner, NotificationAdapterService |
| `cache/` | AgentCache, TenantCache |
| `bfa/` | Backend Function Agents (registry, auth-guard, telemetry, onboarding tools) |
| `domain-packs/` | DomainPackService |
| `domainPacks/` | merge, snapshot, validate, versioning |
| `tools/` | Tool implementations |
| `types/` | Service type definitions |
| `utils/` | Shared utilities |

---

## Agent Fabric (`packages/backend/src/lib/agent-fabric/`)

### Core infrastructure

| File | Purpose |
|---|---|
| `BaseAgent.ts` | `secureInvoke`, hallucination detection, circuit breaker, Zod validation |
| `AgentFactory.ts` | Agent instantiation with dependency injection |
| `LLMGateway.ts` | Multi-provider LLM client (OpenAI, Gemini, Together AI) |
| `MemorySystem.ts` | Tenant-scoped in-memory store (pgvector migration pending) |
| `SecureMessageBus.ts` | CloudEvents inter-agent messaging |
| `CircuitBreaker.ts` | Per-agent circuit breaker |
| `ContextFabric.ts` | Execution context assembly |
| `FabricMonitor.ts` | Agent fabric observability |
| `AuditLogger.ts` | Agent action audit trail |

### Agents (`lib/agent-fabric/agents/`)

| Agent | Lifecycle Stage | Responsibility |
|---|---|---|
| `OpportunityAgent` | OPPORTUNITY | Hypothesis generation |
| `TargetAgent` | DRAFTING | KPI target generation |
| `FinancialModelingAgent` | DRAFTING | Financial model, ROI, sensitivity analysis |
| `IntegrityAgent` | VALIDATING | Claim validation, veto decisions |
| `NarrativeAgent` | NARRATIVE | Value narrative generation |
| `RealizationAgent` | REALIZATION | Implementation plans, milestones |
| `ExpansionAgent` | EXPANSION | Growth opportunities, expansion strategies |
| `ComplianceAuditorAgent` | COMPLIANCE | Compliance audit and evidence |

---

## Runtime Services (`packages/backend/src/runtime/`)

6 subsystems that replaced `UnifiedAgentOrchestrator`:

| Subsystem | Files | Purpose |
|---|---|---|
| `decision-router/` | 5 | Routes decisions based on structured domain state |
| `execution-runtime/` | 5 | `WorkflowExecutor` + `QueryExecutor` |
| `artifact-composer/` | 3 | Composes multi-part artifacts from agent outputs |
| `context-store/` | 3 | Stores/retrieves execution context |
| `policy-engine/` | 3 | Policy evaluation |
| `recommendation-engine/` | 3 | Subscribes to domain events, pushes next-best-action to UI via `RealtimeBroadcastService` |

---

## BullMQ Workers (`packages/backend/src/workers/`)

| Worker | Purpose |
|---|---|
| `workerMain.ts` | Worker process entrypoint |
| `billingAggregatorWorker.ts` | Usage aggregation for billing |
| `crmWorker.ts` | CRM sync jobs |
| `researchWorker.ts` | Async research/web-crawl jobs |

---

## DB Schema

### Supabase (PostgreSQL) — primary data store

Migration files in `supabase/migrations/`. RLS enforced on all tenant-scoped tables. See `packages/shared/src/domain/` for canonical Zod schemas.

### Drizzle (MySQL) — `client/` app only

4 tables: `users`, `enrichment_cache`, `conversations`, `messages`  
5 migrations: `0000` through `0004_perf_indexes.sql`

---

## CI/CD Workflows (`.github/workflows/`)

### Active (8)

| Workflow | Trigger | Key Jobs |
|---|---|---|
| `ci.yml` | PR + push to main/develop | lint, typecheck, vitest (60% coverage), migration hygiene, docs integrity |
| `deploy.yml` | Push to main + weekly + manual | 12 jobs: staging perf, tenant isolation gate, supply chain verification, SLO burn rate guard, emergency bypass |
| `test.yml` | Manual | Full test suite |
| `terraform.yml` | Push + PR | Terraform plan/apply |
| `migration-chain-integrity.yml` | Migration file changes | Migration chain validation |
| `compliance-evidence-export.yml` | Scheduled | Compliance evidence export |
| `access-review-automation.yml` | Scheduled | Access review |
| `oncall-drill-scorecard.yml` | Scheduled | On-call drill scoring |

### Archived (65, in `.github/workflows/.archive/`)

Canary deploy, chaos testing, database backup, design system CI, drift detection, k8s deploy, nightly quality, RLS coverage, Terraform deploy variants, PR preview environments, and more.

---

## Scripts (`scripts/`)

| Subdirectory | Purpose |
|---|---|
| `ci/` (63 files) | Quality gates, security checks, migration hygiene, coverage enforcement |
| `deploy/` | Blue-green, canary, one-click deployment |
| `db/` | Migration management |
| `dev/` | Developer setup, smoke tests, seed data |
| `security/` | Secret rotation verification |
| `chaos/` | Chaos engineering |
| `k8s/` | Kubernetes manifests |
| `perf/` + `performance/` | Performance testing |
| `compliance/` | Compliance scanning |
| `billing/` | Billing audit |
| `llm/` | LLM tooling |
| `agentic-dev/` | Agentic development tools |

---

## Key Architectural Patterns

| Pattern | Where |
|---|---|
| **Dual workflow systems** | `services/workflow/` (FSM) + `services/workflows/` (DAG) — two generations coexisting |
| **SDUI** | `packages/sdui/` (frontend engine) + `services/sdui/` (backend) — AI-driven UI generation |
| **Multi-provider LLM** | Fallback chain: OpenAI → Together AI → Google Gemini, with cost tracking and circuit breakers |
| **Multi-provider secrets** | AWS Secrets Manager, HashiCorp Vault, K8s secret volumes with rotation scheduling |
| **ESO data connectors** | BLS, Census, SEC EDGAR in `packages/infra/eso/` |
| **Tenant isolation** | Enforced at middleware, service, and DB (Supabase RLS) layers |
| **Progressive rollout** | Feature flags via `progressiveRollout.ts` |
| **Dual frontend** | `apps/ValyntApp/` (Supabase-backed, full-featured) + `client/` (Drizzle/MySQL, tRPC, simpler) |

---

## Key File Pointers

| File | Purpose |
|---|---|
| `packages/shared/src/domain/` | Canonical domain model — 9 Zod schemas |
| `packages/backend/src/server.ts` | Express app setup, middleware chain, route mounting |
| `packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts` | `secureInvoke`, hallucination detection |
| `packages/backend/src/runtime/decision-router/` | Agent/action selection from domain state |
| `packages/backend/src/runtime/recommendation-engine/` | Domain event subscriptions → UI recommendations |
| `packages/backend/src/types/orchestration.ts` | Canonical orchestration types |
| `packages/backend/src/analytics/ValueLoopAnalytics.ts` | Value loop learning |
| `packages/backend/src/observability/valueLoopMetrics.ts` | Prometheus metrics |
| `packages/backend/src/services/MessageBus.ts` | CloudEvents inter-agent messaging |
| `packages/backend/src/services/ToolRegistry.ts` | Static tool registration |
| `packages/backend/src/data/lifecycleWorkflows.ts` | DAG workflow definitions |
| `drizzle/schema.ts` | Drizzle schema (client/ app only) |
| `.windsurf/rules/global.md` | Safety and compliance policy |
| `.github/CODEOWNERS` | Review routing |
