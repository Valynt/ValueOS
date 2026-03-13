# Enterprise Agent Audit — Specification

**Scope:** Internal engineering spec for remediation sprint planning
**Compliance targets:** SOC 2 Type II, GDPR
**Deployment stage:** Pre-launch / internal only

---

## 1. Problem Statement

The ValueOS agent system is a multi-agent B2B SaaS platform built around an 8-agent fabric orchestrating a value lifecycle (Opportunity → Target → FinancialModeling → Integrity → Narrative → Realization → Expansion → ComplianceAuditor). Before external customer deployment, the system must be evaluated against enterprise security, privacy, governance, and trust standards.

This spec documents all findings from a full codebase audit and defines the remediation tasks required to reach enterprise readiness.

---

## 2. System Overview (Audited)

| Component | Location |
|---|---|
| 8 lifecycle agents | `packages/backend/src/lib/agent-fabric/agents/` |
| BaseAgent (secureInvoke, hallucination detection) | `BaseAgent.ts` |
| Runtime services (6) | `packages/backend/src/runtime/` |
| LLM Gateway (Together.ai only) | `LLMGateway.ts` |
| Memory system (L1 cache + Supabase backend) | `MemorySystem.ts`, `SupabaseMemoryBackend.ts` |
| Policy engine + agent policies | `runtime/policy-engine/`, `policies/agents/` |
| Audit logging | `services/security/AuditLogService.ts`, `AuditTrailService.ts` |
| Compliance controls | `services/security/ComplianceControlStatusService.ts` |
| Security middleware | `middleware/auth.ts`, `middleware/rbac.ts` |
| Sandboxed code execution | `services/SandboxedExecutor.ts` |
| Tool registry | `services/ToolRegistry.ts` |
| SDUI rendering | `packages/sdui/` |
| Integrations | `packages/integrations/` |

---

## 3. Scoring Summary

| Dimension | Score (1–5) | Rationale |
|---|---|---|
| A. Product & Enterprise Fit | 4 | Clear lifecycle, bounded agents, SDUI, multi-tenant. Only 3/8 agents have policy files. |
| B. Security Architecture | 3 | Good: circuit breaker, RBAC, RLS, sandboxed exec. Gaps: AuditLogger stub, agent identity is a plain interface with no enforcement, cross-workspace memory in BaseAgent. |
| C. Privacy & Data Governance | 3 | Good: PII redaction, DSR endpoints, tenant deletion. Gaps: compliance scores are hash-derived fakes, memory TTL not enforced on reads, `semantic_memory` not in DSR table list. |
| D. Trust, Transparency & UX | 3 | Good: model cards exist, hallucination detection, HITL checkpoints. Gaps: model cards have wrong model names, `hallucination_check` boolean not surfaced to users. |
| E. Reliability & Operational Resilience | 4 | Good: circuit breaker, retry, BullMQ, idempotency keys, saga compensation. Gap: SSE interval leak in compliance stream. |
| F. Agent Design Quality | 4 | Good: Zod schemas, secureInvoke, deterministic policy gates before LLM. Gap: all agents hardcode `version: "1.0.0"` in BaseAgent constructor. |
| G. Governance & Compliance Readiness | 2 | Critical: `ComplianceControlStatusService` generates scores from a hash of `tenantId + seed` — not real telemetry. Policy files exist for only 3 of 8 agents. `AuditLogger` in agent-fabric is an empty stub. |
| H. Commercial & Adoption Risk | 3 | Fabricated compliance scores are a procurement blocker. Emergency auth fallback is a CISO objection. Agent identity has no cryptographic binding. |

**Overall enterprise readiness score: 3 / 5**
**Overall security posture score: 3 / 5**
**Overall trustworthiness score for security-conscious users: 3 / 5**

**Deployment recommendation: Ready only for internal/pilot use** — not ready for broad enterprise deployment until P0 and P1 findings are resolved.

---

## 4. Findings Table

