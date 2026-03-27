// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from '../../lib/supabase.js';

export interface OpportunityRoutingSnapshot {
  id: string;
  lifecycle_stage?: string;
  confidence_score?: number;
  value_maturity?: 'low' | 'medium' | 'high';
}

export interface HypothesisRoutingSnapshot {
  id: string;
  confidence?: 'high' | 'medium' | 'low';
  confidence_score?: number;
  evidence_count?: number;
  best_evidence_tier?: 'silver' | 'gold' | 'platinum';
}

export interface BusinessCaseRoutingSnapshot {
  id: string;
  status?: 'draft' | 'in_review' | 'approved' | 'presented' | 'archived';
  assumptions_reviewed?: boolean;
}

export interface DecisionContextSnapshot {
  opportunity: OpportunityRoutingSnapshot | null;
  hypothesis: HypothesisRoutingSnapshot | null;
  businessCase: BusinessCaseRoutingSnapshot | null;
}

export interface DecisionContextRepository {
  getSnapshot(opportunityId: string, organizationId: string): Promise<DecisionContextSnapshot>;
}

const CONFIDENCE_TO_SCORE: Record<'high' | 'medium' | 'low', number> = {
  high: 0.85,
  medium: 0.6,
  low: 0.35,
};

export class SupabaseDecisionContextRepository implements DecisionContextRepository {
  private readonly supabase = createServerSupabaseClient();

  async getSnapshot(opportunityId: string, organizationId: string): Promise<DecisionContextSnapshot> {
    const [opportunityRes, hypothesisRes, businessCaseRes] = await Promise.all([
      this.supabase
        .from('opportunities')
        .select('id,lifecycle_stage,confidence_score,value_maturity')
        .eq('id', opportunityId)
        .eq('organization_id', organizationId)
        .maybeSingle(),
      this.supabase
        .from('hypothesis_outputs')
        .select('id,confidence_level,confidence,evidence_count,best_evidence_tier,created_at')
        .eq('opportunity_id', opportunityId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.supabase
        .from('business_cases')
        .select('id,status,assumptions_reviewed,created_at')
        .eq('opportunity_id', opportunityId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const opportunity = opportunityRes.error || !opportunityRes.data
      ? null
      : {
          id: String(opportunityRes.data.id),
          lifecycle_stage: opportunityRes.data.lifecycle_stage ? String(opportunityRes.data.lifecycle_stage) : undefined,
          confidence_score: typeof opportunityRes.data.confidence_score === 'number' ? opportunityRes.data.confidence_score : undefined,
          value_maturity: opportunityRes.data.value_maturity === 'low' || opportunityRes.data.value_maturity === 'medium' || opportunityRes.data.value_maturity === 'high'
            ? opportunityRes.data.value_maturity
            : undefined,
        };

    const hypothesis = hypothesisRes.error || !hypothesisRes.data
      ? null
      : (() => {
          const confidenceRaw = hypothesisRes.data.confidence_level ?? hypothesisRes.data.confidence;
          const confidence = confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
            ? confidenceRaw
            : undefined;

          return {
            id: String(hypothesisRes.data.id),
            confidence,
            confidence_score: typeof hypothesisRes.data.confidence === 'number'
              ? hypothesisRes.data.confidence
              : confidence ? CONFIDENCE_TO_SCORE[confidence] : undefined,
            evidence_count: typeof hypothesisRes.data.evidence_count === 'number' ? hypothesisRes.data.evidence_count : undefined,
            best_evidence_tier: hypothesisRes.data.best_evidence_tier === 'silver'
              || hypothesisRes.data.best_evidence_tier === 'gold'
              || hypothesisRes.data.best_evidence_tier === 'platinum'
              ? hypothesisRes.data.best_evidence_tier
              : undefined,
          };
        })();

    const businessCase = businessCaseRes.error || !businessCaseRes.data
      ? null
      : {
          id: String(businessCaseRes.data.id),
          status: businessCaseRes.data.status === 'draft'
            || businessCaseRes.data.status === 'in_review'
            || businessCaseRes.data.status === 'approved'
            || businessCaseRes.data.status === 'presented'
            || businessCaseRes.data.status === 'archived'
            ? businessCaseRes.data.status
            : undefined,
          assumptions_reviewed: typeof businessCaseRes.data.assumptions_reviewed === 'boolean'
            ? businessCaseRes.data.assumptions_reviewed
            : undefined,
        };

    return { opportunity, hypothesis, businessCase };
  }
}
