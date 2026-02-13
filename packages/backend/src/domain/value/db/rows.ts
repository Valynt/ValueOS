// DB row access module for value domain tables
// All functions require tenant_id as first argument

import { createClient } from '@supabase/supabase-js';

// TODO(ticket:VOS-DEBT-1427 owner:team-valueos date:2026-02-13): Import generated Supabase types if available
// import { Database } from '...';

// Minimal row types (replace with generated types if available)
export interface ValueCaseRow {
  id: string;
  tenant_id: string;
  state: string;
  committed_at?: string;
  last_modified_by?: string;
  // ...other fields
}

export interface OpportunityRow {
  id: string;
  tenant_id: string;
  // ...other fields
}

export interface ValueDriverRow {
  id: string;
  tenant_id: string;
  value_case_id: string;
  parent_id?: string;
  label: string;
  driver_type: string;
  value?: number;
  // ...other fields
}

export interface ValueCommitmentRow {
  id: string;
  tenant_id: string;
  session_id: string;
  user_id: string;
  organization_id?: string;
  title: string;
  description: string;
  commitment_type: string;
  priority: string;
  financial_impact: Record<string, any>;
  currency: string;
  timeframe_months: number;
  status: string;
  progress_percentage: number;
  confidence_level: number;
  committed_at: string;
  target_completion_date: string;
  actual_completion_date?: string;
  ground_truth_references: Record<string, any>;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Example: get value commitments for a case (via session_id)
export async function getValueCommitmentsForCase(supabase: ReturnType<typeof createClient>, tenant_id: string, value_case_id: string): Promise<ValueCommitmentRow[]> {
  // First get the value case to find session_id
  const valueCase = await getValueCase(supabase, tenant_id, value_case_id);
  if (!valueCase) return [];
  
  const { data, error } = await supabase
    .from<ValueCommitmentRow>('value_commitments')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('session_id', valueCase.session_id); // Assuming value_cases has session_id
  if (error) throw error;
  return data || [];
}

// Example: get a value case by tenant and id
export async function getValueCase(supabase: ReturnType<typeof createClient>, tenant_id: string, value_case_id: string): Promise<ValueCaseRow | null> {
  const { data, error } = await supabase
    .from<ValueCaseRow>('value_cases')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('id', value_case_id)
    .single();
  if (error) throw error;
  return data;
}

// Example: list value drivers for a case
export async function listValueDriversForCase(supabase: ReturnType<typeof createClient>, tenant_id: string, value_case_id: string): Promise<ValueDriverRow[]> {
  const { data, error } = await supabase
    .from<ValueDriverRow>('value_drivers')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('value_case_id', value_case_id);
  if (error) throw error;
  return data || [];
}

// Example: get financial model for a case
export async function getFinancialModelForCase(supabase: ReturnType<typeof createClient>, tenant_id: string, value_case_id: string): Promise<FinancialModelRow | null> {
  const { data, error } = await supabase
    .from<FinancialModelRow>('financial_models')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('value_case_id', value_case_id)
    .single();
  if (error) throw error;
  return data;
}