| ID | Severity | Category | Affected Component | Description | Why It Matters | Effort |
|---|---|---|---|---|---|---|
| F-001 | Critical | Governance / Compliance | `ComplianceControlStatusService.ts` | Compliance control scores (MFA coverage, encryption coverage, key rotation freshness, audit integrity) are computed by hashing `tenantId + seed` — not from real telemetry. The API endpoint `/compliance/control-status` returns these fabricated values. | A CISO or auditor querying this endpoint receives numbers that look like real measurements but are deterministic hash outputs. If surfaced in a SOC 2 audit or security questionnaire, it constitutes misrepresentation. | L |
| F-002 | Critical | Governance | `lib/agent-fabric/AuditLogger.ts` | `AuditLogger` class is an empty stub — constructor only, no methods. The singleton `auditlogger` is exported but does nothing. Agent-level actions (LLM invocations, memory writes, veto decisions) are not audit-logged through this path. | Agent actions that should produce an immutable audit trail produce nothing. SOC 2 CC7.2 and GDPR Art. 30 require records of processing activities. | M |
| F-003 | Critical | Reliability | `lib/agent-fabric/ExternalAPIAdapter.ts` | `ExternalAPIAdapter` is an empty stub — constructor only. Imported and exported from agent-fabric but does nothing. | Any code path that relies on this adapter for external API calls silently no-ops. The stub masks integration failures. | S |
| F-004 | High | Security | `lib/agent-fabric/agents/BaseAgent.ts` line ~202 | All LLM requests sent via `secureInvoke` hardcode `userId: "system"` in the request metadata. The actual user ID from `LifecycleContext` is available but not forwarded. | LLM provider audit logs, cost attribution, and rate limiting all show `userId: "system"` regardless of which user triggered the agent. This breaks per-user cost tracking and makes abuse investigation impossible. | S |
| F-005 | High | Security | `middleware/auth.ts` | Emergency auth fallback mode (`AUTH_FALLBACK_EMERGENCY_MODE=true`) can be enabled without a TTL in development environments. The fallback activation counter is tracked in an in-process array that resets on restart. | If this flag is accidentally left enabled in staging or production, authentication is silently downgraded. The in-process counter provides no durable alerting. | M |
| F-006 | High | Privacy / Governance | `services/security/ComplianceControlStatusService.ts` | The `scoreFor` private method uses SHA-1 to hash `tenantId:seed`. SHA-1 is cryptographically broken. | Using a broken hash function in a compliance service will trigger findings in any security review, even if the scores themselves are replaced with real telemetry. | S |
| F-007 | High | Governance | `policies/agents/` | Agent policy files exist for only 3 of 8 agents: `default.json`, `integrity-agent.json`, `opportunity-agent.json`. The remaining 5 agents fall back to `default.json`. The default policy lists `gpt-4o-mini` and `gpt-4o` as allowed models but the system uses Together.ai. | Agents operating under the wrong policy may exceed intended cost/token limits. The fallback to `default` silently masks missing per-agent policies. | M |
| F-008 | High | Security / Privacy | `lib/agent-fabric/agents/BaseAgent.ts` (`crossReferenceMemory`), `agents/ComplianceAuditorAgent.ts` | Both BaseAgent's hallucination cross-reference and ComplianceAuditorAgent use `include_cross_workspace: true`. There is no access control gate — any agent can request cross-workspace reads by providing any reason string. | Cross-workspace memory reads within a tenant may expose data from one user's session to another user's agent execution within the same org. | M |
| F-009 | Medium | Governance | `lib/agent-fabric/agents/BaseAgent.ts` constructor | All agents hardcode `this.version = "1.0.0"` in the `BaseAgent` constructor, overriding any version the subclass might define. | Agent versioning is used in model cards, audit trails, and output metadata. If all agents report `1.0.0`, change management and rollback are impossible to track. | S |
| F-010 | Medium | Trust / Transparency | `services/llm/ModelCardService.ts` | Model cards for `target` reference `OpenAI-gpt-4.1-preview` and `realization` references `Claude-3-opus-2024-11-21`. The system exclusively uses Together.ai. The `prompt_contract_hash` values are hex literals that do not correspond to any actual prompt hash computation. | Model cards are the primary transparency artifact for enterprise buyers. Incorrect model references and fake hashes undermine the credibility of the entire transparency layer. | M |
| F-011 | Medium | Privacy / Governance | `api/dataSubjectRequests.ts` | The DSR erasure endpoint's `PII_TABLES` list does not include `semantic_memory`, `hypothesis_outputs`, `integrity_outputs`, `narrative_drafts`, `realization_reports`, `expansion_opportunities`, or `value_loop_events`. | A GDPR Art. 17 erasure request will leave agent-generated content containing user data intact. | M |
| F-012 | Medium | Reliability | `lib/agent-fabric/MemorySystem.ts` | `MemorySystemConfig` has a `ttl_seconds` field but the in-process `Map` eviction logic does not enforce TTL on reads — only on LRU eviction when `max_memories` is reached. | Stale agent memories can influence current agent reasoning. For financial and integrity agents, this is a correctness risk. | M |
| F-013 | Medium | Security | `lib/auth/AgentIdentity.ts` | `AgentIdentity` is a plain TypeScript interface with a factory function. No cryptographic binding, no signature, no token. The `permissions: []` array is always empty on creation. | Any code that constructs an `AgentIdentity` directly can claim any `agent_id` and `organization_id`. There is no enforcement boundary between agents at the identity layer. | L |
| F-014 | Medium | Reliability | Compliance stream endpoint in `ComplianceControlStatusService.ts` | The SSE stream endpoint uses `setInterval` that is never cleared on client disconnect. `req.on('close')` calls `res.end()` but not `clearInterval`. | Memory leak per connected compliance dashboard client. Accumulates in multi-tenant environments. | S |

