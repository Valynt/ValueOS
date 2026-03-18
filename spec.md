# Production Readiness: Governance, CRM Integration, and Artifact Generation

## Problem Statement

Three categories of production-blocking defects exist in the codebase:

1. **TypeScript contract defects** — compile errors caused by incomplete type coverage and invalid modifier usage that will surface as runtime failures or silent type unsafety.

2. **Governance bypass** — `enforceRules()` in `packages/backend/src/lib/rules.ts` is a stub that always returns `{ allowed: true }`. `ActionRouter` calls it as a mandatory policy gate before every action execution, but because it never denies, all routing, tool execution, writes, and side effects are unguarded in production.

3. **Production-path stubs** — several API endpoints and services return hardcoded fake data or do nothing, including:
   - `CRMConnector` — calls `mockHubSpotFetch()` with fabricated opportunity data
   - `SECEdgarClient.resolveCIK()` — derives a fake CIK from ticker string length
   - `ChunkEmbedPipeline.storeChunks()` — logs but never writes to the database
   - `ReflectionEngine.refine()` — returns a hardcoded stub response; the real agent call is commented out
   - `FinanceExportService.generateExportFile()` — returns a hardcoded `storage.example.com` URL
   - `AgentPrefetchService.fetchSimilarDeals()` / `fetchObjectionPatterns()` — return empty arrays
   - `POST /api/cases/:caseId/artifacts` — fabricates a `jobId`, never triggers `NarrativeAgent`
   - `POST /api/cases/:caseId/deal-assembly` — fabricates a `jobId`, never triggers `DealAssemblyAgent`
   - Academy simulation `evaluateResponse` — returns hardcoded score 75 with canned feedback

---

## Requirements

### R1 — TypeScript Contract Defects

#### R1.1 — `AgentInitializer.ts`: Incomplete `HEALTH_CHECK_QUERIES` record

`HEALTH_CHECK_QUERIES` is typed `Record<AgentType, string>` but is missing the `groundtruth` and `compliance-auditor` keys that exist in the `AgentType` union. This is a TypeScript compile error.

**Fix:** Add both missing entries to `HEALTH_CHECK_QUERIES`. Also add both to the `AGENT_TYPES` array used for health checks if they should be health-checked at startup; if they are intentionally excluded from startup checks, narrow the type to `Partial<Record<AgentType, string>>` with a comment explaining the exclusion.

#### R1.2 — `AgentOutputListener.ts`: Invalid `override private` modifier

`override private listeners` is invalid TypeScript. The `override` keyword applies to members inherited from a parent class, but `EventEmitter` has no `listeners` property with that signature, and `private` members cannot be overridden.

**Fix:** Remove the `override` keyword. The field should be declared as `private listeners: Map<string, AgentOutputCallback[]>`.

#### R1.3 — `RateLimitMetricsService.ts`: Invalid `private override readonly CACHE_TTL`

`private override readonly CACHE_TTL` is invalid. `BaseService` declares `CACHE_TTL` as `private`, and TypeScript does not permit overriding a `private` member from a parent class.

**Fix:** Remove the `override` keyword. If the intent is to shadow the parent's `CACHE_TTL` with a different value, declare it as `private readonly CACHE_TTL` (no `override`). If the intent is to make it overridable, change the parent's declaration to `protected`.

#### R1.4 — `WorkflowDAGDefinitions.ts`: Empty compensation handler

`compensateValueModelingWorkflow` logs a message but performs no actual rollback. It is registered as the compensation handler for the Value Modeling Workflow, meaning saga failures silently do nothing.

**Fix:** Implement the rollback body: fetch the previous value tree version from history, restore `value_tree_nodes` to that state, clean up partial scenario data, and reset assumptions to pre-modeling state. If a full rollback is not yet feasible, the function must at minimum mark the case as `compensation_failed` in the database and emit a structured error log so the failure is observable and recoverable.

---

### R2 — Governance Engine (`enforceRules`)

#### R2.1 — Replace the stub with a real policy decision engine

**File:** `packages/backend/src/lib/rules.ts`

The current implementation:

```ts
export async function enforceRules(
  context: Record<string, unknown>,
  ruleIds?: string[]
): Promise<EnforcementResult> {
  return { allowed: true, violations: [], warnings: [] };
}
```

