# Agent Hardening Layer

Production-grade reliability, governance, and auditability for the ValueOS agent fabric.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          INBOUND REQUEST                                     │
│                    { request_id, trace_id, session_id }                      │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  SAFETY LAYER  (AgentSafetyLayer.ts)                                         │
│                                                                              │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │  PromptSanitizer    │  │  ToolAccessGuard      │  │  OutputValidator   │  │
│  │                     │  │                       │  │                    │  │
│  │  • 10 injection     │  │  • Allowlist check    │  │  • Zod schema      │  │
│  │    pattern checks   │  │  • Tenant scope       │  │  • PII detection   │  │
│  │  • Context scan     │  │  • Rate limit         │  │  • Error paths     │  │
│  │  • High → BLOCK     │  │  • Violation log      │  │    reported        │  │
│  │  • Medium → REDACT  │  │                       │  │                    │  │
│  └─────────────────────┘  └──────────────────────┘  └────────────────────┘  │
│                                                                              │
│  verdict: clean | flagged | blocked                                          │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ (blocked → throw, flagged → warn + continue)
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  RESILIENCE LAYER  (HardenedAgentRunner.ts)                                  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  for attempt in 0..maxRetries:                                       │   │
│  │    withTimeout(timeoutMs) {                                          │   │
│  │      circuitBreaker.execute(() => agent._execute(context))           │   │
│  │    }                                                                 │   │
│  │    on timeout/transient error → exponential backoff + jitter        │   │
│  │    on CircuitOpenError → abort immediately (no retry)               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Config: timeoutMs=30 000, maxRetries=3, baseDelay=1 000, jitter=20%        │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  AGENT EXECUTION  (BaseAgent.secureInvoke)                                   │
│                                                                              │
│  • Kill switch check (Redis)                                                 │
│  • Tenant context assertion                                                  │
│  • OTel span creation                                                        │
│  • LLM call via LLMGateway (circuit breaker + retry at LLM layer)           │
│  • Hallucination detection (multi-signal + KnowledgeFabric)                 │
│  • Zod schema validation of LLM response                                    │
│  • Reasoning trace persisted to reasoning_traces table                      │
│  • Evidence mapping enforcement (numeric outputs need evidence links)        │
│  • Token usage captured                                                      │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  GOVERNANCE LAYER  (AgentGovernanceLayer.ts)                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Step 1: IntegrityAgent Veto (when requiresIntegrityVeto=true)       │   │
│  │    • Benchmark deviation check (>15% → veto)                        │   │
│  │    • Structural truth schema validation                              │   │
│  │    • Confidence penalty applied on issues found                     │   │
│  │    • Fail-open: service unavailable → log + continue                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Step 2: Confidence Threshold Policy                                 │   │
│  │                                                                      │   │
│  │  Risk Tier    │ accept │ review │ block                              │   │
│  │  ─────────────┼────────┼────────┼──────                             │   │
│  │  financial    │  0.75  │  0.60  │ 0.40                              │   │
│  │  commitment   │  0.70  │  0.55  │ 0.35                              │   │
│  │  discovery    │  0.55  │  0.40  │ 0.25                              │   │
│  │  narrative    │  0.65  │  0.50  │ 0.30                              │   │
│  │  compliance   │  0.80  │  0.65  │ 0.45                              │   │
│  │                                                                      │   │
│  │  score ≥ accept  → approved                                         │   │
│  │  review ≤ score < accept → pending_human (HITL)                     │   │
│  │  score < block   → vetoed                                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Step 3: Human-in-the-Loop Checkpoint                                │   │
│  │    • Triggered by: pending_human verdict, requiresHumanApproval,    │   │
│  │      or IntegrityAgent re-refine request                            │   │
│  │    • Writes to ApprovalInbox with checkpoint_id                     │   │
│  │    • Workflow paused until human approves/rejects                   │   │
│  │    • checkpoint_id included in GovernanceDecision for traceability  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  OBSERVABILITY LAYER  (AgentObservabilityLayer.ts)                           │
│                                                                              │
│  AgentExecutionLog (per invocation):                                         │
│    request_id, trace_id, session_id          ← correlation                  │
│    agent_name, agent_version, lifecycle_stage                                │
│    organization_id, user_id                  ← tenant + actor                │
│    started_at, completed_at, latency_ms      ← timing                       │
│    input_summary (PII-redacted)              ← sanitized input               │
│    output_summary                            ← sanitized output              │
│    reasoning_trace[]                         ← step-by-step reasoning        │
│    tools_used[]                              ← tool name + latency           │
│    token_usage + estimated_cost_usd          ← cost attribution              │
│    confidence (breakdown)                    ← explainability                │
│    governance (verdict + reason)             ← decision audit trail          │
│    safety (verdict + signals)                ← security audit trail          │
│    circuit_breaker_state, retry_count        ← resilience state              │
│    status: success|failure|vetoed|pending_review|timeout|circuit_open        │
│                                                                              │
│  Emitted to:                                                                 │
│    1. Structured logger (stdout → log aggregator)                            │
│    2. OTel span (agent.hardened_execution)                                   │
│    3. reasoning_traces table (via BaseAgent.secureInvoke)                    │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  HardenedInvokeResult │
                    │  { output, confidence,│
                    │    governance, safety,│
                    │    token_usage,       │
                    │    trace_id }         │
                    └───────────────────────┘
