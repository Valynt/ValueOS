# Agent Hardening Layer

Production-grade reliability, governance, and auditability for the ValueOS agent fabric.

---

## 1. Architecture Diagram (Logical)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         INBOUND REQUEST                                      ║
║          { request_id, trace_id, session_id, user_id, org_id }              ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  LAYER 1 — SAFETY  (AgentSafetyLayer.ts)                                    ║
║                                                                              ║
║  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  ║
║  │  PromptSanitizer    │  │  ToolAccessGuard      │  │  OutputValidator   │  ║
║  │                     │  │                       │  │  (post-execution)  │  ║
║  │  10 OWASP patterns  │  │  Allowlist check      │  │  Zod schema        │  ║
║  │  high  → BLOCK      │  │  Tenant scope guard   │  │  PII detection     │  ║
║  │  medium → REDACT    │  │  Rate limit check     │  │  Error reporting   │  ║
║  │  low   → WARN       │  │  Violation audit log  │  │                    │  ║
║  └─────────────────────┘  └──────────────────────┘  └────────────────────┘  ║
║                                                                              ║
║  verdict: clean | flagged | blocked                                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                         blocked → throw SafetyBlockError
                         flagged → warn + continue
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  LAYER 2 — RESILIENCE  (HardenedAgentRunner.ts)                             ║
║                                                                              ║
║  for attempt in 0..maxRetries:                                               ║
║    withTimeout(timeoutMs) {                                                  ║
║      circuitBreaker.execute(() => agent._execute(context))                   ║
║    }                                                                         ║
║    on timeout / transient error → exponential backoff + jitter              ║
║    on CircuitOpenError          → abort immediately (no retry)              ║
║                                                                              ║
║  Defaults: timeoutMs=30 000  maxRetries=3  baseDelay=1 000  jitter=20%      ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  LAYER 3 — AGENT EXECUTION  (BaseAgent.secureInvoke)                        ║
║                                                                              ║
║  ① Kill switch check (Redis — per-agent key)                                ║
║  ② Tenant context assertion (assertTenantContextMatch)                      ║
║  ③ OTel span creation (agent.secureInvoke)                                  ║
║  ④ LLM call via LLMGateway                                                  ║
║       └─ policy enforcement (model allowlist, budget cap)                   ║
║       └─ circuit breaker + retry at LLM layer (LLMResilience)              ║
║       └─ structured output (response_format: json_schema)                   ║
║  ⑤ Hallucination detection (multi-signal):                                  ║
║       refusal_pattern | fabricated_data | self_reference                    ║
║       confidence_mismatch | internal_contradiction | ungrounded_claim       ║
║       + KnowledgeFabricValidator cross-reference                            ║
║  ⑥ Zod schema validation of LLM response                                   ║
║  ⑦ Evidence mapping enforcement (numeric outputs require evidence_links)    ║
║  ⑧ Reasoning trace persisted → reasoning_traces table                      ║
║  ⑨ Execution lineage persisted → agent_execution_lineage table             ║
║  ⑩ Token usage captured for cost attribution                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  LAYER 4 — GOVERNANCE  (AgentGovernanceLayer.ts)                            ║
║                                                                              ║
║  Step 1 — IntegrityAgent Veto  (when requiresIntegrityVeto=true)            ║
║    • Benchmark deviation check (>15% → veto)                                ║
║    • Structural truth schema validation                                      ║
║    • Confidence penalty applied per issue found                             ║
║    • Fail-open: service unavailable → log + continue                        ║
║                                                                              ║
║  Step 2 — Confidence Threshold Policy                                        ║
║                                                                              ║
║  Risk Tier   │ accept │ review │ block   Verdict                            ║
║  ────────────┼────────┼────────┼──────   ──────────────────────────────     ║
║  financial   │  0.75  │  0.60  │ 0.40    score >= accept  → approved        ║
║  commitment  │  0.70  │  0.55  │ 0.35    review <= score  → pending_human   ║
║  discovery   │  0.55  │  0.40  │ 0.25    score < block    → vetoed          ║
║  narrative   │  0.65  │  0.50  │ 0.30                                        ║
║  compliance  │  0.80  │  0.65  │ 0.45                                        ║
║                                                                              ║
║  Step 3 — Human-in-the-Loop Checkpoint                                       ║
║    • Triggered by: pending_human verdict, requiresHumanApproval=true,       ║
║      or IntegrityAgent re-refine request                                    ║
║    • Writes to ApprovalInbox with checkpoint_id                             ║
║    • Workflow paused until human approves / rejects                         ║
║    • checkpoint_id included in GovernanceDecision for full traceability     ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  LAYER 5 — OBSERVABILITY  (AgentObservabilityLayer.ts)                      ║
║                                                                              ║
║  AgentExecutionLog — one record per invocation, correlated by request_id:   ║
║                                                                              ║
║  Identity       request_id, trace_id, session_id                            ║
║  Actor          user_id, organization_id                                     ║
║  Agent          agent_name, agent_version, lifecycle_stage                  ║
║  Timing         started_at, completed_at, latency_ms                        ║
║  Input          input_summary (PII-redacted)                                ║
║  Output         output_summary (PII-redacted)                               ║
║  Reasoning      reasoning_trace[] — step, assumptions, evidence_refs        ║
║  Tools          tools_used[] — tool_name, latency_ms, success               ║
║  Cost           token_usage { input, output, total, estimated_cost_usd }    ║
║  Confidence     breakdown { overall, evidence_quality, grounding, label }   ║
║  Governance     verdict, decided_by, reason, integrity_issues               ║
║  Safety         verdict, injection_signals, schema_valid, pii_detected      ║
║  Resilience     circuit_breaker_state, retry_count                          ║
║  Status         success|failure|vetoed|pending_review|timeout|circuit_open  ║
║                                                                              ║
║  Emitted to:                                                                 ║
║    1. Structured logger (stdout → log aggregator)                           ║
║    2. OTel span  agent.hardened_execution                                   ║
║    3. reasoning_traces table (via BaseAgent.secureInvoke)                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      HardenedInvokeResult<T>  │
                    │  output          : T           │
                    │  confidence      : Breakdown   │
                    │  governance      : Decision    │
                    │  safety          : ScanResult  │
                    │  token_usage     : TokenUsage  │
                    │  trace_id        : string      │
                    │  attempts        : number      │
                    │  cache_hit       : boolean     │
                    └───────────────────────────────┘
