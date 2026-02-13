import { getSupabaseClient } from "../lib/supabase";
import { logger } from "../lib/logger";
import type { Canvas, CanvasNode, CanvasEdge, CanvasNodeType } from "../features/canvas/types";

export class CanvasService {
  /**
   * Get canvas by ID (which corresponds to value_case_id)
   */
  async getCanvas(canvasId: string, tenantId: string): Promise<Canvas | null> {
    const supabase = getSupabaseClient();

    try {
      // 1. Fetch value case metadata to ensure it exists and we have access
      const { data: valueCase, error: caseError } = await supabase
        .from("value_cases")
        .select("id, name, created_at, updated_at")
        .eq("id", canvasId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (caseError) {
        logger.error("Error fetching value case for canvas", caseError, { canvasId, tenantId });
        throw caseError;
      }

      if (!valueCase) {
        logger.warn("Value case not found for canvas", { canvasId, tenantId });
        return null;
      }

      // 2. Fetch canvas elements
      const { data: elements, error: elementsError } = await supabase
        .from("canvas_elements")
        .select("*")
        .eq("value_case_id", canvasId);

      if (elementsError) {
        logger.error("Error fetching canvas elements", elementsError, { canvasId, tenantId });
        throw elementsError;
      }

      // 3. Transform elements into nodes and edges
      const nodes: CanvasNode[] = [];
      const edges: CanvasEdge[] = [];

      (elements || []).forEach((el: any) => {
        if (el.element_type === "connector") {
          // It's an edge
          const content = el.content || {};
          if (content.source && content.target) {
            edges.push({
              id: el.id,
              source: content.source,
              target: content.target,
              type: content.type || "default",
              label: content.label,
            });
          }
        } else {
          // It's a node
          // Map DB element types to CanvasNodeType
          let nodeType: CanvasNodeType = "text"; // Default

          // Simple mapping or pass-through if types align
          if (["text", "card", "metric", "chart", "image"].includes(el.element_type)) {
             nodeType = el.element_type as CanvasNodeType;
          } else if (el.element_type === "sticky_note") {
             nodeType = "card"; // Map sticky_note to card for now
          } else if (el.element_type === "shape") {
             nodeType = "text"; // Fallback for shape
          }

          nodes.push({
            id: el.id,
            type: nodeType,
            position: {
              x: Number(el.position_x) || 0,
              y: Number(el.position_y) || 0,
            },
            data: {
              ...el.content,
              style: el.style,
              width: el.width,
              height: el.height,
              locked: el.locked,
              zIndex: el.z_index,
            },
            selected: false,
          });
        }
      });

      return {
        id: valueCase.id,
        name: valueCase.name,
        nodes,
        edges,
        viewport: { x: 0, y: 0, zoom: 1 }, // TODO(ticket:VOS-DEBT-1427 owner:team-valueos date:2026-02-13): Store viewport in DB?
        createdAt: valueCase.created_at,
        updatedAt: valueCase.updated_at,
      };

    } catch (error) {
      logger.error("Failed to get canvas", error instanceof Error ? error : new Error(String(error)), {
        canvasId,
        tenantId,
      });
      return null;
    }
  }
}

export const canvasService = new CanvasService();
