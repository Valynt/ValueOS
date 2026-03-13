# Spec: Valynt Memory Layer (VML) — Gap Implementation

**Project Code Name:** Mnemonic-GTM  
**Status:** Draft  
**Owner:** Agentic Architect  
**Scope:** Fill the gaps in the existing `packages/memory` architecture. Existing Tier 1, Tier 3, and Tier 4 foundations are retained and extended, not replaced.

---

## 1. Problem Statement

The `packages/memory` package has a working foundation for Tier 1 (SessionContextLedger), Tier 3 (SemanticMemory + VectorMemory), and partial Tier 4 (ProvenanceTracker). Four gaps block the VML from being production-ready for B2B GTM use cases:

1. **No Entity Graph (Tier 2).** Account→KPI→NPV dependency chains are not tracked as a memory tier. A 1% churn change in one region cannot propagate to a global NPV recalculation because the dependency map does not exist.
2. **No Veto Controller.** Agents can commit financially invalid scenarios (negative churn, IRR > 500%, NPV deviation > 20% without justification) with no guardrail.
3. **No financial override audit trail.** `AuditLogger` is an empty stub. Every financial assumption change must be bound to an `auth0_id` for compliance.
4. **No MCP write interface.** External tools (Salesforce, Gong) have no defined contract for writing entity data into Tier 2.

---

## 2. Architecture Baseline

### What exists (do not replace)

| Component | Location | Maps to |
|---|---|---|
| `SessionContextLedger` | `packages/memory/context-ledger/` | Tier 1 — Redis, 24h TTL, scratchpad |
| `SemanticMemory` | `packages/memory/semantic/` | Tier 3 — facts, contradiction detection, `evidenceTier` 1/2/3 |
| `VectorMemory` | `packages/memory/vector/` | Tier 3 — hybrid search (70/30 vector/BM25), provenance attachment |
| `EpisodicMemory` | `packages/memory/episodic/` | Tier 3 — immutable interaction history, importance-weighted retrieval |
| `ProvenanceTracker` | `packages/memory/provenance/` | Tier 4 partial — append-only lineage, CFO Defence |
| `MemoryLifecycle` | `packages/memory/lifecycle/` | Cross-cutting — TTL, consolidation, promotion |

### Evidence tier naming (canonical)

The codebase uses `silver | gold | platinum` string enum (domain layer) and numeric `1 | 2 | 3` (provenance layer). Both are correct and map as follows:

| String | Numeric | Source | Agent write permission |
|---|---|---|---|
| `silver` | `3` | Agent inference, unverified | Writable by agents |
| `gold` | `2` | CRM/Salesforce opportunity data | Writable by agents with `source_url` |
| `platinum` | `1` | Finalized ERP/Audit data | **Read-only for agents** — requires human or MCP write |

---

## 3. Requirements

### 3.1 Tier 2 — Entity Graph (KPI Dependency Map)

**Goal:** Track how a change to one financial assumption propagates to downstream KPIs and the global NPV/IRR.

**Approach:** Extend existing domain tables rather than creating a standalone graph database.

#### New DB table: `kpi_dependencies`

```sql
kpi_dependencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,          -- tenant isolation
  value_case_id   uuid NOT NULL,
  source_node_id  uuid NOT NULL,          -- references value_tree_nodes.id
  target_node_id  uuid NOT NULL,          -- references value_tree_nodes.id
  dependency_type text NOT NULL,          -- 'churn_to_npv' | 'arpu_to_irr' | 'headcount_to_cost' | 'custom'
  weight          numeric(5,4) NOT NULL,  -- sensitivity coefficient (0–1)
  formula         text,                   -- optional formula string for audit
  evidence_tier   smallint NOT NULL,      -- 1 (platinum) | 2 (gold) | 3 (silver)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
)
```

RLS: standard four-policy pattern using `security.user_has_tenant_access(organization_id)`.

#### New TypeScript class: `EntityGraph`

Location: `packages/memory/entity-graph/index.ts`

Interface:

