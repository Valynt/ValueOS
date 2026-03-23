// DB row access module for value domain tables
// All functions require tenant_id as first argument

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../../lib/logger.js';
import type { Database } from '../../../types/supabase-generated.js';

// Use generated Supabase types for full type safety
export type ValueCaseRow = Database['public']['Tables']['value_cases']['Row'];
export type OpportunityRow = Database['public']['Tables']['opportunities']['Row'];
export type ValueDriverRow = Database['public']['Tables']['value_drivers']['Row'];
export type ValueCommitmentRow = Database['public']['Tables']['value_commitments']['Row'];
export type FinancialModelRow = Database['public']['Tables']['financial_models']['Row'];

// Example: get value commitments for a case (via session_id)
export async function getValueCommitmentsForCase(supabase: SupabaseClient, tenant_id: string, value_case_id: string): Promise<ValueCommitmentRow[]> {
  // First get the value case to find session_id
  const valueCase = await getValueCase(supabase, tenant_id, value_case_id);
  if (!valueCase) return [];

  const { data, error } = await supabase
    .from('value_commitments')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('session_id', valueCase.session_id);

  if (error) {
    logger.error('Error fetching value commitments:', { error });
    return [];
  }

  return data || [];
}

// Example: get a value case by tenant and id
export async function getValueCase(supabase: SupabaseClient, tenant_id: string, value_case_id: string): Promise<ValueCaseRow | null> {
  const { data, error } = await supabase
    .from('value_cases')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('id', value_case_id)
    .single();

  if (error) {
    logger.error('Error fetching value case:', { error });
    return null;
  }

  return data;
}

// Example: list value drivers for a case
export async function listValueDriversForCase(supabase: SupabaseClient, tenant_id: string, value_case_id: string): Promise<ValueDriverRow[]> {
  const { data, error } = await supabase
    .from('value_drivers')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('value_case_id', value_case_id);

  if (error) {
    console.error('Error fetching value drivers:', error);
    return [];
  }

  return data || [];
}

// FinancialModelRow is now imported from generated types
// export interface FinancialModelRow { ... }

// Example: get financial model for a case
export async function getFinancialModelForCase(supabase: SupabaseClient, tenant_id: string, value_case_id: string): Promise<FinancialModelRow | null> {
  const { data, error } = await supabase
    .from('financial_models')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('value_case_id', value_case_id)
    .single();

  if (error) {
    console.error('Error fetching financial model:', error);
    return null;
  }

  return data;
}
