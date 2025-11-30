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

import { CanvasLayout, CanvasDelta } from './types';
import { logger } from '../../lib/logger';

export class CanvasPatcher {
  /**
   * Apply delta patches to existing canvas state
   */
  static applyDelta(currentLayout: CanvasLayout, delta: CanvasDelta): CanvasLayout {
    let newLayout = JSON.parse(JSON.stringify(currentLayout)) as CanvasLayout;

    logger.info('Applying canvas delta', {
      operationCount: delta.operations.length,
      reason: delta.reason,
    });

    for (const op of delta.operations) {
      try {
        switch (op.op) {
          case 'replace':
            newLayout = this.replaceAtPath(newLayout, op.path, op.value);
            break;
          case 'add':
            newLayout = this.addAtPath(newLayout, op.path, op.value);
            break;
          case 'remove':
            newLayout = this.removeAtPath(newLayout, op.path);
            break;
          case 'update_props':
            newLayout = this.updateComponentProps(newLayout, op.componentId, op.props);
            break;
          case 'update_data':
            newLayout = this.updateComponentData(newLayout, op.componentId, op.data);
            break;
          case 'reorder':
            newLayout = this.reorderChildren(newLayout, op.parentPath, op.fromIndex, op.toIndex);
            break;
        }
      } catch (error) {
        logger.error('Failed to apply patch operation', error as Error, {
          operation: op.op,
          delta: delta.reason,
        });
        // Continue with other operations even if one fails
      }
    }

    return newLayout;
  }

  /**
   * Update component props by ID (deep search)
   */
  private static updateComponentProps(
    layout: CanvasLayout,
    componentId: string,
    newProps: Record<string, any>
  ): CanvasLayout {
    if (layout.type === 'Component' && layout.componentId === componentId) {
      return {
        ...layout,
        props: { ...layout.props, ...newProps },
      };
    }

    if ('children' in layout && layout.children) {
      return {
        ...layout,
        children: layout.children.map((child: CanvasLayout) =>
          this.updateComponentProps(child, componentId, newProps)
        ),
      } as CanvasLayout;
    }

    return layout;
  }

  /**
   * Update component data by ID (replaces entire data object)
   */
  private static updateComponentData(
    layout: CanvasLayout,
    componentId: string,
    newData: any
  ): CanvasLayout {
    if (layout.type === 'Component' && layout.componentId === componentId) {
      return {
        ...layout,
        props: { ...layout.props, data: newData },
      };
    }

    if ('children' in layout && layout.children) {
      return {
        ...layout,
        children: layout.children.map((child: CanvasLayout) =>
          this.updateComponentData(child, componentId, newData)
        ),
      } as CanvasLayout;
    }

    return layout;
  }

  /**
   * Replace value at JSONPath
   */
  private static replaceAtPath(
    layout: CanvasLayout,
    path: string,
    value: any
  ): CanvasLayout {
    const parts = path.split('/').filter(Boolean);
    return this.setValueAtPath(layout, parts, value);
  }

  /**
   * Add value at JSONPath
   */
  private static addAtPath(layout: CanvasLayout, path: string, value: any): CanvasLayout {
    const parts = path.split('/').filter(Boolean);
    return this.setValueAtPath(layout, parts, value);
  }

  /**
   * Remove value at JSONPath
   */
  private static removeAtPath(layout: CanvasLayout, path: string): CanvasLayout {
    const parts = path.split('/').filter(Boolean);
    return this.deleteAtPath(layout, parts);
  }

  /**
   * Reorder children of a container
   */
  private static reorderChildren(
    layout: CanvasLayout,
    parentPath: string,
    fromIndex: number,
    toIndex: number
  ): CanvasLayout {
    const parts = parentPath.split('/').filter(Boolean);

    const reorder = (node: any, remainingPath: string[]): any => {
      if (remainingPath.length === 0) {
        if (!('children' in node) || !Array.isArray(node.children)) {
          throw new Error('Cannot reorder: node has no children');
        }

        const newChildren = [...node.children];
        const [moved] = newChildren.splice(fromIndex, 1);
        newChildren.splice(toIndex, 0, moved);

        return { ...node, children: newChildren };
      }

      const [head, ...tail] = remainingPath;
      if (!('children' in node)) {
        throw new Error(`Cannot traverse path: ${head}`);
      }

      const index = parseInt(head);
      if (isNaN(index)) {
        throw new Error(`Invalid path index: ${head}`);
      }

      return {
        ...node,
        children: node.children.map((child: any, i: number) =>
          i === index ? reorder(child, tail) : child
        ),
      };
    };

    return reorder(layout, parts);
  }

  /**
   * Helper: Set value at path recursively
   */
  private static setValueAtPath(node: any, path: string[], value: any): any {
    if (path.length === 0) {
      return value;
    }

    const [head, ...tail] = path;

    if (!head) {
      throw new Error('Invalid path: empty segment');
    }

    if (Array.isArray(node)) {
      const index = parseInt(head);
      return node.map((item, i) => (i === index ? this.setValueAtPath(item, tail, value) : item));
    }

    if (typeof node === 'object' && node !== null) {
      return {
        ...node,
        [head]: this.setValueAtPath(node[head], tail, value),
      };
    }

    throw new Error(`Cannot set value at path: ${path.join('/')}`);
  }

  /**
   * Helper: Delete at path recursively
   */
  private static deleteAtPath(node: any, path: string[]): any {
    if (path.length === 0) {
      return undefined;
    }

    const [head, ...tail] = path;

    if (!head) {
      throw new Error('Invalid path: empty segment');
    }

    if (tail.length === 0) {
      if (Array.isArray(node)) {
        const index = parseInt(head);
        return node.filter((_, i) => i !== index);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [head]: _, ...rest } = node;
      return rest;
    }

    if (Array.isArray(node)) {
      const index = parseInt(head);
      return node.map((item, i) => (i === index ? this.deleteAtPath(item, tail) : item));
    }

    if (typeof node === 'object' && node !== null) {
      return {
        ...node,
        [head]: this.deleteAtPath(node[head], tail),
      };
    }

    throw new Error(`Cannot delete at path: ${path.join('/')}`);
  }

  /**
   * Get component by ID (deep search)
   */
  static findComponentById(layout: CanvasLayout, componentId: string): CanvasLayout | null {
    if (layout.type === 'Component' && layout.componentId === componentId) {
      return layout;
    }

    if ('children' in layout && layout.children) {
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
      if (node.type === 'Component') {
        ids.push(node.componentId);
      }

      if ('children' in node && node.children) {
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
      if (op.op === 'update_props' || op.op === 'update_data') {
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
