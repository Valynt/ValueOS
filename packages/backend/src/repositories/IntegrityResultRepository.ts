/**
 * IntegrityResultRepository
 *
 * Persists and retrieves IntegrityAgent outputs from the integrity_results
 * table. All queries are scoped to organization_id (tenant isolation).
 */

import { createLogger } from '@shared/lib/logger';

import { createServerSupabaseClient } from '../lib/supabase.js';

const logger = createLogger({ service: 'IntegrityResultRepository' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaimValidation {
  claim_id: string;
  claim_text: string;
  verdict: 'supported' | 'partially_supported' | 'unsupported' | 'insufficient_evidence';
  confidence: number;
  evidence_assessment: string;
  issues: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  suggested_fix?: string;
}

export interface IntegrityResultPayload {
  session_id?: string;
  claims: ClaimValidation[];
  veto_decision: 'pass' | 'veto' | 're_refine';
  overall_score: number;
  data_quality_score?: number;
  logic_score?: number;
  evidence_score?: number;
  hallucination_check?: boolean;
  source_agent?: string;
}

export interface IntegrityResult extends IntegrityResultPayload {
  id: string;
  organization_id: string;
  value_case_id: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class IntegrityResultRepository {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    this.supabase = createServerSupabaseClient();
  }

  async createResult(
    caseId: string,
    orgId: string,
    payload: IntegrityResultPayload,
  ): Promise<IntegrityResult> {
    const { data, error } = await this.supabase
      .from('integrity_results')
      .insert({
        organization_id: orgId,
        value_case_id: caseId,
        session_id: payload.session_id ?? null,
        claims: payload.claims,
        veto_decision: payload.veto_decision,
        overall_score: payload.overall_score,
        data_quality_score: payload.data_quality_score ?? null,
        logic_score: payload.logic_score ?? null,
        evidence_score: payload.evidence_score ?? null,
        hallucination_check: payload.hallucination_check ?? null,
        source_agent: payload.source_agent ?? 'IntegrityAgent',
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create integrity result', { caseId, orgId, error: error.message });
      throw new Error(`IntegrityResultRepository.createResult: ${error.message}`);
    }

    return data as IntegrityResult;
  }

  async getLatestForCase(
    caseId: string,
    orgId: string,
  ): Promise<IntegrityResult | null> {
    const { data, error } = await this.supabase
      .from('integrity_results')
      .select('*')
      .eq('value_case_id', caseId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch integrity result', { caseId, orgId, error: error.message });
      throw new Error(`IntegrityResultRepository.getLatestForCase: ${error.message}`);
    }

    return data as IntegrityResult | null;
  }
}