```

---

## 2. File Map

```
packages/backend/src/lib/agent-fabric/hardening/
├── AgentHardeningTypes.ts       # Canonical types: RequestEnvelope, ConfidenceBreakdown,
│                                #   GovernanceDecision, AgentExecutionLog, FailureScenario,
│                                #   CONFIDENCE_THRESHOLDS, FAILURE_RESPONSES
├── AgentSafetyLayer.ts          # PromptSanitizer, ToolAccessGuard, OutputValidator, SafetyLayer
├── AgentGovernanceLayer.ts      # GovernanceLayer, IntegrityVeto adapter, HITL checkpoint writer
├── AgentObservabilityLayer.ts   # ExecutionLogBuilder, ObservabilityLayer, cost estimator
├── HardenedAgentRunner.ts       # Orchestrates all layers; retry + timeout wrapper
├── HardenedDiscoveryAgent.ts    # Reference implementation (canonical hardened agent)
└── HARDENING.md                 # This file
```

Supporting infrastructure (not in this directory):

```
packages/backend/src/lib/agent-fabric/
├── agents/BaseAgent.ts          # Abstract base: secureInvoke, hallucination detection,
│                                #   evidence mapping, kill switch, OTel spans
├── CircuitBreaker.ts            # Re-exports from lib/resilience/CircuitBreaker
├── LLMResilience.ts             # LLM-layer circuit breaker + retry + timeout
├── LLMGateway.ts                # Provider abstraction + policy enforcement + cost tracking
├── AuditLogger.ts               # Immutable audit entries (LLM calls, memory ops, vetoes)
└── KnowledgeFabricValidator.ts  # Semantic memory cross-reference for hallucination detection

