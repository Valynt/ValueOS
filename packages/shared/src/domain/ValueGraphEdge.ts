/**
 * ValueGraphEdge — Value Graph relationship
 *
 * A typed, weighted, evidence-linked edge between two Value Graph entities.
 * Edges are the core primitive that makes ROI paths deterministic and
 * explainable — every causal claim is a traversable edge with a confidence
 * score and evidence links.
 *
 * Canonical edge types and their allowed source → target pairs:
 *
 *   company_has_persona          Account       → Stakeholder
 *   persona_executes_use_case    Stakeholder   → UseCase
 *   use_case_enabled_by_cap      UseCase       → VgCapability
 *   capability_impacts_metric    VgCapability  → VgMetric
 *   metric_maps_to_value_driver  VgMetric      → VgValueDriver
<<<<<<< HEAD
 *   evidence_supports_metric          Evidence        → VgMetric
 *   hypothesis_claims_value_driver    ValueHypothesis → VgValueDriver
 *
 * Sprint 47: Initial definition.
 * Sprint 48: Renamed hypothesis_claims_metric → hypothesis_claims_value_driver to match
 *            the actual target entity type (VgValueDriver, not VgMetric).
=======
 *   evidence_supports_metric     Evidence      → VgMetric
 *   hypothesis_claims_metric     ValueHypothesis → VgMetric
 *
 * Sprint 47: Initial definition.
>>>>>>> origin/main
 */

import { z } from "zod";

export const ValueGraphEntityTypeSchema = z.enum([
  "account",
  "stakeholder",
  "use_case",
  "vg_capability",
  "vg_metric",
  "vg_value_driver",
  "evidence",
  "value_hypothesis",
]);
export type ValueGraphEntityType = z.infer<typeof ValueGraphEntityTypeSchema>;

export const ValueGraphEdgeTypeSchema = z.enum([
  "company_has_persona",
  "persona_executes_use_case",
  "use_case_enabled_by_capability",
  "capability_impacts_metric",
  "metric_maps_to_value_driver",
  "evidence_supports_metric",
<<<<<<< HEAD
  "hypothesis_claims_value_driver",
=======
  "hypothesis_claims_metric",
>>>>>>> origin/main
]);
export type ValueGraphEdgeType = z.infer<typeof ValueGraphEdgeTypeSchema>;

export const ValueGraphEdgeSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** The opportunity this edge belongs to. */
  opportunity_id: z.string().uuid(),

  /** Entity type of the source node. */
  from_entity_type: ValueGraphEntityTypeSchema,

  /** UUID of the source entity. */
  from_entity_id: z.string().uuid(),

  /** Entity type of the target node. */
  to_entity_type: ValueGraphEntityTypeSchema,

  /** UUID of the target entity. */
  to_entity_id: z.string().uuid(),

  /** Semantic relationship type. */
  edge_type: ValueGraphEdgeTypeSchema,

  /**
   * Confidence that this relationship holds (0–1).
   * Set by the agent that created the edge; updated by IntegrityAgent.
   */
  confidence_score: z.number().min(0).max(1).default(0.5),

  /**
   * IDs of Evidence entities that support this edge.
   * An edge with no evidence links is treated as agent inference (silver tier).
   */
  evidence_ids: z.array(z.string().uuid()).default([]),

  /**
   * Name of the agent that created this edge.
   * Used for contradiction detection and audit.
   */
  created_by_agent: z.string().min(1).max(100),

  /** Ontology version this edge was written under. */
  ontology_version: z.string().default("1.0"),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ValueGraphEdge = z.infer<typeof ValueGraphEdgeSchema>;