```

---

## File Map

```
packages/backend/src/lib/agent-fabric/hardening/
├── AgentHardeningTypes.ts       # Shared types: RequestEnvelope, ConfidenceBreakdown,
│                                #   GovernanceDecision, AgentExecutionLog, FailureScenario
├── AgentSafetyLayer.ts          # PromptSanitizer, ToolAccessGuard, OutputValidator, SafetyLayer
├── AgentGovernanceLayer.ts      # GovernanceLayer, IntegrityVeto adapter, HITL checkpoint writer
├── AgentObservabilityLayer.ts   # ExecutionLogBuilder, ObservabilityLayer, cost estimator
├── HardenedAgentRunner.ts       # Orchestrates all layers; retry + timeout wrapper
├── HardenedDiscoveryAgent.ts    # Reference implementation (example hardened agent)
└── HARDENING.md                 # This file
```

---

## BaseAgent Contract Extensions

The hardening layer does not modify `BaseAgent` directly. It wraps it via
`HardenedAgentRunner.run()`. The contract extensions are:

```typescript
// Every hardened invocation requires:
interface HardenedInvokeOptions {
  outputSchema: z.ZodTypeAny;          // Required — no unvalidated LLM output
  riskTier: string;                    // Required — selects confidence thresholds
  timeoutMs?: number;                  // Default: 30 000 ms
  maxRetries?: number;                 // Default: 3
  requiresIntegrityVeto?: boolean;     // Default: false
  requiresHumanApproval?: boolean;     // Default: false
  idempotencyKey?: string;             // For deduplication
}

// Every hardened result includes:
interface HardenedInvokeResult<T> {
  output: T;                           // Validated, typed output
  confidence: ConfidenceBreakdown;     // Full breakdown, not just a label
  governance: GovernanceDecision;      // Immutable audit record
  safety: SafetyScanResult;            // Injection + schema + PII results
  token_usage: TokenUsage;             // Input/output tokens + cost USD
  trace_id: string;                    // Links to reasoning_traces row
  attempts: number;                    // Retry count
  cache_hit: boolean;
}
```

---

## Failure Scenarios

| Scenario | System Action | Audited | Human Notified |
|---|---|---|---|
| `llm_timeout` | Retry with backoff (max 3). If all fail → `status=timeout`. | ✅ | ❌ |
| `circuit_open` | Abort immediately. No LLM call. Re-evaluates after cooldown. | ✅ | ❌ |
| `schema_validation_failed` | Retry with schema-repair prompt. If still invalid → veto. | ✅ | ❌ |
| `confidence_below_block` | Block output. Return failure. Log confidence breakdown. | ✅ | ✅ |
| `confidence_below_accept` | Route to HITL review queue. Workflow paused. | ✅ | ✅ |
| `integrity_veto` | IntegrityAgent blocks output. Saga compensation triggered. | ✅ | ✅ |
| `human_approval_required` | Output queued in ApprovalInbox. Escalation policy notified. | ✅ | ✅ |
| `prompt_injection_detected` | High severity → block. Medium → sanitize + warn. | ✅ | ✅ (high) |
| `tool_access_denied` | `PermissionDeniedError` thrown. Security audit event emitted. | ✅ | ❌ |
| `tenant_mismatch` | Abort immediately. Critical security audit event. | ✅ | ✅ |
| `kill_switch_active` | Block execution. `KillSwitchError` thrown. | ✅ | ❌ |
| `evidence_mapping_violation` | `EvidenceMappingError` thrown. CFO-defensibility gate enforced. | ✅ | ✅ |

---

## Adding Hardening to an Existing Agent

1. **Declare an output schema** — add a `z.ZodObject` that matches the agent's
   `result` field. Include `hallucination_check: z.boolean()`.

2. **Declare allowed tools** — create a `ReadonlySet<string>` of tool names the
   agent may invoke.

3. **Choose a risk tier** — `financial`, `commitment`, `discovery`, `narrative`,
   or `compliance`. This selects the confidence thresholds.

4. **Instantiate `HardenedAgentRunner`** — pass the agent's name, version,
   lifecycle stage, organization ID, allowed tools, and risk tier.

5. **Call `runner.run()`** — pass the `RequestEnvelope`, `LifecycleContext`,
   the agent's `execute` method, and `HardenedInvokeOptions`.

6. **Handle `GovernanceVetoError`** — callers must handle this error type.
   It carries the verdict, reason, and optional checkpoint ID.

See `HardenedDiscoveryAgent.ts` for the complete reference implementation.

---

## Confidence Thresholds by Risk Tier

```
financial:   accept=0.75  review=0.60  block=0.40
commitment:  accept=0.70  review=0.55  block=0.35
discovery:   accept=0.55  review=0.40  block=0.25
narrative:   accept=0.65  review=0.50  block=0.30
compliance:  accept=0.80  review=0.65  block=0.45
```

Thresholds align with the ranges in `docs/AGENTS.md`:
- Financial: 0.7–0.9
- Commitment: 0.6–0.85
- Discovery: 0.5–0.8

---

## Injection Pattern Coverage

The `PromptSanitizer` covers OWASP LLM Top 10 categories LLM01 and LLM02:

| Pattern ID | Severity | Description |
|---|---|---|
| `role_override` | high | Attempts to override system instructions |
| `new_instructions` | high | Injects new instruction block |
| `jailbreak_dan` | high | Known jailbreak patterns (DAN, etc.) |
| `exfiltrate_env` | high | Attempts to extract secrets/credentials |
| `exfiltrate_system` | high | Attempts to extract infrastructure details |
| `indirect_injection_marker` | high | Injection markers in external content |
| `delimiter_abuse` | medium | Model-specific delimiter injection |
| `base64_instruction` | medium | Base64-encoded instruction smuggling |
| `persona_switch` | medium | Persona/role switching attempts |
| `token_flood` | low | Excessive repetition (token flooding) |

High-severity signals block execution entirely. Medium signals redact the
matched text and continue with a `flagged` verdict.
