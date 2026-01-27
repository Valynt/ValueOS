// DB row access module for value domain tables
// All functions require tenant_id as first argument

import { createClient } from '@supabase/supabase-js';

// TODO: Import generated Supabase types if available
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

export interface FinancialModelRow {
  id: string;
  tenant_id: string;
  value_case_id: string;
  assumptions?: Record<string, number>;
  outputs?: Record<string, number>;
  // ...other fields
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
