
/**
 * CaseValueTreeService
 *
 * Manages value_tree_nodes for a value case. Backed by the
 * value_tree_nodes table added in migration 20260310000000.
 * All queries are scoped to organization_id.
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { supabase } from "../../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ValueTreeNodeInputSchema = z.object({
  id: z.string().uuid().optional(),
  case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  label: z.string().min(1),
  value: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  node_type: z.enum(["root", "driver", "assumption", "kpi"]).default("driver"),
  metadata: z.record(z.unknown()).default({}),
  sort_order: z.number().int().default(0),
});

export type ValueTreeNodeInput = z.infer<typeof ValueTreeNodeInputSchema>;

export interface ValueTreeNodeRow {
  id: string;
  case_id: string;
  organization_id: string;
  parent_id: string | null;
  label: string;
  value: number | null;
  unit: string | null;
  node_type: "root" | "driver" | "assumption" | "kpi";
  metadata: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CaseValueTreeService {
  /**
   * Fetch all nodes for a case, ordered by sort_order.
   */
  async getTree(
    caseId: string,
    organizationId: string,
  ): Promise<ValueTreeNodeRow[]> {
    const { data, error } = await supabase
      .from("value_tree_nodes")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });

    if (error) {
      logger.error("CaseValueTreeService.getTree failed", {
        case_id: caseId,
        organization_id: organizationId,
        error: error.message,
      });
      throw new Error(`Failed to fetch value tree: ${error.message}`);
    }

    return (data ?? []) as ValueTreeNodeRow[];
  }

  /**
   * Replace all nodes for a case with the provided set.
   * Deletes existing nodes then inserts the new ones.
   */
  async replaceTree(
    caseId: string,
    organizationId: string,
    nodes: Omit<ValueTreeNodeInput, "case_id" | "organization_id">[],
  ): Promise<ValueTreeNodeRow[]> {
    const validated = nodes.map((n, i) =>
      ValueTreeNodeInputSchema.parse({
        ...n,
        case_id: caseId,
        organization_id: organizationId,
        sort_order: n.sort_order ?? i,
      }),
    );

    const { error: deleteError } = await supabase
      .from("value_tree_nodes")
      .delete()
      .eq("case_id", caseId)
      .eq("organization_id", organizationId);

    if (deleteError) {
      logger.error("CaseValueTreeService.replaceTree delete failed", {
        case_id: caseId,
        organization_id: organizationId,
        error: deleteError.message,
      });
      throw new Error(`Failed to clear value tree: ${deleteError.message}`);
    }

    if (validated.length === 0) {
      return [];
    }

    const { data, error: insertError } = await supabase
      .from("value_tree_nodes")
      .insert(
        validated.map((n) => ({
          case_id: n.case_id,
          organization_id: n.organization_id,
          parent_id: n.parent_id ?? null,
          label: n.label,
          value: n.value ?? null,
          unit: n.unit ?? null,
          node_type: n.node_type,
          metadata: n.metadata,
          sort_order: n.sort_order,
        })),
      )
      .select("*");

    if (insertError) {
      logger.error("CaseValueTreeService.replaceTree insert failed", {
        case_id: caseId,
        organization_id: organizationId,
        error: insertError.message,
      });
      throw new Error(`Failed to insert value tree nodes: ${insertError.message}`);
    }

    logger.info("Value tree replaced", {
      case_id: caseId,
      organization_id: organizationId,
      node_count: validated.length,
    });

    return (data ?? []) as ValueTreeNodeRow[];
  }

  /**
   * Upsert a single node. Updates by id if provided, otherwise inserts.
   */
  async upsertNode(node: ValueTreeNodeInput): Promise<ValueTreeNodeRow> {
    const validated = ValueTreeNodeInputSchema.parse(node);

    const payload = {
      case_id: validated.case_id,
      organization_id: validated.organization_id,
      parent_id: validated.parent_id ?? null,
      label: validated.label,
      value: validated.value ?? null,
      unit: validated.unit ?? null,
      node_type: validated.node_type,
      metadata: validated.metadata,
      sort_order: validated.sort_order,
    };

    if (validated.id) {
      const { data, error } = await supabase
        .from("value_tree_nodes")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", validated.id)
        .eq("organization_id", validated.organization_id)
        .select("*")
        .single();

      if (error) {
        logger.error("CaseValueTreeService.upsertNode update failed", {
          id: validated.id,
          organization_id: validated.organization_id,
          error: error.message,
        });
        throw new Error(`Failed to update value tree node: ${error.message}`);
      }

      return data as ValueTreeNodeRow;
    }

    const { data, error } = await supabase
      .from("value_tree_nodes")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      logger.error("CaseValueTreeService.upsertNode insert failed", {
        case_id: validated.case_id,
        organization_id: validated.organization_id,
        error: error.message,
      });
      throw new Error(`Failed to insert value tree node: ${error.message}`);
    }

    return data as ValueTreeNodeRow;
  }
}

export const caseValueTreeService = new CaseValueTreeService();