---

## 5. Agent-by-Agent Audit

### OpportunityAgent
- **Purpose:** Entry point. Fetches financial ground truth via MCP, generates value hypotheses.
- **Strengths:** Uses `secureInvoke`, Zod schema, persists to `hypothesis_outputs`, emits domain events, loads domain pack context.
- **Risks:** Falls back to empty domain context silently when `ENABLE_DOMAIN_PACK_CONTEXT` is false — no warning to user.
- **Recommendation:** Keep. Add warning log when domain pack context is disabled.

### TargetAgent
- **Purpose:** Generates KPI targets from hypotheses. Validates causal links.
- **Strengths:** Uses causal engine for deterministic validation, persists value tree to DB.
- **Risks:** No dedicated policy file — falls back to `default.json` which lists wrong allowed models.
- **Recommendation:** Keep. Add `target-agent.json` policy file.

### FinancialModelingAgent
- **Purpose:** Builds financial models (ROI, NPV, IRR, payback) using economic kernel.
- **Strengths:** LLM structures assumptions; deterministic `decimal.js` kernel computes results. Clean separation of concerns.
- **Risks:** No dedicated policy file. Financial confidence threshold (0.7–0.9) defined in AGENTS.md but not enforced in `secureInvoke` call options.
- **Recommendation:** Keep. Add policy file. Enforce financial confidence thresholds in `secureInvoke` options.

### IntegrityAgent
- **Purpose:** Validates claims, produces veto decisions.
- **Strengths:** Deterministic policy gates run before LLM. Policy traces are persisted. Veto decision is deterministic-first.
- **Risks:** Has dedicated policy file but `allowedModels` should be verified against Together.ai model names.
- **Recommendation:** Keep. Verify policy file model names.

### NarrativeAgent
- **Purpose:** Synthesizes validated results into executive narrative.
- **Strengths:** Prompt built from structured data (not free-form user input), Zod schema, persists to `narrative_drafts`.
- **Risks:** No dedicated policy file. `hallucination_check` boolean in output is not surfaced to the user in SDUI.
- **Recommendation:** Keep. Add policy file. Surface `hallucination_check` in SDUI.

### RealizationAgent
- **Purpose:** Compares committed KPI targets against actual telemetry.
- **Risks:** No dedicated policy file. Relies on telemetry data passed in context — no validation that telemetry source is authoritative.
- **Recommendation:** Keep. Add policy file.