```typescript
export interface DependencyNode {
  nodeId: string;
  nodeType: 'kpi' | 'assumption' | 'npv' | 'irr' | 'churn' | 'arpu' | 'custom';
  label: string;
  currentValue: number;
  unit: string;
  evidenceTier: 1 | 2 | 3;
}

export interface KpiDependency {
  id: string;
  organizationId: string;
  valueCaseId: string;
  sourceNodeId: string;
  targetNodeId: string;
  dependencyType: string;
  weight: number;
  formula?: string;
  evidenceTier: 1 | 2 | 3;
}

export interface PropagationResult {
  affectedNodes: Array<{ nodeId: string; label: string; delta: number; newValue: number }>;
  npvDelta: number;
  irrDelta: number;
  propagationPath: string[];
}

export class EntityGraph {
  addDependency(input: Omit<KpiDependency, 'id'>): Promise<KpiDependency>;
  getDependencies(organizationId: string, valueCaseId: string): Promise<KpiDependency[]>;
  propagateChange(
    organizationId: string,
    valueCaseId: string,
    sourceNodeId: string,
    delta: number,
  ): Promise<PropagationResult>;
}
```

`propagateChange` walks the dependency graph from the changed node, applies `weight * delta` at each hop, and returns the full propagation path. This is the mechanism that answers "a 1% churn increase in Region X impacts global NPV by $Y."

**Platinum-tier protection:** `addDependency` must reject writes where the source node has `evidenceTier = 1` (platinum) and the caller is an agent (not a human or MCP write). Agents may read platinum nodes but not overwrite them.

---

### 3.2 Veto Controller — Financial Guardrail

**Goal:** Block agents from committing financially invalid scenarios. Force evidence escalation when thresholds are breached.

#### Location

`packages/memory/veto/index.ts`

#### Veto triggers

Three triggers, configurable per lifecycle stage:

| Trigger | Default threshold | Configurable per stage |
|---|---|---|
| Churn rate | `< 0%` | Yes |
| IRR | `> 500%` (non-seed) | Yes — seed-stage orgs may override |
| NPV session deviation | `> 20%` from previous session without justification narrative | Yes |

#### Stage-configurable thresholds

```typescript
export interface VetoThresholds {
  minChurnRate: number;               // default: 0
  maxIrrPercent: number;              // default: 500
  maxNpvDeviationPercent: number;     // default: 20
  allowSeedStageIrrOverride: boolean; // default: false
}

export type VetoStageConfig = Partial<Record<LifecycleStage, VetoThresholds>>;
```

Thresholds are stored in a new `veto_stage_config` table (per `organization_id` + `lifecycle_stage`). A `DEFAULT_VETO_THRESHOLDS` constant provides the fallback when no row exists.

#### Veto outcome

```typescript
export type VetoDecision = 'pass' | 'veto' | 'warn';

export interface VetoResult {
  decision: VetoDecision;
  triggeredRules: VetoRule[];
  requiredEvidenceTier: 1 | 2 | 3 | null; // null when decision is 'pass'
  justificationRequired: boolean;
  message: string;
}

export interface VetoRule {
  ruleId: string;
  trigger: 'churn_negative' | 'irr_exceeded' | 'npv_deviation';
  observedValue: number;
  thresholdValue: number;
  severity: 'warn' | 'block';
}
```

When `decision === 'veto'`, the agent **must not** commit the financial scenario. It must surface `requiredEvidenceTier` to the user and request supporting evidence before retrying.

#### Integration point

`VetoController.check(params)` is called inside `FinancialModelingAgent.execute()` after the LLM produces cash flow projections, before `FinancialModelSnapshotRepository.save()`. If vetoed, the agent returns an `AgentOutput` with `status: 'veto'` and the `VetoResult` in `metadata`.

---

### 3.3 AuditLogger — Financial Override Audit Trail

**Goal:** Every financial assumption change must be bound to an `auth0_id` and written to an immutable append-only log.

#### New DB table: `financial_audit_log`

