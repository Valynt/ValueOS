# Traceability Map — Agent Lifecycle → DB → API → UI

Full-stack slice for every lifecycle stage. Use this before touching any layer to understand
what exists, what is missing, and what depends on what.

Legend: ✅ implemented | ⚠️ partial | ❌ missing/stub

---

## Lifecycle Stage Overview

```
INITIATED → DRAFTING → VALIDATING → COMPOSING → REFINING → FINALIZED
    │            │           │            │           │           │
Opportunity   Target +    Integrity   Narrative   Expansion  Realization
  Agent      Financial     Agent       Agent       Agent       Agent
              Modeling
               Agent
```

---

## Stage 1: Hypothesis (INITIATED)

| Layer | Artifact | Status |
|---|---|---|
| **Agent** | `OpportunityAgent.ts` — generates 3–5 value hypotheses with confidence scores | ✅ |
| **DB table** | `hypothesis_outputs` — `id`, `case_id`, `organization_id`, `hypotheses[]`, `created_at` | ✅ |
| **Service** | `HypothesisOutputService.ts` — upsert/get by `case_id` + `organization_id` | ✅ |
| **API endpoint** | `GET /api/v1/value-cases/:caseId/hypothesis` | ✅ |
| **API endpoint** | `POST /api/agents/opportunity/invoke` | ✅ |
| **Router mount** | `valueCasesRouter` mounted in `server.ts` at `/api/v1/cases` (line 501) and `/api/v1/value-cases` (line 503) | ✅ |
| **Frontend hook** | `useHypothesisOutput(caseId)` — polls GET, exposes `runAgent()` | ✅ |
| **UI component** | `HypothesisStage.tsx` — renders hypotheses, triggers agent run | ✅ |
| **User story** | US-002 | ✅ |

---

## Stage 2: Model (DRAFTING)

| Layer | Artifact | Status |
|---|---|---|
| **Agent** | `TargetAgent.ts` — generates KPI targets from accepted hypotheses | ✅ |
| **Agent** | `FinancialModelingAgent.ts` — builds value tree, ROI, NPV, sensitivity analysis | ✅ |
| **DB table** | `value_tree_nodes` — `id`, `case_id`, `organization_id`, `node_type`, `value`, `formula` | ✅ |
| **DB table** | `financial_model_snapshots` — `id`, `case_id`, `organization_id`, `snapshot_data`, `version` | ✅ |
| **Repository** | `ValueTreeRepository.ts` + `ValueTreeNodeRepository.ts` | ✅ |
| **Repository** | `FinancialModelSnapshotRepository.ts` | ✅ |
| **Service** | `CaseValueTreeService.ts` — upsert/replace value tree nodes | ✅ |
| **API endpoint** | `GET /api/v1/value-cases/:caseId/value-tree` | ✅ |
| **API endpoint** | `PATCH /api/v1/value-cases/:caseId/value-tree` | ✅ |
| **API endpoint** | `GET /api/v1/value-cases/:caseId/model-snapshots/latest` | ✅ |
| **API endpoint** | `POST /api/agents/target/invoke` | ✅ |
| **API endpoint** | `POST /api/agents/financial-modeling/invoke` | ✅ |
| **Frontend hook** | `useValueTree(caseId)` | ✅ |
| **Frontend hook** | `useModelSnapshot(caseId)` | ✅ |
| **UI component** | `ModelStage.tsx` | ✅ |
| **User story** | US-003 | ✅ |

---

## Stage 3: Integrity (VALIDATING)

| Layer | Artifact | Status |
|---|---|---|
| **Agent** | `IntegrityAgent.ts` — validates claims, assigns confidence scores, component-scoped vetoes | ✅ |
| **DB table** | `integrity_outputs` — migration `20260325000000_integrity_outputs.sql` | ✅ |
| **Repository** | `packages/backend/src/repositories/IntegrityOutputRepository.ts` | ✅ |
| **Service** | — | — |
| **API endpoint** | `GET /api/v1/cases/:caseId/integrity` | ✅ |
| **API endpoint** | `POST /api/agents/integrity/invoke` | ✅ |
| **Frontend hook** | `apps/ValyntApp/src/hooks/useIntegrityOutput.ts` | ✅ |
| **UI component** | `IntegrityStage.tsx` — wired to real data, empty state, veto banner | ✅ |
| **User story** | US-004 | ✅ |
| **Debt ref** | DEBT-001, DEBT-002, DEBT-003 — all resolved in Sprint 11 | |