Must be replaced with a real implementation. The function signature must change to accept a typed `GovernanceContext` and return a typed `GovernanceDecision`.

##### New types

```ts
export type GovernanceContext = {
  actor: {
    userId: string;
    tenantId: string;
    roles: string[];
    sessionId?: string;
  };
  action: {
    type: string;
    name: string;
    target?: {
      resourceType: string;
      resourceId?: string;
      ownerTenantId?: string;
    };
    payload?: unknown;
  };
  environment: {
    stage: "dev" | "staging" | "prod";
    nowIso: string;
  };
  workflow?: {
    workflowId?: string;
    step?: string;
    approvals?: string[];
  };
};

export type GovernanceObligation =
  | { type: "REDACT_FIELDS"; fields: string[] }
  | { type: "REQUIRE_APPROVAL"; approvalType: string }
  | { type: "READ_ONLY" }
  | { type: "LOG_AUDIT" };

export type GovernanceReasonCode =
  | "ALLOW"
  | "DENY_UNAUTHENTICATED"
  | "DENY_UNAUTHORIZED"
  | "DENY_CROSS_TENANT"
  | "DENY_POLICY"
  | "DENY_RISK"
  | "DENY_MISSING_APPROVAL"
  | "DENY_INVALID_STATE";

export type GovernanceDecision = {
  allowed: boolean;
  reasonCode: GovernanceReasonCode;
  message: string;
  obligations?: GovernanceObligation[];
  audit: {
    policyVersion: string;
    evaluatedAt: string;
    matchedRules: string[];
  };
};
```

##### Evaluation layers (in order, all non-bypassable)

**Layer 1 — Hard guards (synchronous, no I/O)**
- No `actor.userId` → `DENY_UNAUTHENTICATED`
- No `actor.tenantId` → `DENY_POLICY`
- `action.target.ownerTenantId` present and does not match `actor.tenantId` → `DENY_CROSS_TENANT`

**Layer 2 — RBAC (async, reads permissions)**
- Load actor permissions via `getActorPermissions(userId, tenantId)` — query the existing RBAC system (`packages/backend/src/lib/permissions.ts` / Supabase `user_roles` / `role_permissions` tables)
- If `action.name` is not in the actor's permission set → `DENY_UNAUTHORIZED`
- If `isDestructiveAction(action)` and actor lacks elevated role → `DENY_UNAUTHORIZED`

**Layer 3 — Workflow-state validation (async, reads case/proposal state)**
- For `action.name === "proposal.publish"`: verify integrity review passed and required evidence threshold is met; deny with `DENY_INVALID_STATE` or `DENY_MISSING_APPROVAL` respectively
- For `action.name === "value_model.finalize"`: verify all required assumptions are confirmed
- Additional action-specific state checks follow the same pattern

**Layer 4 — Environment controls**
- In `prod` environment, destructive actions without an approval in `workflow.approvals` → `DENY_MISSING_APPROVAL`

**Layer 5 — Obligations on allow**
- Every allowed decision must include `{ type: "LOG_AUDIT" }` in `obligations`
- Sensitive read actions include `{ type: "REDACT_FIELDS", fields: [...] }` as appropriate

##### Fail-closed requirement

The entire evaluation must be wrapped in a try/catch. On any thrown error, return:

```ts
{
  allowed: false,
  reasonCode: "DENY_POLICY",
  message: "Governance evaluation failed.",
  audit: {
    policyVersion: "unknown",
    evaluatedAt: new Date().toISOString(),
    matchedRules: ["governance-evaluation-error"]
  }
}
```

Never return `allowed: true` from a catch block.

#### R2.2 — Update `ActionRouter` to enforce the decision as binding

**File:** `packages/backend/src/services/agents/ActionRouter.ts`

`checkGovernanceRules` currently calls `enforceRules` and logs the result, but `ActionRouter.executeAction` does not stop execution on deny. The router must:

1. Throw a `GovernanceError` (new typed error class) when `decision.allowed === false`, carrying `reasonCode` and `audit` fields.
2. Apply obligations when `decision.allowed === true`:
   - `LOG_AUDIT` → emit a structured audit log entry before execution
   - `REDACT_FIELDS` → strip named fields from the action payload before passing to the handler
   - `REQUIRE_APPROVAL` → block execution and return a pending-approval response
   - `READ_ONLY` → downgrade write actions to read-only mode

