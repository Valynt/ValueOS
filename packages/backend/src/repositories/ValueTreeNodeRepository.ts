/**
 * ValueTreeNodeRepository
 *
 * Persists and retrieves individual nodes within a value tree.
 * Accepts an injected RLS-scoped Supabase client — no service_role access.
 * All queries are implicitly tenant-scoped via RLS on the authenticated client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../lib/logger.js';

export interface ValueTreeNodeRow {
  id: string;
  value_tree_id: string;
  node_id: string | null;
  label: string;
  type: string | null;
  reference_id: string | null;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface ValueTreeNodeWrite {
  value_tree_id: string;
  node_id?: string;
  label: string;
  type?: string;
  reference_id?: string;
  properties?: Record<string, unknown>;
}

export class ValueTreeNodeRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<{ data: ValueTreeNodeRow | null; error: Error | null }> {
    const { data, error } = await this.supabase
      .from('value_tree_nodes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('ValueTreeNodeRepository.findById failed', { id, error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as ValueTreeNodeRow | null, error: null };
  }

  async create(input: ValueTreeNodeWrite): Promise<{ data: ValueTreeNodeRow; error: null } | { data: null; error: Error }> {
    const { data, error } = await this.supabase
      .from('value_tree_nodes')
      .insert({
        value_tree_id: input.value_tree_id,
        node_id: input.node_id ?? null,
        label: input.label,
        type: input.type ?? null,
        reference_id: input.reference_id ?? null,
        properties: input.properties ?? {},
      })
      .select()
      .single();

    if (error) {
      logger.error('ValueTreeNodeRepository.create failed', { error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as ValueTreeNodeRow, error: null };
  }
}
