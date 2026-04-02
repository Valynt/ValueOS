/**
 * Evidence types for CFO-defensible, audit-backed numeric outputs
 *
 * Evidence links provide traceability from calculated numbers to their
 * source evidence — required for Pattern 4 compliance (INVARIANT-5, INVARIANT-6).
 */

import { z } from "zod";

/**
 * Zod schema for evidence links attached to numeric agent outputs.
 * Every number shown to a CFO must have an evidence chain.
 */
export const EvidenceLinkSchema = z.object({
  /** The numeric value that this evidence supports */
  value: z.number(),

  /** JSON path to the numeric value in the result object */
  path: z.string().min(1),

  /** Trace ID for correlation with reasoning trace */
  trace_id: z.string().min(1),

  /** Reference to the source evidence (document ID, benchmark URL, etc.) */
  evidence_reference: z.string().min(1),

  /** Human-readable description of the evidence */
  description: z.string().max(500).optional(),

  /** Timestamp when the evidence was captured (ISO 8601) */
  captured_at: z.string().datetime().optional(),
});

/**
 * Evidence link for a numeric value in agent output.
 * Provides traceability from calculated numbers to their source evidence.
 * Required for compliance and auditability (Pattern 4, S2-1).
 */
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

/**
 * Evidence tier classification for evidence quality.
 * CFO-ready outputs require "gold" tier evidence.
 */
export const EvidenceRecordTierSchema = z.enum([
  "bronze",  // Anecdotal, stakeholder estimate
  "silver",  // Documented, but not independently verified
  "gold",    // Benchmark-backed, third-party verified
  "platinum", // Audited financial or operational data
]);

export type EvidenceRecordTier = z.infer<typeof EvidenceRecordTierSchema>;

/**
 * Evidence record with full provenance for audit trail.
 */
export const EvidenceRecordSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().min(1),

  /** The claim or value this evidence supports */
  claim: z.string().min(1).max(1000),

  /** Evidence tier classification */
  tier: EvidenceRecordTierSchema,

  /** Source type of the evidence */
  source_type: z.enum([
    "document",
    "benchmark",
    "interview",
    "system_data",
    "financial_statement",
    "audit_report",
    "third_party_verification",
  ]),

  /** Source identifier (URL, document ID, etc.) */
  source_reference: z.string().min(1).max(500),

  /** Human-readable source name */
  source_name: z.string().min(1).max(200),

  /** Date the source was created/published */
  source_date: z.string().datetime().optional(),

  /** Excerpt or summary from the source */
  excerpt: z.string().max(2000).optional(),

  /** Confidence in this evidence (0-1) */
  confidence: z.number().min(0).max(1).default(0.8),

  /** Who captured/verified this evidence */
  captured_by: z.string().min(1).max(100),

  /** When this evidence was captured */
  captured_at: z.string().datetime(),

  /** Related hypothesis, assumption, or value driver IDs */
  related_ids: z.array(z.string().uuid()).default([]),

  /** Reasoning trace ID that produced this evidence link */
  trace_id: z.string().optional(),
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

/**
 * Validation result when checking evidence coverage for numeric outputs.
 */
export interface EvidenceValidationResult {
  /** Whether all numeric values have evidence links */
  valid: boolean;

  /** Paths to numeric values missing evidence */
  missing: string[];

  /** Evidence links present */
  present: EvidenceLink[];

  /** Compliance status for CFO presentation */
  cfo_ready: boolean;
}
