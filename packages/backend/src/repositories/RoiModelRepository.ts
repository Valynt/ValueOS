/**
 * RoiModelRepository
 *
 * Persists and retrieves ROI model records.
 * Accepts an injected RLS-scoped Supabase client — no service_role access.
 * All queries are implicitly tenant-scoped via RLS on the authenticated client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../lib/logger.js';

export interface RoiModelRow {
  id: string;
  value_tree_id: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RoiModelWrite {
  value_tree_id: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export class RoiModelRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<{ data: RoiModelRow | null; error: Error | null }> {
    const { data, error } = await this.supabase
      .from('roi_models')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('RoiModelRepository.findById failed', { id, error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as RoiModelRow | null, error: null };
  }

  async create(input: RoiModelWrite): Promise<{ data: RoiModelRow; error: null } | { data: null; error: Error }> {
    const { data, error } = await this.supabase
      .from('roi_models')
      .insert({
        value_tree_id: input.value_tree_id,
        name: input.name ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      logger.error('RoiModelRepository.create failed', { error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as RoiModelRow, error: null };
  }
}
