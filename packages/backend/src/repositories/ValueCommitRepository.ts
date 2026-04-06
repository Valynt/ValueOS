/**
 * ValueCommitRepository
 *
 * Persists and retrieves value commitment records.
 * Accepts an injected RLS-scoped Supabase client — no service_role access.
 * All queries are implicitly tenant-scoped via RLS on the authenticated client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../lib/logger.js';

export interface ValueCommitRow {
  id: string;
  value_tree_id: string;
  value_case_id: string;
  committed_value: number | null;
  currency: string | null;
  timeframe_months: number | null;
  confidence: number | null;
  status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ValueCommitWrite {
  value_tree_id: string;
  value_case_id: string;
  committed_value?: number;
  currency?: string;
  timeframe_months?: number;
  confidence?: number;
  status?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export class ValueCommitRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<{ data: ValueCommitRow | null; error: Error | null }> {
    const { data, error } = await this.supabase
      .from('value_commits')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('ValueCommitRepository.findById failed', { id, error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as ValueCommitRow | null, error: null };
  }

  async create(input: ValueCommitWrite): Promise<{ data: ValueCommitRow; error: null } | { data: null; error: Error }> {
    const { data, error } = await this.supabase
      .from('value_commits')
      .insert({
        value_tree_id: input.value_tree_id,
        value_case_id: input.value_case_id,
        committed_value: input.committed_value ?? null,
        currency: input.currency ?? null,
        timeframe_months: input.timeframe_months ?? null,
        confidence: input.confidence ?? null,
        status: input.status ?? null,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      logger.error('ValueCommitRepository.create failed', { error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as ValueCommitRow, error: null };
  }
}
