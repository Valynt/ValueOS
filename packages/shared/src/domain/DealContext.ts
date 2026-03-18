/**
 * DealContext — canonical domain object
 *
 * Assembled context for a sales opportunity from multiple sources:
 * CRM data, call transcripts, seller notes, and external research.
 * Provides the foundation for value hypothesis generation.
 *
 * Satisfies Guiding Principle 4.2: "No blank starts — every value case
 * begins with auto-assembled context and candidate value drivers."
 */

import { z } from "zod";

export const DealContextStatusSchema = z.enum([
  "draft",
  "reviewing",
  "approved",
  "archived",
]);
export type DealContextStatus = z.infer<typeof DealContextStatusSchema>;

export const SourceClassificationSchema = z.enum([
  "customer-confirmed",
  "CRM-derived",
  "call-derived",
  "note-derived",
  "benchmark-derived",
  "externally-researched",
  "inferred",
  "manually-overridden",
]);
export type SourceClassification = z.infer<typeof SourceClassificationSchema>;

export const DealContextSourceTypeSchema = z.enum([
  "crm-opportunity",
  "crm-account",
  "crm-contact",
  "call-transcript",
  "seller-notes",
  "public-enrichment",
  "user-upload",
  "benchmark-reference",
]);
export type DealContextSourceType = z.infer<typeof DealContextSourceTypeSchema>;

export const DealContextSourceSchema = z.object({
  id: z.string().uuid(),
  source_type: DealContextSourceTypeSchema,
  source_url: z.string().url().optional(),
  ingested_at: z.string().datetime(),
  fragment_hash: z.string(),
  fragment_summary: z.string().max(1000).optional(),
  data_json: z.record(z.unknown()).optional(),
});
export type DealContextSource = z.infer<typeof DealContextSourceSchema>;

export const ValueDriverCandidateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000),
  signal_strength: z.number().min(0).max(1),
  evidence_count: z.number().int().min(0),
  suggested_kpi: z.string().max(255).optional(),
  source_fragments: z.array(z.string().uuid()),
});
export type ValueDriverCandidate = z.infer<typeof ValueDriverCandidateSchema>;

export const MissingDataFlagSchema = z.object({
  field: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  reason: z.string().max(500),
  suggested_source: z.string().max(255).optional(),
});
export type MissingDataFlag = z.infer<typeof MissingDataFlagSchema>;

export const DealContextSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  tenant_id: z.string().uuid(),

  /** The opportunity this context is assembled for. */
  opportunity_id: z.string().uuid(),

  /** Associated value case (if created). */
  case_id: z.string().uuid().optional(),

  /** Assembly timestamp. */
  assembled_at: z.string().datetime(),

  /** Current status of the assembled context. */
  status: DealContextStatusSchema,

  /** Tracked sources that contributed to this context. */
  sources: z.array(DealContextSourceSchema),

  /** Extracted value driver candidates with signal strength. */
  value_driver_candidates: z.array(ValueDriverCandidateSchema),

  /** Flagged missing data points. */
  missing_data_flags: z.array(MissingDataFlagSchema),

  /** Raw assembled context data. */
  context_json: z.record(z.unknown()),

  /** Human-readable summary of sources used. */
  source_summary: z.string().max(2000).optional(),

  /** Completeness score 0-1 based on data coverage. */
  completeness_score: z.number().min(0).max(1).optional(),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DealContext = z.infer<typeof DealContextSchema>;