3. Return policy-aware error responses to callers — the HTTP layer must map `GovernanceError` to `403` with a structured body containing `reasonCode` and `message`.

#### R2.3 — `GovernanceError` class

Add `packages/backend/src/services/errors.ts` (or the canonical error file):

```ts
export class GovernanceError extends Error {
  constructor(
    message: string,
    public readonly reasonCode: GovernanceReasonCode,
    public readonly audit: GovernanceDecision["audit"]
  ) {
    super(message);
    this.name = "GovernanceError";
  }
}
```

---

### R3 — CRM Integration (`CRMConnector`)

#### R3.1 — Replace mock HubSpot fetch with real API calls

**File:** `packages/backend/src/services/deal/CRMConnector.ts`

`fetchWithTimeout` currently delegates to `mockHubSpotFetch`, which returns fabricated opportunity data with a simulated 100ms delay. Replace with real provider implementations behind the existing `CrmProvider` abstraction.

##### Provider abstraction

The existing `CrmProvider` enum (`hubspot` | `salesforce`) must be used to dispatch to provider-specific implementations. Add a `CrmProviderClient` interface:

```ts
interface CrmProviderClient {
  fetchOpportunity(input: CRMFetchInput, signal: AbortSignal): Promise<CRMFetchResult>;
}
```

Implement `HubSpotClient` and `SalesforceClient` as separate classes. `CRMConnector.fetchWithTimeout` selects the client based on `this.provider`.

##### HubSpot implementation

- Use the HubSpot CRM v3 REST API (`https://api.hubapi.com/crm/v3/objects/deals/:dealId`)
- Authenticate via `Authorization: Bearer <HUBSPOT_API_KEY>` — key loaded from environment, never hardcoded
- Map HubSpot deal properties to `CRMOpportunity` shape
- Map HubSpot associated contacts/companies to `CRMAccount` and `CRMContact` shapes
- Handle HubSpot-specific error codes: `401` → throw auth error, `404` → return `null` result, `429` → respect `Retry-After` header

##### Salesforce implementation

- Use Salesforce REST API (`/services/data/v58.0/sobjects/Opportunity/:id`)
- Authenticate via OAuth 2.0 client credentials flow — store `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_INSTANCE_URL` in environment
- Cache the access token with expiry; refresh before expiry
- Map Salesforce `Opportunity` fields to `CRMOpportunity` shape

##### Shared requirements for both providers

- Respect the existing `REQUEST_TIMEOUT_MS` via `AbortController`
- On network error or non-2xx response, throw a typed `CRMFetchError` with provider name, status code, and message
- Log provider name, status, and latency at `info` level; never log API keys or tokens
- All credentials loaded from environment variables; throw at construction time if required vars are absent

#### R3.2 — Remove `mockHubSpotFetch`

Delete the `mockHubSpotFetch` method entirely. It must not exist in the production codebase.

---

### R4 — Artifact Generation Pipeline

#### R4.1 — `POST /api/cases/:caseId/artifacts` — real job creation and dispatch

**File:** `packages/backend/src/api/artifacts.ts`

The current handler returns a fabricated `jobId` and does nothing. Replace with:

**Step 1 — Validate request and case state**
- Verify `caseId` exists and belongs to `req.tenantId`
- Verify caller has `artifact.generate` permission (via RBAC)
- Verify case has a value model (block if missing)
- Validate `artifactType` is a supported enum value
- Return `400` with a structured error if any check fails; `403` for authorization failures

**Step 2 — Create a persistent `artifact_jobs` row**

Schema:
```ts
type ArtifactJobStatus = "queued" | "running" | "completed" | "failed";

type ArtifactJob = {
  id: string;               // uuid
  tenant_id: string;
  case_id: string;
  artifact_type: string;
  format: string;
  requested_by: string;     // userId
  status: ArtifactJobStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error_message?: string;
  artifact_id?: string;     // populated on completion
};
```

Insert the row with `status: "queued"` before enqueuing work. Return `jobId` from this row.

**Step 3 — Enqueue real background work**

Use the existing `AgentMessageQueue` (BullMQ) to enqueue a `generate-artifact` job:

