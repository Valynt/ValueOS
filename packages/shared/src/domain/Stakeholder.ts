/**
 * Stakeholder — canonical domain object
 *
 * A person with a role in the value case (champion, economic buyer, etc.).
 * Consolidates StakeholderSchema (packages/backend/src/api/valueCases/types.ts)
 * and MappedStakeholder (packages/backend/src/services/CRMFieldMapper.ts).
 *
 * Sprint 3: First-class domain definition.
 */

import { z } from "zod";

export const StakeholderRoleSchema = z.enum([
  "economic_buyer",
  "champion",
  "technical_evaluator",
  "end_user",
  "blocker",
  "influencer",
]);

export type StakeholderRole = z.infer<typeof StakeholderRoleSchema>;

export const StakeholderSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** The opportunity this stakeholder is associated with. */
  opportunity_id: z.string().uuid(),

  /** Full name. */
  name: z.string().min(1).max(255),

  /** Job title. */
  title: z.string().max(255).optional(),

  /** Business email. Never logged or exposed in agent outputs. */
  email: z.string().email().optional(),

  /** Role in the buying/value process. */
  role: StakeholderRoleSchema,

  /**
   * Influence score 0–1. Used by agents to prioritise outreach and
   * tailor narrative framing.
   */
  influence_score: z.number().min(0).max(1).optional(),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Stakeholder = z.infer<typeof StakeholderSchema>;
