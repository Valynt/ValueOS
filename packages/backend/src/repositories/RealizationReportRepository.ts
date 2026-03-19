/**
 * RealizationReportRepository
 *
 * Persists and retrieves RealizationAgent outputs from the realization_reports
 * table. All queries are scoped to organization_id (tenant isolation).
 */

import { createLogger } from '@shared/lib/logger';

import { createServiceRoleSupabaseClient } from '../lib/supabase.js';

const logger = createLogger({ service: 'RealizationReportRepository' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KPIRealization {
  kpi_id: string;
  kpi_name: string;
  committed_value: number;
  realized_value: number;
  unit: string;
  variance_percentage: number;
  direction: 'over' | 'under' | 'on_target';
  confidence: number;
}

export interface Milestone {
  id: string;
  title: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'at_risk';
  owner?: string;
}

export interface Risk {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
}

export interface RealizationReportPayload {
  session_id?: string;
  kpis: KPIRealization[];
  milestones: Milestone[];
  risks: Risk[];
  variance_analysis: Record<string, unknown>;
  hallucination_check?: boolean;
  source_agent?: string;
}

export interface RealizationReport extends RealizationReportPayload {
  id: string;
  organization_id: string;
  value_case_id: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class RealizationReportRepository {
  private supabase: ReturnType<typeof createServiceRoleSupabaseClient>;

  constructor() {
    this.supabase = createServiceRoleSupabaseClient();
  }

  async createReport(
    caseId: string,
    orgId: string,
    payload: RealizationReportPayload,
  ): Promise<RealizationReport> {
    const overallRate = typeof payload.variance_analysis?.['overall_realization_rate'] === 'number'
      ? payload.variance_analysis['overall_realization_rate']
      : null;

    const { data, error } = await this.supabase
      .from('realization_reports')
      .insert({
        organization_id: orgId,
        value_case_id: caseId,
        session_id: payload.session_id ?? null,
        kpis: payload.kpis,
        milestones: payload.milestones,
        risks: payload.risks,
        variance_analysis: payload.variance_analysis,
        hallucination_check: payload.hallucination_check ?? null,
        source_agent: payload.source_agent ?? 'RealizationAgent',
        // Promoted scalar columns — avoids jsonb parsing for aggregation queries
        kpi_count: payload.kpis.length,
        milestone_count: payload.milestones.length,
        risk_count: payload.risks.length,
        overall_realization_rate: overallRate,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create realization report', { caseId, orgId, error: error.message });
      throw new Error(`RealizationReportRepository.createReport: ${error.message}`);
    }

    return data as RealizationReport;
  }

  async getLatestForCase(
    caseId: string,
    orgId: string,
  ): Promise<RealizationReport | null> {
    const { data, error } = await this.supabase
      .from('realization_reports')
      .select('*')
      .eq('value_case_id', caseId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch realization report', { caseId, orgId, error: error.message });
      throw new Error(`RealizationReportRepository.getLatestForCase: ${error.message}`);
    }

    return data as RealizationReport | null;
  }
}