### ExpansionAgent
- **Purpose:** Identifies upsell/cross-sell opportunities from realization outcomes.
- **Risks:** No dedicated policy file. Expansion opportunities feed back into OpportunityAgent — the loop re-entry path has no rate limit or cycle detection at the agent level.
- **Recommendation:** Keep. Add policy file. Add cycle detection guard on loop re-entry.

### ComplianceAuditorAgent
- **Purpose:** Reviews control evidence across all agents, produces compliance score.
- **Risks:** Uses `include_cross_workspace: true` with a hardcoded justification string — no access control gate. LLM prompt receives raw memory content from all agents, which may include sensitive financial data.
- **Recommendation:** Keep but modify. Replace cross-workspace read with a dedicated compliance evidence table query. Redact financial figures from LLM prompt.

---

## 6. Cross-Agent Architecture Audit

### Orchestration Quality
The six runtime services are well-separated. DAG enforcement is present. Saga compensation is implemented. **Score: 4/5.**

### Data Flow Risks
- Agent outputs flow through memory (L1 Map → Supabase) and are consumed by downstream agents via `memorySystem.retrieve()`. The retrieve path is tenant-scoped. No cross-tenant leakage path identified.
- `userId: "system"` in LLM requests (F-004) means the LLM provider cannot attribute requests to users.

### Memory and Context Risks
- L1 cache TTL not enforced on reads (F-012).
- Cross-workspace reads in BaseAgent and ComplianceAuditorAgent (F-008).
- Memory content stored as summarized/hashed strings — good for privacy, but the hash is not verified on retrieval.

### Tool Invocation Risks
- `ExternalAPIAdapter` is a stub (F-003). Any tool that delegates to it silently no-ops.
- `ToolRegistry` enforces policy via `assertAuthorized` — good.
- `SandboxedExecutor` uses E2B with blocked command patterns — good.

### Failure Propagation Risks
- Circuit breaker is present and canonical (ADR-0012).
- `crossReferenceMemory` in BaseAgent catches errors and continues — appropriate for a non-critical path, but the error is only logged as `warn`, not surfaced to the hallucination result.

### Tenant Isolation Risks
- RLS enforced at DB layer. Application queries add `organization_id` filter as defense-in-depth. Pattern is consistent.
- `service_role` usage is restricted to AuthService, tenant provisioning, cron — correct.
- Cross-workspace memory reads are the only identified intra-tenant isolation gap (F-008).

### Observability and Governance Gaps
- `AuditLogger` in agent-fabric is a stub (F-002).
- `AuditLogService` and `AuditTrailService` in `services/security/` are real and have hash chains — but they are not called from agent execution paths.
- OpenTelemetry tracing is configured. Value loop metrics (Prometheus) are implemented.

---

## 7. Security-Conscious End-User Audit

A user who cares about privacy, transparency, control, minimal data exposure, accurate claims, and safe automation would have the following concerns:

**Would they trust this system? Conditionally — not yet.**

| Concern | Current State | Gap |
|---|---|---|
| What data did the agent use? | Not surfaced to user | No per-execution data lineage in UI |
| Was the output hallucinated? | `hallucination_check` boolean exists in agent output | Not shown to user in SDUI |
| Can I see what the agent did? | Audit trail exists in DB | No user-facing audit log view |
| Can I roll back an agent action? | Saga compensation exists | No user-initiated rollback UI |
| Is my data isolated from other users? | Yes at DB layer | Cross-workspace memory reads within org are a gap |
| Are the compliance scores real? | No — hash-derived fakes | Critical trust gap if ever shown to users |
| What model is being used? | Model cards exist | Model cards contain wrong model names |

---

## 8. Enterprise Buyer Audit

### CIO
- **Concern:** Is this operationally predictable? Can I control what agents do?
- **Current state:** Autonomy config, kill switches, HITL checkpoints exist. Feature flags allow disabling agent behaviors.
- **Gap:** No admin UI for agent kill switches. Policy files missing for 5/8 agents.