```ts
await agentMessageQueue.queueAgentInvocation({
  agent: "narrative",
  query: "generate_case_artifact",
  context: {
    jobId,
    caseId,
    tenantId,
    artifactType,
    format,
    audience,
    requestedBy: userId,
  },
  sessionId: `artifact:${jobId}`,
  organizationId: tenantId,
  userId,
  traceId: uuidv4(),
});
```

**Step 4 — Return real job reference**

```json
{
  "jobId": "<real uuid from artifact_jobs>",
  "status": "queued"
}
```

HTTP status `202 Accepted`.

#### R4.2 — Artifact generation worker

Add a BullMQ worker (or extend `AgentExecutorService`) that processes `generate-artifact` jobs:

1. Load the `artifact_jobs` row; set `status: "running"`, `started_at: now`
2. Load full case context from Supabase: case summary, value hypotheses, ROI model outputs, assumptions, evidence, stakeholder framing
3. Invoke `NarrativeAgent.secureInvoke()` with the assembled context
4. Validate the generated output against the `NarrativeAgent` Zod schema
5. Persist the artifact to an `artifacts` table:
   ```ts
   type CaseArtifact = {
     id: string;
     tenant_id: string;
     case_id: string;
     job_id: string;
     artifact_type: string;
     format: string;
     title: string;
     content: string;
     created_by: string;
     created_at: string;
     metadata: {
       audience?: string;
       evidence_included: boolean;
       model_version?: string;
       prompt_version?: string;
     };
   };
   ```
6. Update `artifact_jobs`: `status: "completed"`, `completed_at: now`, `artifact_id: <new id>`
7. On any error: update `artifact_jobs`: `status: "failed"`, `failed_at: now`, `error_message: normalizeError(err)`; rethrow so BullMQ can record the failure

#### R4.3 — Job status and artifact retrieval endpoints

Add two endpoints:

- `GET /api/artifact-jobs/:jobId` — returns the `artifact_jobs` row (status, artifactId when complete). Enforces tenant isolation: `job.tenant_id` must equal `req.tenantId`.
- `GET /api/cases/:caseId/artifacts/:artifactId` — returns the artifact content. Enforces tenant isolation.

Both return `404` if the resource does not exist or belongs to a different tenant.

---

### R5 — Remaining Production-Path Stubs

The following stubs must be replaced. Each is a production code path that currently returns fake data or does nothing.

#### R5.1 — `SECEdgarClient.resolveCIK()`

**File:** `packages/backend/src/services/integrity/SECEdgarClient.ts`

Replace the fake CIK derivation with a real lookup against the SEC EDGAR company tickers JSON endpoint (`https://www.sec.gov/files/company_tickers.json`). Cache the response (TTL: 24 hours) in Redis. If the ticker is not found, return `null`. If the SEC endpoint is unavailable, throw a typed `SECEdgarError` — do not return a fabricated CIK.

#### R5.2 — `ChunkEmbedPipeline.storeChunks()`

**File:** `packages/backend/src/services/ground-truth/ChunkEmbedPipeline.ts`

Replace the log-only stub with a real Supabase insert into the `semantic_memory` table. Each chunk must be inserted with: `content`, `embedding` (vector), `metadata` (jsonb including `tenantId`, `documentId`, `chunkIndex`), and `tenant_id` for RLS. Use a batch insert. On Supabase error, throw — do not silently swallow.

#### R5.3 — `ReflectionEngine.refine()`

**File:** `packages/backend/src/services/post-v1/ReflectionEngine.ts`

Remove the hardcoded stub response. Uncomment and complete the agent API call. The method must invoke the appropriate agent (determined by `agentType`) via `getAgentAPI().invokeAgent()`, pass the `refinementPrompt` as the query, and return the real agent response data. On failure, throw — do not return a fake `_refined: true` object.

#### R5.4 — `FinanceExportService.generateExportFile()`

**File:** `packages/backend/src/services/billing/FinanceExportService.ts`

Replace the hardcoded `storage.example.com` URL with a real file generation and upload flow. Generate the export file in the requested format (CSV/JSON), upload it to the configured storage backend (Supabase Storage or S3 depending on environment config), and return the real signed URL. The URL must be time-limited (e.g., 1 hour). On upload failure, throw a typed error.

#### R5.5 — `AgentPrefetchService.fetchSimilarDeals()` and `fetchObjectionPatterns()`

**File:** `packages/backend/src/services/crm/AgentPrefetchService.ts`

