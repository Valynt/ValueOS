/**
 * IntegrityOutputRepository
 *
 * Upsert-based store for IntegrityAgent outputs.
 * One row per (case_id, organization_id) — a re-run replaces the prior output.
 *
 * All operations are scoped to (case_id, organization_id).
 */

import { z } from 'zod';

import { logger } from '../lib/logger.js';
import { supabase } from '../lib/supabase.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const IntegrityClaimSchema = z.object({
  claim_id: z.string(),
  text: z.string(),
  confidence_score: z.number().min(0).max(1),
  evidence_tier: z.number().int().min(1).max(3).optional(),
  flagged: z.boolean().default(false),
  flag_reason: z.string().optional(),
});

export type IntegrityClaim = z.infer<typeof IntegrityClaimSchema>;

export const IntegrityOutputWriteSchema = z.object({
  case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  agent_run_id: z.string().uuid().optional(),
  claims: z.array(IntegrityClaimSchema).default([]),
  overall_confidence: z.number().min(0).max(1).optional(),
  veto_triggered: z.boolean().default(false),
  veto_reason: z.string().optional(),
  source_agent: z.string().default('IntegrityAgent'),
});

export type IntegrityOutputWrite = z.infer<typeof IntegrityOutputWriteSchema>;

export interface IntegrityOutputRow {
  id: string;
  case_id: string;
  organization_id: string;
  agent_run_id: string | null;
  claims: IntegrityClaim[];
  overall_confidence: number | null;
  veto_triggered: boolean;
  veto_reason: string | null;
  source_agent: string;
  // Promoted scalar columns (populated on write, avoids jsonb parsing for aggregation)
  claim_count: number;
  flagged_claim_count: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class IntegrityOutputRepository {
  /**
   * Upsert integrity output for a case.
   * A re-run replaces the prior output for the same (case_id, organization_id).
   */
  async upsertForCase(input: IntegrityOutputWrite): Promise<IntegrityOutputRow> {
    const validated = IntegrityOutputWriteSchema.parse(input);

    const flaggedCount = validated.claims.filter(c => c.flagged).length;

    const { data, error } = await supabase
      .from('integrity_outputs')
      .upsert(
        {
          case_id: validated.case_id,
          organization_id: validated.organization_id,
          agent_run_id: validated.agent_run_id ?? null,
          claims: validated.claims,
          overall_confidence: validated.overall_confidence ?? null,
          veto_triggered: validated.veto_triggered,
          veto_reason: validated.veto_reason ?? null,
          source_agent: validated.source_agent,
          // Promoted scalar columns — avoids jsonb parsing for aggregation queries
          claim_count: validated.claims.length,
          flagged_claim_count: flaggedCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'case_id,organization_id' },
      )
      .select('*')
      .single();

    if (error || !data) {
      logger.error('IntegrityOutputRepository.upsertForCase failed', {
        case_id: validated.case_id,
        organization_id: validated.organization_id,
        error: error?.message,
      });
      throw new Error(`Failed to upsert integrity output: ${error?.message}`);
    }

    logger.info('IntegrityOutputRepository: output upserted', {
      id: data.id,
      case_id: validated.case_id,
      organization_id: validated.organization_id,
      claim_count: validated.claims.length,
      veto_triggered: validated.veto_triggered,
    });

    return data as IntegrityOutputRow;
  }

  /**
   * Fetch integrity output for a case.
   * Returns null if no output exists yet.
   */
  async getForCase(
    caseId: string,
    organizationId: string,
  ): Promise<IntegrityOutputRow | null> {
    const { data, error } = await supabase
      .from('integrity_outputs')
      .select('*')
      .eq('case_id', caseId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      logger.error('IntegrityOutputRepository.getForCase failed', {
        case_id: caseId,
        organization_id: organizationId,
        error: error.message,
      });
      throw new Error(`Failed to fetch integrity output: ${error.message}`);
    }

    return data as IntegrityOutputRow | null;
  }
}

export const integrityOutputRepository = new IntegrityOutputRepository();
