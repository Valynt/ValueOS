/**
 * Agent Hardening — Shared Types
 *
 * Single source of truth for all types used across the hardening layer:
 * BaseAgent contract extensions, governance, observability, and safety.
 *
 * Import from this file rather than from individual layer files to avoid
 * circular dependencies.
 */

import type { z } from "zod";

// ---------------------------------------------------------------------------
// Request identity
// ---------------------------------------------------------------------------

/**
 * Correlation envelope attached to every hardened agent invocation.
 * Propagated across async boundaries via MessageBus trace_id.
 */
export interface RequestEnvelope {
  /** Globally unique ID for the top-level user request. */
  request_id: string;
  /** Trace ID for distributed tracing (OTel). May equal request_id for root spans. */
  trace_id: string;
  /** Session ID from the authenticated user session. */
  session_id: string;
  /** Authenticated user. */
  user_id: string;
  /** Tenant owning this request. */
  organization_id: string;
  /** ISO-8601 timestamp when the request was received. */
  received_at: string;
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export type ConfidenceScore = number; // 0.0 – 1.0

export interface ConfidenceBreakdown {
  /** Overall composite score. */
  overall: ConfidenceScore;
  /** Evidence quality contribution (0–1). */
  evidence_quality: ConfidenceScore;
  /** Grounding score from hallucination detection (0–1). */
  grounding: ConfidenceScore;
  /** Model self-reported confidence, if available (0–1). */
  model_self_reported?: ConfidenceScore;
  /** Integrity check contribution (0–1). */
  integrity_check?: ConfidenceScore;
  /** Human label: very_low | low | medium | high | very_high */
  label: "very_low" | "low" | "medium" | "high" | "very_high";
}

/** Risk-tier thresholds. Agents declare which tier they belong to. */
export interface ConfidenceThresholds {
  /** Minimum score to accept output without escalation. */
  accept: ConfidenceScore;
  /** Score below which output is blocked entirely. */
  block: ConfidenceScore;
  /** Score between block and accept triggers human-in-the-loop review. */
  review: ConfidenceScore;
}

export const CONFIDENCE_THRESHOLDS: Record<string, ConfidenceThresholds> = {
  financial: { accept: 0.75, review: 0.60, block: 0.40 },
  commitment: { accept: 0.70, review: 0.55, block: 0.35 },
  discovery: { accept: 0.55, review: 0.40, block: 0.25 },
  narrative: { accept: 0.65, review: 0.50, block: 0.30 },
  compliance: { accept: 0.80, review: 0.65, block: 0.45 },
} as const;

// ---------------------------------------------------------------------------
// BaseAgent contract extensions
// ---------------------------------------------------------------------------

export interface HardenedInvokeOptions {
  /** Milliseconds before the LLM call is aborted. Defaults to 30 000. */
  timeoutMs?: number;
  /** Maximum retry attempts (exponential backoff). Defaults to 3. */
  maxRetries?: number;
  /** Risk tier used to select confidence thresholds. */
  riskTier?: keyof typeof CONFIDENCE_THRESHOLDS;
  /** Zod schema the LLM output must satisfy. */
  outputSchema: z.ZodTypeAny;
  /** Whether to run the IntegrityAgent veto check on this output. */
  requiresIntegrityVeto?: boolean;
  /** Whether a human must approve before the output is released. */
  requiresHumanApproval?: boolean;
  /** Idempotency key for deduplication. */
  idempotencyKey?: string;
}

export interface HardenedInvokeResult<T> {
  output: T;
  confidence: ConfidenceBreakdown;
  /** True when the output was served from cache. */
  cache_hit: boolean;
  /** Number of LLM attempts consumed. */
  attempts: number;
  /** Reasoning trace ID persisted to reasoning_traces table. */
  trace_id: string;
  /** Token usage for cost attribution. */
  token_usage: TokenUsage;
  /** Governance decision applied to this output. */
  governance: GovernanceDecision;
  /** Safety scan result. */
  safety: SafetyScanResult;
}

// ---------------------------------------------------------------------------
// Token / cost
// ---------------------------------------------------------------------------

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  /** Estimated USD cost based on model pricing. */
  estimated_cost_usd: number;
}

// ---------------------------------------------------------------------------
// Governance
// ---------------------------------------------------------------------------

export type GovernanceVerdict = "approved" | "vetoed" | "pending_review" | "pending_human";

export interface GovernanceDecision {
  verdict: GovernanceVerdict;
  /** Agent or rule that produced this decision. */
  decided_by: string;
  /** ISO-8601 timestamp. */
  decided_at: string;
  /** Human-readable reason, especially for vetoes. */
  reason?: string;
  /** Integrity issues that triggered the veto, if any. */
  integrity_issues?: IntegrityIssueRecord[];
  /** Approval checkpoint ID when verdict is pending_human. */
  approval_checkpoint_id?: string;
}

export interface IntegrityIssueRecord {
  type: "hallucination" | "data_integrity" | "confidence" | "logic_error" | "evidence_gap";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  field?: string;
}

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

