/**
 * KpiTargetRepository
 *
 * Persists and retrieves KPI target records linked to value commitments.
 * Accepts an injected RLS-scoped Supabase client — no service_role access.
 * All queries are implicitly tenant-scoped via RLS on the authenticated client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../lib/logger.js';

export interface KpiTargetRow {
  id: string;
  value_commit_id: string;
  kpi_hypothesis_id: string | null;
  name: string | null;
  unit: string | null;
  baseline_value: number | null;
  target_value: number | null;
  timeframe_months: number | null;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KpiTargetWrite {
  value_commit_id: string;
  kpi_hypothesis_id?: string;
  name?: string;
  unit?: string;
  baseline_value?: number;
  target_value?: number;
  timeframe_months?: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export class KpiTargetRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<{ data: KpiTargetRow | null; error: Error | null }> {
    const { data, error } = await this.supabase
      .from('kpi_targets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('KpiTargetRepository.findById failed', { id, error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as KpiTargetRow | null, error: null };
  }

  async create(input: KpiTargetWrite): Promise<{ data: KpiTargetRow; error: null } | { data: null; error: Error }> {
    const { data, error } = await this.supabase
      .from('kpi_targets')
      .insert({
        value_commit_id: input.value_commit_id,
        kpi_hypothesis_id: input.kpi_hypothesis_id ?? null,
        name: input.name ?? null,
        unit: input.unit ?? null,
        baseline_value: input.baseline_value ?? null,
        target_value: input.target_value ?? null,
        timeframe_months: input.timeframe_months ?? null,
        confidence: input.confidence ?? null,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      logger.error('KpiTargetRepository.create failed', { error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as KpiTargetRow, error: null };
  }
}
