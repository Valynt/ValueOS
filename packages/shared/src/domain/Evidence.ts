/**
 * Evidence — canonical domain object
 *
 * A verifiable piece of data that supports or refutes a ValueHypothesis.
 * All claims must be tied to Evidence before they can be presented to customers.
 *
 * Consolidates:
 * - EvidenceSource, EvidenceTiering (packages/backend/src/lib/agents/core/EvidenceTiering.ts)
 * - EvidenceTierLabel, SourceProvenance (packages/backend/src/types/evidence.ts)
 * - EvidenceReportItem (packages/backend/src/lib/agents/orchestration/HypothesisLoop.ts)
 *
 * Sprint 3: First-class domain definition. Satisfies Guiding Principle 5:
 * "Evidence before Confidence Theater — all claims must be tied to verifiable
 * evidence and provenance."
 */

import { z } from "zod";

/**
 * Evidence tier determines how much weight an agent may assign to a claim.
 * - silver (1): agent inference, unverified
 * - gold (2):   corroborated by a second source or user confirmation
 * - platinum (3): verified against primary system of record (CRM/ERP/data warehouse)
 */
export const EvidenceTierSchema = z.enum(["silver", "gold", "platinum"]);
export type EvidenceTier = z.infer<typeof EvidenceTierSchema>;

export const EvidenceProvenanceSchema = z.enum([
  "crm",
  "erp",
  "data_warehouse",
  "agent_inference",
  "user_provided",
  "benchmark",
  "public_data",
  "system",
]);
export type EvidenceProvenance = z.infer<typeof EvidenceProvenanceSchema>;

export const EvidenceSchema = z
  .object({
    /** Stable internal identifier (UUID). */
    id: z.string().uuid(),

    /** Tenant that owns this record. All queries must filter on this. */
    organization_id: z.string().uuid(),

    /** The opportunity this evidence belongs to. */
    opportunity_id: z.string().uuid(),

    /**
     * The hypothesis this evidence supports or refutes.
     * Null for evidence that applies at the opportunity level.
     */
    hypothesis_id: z.string().uuid().nullable().optional(),

    /** Short label (e.g. "Q3 DSO from ERP export"). */
    title: z.string().min(1).max(255),

    /** Full content of the evidence item. */
    content: z.string().min(1).max(10000),

    /** Where this evidence came from. */
    provenance: EvidenceProvenanceSchema,

    /** Quality tier. Agents may not present platinum-tier claims without gold+ evidence. */
    tier: EvidenceTierSchema,

    /**
     * URL or system reference to the original source.
     * Required for gold and platinum tier evidence.
     */
    source_url: z.string().url().nullable().optional(),

    /**
     * Grounding score 0–1 assigned by the hallucination detection pipeline.
     * Populated by secureInvoke when evidence is agent-generated.
     */
    grounding_score: z.number().min(0).max(1).nullable().optional(),

    /** ISO 8601 timestamps. */
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .superRefine((e, ctx) => {
    if ((e.tier === "gold" || e.tier === "platinum") && (e.source_url == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "source_url is required for gold and platinum tier evidence",
        path: ["source_url"],
      });
    }
  });

export type Evidence = z.infer<typeof EvidenceSchema>;