### CISO / Security Reviewer
- **Concern:** Is authentication strong? Are audit trails complete? Is data isolated?
- **Current state:** Supabase JWT auth, RBAC, RLS, circuit breaker, sandboxed execution.
- **Blockers:** Emergency auth fallback (F-005), empty AuditLogger (F-002), fabricated compliance scores (F-001), SHA-1 in compliance service (F-006), agent identity not cryptographically bound (F-013).

### Procurement / Legal
- **Concern:** GDPR compliance, data retention, right to erasure.
- **Current state:** DSR endpoints exist, tenant deletion service exists (3-phase), PII redaction in logs.
- **Gap:** DSR erasure misses agent output tables (F-011). Memory TTL not enforced (F-012).

### Admin / Operator
- **Concern:** Can I manage tenants, users, integrations?
- **Current state:** Tenant provisioning, user roles, integration connections (HubSpot, Salesforce, ServiceNow, SharePoint, Slack) are implemented.
- **Gap:** No admin visibility into which policy version each agent is running under.

### Business Stakeholder
- **Concern:** Are the financial outputs trustworthy? Can I defend them to a CFO?
- **Current state:** Economic kernel uses `decimal.js` for deterministic math. IntegrityAgent has deterministic policy gates. Sensitivity analysis is implemented.
- **Gap:** Model cards reference wrong models (F-010), undermining the credibility of the transparency layer.

---

## 9. Prioritized Remediation Roadmap

### Immediate Blockers (fix before any external demo or pilot)

| ID | Task | File(s) | Acceptance Criteria |
|---|---|---|---|
| F-001 | Replace hash-derived compliance scores with real telemetry queries | `services/security/ComplianceControlStatusService.ts` | `scoreFor()` deleted. Each control queries its actual data source (e.g., MFA coverage from `user_tenants`, key rotation from `audit_logs`). Scores reflect real state. |
| F-002 | Implement `AuditLogger` in agent-fabric | `lib/agent-fabric/AuditLogger.ts` | `AuditLogger` delegates to `AuditLogService`. Agent-level events (LLM invocation, memory write, veto decision) produce audit log rows in `audit_logs` with `tenant_id`, `actor`, `action`, `resource_id`. |
| F-003 | Implement or remove `ExternalAPIAdapter` | `lib/agent-fabric/ExternalAPIAdapter.ts` | Either implement with real HTTP client logic and circuit breaker, or delete the file and remove all imports. No empty stubs in production paths. |
| F-004 | Forward real `userId` in `secureInvoke` LLM requests | `lib/agent-fabric/agents/BaseAgent.ts` | `userId` in LLM request metadata is set from `context.user_id` (passed through `LifecycleContext`), not hardcoded to `"system"`. |
| F-006 | Replace SHA-1 with SHA-256 | `services/security/ComplianceControlStatusService.ts` | `createHash("sha1")` replaced with `createHash("sha256")` everywhere in this file. |

### Pre-Pilot Fixes (required before first external customer)

| ID | Task | File(s) | Acceptance Criteria |
|---|---|---|---|
| F-005 | Harden emergency auth fallback | `middleware/auth.ts` | Fallback activation counter persisted to Redis (not in-process array). Fallback mode requires explicit TTL in all environments. Alert fires when fallback activates. |
| F-007 | Add policy files for all 8 agents | `policies/agents/` | Policy files created for `target-agent.json`, `financial-modeling-agent.json`, `narrative-agent.json`, `realization-agent.json`, `expansion-agent.json`, `compliance-auditor-agent.json`. All policy files list Together.ai model names. Default policy updated to correct model names. |
| F-008 | Gate cross-workspace memory reads | `lib/agent-fabric/agents/BaseAgent.ts`, `agents/ComplianceAuditorAgent.ts` | Cross-workspace reads require a permission check against the requesting agent's policy. BaseAgent hallucination cross-reference scoped to current workspace only. ComplianceAuditorAgent reads from a dedicated compliance evidence table, not cross-workspace semantic memory. |
| F-010 | Fix model card model names and prompt hashes | `services/llm/ModelCardService.ts` | All model cards reference the actual model in use (`meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo`). `prompt_contract_hash` is computed from the actual prompt template at build time, or the field is removed if not implemented. |
| F-011 | Add agent output tables to DSR erasure | `api/dataSubjectRequests.ts` | `PII_TABLES` includes `semantic_memory`, `hypothesis_outputs`, `integrity_outputs`, `narrative_drafts`, `realization_reports`, `expansion_opportunities`, `value_loop_events` with correct user reference columns. |
| F-014 | Fix SSE interval leak in compliance stream | Compliance stream endpoint | `clearInterval` called in `req.on('close')` handler. Test verifies no interval remains after client disconnect. |