```sql
financial_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  value_case_id   uuid NOT NULL,
  auth0_id        text NOT NULL,          -- Auth0 sub claim
  session_id      uuid NOT NULL,
  agent_id        text NOT NULL,
  action          text NOT NULL,          -- 'assumption_change' | 'veto_override' | 'evidence_upgrade' | 'npv_commit'
  field_path      text NOT NULL,          -- e.g. 'cash_flows[0].discount_rate'
  previous_value  jsonb,
  new_value       jsonb NOT NULL,
  evidence_tier   smallint NOT NULL,
  veto_result     jsonb,                  -- populated when action = 'veto_override'
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

This table is **append-only**. No `UPDATE` or `DELETE` RLS policies. `INSERT` requires `auth0_id` to be non-null.

#### TypeScript class: `AuditLogger` (replace stub)

Location: `packages/backend/src/lib/agent-fabric/AuditLogger.ts`

```typescript
export interface FinancialAuditEntry {
  organizationId: string;
  valueCaseId: string;
  auth0Id: string;
  sessionId: string;
  agentId: string;
  action: 'assumption_change' | 'veto_override' | 'evidence_upgrade' | 'npv_commit';
  fieldPath: string;
  previousValue?: unknown;
  newValue: unknown;
  evidenceTier: 1 | 2 | 3;
  vetoResult?: VetoResult;
}

export class AuditLogger {
  async logFinancialChange(entry: FinancialAuditEntry): Promise<void>;
  async getAuditTrail(organizationId: string, valueCaseId: string): Promise<FinancialAuditEntry[]>;
}
```

`logFinancialChange` validates with Zod, then inserts into `financial_audit_log`. It never throws on insert failure — it logs the error and continues, so a DB hiccup does not block the agent pipeline. However, it emits a `financial_audit_write_failure_total` Prometheus counter so the condition is observable.

---

### 3.4 MCP Write Interface — Stub

**Goal:** Define the contract for external tools (Salesforce, Gong) to write entity data into Tier 2. Implementation is deferred; the interface must be stable.

#### Location

`packages/mcp/src/tools/memory-write/index.ts`

#### Interface contract

```typescript
export interface McpMemoryWriteInput {
  organizationId: string;
  auth0Id: string;           // the human who authorized the write
  source: 'salesforce' | 'gong' | 'erp' | 'manual';
  entityType: 'account' | 'opportunity' | 'kpi' | 'assumption';
  entityId: string;
  payload: Record<string, unknown>;
  evidenceTier: 1 | 2 | 3;  // caller declares tier; system validates
}

export interface McpMemoryWriteResult {
  success: boolean;
  nodeId?: string;
  auditLogId?: string;
  error?: string;
}