- `fetchSimilarDeals`: implement vector similarity search against the `semantic_memory` table using `pgvector`. Query by embedding similarity to the current opportunity's description. Return the top-N results mapped to `SimilarDealSuggestion[]`.
- `fetchObjectionPatterns`: query the `objection_patterns` table (or equivalent) filtered by `industry` and `tenant_id`. If the table does not yet exist, create the migration and return an empty array with a structured log — do not silently return empty without explanation.

#### R5.6 — `DealAssemblyService.triggerReassembly()` event emission

**File:** `packages/backend/src/services/deal/DealAssemblyService.ts`

Replace the `// TODO: Integrate with event system` comment with a real event publication. Use the existing `getEventProducer().publish()` to emit a `deal.reassembly.requested` event on `EVENT_TOPICS.AGENT_REQUESTS`. The event payload must include `caseId`, `tenantId`, `userId`, and `correlationId`.

#### R5.7 — Academy simulation `evaluateResponse`

**File:** `packages/backend/src/api/academy/routers/simulations.router.ts`

Replace the hardcoded `{ score: 75, ... }` response with a real LLM evaluation. Invoke the LLM gateway with a structured evaluation prompt that includes the scenario definition, the expected response criteria, and the user's submitted response. Parse and validate the response with a Zod schema. Return the real score and feedback. If the LLM call fails, return a `500` with a structured error — do not return fake scores.

---

## Acceptance Criteria

### TypeScript defects

- [ ] `HEALTH_CHECK_QUERIES` compiles without error — all `AgentType` values are covered or the type is narrowed with documented intent
- [ ] `AgentOutputListener` compiles without error — `override` removed from `listeners`
- [ ] `RateLimitMetricsService` compiles without error — `override` removed from `CACHE_TTL`
- [ ] `compensateValueModelingWorkflow` either performs a real rollback or marks the case as `compensation_failed` and emits a structured error log

### Governance

- [ ] `enforceRules()` returns `{ allowed: false }` when `actor.userId` is absent
- [ ] `enforceRules()` returns `{ allowed: false, reasonCode: "DENY_CROSS_TENANT" }` when `action.target.ownerTenantId` does not match `actor.tenantId`
- [ ] `enforceRules()` returns `{ allowed: false, reasonCode: "DENY_UNAUTHORIZED" }` when the actor lacks the required permission
- [ ] `enforceRules()` returns `{ allowed: false, reasonCode: "DENY_POLICY" }` when an exception is thrown during evaluation (fail-closed)
- [ ] `enforceRules()` never returns `{ allowed: true }` from a catch block
- [ ] `ActionRouter` throws `GovernanceError` when `decision.allowed === false`
- [ ] `ActionRouter` applies `LOG_AUDIT` obligation before executing any allowed action
- [ ] HTTP layer maps `GovernanceError` to `403` with `reasonCode` and `message` in the response body
- [ ] Unit tests cover: unauthenticated actor, cross-tenant access, missing permission, destructive action without elevated role, `proposal.publish` before integrity pass, evaluation error (fail-closed)

### CRM integration

- [ ] `CRMConnector` makes real HTTP calls to HubSpot API when `provider === "hubspot"`
- [ ] `CRMConnector` makes real HTTP calls to Salesforce API when `provider === "salesforce"`
- [ ] `mockHubSpotFetch` does not exist in the codebase
- [ ] Missing `HUBSPOT_API_KEY` or Salesforce credentials cause a thrown error at construction time, not a silent fallback to mock data
- [ ] API keys and tokens are never logged
- [ ] `429` responses from HubSpot respect `Retry-After`

### Artifact generation

- [ ] `POST /api/cases/:caseId/artifacts` inserts a real row into `artifact_jobs` before returning
- [ ] The returned `jobId` is the UUID of the persisted `artifact_jobs` row
- [ ] A BullMQ job is enqueued after the row is created
- [ ] The worker invokes `NarrativeAgent.secureInvoke()` with real case context
- [ ] The generated artifact is persisted to the `artifacts` table
- [ ] `artifact_jobs.status` transitions through `queued → running → completed` (or `failed`)
- [ ] `GET /api/artifact-jobs/:jobId` returns real status
- [ ] `GET /api/cases/:caseId/artifacts/:artifactId` returns the generated artifact content
- [ ] All endpoints enforce tenant isolation — cross-tenant access returns `404`
- [ ] Worker failure sets `status: "failed"` with `error_message`; does not leave jobs in `running` state permanently