### Pre-Enterprise Fixes (required before broad rollout)

| ID | Task | File(s) | Acceptance Criteria |
|---|---|---|---|
| F-009 | Fix agent version override in BaseAgent constructor | `lib/agent-fabric/agents/BaseAgent.ts` | `this.version` reads from `config.version` if provided, otherwise defaults to `"1.0.0"`. Each agent subclass declares its own version. Version appears correctly in agent output metadata and audit logs. |
| F-012 | Enforce memory TTL on reads | `lib/agent-fabric/MemorySystem.ts` | `retrieve()` filters out memories where `created_at + ttl_seconds < now` when `ttl_seconds` is configured. Unit test verifies expired memories are not returned. |
| F-013 | Implement verifiable agent identity | `lib/auth/AgentIdentity.ts` | `AgentIdentity` tokens are signed JWTs (using `jose`, already a dependency in `packages/mcp/ground-truth`). `SecureMessageBus.send()` verifies the sender's identity token before accepting the message. `permissions` array is populated from the agent's policy file at factory construction time. |

### Longer-Horizon Improvements

| Task | Rationale |
|---|---|
| User-facing data lineage view | Show users which data sources each agent used in a given execution. Required for trust with privacy-conscious users. |
| Surface `hallucination_check` in SDUI | The boolean exists in agent output but is not shown to users. Add a confidence/grounding indicator to agent response cards. |
| Admin UI for agent policy management | Allow operators to view and update agent policies without a code deploy. |
| Per-user cost attribution dashboard | Once F-004 is fixed, build a usage dashboard showing LLM cost per user per agent. |
| Prompt contract hash computation | Implement actual prompt template hashing at build time and verify at runtime. Currently the hashes in model cards are fictional. |
| TypeScript `any` reduction | 810 `any` usages in `packages/backend`. Target <700 by Sprint 31 per existing debt tracking. |

---

## 10. Final Verdict

**Is the current agent system enterprise-ready?**
No. The fabricated compliance scores (F-001), empty AuditLogger (F-002), and missing agent policy files (F-007) are blockers for any enterprise security review. These are not theoretical risks — they are concrete gaps that will be found in a SOC 2 audit or CISO review.

**Is it suitable for security-conscious end users?**
Not yet. The system has strong foundations (RLS, circuit breaker, hallucination detection, PII redaction, DSR endpoints) but the compliance score fabrication and missing user-facing transparency (no data lineage, no hallucination indicator in UI) mean a privacy-aware user cannot verify what the system is doing with their data.

**Minimum changes required before any external launch:**
F-001, F-002, F-003, F-004, F-006, F-007, F-008, F-010, F-011, F-014 — all Immediate Blocker and Pre-Pilot items above.

**What is genuinely strong:**
1. `secureInvoke` with circuit breaker + Zod validation + hallucination detection is a well-designed LLM safety layer.
2. Deterministic policy gates in `IntegrityAgent` before LLM verdicting is the correct pattern for high-stakes decisions.
3. Economic kernel separation in `FinancialModelingAgent` (LLM structures assumptions, `decimal.js` computes results) is auditable and defensible.
4. RLS + application-layer `organization_id` filtering is defense-in-depth done correctly.
5. Tenant deletion service (3-phase soft/export/hard delete) is production-grade.
