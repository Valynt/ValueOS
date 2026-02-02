/**
 * Canvas Delta Update System
 *
 * Allows agents to make surgical updates without re-rendering entire canvas
 *
 * @example
 * ```typescript
 * const delta: CanvasDelta = {
 *   operations: [
 *     { op: 'update_props', componentId: 'kpi_1', props: { trend: '+20%' } }
 *   ],
 *   reason: 'User updated retention assumption',
 *   timestamp: Date.now(),
 * };
 *
 * const newLayout = CanvasPatcher.applyDelta(currentLayout, delta);
 * ```
 */

import { CanvasDelta, CanvasLayout } from "./types";
import { logger } from "@shared/lib/logger";
import { immutableUpdate, immutableNestedUpdate } from "../../utils/immutableUtils";

export class CanvasPatcher {
  /**
   * Apply delta patches to existing canvas state
   */
  static applyDelta(currentLayout: CanvasLayout, delta: CanvasDelta): CanvasLayout {
    let newLayout = currentLayout;

    logger.info("Applying canvas delta", {
      operationCount: delta.operations.length,
      reason: delta.reason,
    });

    for (const op of delta.operations) {
      try {
        switch (op.op) {
          case "replace":
            newLayout = immutableNestedUpdate(
              newLayout,
              op.path.split("/").filter(Boolean),
              () => op.value
            );
            break;
          case "add":
            newLayout = immutableNestedUpdate(
              newLayout,
              op.path.split("/").filter(Boolean),
              (current) => {
                if (Array.isArray(current)) {
                  return [...current, op.value];
                }
                return op.value;
              }
            );
            break;
          case "remove":
            newLayout = immutableNestedUpdate(
              newLayout,
              op.path.split("/").filter(Boolean),
              (current) => {
                if (Array.isArray(current)) {
                  return current.filter(
                    (_, index) => index !== parseInt(op.path.split("/").pop() || "-1")
                  );
                }
                return current;
              }
            );
            break;
          case "update_props":
            newLayout = this.updateComponentPropsImmutable(newLayout, op.componentId, op.props);
            break;
          case "update_data":
            newLayout = this.updateComponentDataImmutable(newLayout, op.componentId, op.data);
            break;
          case "reorder":
            newLayout = this.reorderChildrenImmutable(
              newLayout,
              op.parentPath,
              op.fromIndex,
              op.toIndex
            );
            break;
        }
      } catch (error) {
        logger.error("Failed to apply patch operation", error as Error, {
          operation: op.op,
          delta: delta.reason,
        });
        // Continue with other operations even if one fails
      }
    }

    return newLayout;
  }

  /**
   * Update component props by ID (deep search) - Immutable version
   */
  private static updateComponentPropsImmutable(
    layout: CanvasLayout,
    componentId: string,
    newProps: Record<string, any>
  ): CanvasLayout {
    if (layout.type === "Component" && layout.componentId === componentId) {
      return immutableUpdate(layout, { props: { ...layout.props, ...newProps } });
    }

    if ("children" in layout && layout.children) {
      return immutableUpdate(layout, {
        children: layout.children.map((child: CanvasLayout) =>
          this.updateComponentPropsImmutable(child, componentId, newProps)
        ),
      });
    }

    return layout;
  }

  /**
   * Update component data by ID (replaces entire data object) - Immutable version
   */
  private static updateComponentDataImmutable(
    layout: CanvasLayout,
    componentId: string,
    newData: any
  ): CanvasLayout {
    if (layout.type === "Component" && layout.componentId === componentId) {
      return immutableUpdate(layout, { props: { ...layout.props, data: newData } });
    }

    if ("children" in layout && layout.children) {
      return immutableUpdate(layout, {
        children: layout.children.map((child: CanvasLayout) =>
          this.updateComponentDataImmutable(child, componentId, newData)
        ),
      });
    }

    return layout;
  }

  /**
   * Reorder children of a container - Immutable version
   */
  private static reorderChildrenImmutable(
    layout: CanvasLayout,
    parentPath: string,
    fromIndex: number,
    toIndex: number
  ): CanvasLayout {
    const parts = parentPath.split("/").filter(Boolean);

    const reorder = (node: any, remainingPath: string[]): any => {
      if (remainingPath.length === 0) {
        const children = Array.isArray(node)
          ? node
          : "children" in node
            ? node.children
            : undefined;

        if (!Array.isArray(children)) {
          throw new Error("Cannot reorder: node has no children");
        }

        if (
          fromIndex < 0 ||
          fromIndex >= children.length ||
          toIndex < 0 ||
          toIndex > children.length
        ) {
          throw new Error("Invalid reorder indexes");
        }

        const newChildren = [...children];
        const [moved] = newChildren.splice(fromIndex, 1);
        newChildren.splice(toIndex, 0, moved);

        return Array.isArray(node) ? newChildren : immutableUpdate(node, { children: newChildren });
      }

      const [head, ...tail] = remainingPath;

      if (!head) {
        throw new Error("Invalid path: empty segment");
      }

      if (Array.isArray(node)) {
        const index = parseInt(head, 10);
        if (isNaN(index)) {
          throw new Error(`Invalid path index: ${head}`);
        }

        return node.map((child: any, i: number) => (i === index ? reorder(child, tail) : child));
      }

      if (node && typeof node === "object" && head in node) {
        return immutableUpdate(node, {
          [head]: reorder(node[head], tail),
        });
      }

      throw new Error(`Cannot traverse path: ${head}`);
    };

    return reorder(layout, parts);
  }

  /**
   * Get component by ID (deep search)
   */
  static findComponentById(layout: CanvasLayout, componentId: string): CanvasLayout | null {
    if (layout.type === "Component" && layout.componentId === componentId) {
      return layout;
    }

    if ("children" in layout && layout.children) {
      for (const child of layout.children) {
        const found = this.findComponentById(child, componentId);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * List all component IDs in layout
   */
  static listComponentIds(layout: CanvasLayout): string[] {
    const ids: string[] = [];

    const traverse = (node: CanvasLayout): void => {
      if (node.type === "Component") {
        ids.push(node.componentId);
      }

      if ("children" in node && node.children) {
        node.children.forEach(traverse);
      }
    };

    traverse(layout);
    return ids;
  }

  /**
   * Validate delta before applying
   */
  static validateDelta(
    layout: CanvasLayout,
    delta: CanvasDelta
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const op of delta.operations) {
      if (op.op === "update_props" || op.op === "update_data") {
        const found = this.findComponentById(layout, op.componentId);
        if (!found) {
          errors.push(`Component not found: ${op.componentId}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
