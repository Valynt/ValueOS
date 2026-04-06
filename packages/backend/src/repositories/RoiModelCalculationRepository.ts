/**
 * RoiModelCalculationRepository
 *
 * Persists and retrieves individual calculation records within an ROI model.
 * Accepts an injected RLS-scoped Supabase client — no service_role access.
 * All queries are implicitly tenant-scoped via RLS on the authenticated client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../lib/logger.js';

export interface RoiModelCalculationRow {
  id: string;
  roi_model_id: string;
  name: string | null;
  formula: string | null;
  result: number | null;
  input_variables: unknown[];
  source_references: Record<string, unknown>;
  reasoning_trace: unknown;
  created_at: string;
}

export interface RoiModelCalculationWrite {
  roi_model_id: string;
  name?: string;
  formula?: string;
  result?: number;
  input_variables?: unknown[];
  source_references?: Record<string, unknown>;
  reasoning_trace?: unknown;
  [key: string]: unknown;
}

export class RoiModelCalculationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<{ data: RoiModelCalculationRow | null; error: Error | null }> {
    const { data, error } = await this.supabase
      .from('roi_model_calculations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('RoiModelCalculationRepository.findById failed', { id, error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as RoiModelCalculationRow | null, error: null };
  }

  async create(input: RoiModelCalculationWrite): Promise<{ data: RoiModelCalculationRow; error: null } | { data: null; error: Error }> {
    const { data, error } = await this.supabase
      .from('roi_model_calculations')
      .insert({
        roi_model_id: input.roi_model_id,
        name: input.name ?? null,
        formula: input.formula ?? null,
        result: input.result ?? null,
        input_variables: input.input_variables ?? [],
        source_references: input.source_references ?? {},
        reasoning_trace: input.reasoning_trace ?? null,
      })
      .select()
      .single();

    if (error) {
      logger.error('RoiModelCalculationRepository.create failed', { error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as RoiModelCalculationRow, error: null };
  }
}
