/**
 * NarrativeDraftRepository
 *
 * Persists and retrieves NarrativeAgent outputs from the narrative_drafts
 * table. All queries are scoped to organization_id (tenant isolation).
 */

import { createLogger } from '@shared/lib/logger';

// service-role:justified repositories/ allowlisted; no request JWT available for background agent/worker writes
import { createServiceRoleSupabaseClient } from '../lib/supabase.js';

const logger = createLogger({ service: 'NarrativeDraftRepository' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NarrativeFormat =
  | 'executive_summary'
  | 'technical'
  | 'board_deck'
  | 'customer_facing';

export interface NarrativeDraftPayload {
  session_id?: string;
  content: string;
  format?: NarrativeFormat;
  defense_readiness_score?: number;
  hallucination_check?: boolean;
  source_agent?: string;
}

export interface NarrativeDraft extends NarrativeDraftPayload {
  id: string;
  organization_id: string;
  value_case_id: string;
  format: NarrativeFormat;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class NarrativeDraftRepository {
  private supabase: ReturnType<typeof createServiceRoleSupabaseClient>;

  constructor() {
    this.supabase = createServiceRoleSupabaseClient();
  }

  async createDraft(
    caseId: string,
    orgId: string,
    payload: NarrativeDraftPayload,
  ): Promise<NarrativeDraft> {
    const { data, error } = await this.supabase
      .from('narrative_drafts')
      .insert({
        organization_id: orgId,
        value_case_id: caseId,
        session_id: payload.session_id ?? null,
        content: payload.content,
        format: payload.format ?? 'executive_summary',
        defense_readiness_score: payload.defense_readiness_score ?? null,
        hallucination_check: payload.hallucination_check ?? null,
        source_agent: payload.source_agent ?? 'NarrativeAgent',
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create narrative draft', { caseId, orgId, error: error.message });
      throw new Error(`NarrativeDraftRepository.createDraft: ${error.message}`);
    }

    return data as NarrativeDraft;
  }

  async getLatestForCase(
    caseId: string,
    orgId: string,
  ): Promise<NarrativeDraft | null> {
    const { data, error } = await this.supabase
      .from('narrative_drafts')
      .select('*')
      .eq('value_case_id', caseId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch narrative draft', { caseId, orgId, error: error.message });
      throw new Error(`NarrativeDraftRepository.getLatestForCase: ${error.message}`);
    }

    return data as NarrativeDraft | null;
  }
}
