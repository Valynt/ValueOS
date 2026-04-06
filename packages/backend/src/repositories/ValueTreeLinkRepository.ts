/**
 * ValueTreeLinkRepository
 *
 * Persists and retrieves edges between nodes in a value tree.
 * Accepts an injected RLS-scoped Supabase client — no service_role access.
 * All queries are implicitly tenant-scoped via RLS on the authenticated client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../lib/logger.js';

export interface ValueTreeLinkRow {
  id: string;
  value_tree_id: string;
  parent_id: string;
  child_id: string;
  link_type: string;
  weight: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ValueTreeLinkWrite {
  value_tree_id: string;
  parent_id: string;
  child_id: string;
  link_type: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export class ValueTreeLinkRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<{ data: ValueTreeLinkRow | null; error: Error | null }> {
    const { data, error } = await this.supabase
      .from('value_tree_links')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('ValueTreeLinkRepository.findById failed', { id, error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as ValueTreeLinkRow | null, error: null };
  }

  async create(input: ValueTreeLinkWrite): Promise<{ data: ValueTreeLinkRow; error: null } | { data: null; error: Error }> {
    const { data, error } = await this.supabase
      .from('value_tree_links')
      .insert({
        value_tree_id: input.value_tree_id,
        parent_id: input.parent_id,
        child_id: input.child_id,
        link_type: input.link_type,
        weight: input.weight ?? 1.0,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      logger.error('ValueTreeLinkRepository.create failed', { error: error.message });
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as ValueTreeLinkRow, error: null };
  }
}
