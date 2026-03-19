/**
 * ValueTreeRepository
 *
 * Persists and retrieves value_tree_nodes for a value case.
 * Uses replace semantics: a new agent run deletes all prior generated nodes
 * for the case and inserts the new set atomically.
 *
 * All operations are scoped to (case_id, organization_id).
 */

import { z } from 'zod';

import { logger } from '../lib/logger.js';
import { supabase } from '../lib/supabase.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ValueTreeNodeWriteSchema = z.object({
  node_key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  driver_type: z.enum(['revenue', 'cost', 'efficiency', 'risk', 'other']).optional(),
  impact_estimate: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
  parent_node_key: z.string().optional(),
  sort_order: z.number().int().default(0),
  source_agent: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type ValueTreeNodeWrite = z.infer<typeof ValueTreeNodeWriteSchema>;

export interface ValueTreeNodeRow {
  id: string;
  case_id: string;
  organization_id: string;
  parent_id: string | null;
  node_key: string | null;
  label: string;
  description: string | null;
  driver_type: string | null;
  impact_estimate: number | null;
  confidence: number | null;
  sort_order: number;
  source_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ValueTreeParentLink {
  node_id: string;
  parent_id: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ValueTreeRepository {
  /**
   * Fetch all nodes for a case ordered by sort_order.
   */
  async getNodesForCase(
    caseId: string,
    organizationId: string,
  ): Promise<ValueTreeNodeRow[]> {
    const { data, error } = await supabase
      .from('value_tree_nodes')
      .select('*')
      .eq('case_id', caseId)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('ValueTreeRepository.getNodesForCase failed', {
        case_id: caseId,
        organization_id: organizationId,
        error: error.message,
      });
      throw new Error(`Failed to fetch value tree nodes: ${error.message}`);
    }

    return (data ?? []) as ValueTreeNodeRow[];
  }

  /**
   * Replace all nodes for a case with the provided flat list.
   * Deletes existing nodes then inserts the new set.
   * Parent/child relationships are resolved via node_key -> id mapping.
   */
  async replaceNodesForCase(
    caseId: string,
    organizationId: string,
    nodes: ValueTreeNodeWrite[],
  ): Promise<ValueTreeNodeRow[]> {
    const validated = nodes.map((n) => ValueTreeNodeWriteSchema.parse(n));

    const { error: deleteError } = await supabase
      .from('value_tree_nodes')
      .delete()
      .eq('case_id', caseId)
      .eq('organization_id', organizationId);

    if (deleteError) {
      logger.error('ValueTreeRepository.replaceNodesForCase delete failed', {
        case_id: caseId,
        organization_id: organizationId,
        error: deleteError.message,
      });
      throw new Error(`Failed to clear value tree: ${deleteError.message}`);
    }

    if (validated.length === 0) {
      return [];
    }

    const { data: inserted, error: insertError } = await supabase
      .from('value_tree_nodes')
      .insert(
        validated.map((n, i) => ({
          case_id: caseId,
          organization_id: organizationId,
          node_key: n.node_key,
          label: n.label,
          description: n.description ?? null,
          driver_type: n.driver_type ?? null,
          impact_estimate: n.impact_estimate ?? null,
          confidence: n.confidence ?? null,
          sort_order: n.sort_order ?? i,
          source_agent: n.source_agent ?? null,
          metadata: n.metadata,
          parent_id: null,
        })),
      )
      .select('id, node_key');

    if (insertError || !inserted) {
      logger.error('ValueTreeRepository.replaceNodesForCase insert failed', {
        case_id: caseId,
        organization_id: organizationId,
        error: insertError?.message,
      });
      throw new Error(`Failed to insert value tree nodes: ${insertError?.message}`);
    }

    // Build node_key -> id map for parent resolution
    const keyToId = new Map<string, string>(
      inserted
        .filter((row) => typeof row.node_key === 'string' && typeof row.id === 'string')
        .map((row) => [row.node_key as string, row.id as string]),
    );

    const parentUpdates: ValueTreeParentLink[] = validated
      .filter((n) => n.parent_node_key && keyToId.has(n.parent_node_key))
      .map((n) => ({
        node_id: keyToId.get(n.node_key)!,
        parent_id: keyToId.get(n.parent_node_key!)!,
      }));

    if (parentUpdates.length > 0) {
      const { error: parentUpdateError } = await supabase.rpc('bulk_update_value_tree_node_parents', {
        p_case_id: caseId,
        p_organization_id: organizationId,
        p_parent_links: parentUpdates,
      });

      if (parentUpdateError) {
        logger.warn('ValueTreeRepository: failed to set parent_id', {
          case_id: caseId,
          organization_id: organizationId,
          parent_links: parentUpdates.length,
          error: parentUpdateError.message,
        });
      }
    }

    logger.info('ValueTreeRepository: nodes replaced', {
      case_id: caseId,
      organization_id: organizationId,
      node_count: validated.length,
      parent_links: parentUpdates.length,
    });

    return this.getNodesForCase(caseId, organizationId);
  }

  /**
   * Delete all nodes for a case.
   */
  async deleteNodesForCase(
    caseId: string,
    organizationId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('value_tree_nodes')
      .delete()
      .eq('case_id', caseId)
      .eq('organization_id', organizationId);

    if (error) {
      logger.error('ValueTreeRepository.deleteNodesForCase failed', {
        case_id: caseId,
        organization_id: organizationId,
        error: error.message,
      });
      throw new Error(`Failed to delete value tree nodes: ${error.message}`);
    }
  }
}

export const valueTreeRepository = new ValueTreeRepository();