**Implemented in Sprint 11.** Full stack slice complete.

---

## Stage 4: Narrative (COMPOSING)

| Layer | Artifact | Status |
|---|---|---|
| **Agent** | `NarrativeAgent.ts` — generates executive summary, value story, key proof points | ✅ |
| **DB table** | `narrative_drafts` — migration `20260321000000_back_half_tables.sql` | ✅ |
| **Repository** | `NarrativeDraftRepository.ts` — `createDraft`, `getLatestForCase` | ✅ |
| **API endpoint** | `GET /api/v1/cases/:caseId/narrative` | ✅ |
| **API endpoint** | `POST /api/v1/cases/:caseId/narrative/run` | ✅ |
| **Frontend hook** | `useNarrative.ts` — `useNarrativeDraft`, `useRunNarrativeAgent` | ✅ |
| **UI component** | `NarrativeStage.tsx` — wired to real data, empty state, run button | ✅ |
| **User story** | US-005 | ✅ |
| **Debt ref** | DEBT-005, issue #1346 — resolved outside sprint cadence | |

**Implemented outside sprint cadence.** Full stack slice complete. All endpoints in `packages/backend/src/api/valueCases/backHalf.ts`.

---

## Stage 5: Realization (FINALIZED)

| Layer | Artifact | Status |
|---|---|---|
| **Agent** | `RealizationAgent.ts` — generates implementation plans and milestones | ✅ |
| **DB table** | `realization_reports` — migration `20260321000000_back_half_tables.sql` | ✅ |
| **Repository** | `RealizationReportRepository.ts` — `createOutput`, `getLatestForCase`, `updateRealizationPct` | ✅ |
| **Service** | `ValueCommitmentTrackingService.ts` — milestones, metrics, risks, stakeholders | ⚠️ 15 TODO stubs (DEBT-007, Sprint 20) |
| **API endpoint** | `GET /api/v1/cases/:caseId/realization` | ✅ |
| **API endpoint** | `POST /api/v1/cases/:caseId/realization/run` | ✅ |
| **Frontend hook** | `useRealization.ts` — `useRealizationReport`, `useRunRealizationAgent` | ✅ |
| **UI component** | `RealizationStage.tsx` — wired to real data, empty state, run button | ✅ |
| **User story** | US-006 | ⚠️ stage wired; commitment tracking stubs remain (Sprint 20) |
| **Debt ref** | DEBT-004 resolved; DEBT-007 / issue #1348 open (Sprint 20) | |

**Stage wired outside sprint cadence.** `ValueCommitmentTrackingService` stubs are the remaining gap — scheduled for Sprint 20.

---

## Stage 6: Expansion (post-FINALIZED)

| Layer | Artifact | Status |
|---|---|---|
| **Agent** | `ExpansionAgent.ts` — growth opportunities, expansion strategies | ✅ |
| **DB table** | `expansion_opportunities` — migration `20260322000000_persistent_memory_tables.sql` | ✅ |
| **Repository** | `ExpansionOpportunityRepository.ts` — `createOutput`, `getLatestRunForCase` | ✅ |
| **API endpoint** | `GET /api/v1/cases/:caseId/expansion` | ✅ |
| **API endpoint** | `POST /api/v1/cases/:caseId/expansion/run` | ✅ |
| **Frontend hook** | `useExpansion.ts` — `useExpansionOpportunities`, `useRunExpansionAgent` | ✅ |
| **UI component** | `ExpansionStage.tsx` — wired to real data, empty state, run button; registered in `LifecycleStageNav` | ✅ |
| **Debt ref** | DEBT-009 — resolved outside sprint cadence | |

**Implemented outside sprint cadence.** Full stack slice complete. All endpoints in `packages/backend/src/api/valueCases/backHalf.ts`.

---

## Cross-cutting: Agent Invocation Path