packages/backend/src/runtime/policy-engine/
├── tenantGuard.ts               # Tenant isolation enforcement
├── autonomyGuardrails.ts        # Kill switch, duration/cost limits, approval gates
└── hitlGating.ts                # HITL trigger conditions (confidence < 0.6 + external artifact)

packages/backend/src/services/
├── agents/AgentKillSwitchService.ts   # Redis-backed per-agent kill switches
├── policy/AgentPolicyService.ts       # JSON policy files: allowedModels, allowedTools, maxCost
└── tools/ToolRegistry.ts              # MCP-compatible tool registry with auth + rate limiting
```

---

## 3. BaseAgent Contract

### Abstract interface

Every agent in the fabric extends `BaseAgent` and must implement:

```typescript
abstract class BaseAgent {
  // Identity
  readonly name: string;
  readonly version: string;
  readonly lifecycleStage: string;

  // Required implementation
  abstract _execute(context: LifecycleContext): Promise<AgentOutput>;

  // Provided by BaseAgent

  /**
   * The ONLY approved path for LLM calls.
   * Enforces: kill switch → tenant assertion → OTel span → circuit breaker →
   *   LLM call → hallucination detection → Zod validation → evidence mapping →
   *   reasoning trace persistence.
   */
  protected secureInvoke<T>(
    prompt: string,
    context: LifecycleContext,
    options: SecureInvokeOptions<T>
  ): Promise<SecureInvokeResult<T>>;

  /** Builds a standardized AgentOutput with evidence links and metadata. */
  protected buildOutput(
    result: Record<string, unknown>,
    status: AgentOutputStatus,
    confidence: ConfidenceLevel,
    startTime: number,
    extra?: BuildOutputExtra
  ): AgentOutput;

  /** Converts a 0-1 score to a ConfidenceLevel label. */
  protected toConfidenceLevel(score: number): ConfidenceLevel;

  /** Injects a KnowledgeFabricValidator for hallucination cross-reference. */
  setKnowledgeFabricValidator(validator: KnowledgeFabricValidator): void;
}
```

### Hardening contract extensions

When wrapped by `HardenedAgentRunner`, every invocation additionally requires:

```typescript
interface HardenedInvokeOptions {
  outputSchema: z.ZodTypeAny;        // Required — no unvalidated LLM output accepted
  riskTier: RiskTier;                // Required — selects confidence thresholds
  prompt: string;                    // Required — scanned for injection before execution
  timeoutMs?: number;                // Default: 30 000 ms
  maxRetries?: number;               // Default: 3
  requiresIntegrityVeto?: boolean;   // Default: false
  requiresHumanApproval?: boolean;   // Default: false
  toolsRequested?: string[];         // Validated against agent allowlist
  idempotencyKey?: string;           // For deduplication
}