export interface AgentExecutionLog {
  /** Correlates with the top-level user request. */
  request_id: string;
  trace_id: string;
  session_id: string;
  agent_name: string;
  agent_version: string;
  lifecycle_stage: string;
  organization_id: string;
  user_id: string;
  /** ISO-8601 */
  started_at: string;
  /** ISO-8601 */
  completed_at: string;
  latency_ms: number;
  /** Sanitized (PII-redacted) input context. */
  input_summary: Record<string, unknown>;
  /** Sanitized output summary (no raw LLM text). */
  output_summary: Record<string, unknown>;
  /** Step-by-step reasoning captured from the LLM. */
  reasoning_trace: ReasoningTraceEntry[];
  /** Tools invoked during this execution. */
  tools_used: ToolUsageRecord[];
  token_usage: TokenUsage;
  confidence: ConfidenceBreakdown;
  governance: GovernanceDecision;
  safety: SafetyScanResult;
  /** Circuit breaker state at time of execution. */
  circuit_breaker_state: "closed" | "open" | "half_open";
  /** Number of retry attempts. */
  retry_count: number;
  status: "success" | "failure" | "vetoed" | "pending_review" | "timeout" | "circuit_open";
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface ReasoningTraceEntry {
  step: number;
  description: string;
  /** Assumptions made at this step. */
  assumptions: string[];
  /** Evidence referenced at this step. */
  evidence_refs: string[];
  /** Confidence at this step. */
  confidence: ConfidenceScore;
}

export interface ToolUsageRecord {
  tool_name: string;
  /** ISO-8601 */
  invoked_at: string;
  latency_ms: number;
  success: boolean;
  /** Sanitized input params (no secrets). */
  params_summary: Record<string, unknown>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

export type SafetyVerdict = "clean" | "flagged" | "blocked";

export interface SafetyScanResult {
  verdict: SafetyVerdict;
  /** Injection patterns detected in the prompt. */
  injection_signals: InjectionSignal[];
  /** Schema validation result. */
  schema_valid: boolean;
  schema_errors?: string[];
  /** Tool access violations. */
  tool_violations: ToolViolation[];
  /** PII detected in output (triggers redaction). */
  pii_detected: boolean;
}

export interface InjectionSignal {
  pattern: string;
  location: "prompt" | "context" | "tool_output";
  severity: "low" | "medium" | "high";
  matched_text?: string;
}

export interface ToolViolation {
  tool_name: string;
  reason: "not_in_allowlist" | "rate_limit_exceeded" | "tenant_scope_violation";
}

// ---------------------------------------------------------------------------
// Failure scenarios
// ---------------------------------------------------------------------------

export type FailureScenario =
  | "llm_timeout"
  | "circuit_open"
  | "schema_validation_failed"
  | "confidence_below_block"
  | "confidence_below_accept"
  | "integrity_veto"
  | "human_approval_required"
  | "prompt_injection_detected"
  | "tool_access_denied"
  | "tenant_mismatch"
  | "kill_switch_active"
  | "evidence_mapping_violation";

export interface FailureResponse {
  scenario: FailureScenario;
  /** What the system does in response. */
  system_action: string;
  /** Whether the caller receives a partial result. */
  partial_result: boolean;
  /** Whether the failure is logged to the audit trail. */
  audited: boolean;
  /** Whether a human is notified. */
  human_notified: boolean;
}

/** Canonical failure response map — used by tests and documentation. */
export const FAILURE_RESPONSES: Record<FailureScenario, FailureResponse> = {
  llm_timeout: {
    scenario: "llm_timeout",
    system_action: "Retry with exponential backoff (max 3 attempts). If all fail, return failure AgentOutput with status=timeout.",
    partial_result: false,
    audited: true,
    human_notified: false,
  },
  circuit_open: {
    scenario: "circuit_open",
    system_action: "Immediately return CircuitOpenError. No LLM call attempted. Circuit re-evaluates after cooldown.",
    partial_result: false,
    audited: true,
    human_notified: false,
  },
  schema_validation_failed: {
    scenario: "schema_validation_failed",
    system_action: "Retry up to maxRetries with schema-repair prompt. If still invalid, veto output and log violation.",
    partial_result: false,
    audited: true,
    human_notified: false,
  },
  confidence_below_block: {
    scenario: "confidence_below_block",
    system_action: "Block output entirely. Return failure AgentOutput. Log to audit trail with confidence breakdown.",
    partial_result: false,
    audited: true,
    human_notified: true,
  },
  confidence_below_accept: {
    scenario: "confidence_below_accept",
    system_action: "Route to human-in-the-loop review queue. Output held until approved or rejected.",
    partial_result: false,
    audited: true,
    human_notified: true,
  },
  integrity_veto: {
    scenario: "integrity_veto",
    system_action: "IntegrityAgent blocks output. Saga compensation triggered. Caller receives veto reason.",
    partial_result: false,
    audited: true,
    human_notified: true,
  },
  human_approval_required: {
    scenario: "human_approval_required",
    system_action: "Output queued in ApprovalInbox. Workflow paused at checkpoint. Notified via configured escalation policy.",
    partial_result: false,
    audited: true,
    human_notified: true,
  },
  prompt_injection_detected: {
    scenario: "prompt_injection_detected",
    system_action: "Prompt sanitized or request blocked depending on severity. Security event logged. High-severity triggers kill switch evaluation.",
    partial_result: false,
    audited: true,
    human_notified: true,
  },
  tool_access_denied: {
    scenario: "tool_access_denied",
    system_action: "PermissionDeniedError thrown. Tool call aborted. Security audit event emitted.",
    partial_result: false,
    audited: true,
    human_notified: false,
  },
  tenant_mismatch: {
    scenario: "tenant_mismatch",
    system_action: "Execution aborted immediately. TenantMismatchError thrown. Critical security audit event emitted.",
    partial_result: false,
    audited: true,
    human_notified: true,
  },
  kill_switch_active: {
    scenario: "kill_switch_active",
    system_action: "Agent execution blocked. KillSwitchError thrown. Caller receives clear error message.",
    partial_result: false,
    audited: true,
    human_notified: false,
  },
  evidence_mapping_violation: {
    scenario: "evidence_mapping_violation",
    system_action: "EvidenceMappingError thrown. Output blocked. Compliance violation logged. CFO-defensibility gate enforced.",
    partial_result: false,
    audited: true,
    human_notified: true,
  },
};
