# User Stories — ValueOS

Core user stories with acceptance criteria and current implementation status.
Audience: AI agents planning features, writing tests, and evaluating completeness.

Update status when stories are implemented or acceptance criteria change.

---

## Personas

| Persona | Role |
|---|---|
| **VE** | Value Engineer — builds and presents business cases to enterprise buyers |
| **Buyer** | Economic buyer (CFO, VP Finance) reviewing a value case |
| **Admin** | Tenant administrator managing users and integrations |
| **Platform** | Internal platform/ops team |

---

## Epic 1: Hypothesis-Driven Value Case Creation

### US-001 — Create a value case from a CRM opportunity
**As a** VE  
**I want to** create a new value case by linking it to a CRM opportunity  
**So that** the system can pre-populate discovery context without manual data entry

**Acceptance criteria:**
- VE can click "New Case" from the dashboard and select an existing CRM opportunity
- System fetches account name, deal size, and industry from the CRM
- A new case is created with `status: INITIATED` and the CRM data pre-filled
- Case is scoped to the VE's `organization_id` (tenant isolation)

**Status:** ✅ Dashboard QuickStart `Go` button → `useCreateCase()` → `/workspace/:caseId` is wired  
**Gap:** CRM data pre-fill falls back to mock "Acme Corp" data (DEBT-008)

---

### US-002 — Generate value hypotheses from discovery signals
**As a** VE  
**I want to** receive AI-generated value hypotheses after entering discovery context  
**So that** I don't have to build the initial business case from scratch

**Acceptance criteria:**
- VE enters discovery signals (pain points, industry, deal size)
- `OpportunityAgent` generates 3–5 value hypotheses with confidence scores
- Each hypothesis includes: value driver, estimated impact range, evidence tier
- Hypotheses are persisted to `hypothesis_outputs` and survive page refresh
- VE can accept, reject, or edit each hypothesis

**Status:** ✅ `HypothesisStage` + `useHypothesisOutput()` + `useRunHypothesisAgent()` wired end-to-end  
**Gap:** None at this layer

---

### US-003 — Build a financial value tree from accepted hypotheses
**As a** VE  
**I want to** see a structured financial model generated from my accepted hypotheses  
**So that** I have a defensible, formula-based business case

**Acceptance criteria:**
- `TargetAgent` generates KPI targets from accepted hypotheses
- `FinancialModelingAgent` builds a value tree with ROI, NPV, payback period
- Value tree is persisted to `value_tree_nodes` and `financial_model_snapshots`
- VE can adjust input assumptions and see the model recalculate
- Sensitivity analysis shows impact of ±20% on key assumptions

**Status:** ✅ `ModelStage` + `useValueTree()` + `useModelSnapshot()` wired  
**Gap:** None at this layer

---

### US-004 — Validate claims with the Integrity Engine
**As a** VE  
**I want to** have each value claim automatically checked for logical consistency and evidence quality  
**So that** I can present a CFO-defensible case without manual fact-checking

**Acceptance criteria:**
- `IntegrityAgent` runs after financial modeling completes
- Each claim receives a `ConfidenceScore` (0.0–1.0) and evidence tier (1/2/3)
- Claims that fail logic checks are flagged individually (not the whole case)
- Integrity output is persisted and loadable on page refresh
- VE can see which claims are flagged and why

**Status:** ❌ `IntegrityStage` renders hardcoded demo data (DEBT-003, issue #1344)  
**Gap:** No `integrity_outputs` table, no repository, no API endpoint

---

### US-005 — Generate an executive narrative
**As a** VE  
**I want to** receive a polished executive summary and value story  
**So that** I can present the business case to a buyer without writing it from scratch

**Acceptance criteria:**
- `NarrativeAgent` generates: executive summary, value story, 3–5 key proof points
- Narrative is tailored to the buyer's industry and persona
- Output is persisted and loadable on refresh
- VE can edit the narrative inline

**Status:** ❌ `NarrativeStage` has no backend agent (DEBT-005, issue #1346)  
**Gap:** `NarrativeAgent.ts` does not exist in the fabric

---

### US-006 — Track value realization post-deal
**As a** VE  
**I want to** track whether the committed value targets are being achieved after the deal closes  
**So that** I can demonstrate ROI and build credibility for future deals

**Acceptance criteria:**
- VE can create milestones linked to a closed value case
- Actual metric values can be recorded against each milestone
- System calculates realization % vs committed targets
- Risks and stakeholders can be tracked per commitment
- Progress report can be generated on demand

**Status:** ❌ `RealizationStage` renders hardcoded demo data (DEBT-004, issue #1345)  
**Gap:** No `realization_outputs` table; `ValueCommitmentTrackingService` is all stubs (DEBT-007)

---

## Epic 2: Tenant Onboarding and Customisation

### US-007 — Onboard a new tenant with company context
**As an** Admin  
**I want to** provide company-specific context (products, ICPs, competitors, personas) once  
**So that** all future value cases are pre-seeded with firm-specific knowledge rather than generic industry data

**Acceptance criteria:**
- Admin can upload or link: company website, product docs, ICP definitions, competitor list
- System ingests and stores this as tenant-scoped semantic memory
- Subsequent agent runs reference this context automatically
- Context can be updated without re-running existing cases

**Status:** ⚠️ Partial — `SupabaseMemoryBackend` exists; onboarding UI and ingestion pipeline not built

---

### US-008 — Connect a CRM integration
**As an** Admin  
**I want to** connect ValueOS to our CRM (Salesforce or HubSpot)  
**So that** VEs can pull opportunity data directly without copy-pasting

**Acceptance criteria:**
- Admin can authenticate via OAuth2 to Salesforce or HubSpot
- Connection health is visible in the integrations dashboard
- VEs can search and select opportunities from the connected CRM
- Token refresh happens transparently

**Status:** ⚠️ HubSpot implemented; Salesforce adapter is empty stubs (DEBT-008, issue #1349)

---

## Epic 3: Platform Safety and Compliance

### US-009 — Prevent cross-tenant data access
**As the** Platform  
**I want to** guarantee that no query can return data belonging to a different tenant  
**So that** enterprise customers can trust the platform with sensitive deal data

**Acceptance criteria:**
- Every DB query on tenant tables includes `organization_id` filter
- RLS policies enforce isolation at the DB layer as defense-in-depth
- `pnpm run test:rls` passes on every PR
- Cross-tenant access attempts are logged and blocked

**Status:** ✅ RLS policies in place; `test:rls` suite exists  
**Gap:** Direct-mode `MemorySystem` has `enable_persistence: false` (DEBT-002), which means memory isolation is untested in that path

---

### US-010 — Audit trail for sensitive operations
**As the** Platform  
**I want to** log every create/update/delete/export/approve/reject action with actor and timestamp  
**So that** we can satisfy enterprise compliance requirements

**Acceptance criteria:**
- `agent_audit_log` is append-only (no updates or deletes)
- All CUD operations on value cases, commitments, and agent outputs are logged
- Audit entries include: `actor_id`, `organization_id`, `action`, `resource_id`, `timestamp`
- Audit log is queryable by tenant admins

**Status:** ✅ `AuditLogger` implemented; `agent_audit_log` is append-only  
**Gap:** `ValueCommitmentTrackingService` audit entries are TODO stubs (DEBT-007)