type RiskTier = "financial" | "commitment" | "discovery" | "narrative" | "compliance";
```

Every hardened result carries:

```typescript
interface HardenedInvokeResult<T> {
  output: T;                         // Validated, typed output
  confidence: ConfidenceBreakdown;   // Full breakdown, not just a label
  governance: GovernanceDecision;    // Immutable audit record
  safety: SafetyScanResult;          // Injection + schema + PII results
  token_usage: TokenUsage;           // Input/output tokens + estimated cost USD
  trace_id: string;                  // Links to reasoning_traces row
  attempts: number;                  // Retry count consumed
  cache_hit: boolean;
}
```

### Confidence breakdown

```typescript
interface ConfidenceBreakdown {
  overall: number;                   // Composite score 0-1
  evidence_quality: number;          // Evidence tier contribution
  grounding: number;                 // Hallucination detection score
  model_self_reported?: number;      // LLM self-reported confidence
  integrity_check?: number;          // IntegrityAgent contribution
  label: "very_low" | "low" | "medium" | "high" | "very_high";
}
```

---

## 4. Governance Layer

### IntegrityAgent veto

The `IntegrityAgent` is a first-class agent in the fabric (not just middleware).
It runs the full `secureInvoke` path itself and produces a structured veto decision.

Veto triggers:
- Benchmark deviation > 15% from GroundTruth reference values
- Structural truth schema validation failure
- Evidence gap on high-confidence numeric claims
- Logic errors detected in claim-evidence chains

When vetoed:
1. `GovernanceVetoError` is thrown with `verdict`, `reason`, and `integrity_issues[]`
2. Saga compensation is triggered (ValueLifecycleOrchestrator)
3. Audit entry written with full issue list
4. Human notified via escalation policy

Fail-open behavior: if the IntegrityAgent service is unavailable, the veto check
is skipped with a warning log. The output proceeds with a confidence penalty applied.

### Confidence thresholds

```
Risk Tier    accept   review   block
----------   ------   ------   -----
financial     0.75     0.60    0.40
commitment    0.70     0.55    0.35
discovery     0.55     0.40    0.25
narrative     0.65     0.50    0.30
compliance    0.80     0.65    0.45
```

Threshold selection is deterministic: the `riskTier` declared by the agent maps
directly to the row above. There is no runtime override.

### Human-in-the-loop checkpoints

HITL is triggered when:
- Governance verdict is `pending_human` (confidence between review and accept)
- `requiresHumanApproval: true` is set on the invocation options
- IntegrityAgent requests re-refinement
- Runtime policy engine detects: confidence < 0.6 AND output references external artifact

Checkpoint lifecycle:
1. `HITLCheckpointPort.createCheckpoint()` writes to `ApprovalInbox`
2. Workflow paused — `HardenedInvokeResult` is not returned to caller
3. `checkpoint_id` stored in `GovernanceDecision` for traceability
4. Human approves or rejects via approval UI
5. On approval: result released, workflow resumes
6. On rejection: `GovernanceVetoError` thrown, saga compensation triggered

---

## 5. Observability

### What is logged per invocation

Every call through `HardenedAgentRunner.run()` produces one `AgentExecutionLog`
record. The record is:

1. **Emitted to structured logger** — JSON, stdout → log aggregator (Loki / CloudWatch)
2. **Attached to OTel span** — span name `agent.hardened_execution`, attributes
   include `agent.name`, `agent.version`, `request_id`, `governance.verdict`,
   `safety.verdict`, `confidence.overall`, `latency_ms`, `cost_usd`
3. **Persisted to `reasoning_traces` table** — via `BaseAgent.secureInvoke`

### Correlation

Every log record and OTel span carries:
- `request_id` — top-level user request ID (set at API boundary)
- `trace_id` — OTel trace ID (may equal `request_id` for root spans)
- `session_id` — authenticated user session
- `organization_id` — tenant isolation key

These four IDs allow any execution to be reconstructed from any of the three
storage backends.

### Cost attribution

Token usage is captured from the LLM response and enriched with a USD estimate
using the static `MODEL_PRICING` table in `AgentObservabilityLayer.ts`.
Update that table when provider rates change.

Prometheus metrics also track cumulative cost:
- `agent_fabric_cost_usd_total{agent, tenant, model}`
- `agent_fabric_token_usage_total{agent, tenant, model, type}`

---

## 6. Safety

### Prompt injection protection

The `PromptSanitizer` scans every prompt before the LLM call. It covers
OWASP LLM Top 10 categories LLM01 (Prompt Injection) and LLM02 (Insecure Output).

| Pattern ID                  | Severity | Description                                  |
|-----------------------------|----------|----------------------------------------------|
| `role_override`             | high     | Override system instructions                 |
| `new_instructions`          | high     | Inject new instruction block                 |
| `jailbreak_dan`             | high     | Known jailbreak patterns (DAN, etc.)         |
| `exfiltrate_env`            | high     | Extract secrets / credentials                |
| `exfiltrate_system`         | high     | Extract internal infrastructure details      |
| `indirect_injection_marker` | high     | Injection markers in external content        |
| `delimiter_abuse`           | medium   | Model-specific delimiter injection           |
| `base64_instruction`        | medium   | Base64-encoded instruction smuggling         |
| `persona_switch`            | medium   | Persona / role switching attempts            |
| `token_flood`               | low      | Excessive repetition (token flooding)        |

**High severity** → execution blocked, `SafetyBlockError` thrown, security event emitted.
**Medium severity** → matched text redacted, execution continues with `flagged` verdict.
**Low severity** → warning logged, execution continues with `clean` verdict.

### Tool access restrictions

The `ToolAccessGuard` enforces:
1. **Allowlist** — tool name must be in the agent's declared `allowedTools` set
2. **Tenant scope** — tool call must not cross tenant boundaries
3. **Rate limit** — per-tool sliding window enforced by `ToolRegistry`

Violations throw `PermissionDeniedError` and emit a security audit event.

### Output validation

After every LLM call, `OutputValidator` runs:
1. Strict JSON parse (no partial objects)
2. Zod schema validation against the declared `outputSchema`
3. PII scan on all string fields (email, SSN, phone, credit card patterns)

Schema failures trigger a schema-repair retry (up to `maxRetries`). PII
detection triggers redaction before the result is stored or returned.

---

## 7. Failure Scenarios

| Scenario                     | System Action                                                              | Partial Result | Audited | Human Notified |
|------------------------------|----------------------------------------------------------------------------|:--------------:|:-------:|:--------------:|
| `llm_timeout`                | Retry with exponential backoff (max 3). All fail → `status=timeout`.      | No             | Yes     | No             |
| `circuit_open`               | Abort immediately. No LLM call. Re-evaluates after cooldown.              | No             | Yes     | No             |
| `schema_validation_failed`   | Retry with schema-repair prompt. Still invalid → veto + violation log.    | No             | Yes     | No             |
| `confidence_below_block`     | Block output. Return failure. Log confidence breakdown.                    | No             | Yes     | Yes            |
| `confidence_below_accept`    | Route to HITL review queue. Workflow paused until approved.               | No             | Yes     | Yes            |
| `integrity_veto`             | IntegrityAgent blocks output. Saga compensation triggered.                | No             | Yes     | Yes            |
| `human_approval_required`    | Output queued in ApprovalInbox. Escalation policy notified.               | No             | Yes     | Yes            |
| `prompt_injection_detected`  | High → block. Medium → sanitize + warn. Security event emitted.           | No             | Yes     | Yes (high)     |
| `tool_access_denied`         | `PermissionDeniedError` thrown. Security audit event emitted.             | No             | Yes     | No             |
| `tenant_mismatch`            | Abort immediately. Critical security audit event.                         | No             | Yes     | Yes            |
| `kill_switch_active`         | Block execution. `KillSwitchError` thrown.                                | No             | Yes     | No             |
| `evidence_mapping_violation` | `EvidenceMappingError` thrown. CFO-defensibility gate enforced.           | No             | Yes     | Yes            |

All failure scenarios produce zero partial results. The system never returns
an unvalidated or partially-validated output to callers.

---

## 8. Adding Hardening to an Existing Agent

1. **Declare an output schema** — add a `z.ZodObject` covering all fields the
   agent returns. Include `hallucination_check: z.boolean()` for traceability.

2. **Declare allowed tools** — create a `ReadonlySet<string>` of tool names the
   agent may invoke. Be minimal — only tools the agent actually needs.

3. **Choose a risk tier** — `financial`, `commitment`, `discovery`, `narrative`,
   or `compliance`. This selects the confidence thresholds. When in doubt,
   use `commitment` (conservative defaults).

4. **Instantiate `HardenedAgentRunner`** — pass `agentName`, `agentVersion`,
   `lifecycleStage`, `organizationId`, `allowedTools`, and `riskTier`.

5. **Call `runner.run()`** — pass the `RequestEnvelope`, `LifecycleContext`,
   the agent's `execute` method, and `HardenedInvokeOptions` (including `prompt`
   and `outputSchema`).

6. **Handle `GovernanceVetoError`** — callers must handle this error type.
   It carries `verdict`, `reason`, and optional `checkpointId`.

See `HardenedDiscoveryAgent.ts` for the complete reference implementation.

---

## 9. Security Invariants

These invariants must never be violated. Any PR that breaks them must be rejected.

1. **No raw LLM output reaches callers.** All output passes Zod schema validation
   before being returned. `OutputComplianceEngine` is not optional.

2. **No cross-tenant data access.** `assertTenantContextMatch` runs before every
   LLM call. Tenant mismatch aborts execution immediately.

3. **No unscanned prompts.** `PromptSanitizer` runs before every LLM call.
   High-severity injection signals block execution — they are never logged and
   forwarded.

4. **No numeric output without evidence links.** `EvidenceMappingError` is thrown
   when a high-confidence numeric output lacks `evidence_links`. This is the
   CFO-defensibility gate.

5. **No agent bypasses the kill switch.** `agentKillSwitchService.isKilled()`
   is checked inside `secureInvoke` before every LLM call. Kill switches are
   Redis-backed and take effect within one TTL cycle.

6. **No governance decision is mutable.** `GovernanceDecision` objects are
   written once and never updated. Audit entries are append-only.

7. **No secrets in logs.** `redactSensitiveText` runs on all string values
   before they are written to `AgentExecutionLog`. PII patterns are scanned
   on LLM output before storage.

---

## 10. Test Coverage

Unit tests live in `hardening/__tests__/`. Run with:

```bash
pnpm --filter backend test -- src/lib/agent-fabric/hardening/__tests__
```

| Test file                          | What it covers                                                      |
|------------------------------------|---------------------------------------------------------------------|
| `AgentSafetyLayer.test.ts`         | All 10 injection patterns, tool access guard, output validator, PII detection, SafetyLayer integration |
| `AgentGovernanceLayer.test.ts`     | `evaluateConfidence` for all 5 risk tiers, IntegrityAgent veto, HITL checkpoint, fail-open behavior |
| `HardenedAgentRunner.test.ts`      | Full 5-layer stack: injection blocking, tool violations, timeout, retry, circuit breaker abort, governance verdicts, observability log emission on every path |

---

## 11. Gap Fixes Applied

The following issues were identified and corrected during the hardening audit:

### CircuitOpenError detection (HardenedAgentRunner.ts)

**Before:** Circuit open was detected via `err.message.includes("circuit")` — fragile string matching that could produce false positives or miss errors with different messages.

**After:** `CircuitOpenError` is imported from `lib/resilience.ts` and detected via `instanceof`. This is type-safe and immune to message string changes.

### GovernanceVetoError location (AgentHardeningTypes.ts)

**Before:** `GovernanceVetoError` was defined at the bottom of `HardenedAgentRunner.ts`, forcing callers to import the full runner module just to catch the error type.

**After:** `GovernanceVetoError` is defined in `AgentHardeningTypes.ts` (the canonical types file) and re-exported from both `HardenedAgentRunner.ts` and `index.ts` for backward compatibility. Callers can now import it from the types file without pulling in runner dependencies.

### Missing test coverage

**Before:** No unit tests existed for any of the five hardening layers.

**After:** Three test files added covering safety, governance, and the full runner stack (see section 10).
