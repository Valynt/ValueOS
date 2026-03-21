/**
 * ReasoningTrace — canonical domain object
 *
 * A structured, persisted record of why an agent reached a conclusion.
 * Created by BaseAgent.secureInvoke on every LLM invocation (non-blocking).
 *
 * The schema is a superset of the 5 UI sections rendered by ReasoningTracePanel
 * plus system metadata auto-populated by secureInvoke (grounding score, latency,
 * token usage). Agents may enrich the 5 content sections via the optional
 * `trace` option on secureInvoke.
 *
 * Anchored to value_cases.id (value_case_id) as the primary query key.
 * opportunity_id is stored as a nullable secondary anchor for graph-level queries.
 *
 * Sprint 51: Initial definition.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Token usage (mirrors AgentOutputMetadata.token_usage shape)
// ---------------------------------------------------------------------------

export const ReasoningTraceTokenUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});

export type ReasoningTraceTokenUsage = z.infer<typeof ReasoningTraceTokenUsageSchema>;

// ---------------------------------------------------------------------------
// Main schema
// ---------------------------------------------------------------------------

export const ReasoningTraceSchema = z.object({
  /** Stable internal identifier (UUID). DB-generated. */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** Agent execution session. Links to agent_execution_lineage.session_id. */
  session_id: z.string().uuid(),

  /**
   * Primary query anchor — FK to value_cases.id.
   * Maps to the :caseId route parameter in the API.
   * Falls back to session_id for background invocations outside a case context.
   */
  value_case_id: z.string().uuid(),

  /**
   * Optional parent graph anchor — FK to opportunities.id.
   * Stored for graph-level lineage queries; not used as an API route parameter.
   */
  opportunity_id: z.string().uuid().nullable(),

  /** Name of the agent that produced this trace (e.g. "OpportunityAgent"). */
  agent_name: z.string().min(1),

  /** Semver version of the agent at invocation time. */
  agent_version: z.string(),

  /**
   * Trace identifier propagated from context.trace_id / sessionId.
   * Attached to AgentOutput.metadata.trace_id so the UI can fetch this record.
   */
  trace_id: z.string().uuid(),

  // -------------------------------------------------------------------------
  // The 5 UI sections — hydrate ReasoningTracePanel directly
  // -------------------------------------------------------------------------

  /** Sanitized agent input context (PII-redacted by sanitizeForAgent). */
  inputs: z.record(z.unknown()),

  /** Ordered list of transformation steps the agent applied. */
  transformations: z.array(z.string()),

  /** Named assumptions the agent relied on. */
  assumptions: z.array(z.string()),

  /**
   * Agent-populated confidence breakdown by dimension.
   * Keys are free-form labels (e.g. "Data Quality", "Logic Consistency").
   * Values are scores 0–1. Rendered as an inline bar chart in the UI.
   */
  confidence_breakdown: z.record(z.number().min(0).max(1)),

  /** URLs linking to supporting evidence. */
  evidence_links: z.array(z.string().url()),

  // -------------------------------------------------------------------------
  // System quality metrics — auto-populated by secureInvoke
  // -------------------------------------------------------------------------

  /** Aggregate grounding score 0–1 from hallucination detection. */
  grounding_score: z.number().min(0).max(1).nullable(),

  /** Wall-clock LLM latency in milliseconds. */
  latency_ms: z.number().int().nonnegative().nullable(),

  /** Token counts from the LLM response. Null when provider does not return usage. */
  token_usage: ReasoningTraceTokenUsageSchema.nullable(),

  /** ISO 8601 timestamp. DB-generated. */
  created_at: z.string().datetime(),
});

export type ReasoningTrace = z.infer<typeof ReasoningTraceSchema>;

// ---------------------------------------------------------------------------
// Write payload — id and created_at are DB-generated
// ---------------------------------------------------------------------------

export const ReasoningTraceWriteSchema = ReasoningTraceSchema.omit({
  id: true,
  created_at: true,
});

export type ReasoningTraceWrite = z.infer<typeof ReasoningTraceWriteSchema>;
