/**
 * Database row types for Sprint 12 persistent memory tables.
 * Mirrors the schema in 20260322000000_persistent_memory_tables.sql.
 */

// ---------------------------------------------------------------------------
// semantic_memory
// ---------------------------------------------------------------------------

export type SemanticMemoryType =
  | 'value_proposition'
  | 'target_definition'
  | 'opportunity'
  | 'integrity_check'
  | 'workflow_result'
  | 'narrative'
  | 'realization'
  | 'expansion_opportunity';

export interface SemanticMemoryRow {
  id: string;
  organization_id: string;
  type: SemanticMemoryType;
  content: string;
  /** pgvector float4[] — null until embedding is generated */
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  source_agent: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SemanticMemoryInsert {
  organization_id: string;
  type: SemanticMemoryType;
  content: string;
  embedding?: number[] | null;
  metadata?: Record<string, unknown>;
  source_agent?: string;
  session_id?: string | null;
}

/** Row returned by match_semantic_memory / match_semantic_memory_hybrid RPCs */
export interface SemanticMemoryMatch {
  id: string;
  type: SemanticMemoryType;
  content: string;
  metadata: Record<string, unknown>;
  source_agent: string;
  session_id: string | null;
  similarity: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// expansion_opportunities
// ---------------------------------------------------------------------------

export type ExpansionOpportunityType =
  | 'upsell'
  | 'cross_sell'
  | 'new_use_case'
  | 'geographic_expansion'
  | 'deeper_adoption';

export interface ExpansionOpportunityRow {
  id: string;
  organization_id: string;
  value_case_id: string;
  session_id: string | null;
  agent_run_id: string | null;

  title: string;
  description: string;
  type: ExpansionOpportunityType;
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

export interface ExpansionOpportunityInsert {
  organization_id: string;
  value_case_id: string;
  session_id?: string | null;
  agent_run_id?: string | null;
  title: string;
  description: string;
  type: ExpansionOpportunityType;
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