### Remaining stubs

- [ ] `SECEdgarClient.resolveCIK()` queries the real SEC EDGAR tickers endpoint; fabricated CIKs are gone
- [ ] `ChunkEmbedPipeline.storeChunks()` inserts into `semantic_memory`; the log-only path is gone
- [ ] `ReflectionEngine.refine()` calls a real agent; the hardcoded `_refined: true` stub is gone
- [ ] `FinanceExportService.generateExportFile()` returns a real signed URL from real storage; `storage.example.com` is gone
- [ ] `DealAssemblyService.triggerReassembly()` publishes a real event
- [ ] Academy `evaluateResponse` returns LLM-generated scores; hardcoded `75` is gone

---

## Implementation Approach

Execute in this order. Each step is independently mergeable.

1. **Fix TypeScript contract defects** (`R1.1`–`R1.4`)
   - `AgentInitializer.ts`: add `groundtruth` and `compliance-auditor` to `HEALTH_CHECK_QUERIES` and `AGENT_TYPES`
   - `AgentOutputListener.ts`: remove `override` from `listeners`
   - `RateLimitMetricsService.ts`: remove `override` from `CACHE_TTL`; change `BaseService.CACHE_TTL` to `protected` if subclass override is the intent
   - `WorkflowDAGDefinitions.ts`: implement `compensateValueModelingWorkflow` rollback body

2. **Implement `GovernanceError` and update `enforceRules` types** (`R2.3`, `R2.1` types only)
   - Add `GovernanceContext`, `GovernanceDecision`, `GovernanceReasonCode`, `GovernanceObligation` types to `lib/rules.ts`
   - Add `GovernanceError` class to the canonical errors file
   - Update `ActionRouter`'s import and call sites to use the new types

3. **Implement `enforceRules` evaluation engine** (`R2.1` implementation)
   - Implement Layer 1 (hard guards) — synchronous, no I/O
   - Implement Layer 2 (RBAC) — wire to existing permission lookup
   - Implement Layer 3 (workflow-state validation) — wire to Supabase case/proposal state
   - Implement Layer 4 (environment controls)
   - Implement Layer 5 (obligations)
   - Wrap in fail-closed try/catch
   - Write unit tests for all denial paths and the fail-closed path

4. **Update `ActionRouter` to enforce governance decisions** (`R2.2`)
   - Throw `GovernanceError` on deny
   - Apply obligations on allow
   - Map `GovernanceError` to `403` in the Express error handler
   - Write integration tests for blocked and allowed action paths

5. **Implement CRM provider abstraction and real clients** (`R3.1`–`R3.2`)
   - Define `CrmProviderClient` interface
   - Implement `HubSpotClient` with real API calls
   - Implement `SalesforceClient` with OAuth 2.0 and real API calls
   - Update `CRMConnector.fetchWithTimeout` to dispatch by provider
   - Delete `mockHubSpotFetch`
   - Write unit tests with mocked HTTP (no real API calls in CI)

6. **Implement artifact generation pipeline** (`R4.1`–`R4.3`)
   - Write and apply Supabase migration for `artifact_jobs` and `artifacts` tables
   - Implement `POST /api/cases/:caseId/artifacts` handler (validate → persist job → enqueue)
   - Implement the BullMQ worker (load context → invoke `NarrativeAgent` → persist artifact → update job)
   - Add `GET /api/artifact-jobs/:jobId` and `GET /api/cases/:caseId/artifacts/:artifactId`
   - Write integration tests covering the full job lifecycle including failure path

7. **Replace remaining production-path stubs** (`R5.1`–`R5.7`)
   - `SECEdgarClient.resolveCIK` — real SEC EDGAR lookup with Redis cache
   - `ChunkEmbedPipeline.storeChunks` — real Supabase batch insert
   - `ReflectionEngine.refine` — real agent invocation
   - `FinanceExportService.generateExportFile` — real file generation and storage upload
   - `AgentPrefetchService.fetchSimilarDeals` / `fetchObjectionPatterns` — real queries
   - `DealAssemblyService.triggerReassembly` — real event publication
   - Academy `evaluateResponse` — real LLM evaluation
