/**
 * Account — canonical domain object
 *
 * Represents a customer account (company) in the value lifecycle.
 * Consolidates CanonicalAccount (packages/backend/src/services/crm/types.ts).
 *
 * Sprint 3: First-class domain definition. Supersedes ad-hoc account shapes
 * scattered across CRM integration and value case types.
 */

import { z } from "zod";

export const AccountSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this account record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** Human-readable company name. */
  name: z.string().min(1).max(255),

  /** Primary domain (e.g. "acme.com"). Used for deduplication and enrichment. */
  domain: z.string().max(255).optional(),

  /** Industry vertical (free-form; normalised by enrichment pipeline). */
  industry: z.string().max(100).optional(),

  /** Employee count band. */
  employee_count: z.number().int().positive().optional(),

  /** Annual recurring revenue in USD. */
  arr_usd: z.number().nonnegative().optional(),

  /**
   * External CRM identifier (e.g. Salesforce Account ID).
   * Null when the account was created directly in ValueOS.
   */
  crm_external_id: z.string().max(255).nullable().optional(),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Account = z.infer<typeof AccountSchema>;