// Stub implementation — throws NotImplementedError
export class McpMemoryWriteTool implements Tool<McpMemoryWriteInput, McpMemoryWriteResult> {
  readonly name = 'memory_write';
  readonly description = 'Write entity data from external CRM/ERP tools into the Entity Graph (Tier 2)';
  async execute(_input: McpMemoryWriteInput): Promise<McpMemoryWriteResult> {
    throw new Error('McpMemoryWriteTool: not yet implemented (Mnemonic-GTM Phase 4)');
  }
}
```

Register `McpMemoryWriteTool` statically in `ToolRegistry.ts` so it appears in tool discovery. The stub surfaces a clear error rather than silently failing.

---

## 4. Acceptance Criteria

### Tier 2 — Entity Graph

- [ ] `kpi_dependencies` table exists with RLS enabled and all four standard policies
- [ ] `EntityGraph.addDependency()` rejects agent writes to platinum-tier source nodes
- [ ] `EntityGraph.propagateChange()` returns correct `npvDelta` for a single-hop dependency (unit test)
- [ ] `EntityGraph.propagateChange()` returns correct `npvDelta` for a two-hop dependency chain (unit test)
- [ ] All queries include `organization_id` filter (tenant isolation)

### Veto Controller

- [ ] `VetoController.check()` returns `decision: 'veto'` when churn < 0%
- [ ] `VetoController.check()` returns `decision: 'veto'` when IRR > 500% and `allowSeedStageIrrOverride: false`
- [ ] `VetoController.check()` returns `decision: 'pass'` when IRR > 500% and `allowSeedStageIrrOverride: true`
- [ ] `VetoController.check()` returns `decision: 'veto'` when NPV deviates > 20% from previous session without justification
- [ ] `VetoController.check()` returns `decision: 'warn'` when NPV deviates > 20% and a justification narrative is present
- [ ] `FinancialModelingAgent` calls `VetoController.check()` before committing a snapshot
- [ ] A vetoed agent run returns `status: 'veto'` in `AgentOutput` (not an unhandled error)
- [ ] Stage-specific thresholds override defaults when a `veto_stage_config` row exists

### AuditLogger

- [ ] `AuditLogger.logFinancialChange()` inserts a row into `financial_audit_log` with non-null `auth0_id`
- [ ] Insert failure increments `financial_audit_write_failure_total` counter and does not throw
- [ ] `financial_audit_log` has no `UPDATE` or `DELETE` RLS policies
- [ ] `AuditLogger.getAuditTrail()` filters by `organization_id` (tenant isolation)
- [ ] `FinancialModelingAgent` calls `AuditLogger.logFinancialChange()` on every NPV commit

### MCP Write Stub

- [ ] `McpMemoryWriteTool` is registered in `ToolRegistry.ts`
- [ ] Calling `execute()` throws with a message referencing Mnemonic-GTM Phase 4
- [ ] Tool appears in tool discovery output

### Cross-cutting

- [ ] `pnpm run test:rls` passes for `kpi_dependencies` and `financial_audit_log`
- [ ] Hallucination rate on NPV/IRR calculations remains < 1% (measured via existing `valueLoopMetrics`)
- [ ] Semantic retrieval from Tier 3 remains < 400ms (no regression from new Tier 2 queries)

---

## 5. Implementation Plan

Steps are ordered by dependency. Each step is independently mergeable.

1. **DB migration: `kpi_dependencies` table**  
   New migration file. Enable RLS. Four standard policies. Rollback file.

2. **DB migration: `financial_audit_log` table**  
   Append-only. INSERT-only RLS. No UPDATE/DELETE policies. Rollback file.

3. **DB migration: `veto_stage_config` table**  
   Stores per-org, per-stage threshold overrides. RLS. Seed default row.

4. **`EntityGraph` class + `KpiDependencyRepository`**  
   `packages/memory/entity-graph/index.ts`. Platinum-tier write guard. `propagateChange` BFS traversal. Co-located unit tests.

5. **`VetoController` class**  
   `packages/memory/veto/index.ts`. Three trigger rules. Stage-config lookup. Zod-validated output. Co-located unit tests covering all pass/warn/veto branches.

6. **`AuditLogger` implementation (replace stub)**  
   `packages/backend/src/lib/agent-fabric/AuditLogger.ts`. Zod validation. Prometheus counter. Co-located unit tests with mocked Supabase.

7. **Wire `VetoController` into `FinancialModelingAgent`**  
   Call `check()` after LLM output, before snapshot save. Return `status: 'veto'` on block. Call `AuditLogger.logFinancialChange()` on NPV commit.

8. **`McpMemoryWriteTool` stub + `ToolRegistry` registration**  
   `packages/mcp/src/tools/memory-write/index.ts`. Static registration. NotImplementedError.

9. **Export `EntityGraph` and `VetoController` from `packages/memory/index.ts`**  
   Update public API barrel.

10. **Update context layer**  
    - `traceability.md`: add Tier 2 row for `kpi_dependencies`  
    - `decisions.md`: add undocumented decision for VetoController thresholds  
    - `debt.md`: mark MCP write as deferred (Phase 4)

---

## 6. Out of Scope

- Replacing existing Tier 1, Tier 3, or Tier 4 implementations
- Auth0 namespace isolation (per-user scratchpad partitioning within a tenant) — audit log only
- MCP write implementation (stub interface only)
- LLM provider changes (Together.ai remains the only provider per ADR undocumented decision)
- Frontend UI for the Veto Controller (surfacing `status: 'veto'` in the existing `IntegrityStage` is a follow-on task)

---

## 7. Key File Pointers

| File | Role |
|---|---|
| `packages/memory/context-ledger/index.ts` | Tier 1 — do not modify |
| `packages/memory/semantic/index.ts` | Tier 3 — do not modify |
| `packages/memory/vector/index.ts` | Tier 3 — do not modify |
| `packages/memory/provenance/index.ts` | Tier 4 — do not modify |
| `packages/memory/entity-graph/index.ts` | **New** — Tier 2 |
| `packages/memory/veto/index.ts` | **New** — Veto Controller |
| `packages/backend/src/lib/agent-fabric/AuditLogger.ts` | **Replace stub** |
| `packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts` | Wire veto + audit |
| `packages/mcp/src/tools/memory-write/index.ts` | **New stub** |
| `packages/backend/src/services/ToolRegistry.ts` | Register MCP stub |
| `infra/supabase/supabase/migrations/` | New migration files (steps 1–3) |
