/**
 * VgCapability — Value Graph entity
 *
 * Represents what a product or solution enables operationally.
 * Distinct from the legacy `capabilities` table (ValueFabricService) which
 * is a template catalog. VgCapability is opportunity-scoped and participates
 * in the Value Graph as a node between UseCase and Metric.
 *
 * Graph position: UseCase → (use_case_enabled_by_capability) → VgCapability
 *                 VgCapability → (capability_impacts_metric) → VgMetric
 *
 * Sprint 47: Initial definition. Agents write nodes; ValueGraphService reads paths.
 */

import { z } from "zod";

export const VgCapabilityCategorySchema = z.enum([
  "automation",
  "analytics",
  "integration",
  "collaboration",
  "security",
  "compliance",
  "ai_ml",
  "infrastructure",
  "other",
]);
export type VgCapabilityCategory = z.infer<typeof VgCapabilityCategorySchema>;

export const VgCapabilitySchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** The opportunity this capability node belongs to. */
  opportunity_id: z.string().uuid(),

  /**
   * Short name of the capability.
   * Example: "Automated invoice reconciliation"
   */
  name: z.string().min(1).max(255),

  /**
   * What operational change this capability enables.
   * Example: "Eliminates manual matching of PO lines to invoices"
   */
  description: z.string().min(1).max(2000),

  /** Functional category for grouping and filtering. */
  category: VgCapabilityCategorySchema,

  /**
   * Ontology version this node was written under.
   * Agents must record the version they used so drift can be detected.
   */
  ontology_version: z.string().default("1.0"),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type VgCapability = z.infer<typeof VgCapabilitySchema>;
