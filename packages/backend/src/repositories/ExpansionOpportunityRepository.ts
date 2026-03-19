/**
 * ExpansionOpportunityRepository
 *
 * Persists and retrieves ExpansionAgent outputs from the expansion_opportunities
 * table. All queries are scoped to organization_id (tenant isolation).
 */

import { createLogger } from '@shared/lib/logger';

import { createServiceRoleSupabaseClient } from '../lib/supabase.js';

const logger = createLogger({ service: 'ExpansionOpportunityRepository' });

// ---------------------------------------------------------------------------
// Types (mirror expansion_opportunities table columns)
// ---------------------------------------------------------------------------

export interface ExpansionOpportunityRecord {
  id: string;
  organization_id: string;
  value_case_id: string;
  session_id: string | null;
  agent_run_id: string | null;
  title: string;
  description: string;
  type: string;
  source_kpi_id: string | null;
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  estimated_value_unit: string | null;
  estimated_value_timeframe_months: number | null;
  confidence: number | null;
  evidence: string[];
  prerequisites: string[];
  stakeholders: string[];
  portfolio_summary: string | null;
  total_expansion_value_low: number | null;
  total_expansion_value_high: number | null;
  total_expansion_currency: string | null;
  gap_analysis: unknown[];
  new_cycle_recommendations: unknown[];
  recommended_next_steps: string[];
  hallucination_check: boolean | null;
  source_agent: string;
  created_at: string;
  updated_at: string;
}

export interface CreateExpansionOpportunityInput {
  organization_id: string;
  value_case_id: string;
  session_id?: string | null;
  agent_run_id?: string | null;
  title: string;
  description: string;
  type: string;
  source_kpi_id?: string | null;
  estimated_value_low?: number | null;
  estimated_value_high?: number | null;
  estimated_value_unit?: string | null;
  estimated_value_timeframe_months?: number | null;
  confidence?: number | null;
  evidence?: string[];
  prerequisites?: string[];
  stakeholders?: string[];
  portfolio_summary?: string | null;
  total_expansion_value_low?: number | null;
  total_expansion_value_high?: number | null;
  total_expansion_currency?: string | null;
  gap_analysis?: unknown[];
  new_cycle_recommendations?: unknown[];
  recommended_next_steps?: string[];
  hallucination_check?: boolean | null;
  source_agent?: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ExpansionOpportunityRepository {
  private supabase: ReturnType<typeof createServiceRoleSupabaseClient>;

  constructor() {
    this.supabase = createServiceRoleSupabaseClient();
  }

  /**
   * Persist a single expansion opportunity row.
   */
  async createOpportunity(
    input: CreateExpansionOpportunityInput,
  ): Promise<ExpansionOpportunityRecord> {
    const { data, error } = await this.supabase
      .from('expansion_opportunities')
      .insert({
        organization_id: input.organization_id,
        value_case_id: input.value_case_id,
        session_id: input.session_id ?? null,
        agent_run_id: input.agent_run_id ?? null,
        title: input.title,
        description: input.description,
        type: input.type,
        source_kpi_id: input.source_kpi_id ?? null,
        estimated_value_low: input.estimated_value_low ?? null,
        estimated_value_high: input.estimated_value_high ?? null,
        estimated_value_unit: input.estimated_value_unit ?? null,
        estimated_value_timeframe_months: input.estimated_value_timeframe_months ?? null,
        confidence: input.confidence ?? null,
        evidence: input.evidence ?? [],
        prerequisites: input.prerequisites ?? [],
        stakeholders: input.stakeholders ?? [],
        portfolio_summary: input.portfolio_summary ?? null,
        total_expansion_value_low: input.total_expansion_value_low ?? null,
        total_expansion_value_high: input.total_expansion_value_high ?? null,
        total_expansion_currency: input.total_expansion_currency ?? null,
        gap_analysis: input.gap_analysis ?? [],
        new_cycle_recommendations: input.new_cycle_recommendations ?? [],
        recommended_next_steps: input.recommended_next_steps ?? [],
        hallucination_check: input.hallucination_check ?? null,
        source_agent: input.source_agent ?? 'ExpansionAgent',
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create expansion opportunity', {
        service: 'ExpansionOpportunityRepository',
        caseId: input.value_case_id,
        orgId: input.organization_id,
        error: error.message,
      });
      throw new Error(`Failed to create expansion opportunity: ${error.message}`);
    }

    return data as ExpansionOpportunityRecord;
  }

  /**
   * Fetch all expansion opportunities for a case, newest first.
   * Returns an empty array when none exist.
   */
  async getForCase(
    caseId: string,
    orgId: string,
  ): Promise<ExpansionOpportunityRecord[]> {
    const { data, error } = await this.supabase
      .from('expansion_opportunities')
      .select('*')
      .eq('value_case_id', caseId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch expansion opportunities', {
        service: 'ExpansionOpportunityRepository',
        caseId,
        orgId,
        error: error.message,
      });
      throw new Error(`Failed to fetch expansion opportunities: ${error.message}`);
    }

    return (data ?? []) as ExpansionOpportunityRecord[];
  }

  /**
   * Fetch the most recent expansion opportunity batch for a case
   * (all rows sharing the latest agent_run_id).
   */
  async getLatestRunForCase(
    caseId: string,
    orgId: string,
  ): Promise<ExpansionOpportunityRecord[]> {
    // Get the latest agent_run_id first
    const { data: latest, error: latestError } = await this.supabase
      .from('expansion_opportunities')
      .select('agent_run_id, created_at')
      .eq('value_case_id', caseId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      logger.error('Failed to fetch latest expansion run', {
        service: 'ExpansionOpportunityRepository',
        caseId,
        orgId,
        error: latestError.message,
      });
      throw new Error(`Failed to fetch latest expansion run: ${latestError.message}`);
    }

    if (!latest) return [];

    const runId = (latest as { agent_run_id: string | null }).agent_run_id;

    // Fetch all rows from that run
    const query = this.supabase
      .from('expansion_opportunities')
      .select('*')
      .eq('value_case_id', caseId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    const { data, error } = runId
      ? await query.eq('agent_run_id', runId)
      : await query.limit(10);

    if (error) {
      logger.error('Failed to fetch expansion opportunities for run', {
        service: 'ExpansionOpportunityRepository',
        caseId,
        orgId,
        runId,
        error: error.message,
      });
      throw new Error(`Failed to fetch expansion opportunities: ${error.message}`);
    }

    return (data ?? []) as ExpansionOpportunityRecord[];
  }
}
