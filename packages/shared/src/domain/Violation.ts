/**
 * Violation — canonical domain object for Value Integrity Layer
 *
 * Represents a detected contradiction or integrity issue within a business
 * case, produced by ValueIntegrityService after each agent run.
 *
 * Four contradiction types:
 *   SCALAR_CONFLICT    — two agents assert different numeric values for the same metric
 *   FINANCIAL_SANITY   — a single agent's output fails plausibility thresholds
 *   LOGIC_CHAIN_BREAK  — an agent's implied condition is contradicted by another agent
 *   UNIT_MISMATCH      — two agents reference the same metric with incompatible units/scale
 *
 * Sprint 53: Initial definition.
 */

import { z } from "zod";

export const ViolationTypeSchema = z.enum([
  "SCALAR_CONFLICT",
  "FINANCIAL_SANITY",
  "LOGIC_CHAIN_BREAK",
  "UNIT_MISMATCH",
]);
export type ViolationType = z.infer<typeof ViolationTypeSchema>;

export const ViolationSeveritySchema = z.enum(["critical", "warning", "info"]);
export type ViolationSeverity = z.infer<typeof ViolationSeveritySchema>;

export const ViolationStatusSchema = z.enum([
  "OPEN",
  "RESOLVED_AUTO",
  "DISMISSED",
]);
export type ViolationStatus = z.infer<typeof ViolationStatusSchema>;

export const ResolutionMetadataSchema = z.object({
  /** Human-provided reason code when dismissing a violation. */
  reason_code: z.string().min(1).optional(),
  /** Human-provided comment when dismissing a violation. */
  comment: z.string().optional(),
  /** ISO 8601 timestamp of the last re-evaluation attempt. */
  re_evaluated_at: z.string().datetime().optional(),
}).nullable().optional();

export type ResolutionMetadata = z.infer<typeof ResolutionMetadataSchema>;

export const ViolationSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** The business case this violation belongs to. */
  case_id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** Which contradiction pattern was detected. */
  type: ViolationTypeSchema,

  /**
   * Severity determines gate behaviour:
   *   critical — hard blocks status advance to in_review
   *   warning  — surfaced as soft_warnings; bypassable with bypassWarnings flag
   *   info     — advisory only, no gate effect
   */
  severity: ViolationSeveritySchema,

  /** Human-readable description of the contradiction. */
  description: z.string().min(1),

  /**
   * IDs of the agents whose outputs produced this violation.
   * Single-element for FINANCIAL_SANITY; two elements for cross-agent types.
   */
  agent_ids: z.array(z.string().min(1)).min(1),

  /** Current resolution state. */
  status: ViolationStatusSchema.default("OPEN"),

  /**
   * User ID or "SYSTEM_AGENT" that resolved this violation.
   * Null while status is OPEN.
   */
  resolved_by: z.string().nullable().optional(),

  /**
   * Stores dismissal reason/comment or re-evaluation timestamp.
   * Null while status is OPEN.
   */
  resolution_metadata: ResolutionMetadataSchema,

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Violation = z.infer<typeof ViolationSchema>;

/**
 * Non-dismissable violation types.
 *
 * SCALAR_CONFLICT and LOGIC_CHAIN_BREAK critical violations must be resolved
 * via RE_EVALUATE (data correction). Dismissal is forbidden at the API layer.
 */
export const NON_DISMISSABLE_TYPES: ReadonlySet<ViolationType> = new Set([
  "SCALAR_CONFLICT",
  "LOGIC_CHAIN_BREAK",
]);