```
Frontend hook
  └─ POST /api/agents/:agentId/invoke
       └─ agentsRouter (server.ts: /api/agents)
            └─ getDirectFactory() → LLMGateway { provider: "together" }  ⚠️ currently "openai" — DEBT-001
                 └─ AgentFactory.create(agentId)
                      └─ XAgent.execute(context)
                           ├─ this.secureInvoke(sessionId, prompt, schema)  ← required
                           ├─ this.memorySystem.store(...)  ⚠️ enable_persistence: false — DEBT-002
                           └─ repository.upsert(output)  ← only for Opportunity, Target, Financial
```

---

## Cross-cutting: Value Case CRUD

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/value-cases` | POST | member+ | Create case |
| `/api/v1/value-cases` | GET | viewer+ | List cases (tenant-scoped) |
| `/api/v1/value-cases/:caseId` | GET | viewer+ | Get case by ID |
| `/api/v1/value-cases/:caseId` | PATCH | member+ | Update case |
| `/api/v1/value-cases/:caseId` | DELETE | admin | Delete case |
| `/api/v1/value-cases/:caseId/hypothesis` | GET | viewer+ | Get hypothesis output |
| `/api/v1/value-cases/:caseId/value-tree` | GET | viewer+ | Get value tree nodes |
| `/api/v1/value-cases/:caseId/value-tree` | PATCH | member+ | Update value tree |
| `/api/v1/value-cases/:caseId/model-snapshots/latest` | GET | viewer+ | Latest financial snapshot |

**Router:** `packages/backend/src/api/valueCases/index.ts` → exported as `valueCasesRouter`  
❌ Not mounted in `server.ts` — all endpoints in this table currently return 404. See Stage 1 gap above for the fix.

---

## Cross-cutting: Integrations

| Integration | Status | Adapter location |
|---|---|---|
| HubSpot | ✅ implemented | `packages/integrations/src/hubspot/` |
| Salesforce | ❌ empty stubs | `packages/integrations/src/salesforce/` |
| ServiceNow | ❌ empty stubs | `packages/integrations/src/servicenow/` |
| Slack | ❌ empty stubs | `packages/integrations/src/slack/` |
| SharePoint | ❌ empty stubs | `packages/integrations/src/sharepoint/` |

API: `GET|POST /api/integrations` → `integrationsRouter` (mounted in server.ts)  
CRM: `GET|POST /api/crm` → `crmRouter` (mounted in server.ts)

### CRM connection persistence

| Layer | Artifact | Status |
|---|---|---|
| **DB table** | `crm_connections` — migration `20260401020000_crm_connections.sql` | ✅ |
| **Service** | `CrmConnectionService.ts` — CRUD for OAuth connections | ✅ |
| **Encryption** | `tokenEncryption.ts` — AES-256-GCM envelope encryption with key versioning | ✅ |
| **Key rotation** | `TokenReEncryptionJob.ts` — re-encrypts rows after `CRM_TOKEN_KEY_VERSION` bump | ✅ |
| **Admin endpoint** | `POST /admin/crm/re-encrypt-tokens` — triggers re-encryption job | ✅ |

`crm_connections` has a `token_key_version` column (indexed) that the re-encryption job filters on. After rotating `CRM_TOKEN_KEY_VERSION`, call the admin endpoint to re-encrypt existing rows. The job is idempotent and processes in batches of 50.

---

## Frontend Component → Route Map

| Component | Route | Stage key |
|---|---|---|
| `ValueCaseCanvas.tsx` | `/workspace/:caseId` | container |
| `HypothesisStage.tsx` | (rendered inside canvas) | `hypothesis` |
| `ModelStage.tsx` | (rendered inside canvas) | `model` |
| `IntegrityStage.tsx` | (rendered inside canvas) | `integrity` |
| `NarrativeStage.tsx` | (rendered inside canvas) | `narrative` |
| `RealizationStage.tsx` | (rendered inside canvas) | `realization` |
| `LifecycleStageNav.tsx` | (nav inside canvas) | — |
| `AgentThread.tsx` | (sidebar inside canvas) | — |

Stage switching: `activeStage` state in `ValueCaseCanvas`, set by `LifecycleStageNav`.
