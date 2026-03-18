/**
 * Agent LLM Output Constraints
 *
 * Generates JSON schemas for OpenAI function calling to prevent hallucination
 * Validates agent output before rendering
 */

import { AgentFunctionSchema, AgentOutputValidation, ALLOWED_CANVAS_COMPONENTS, CanvasLayout } from './types';

/**
 * Generate OpenAI function calling schema for canvas updates
 * This constrains the LLM to only use valid components
 */
export function generateAgentConstraintSchema(): AgentFunctionSchema {
  return {
    name: 'update_canvas',
    description: 'Update the value model canvas with charts, KPIs, and visualizations based on user conversation',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['replace', 'patch', 'stream', 'reset'],
          description: 'Type of canvas update operation',
        },
        layout: {
          $ref: '#/definitions/CanvasNode',
          description: 'Canvas layout tree with nested components',
        },
      },
      required: ['operation', 'layout'],
      definitions: {
        CanvasNode: {
          oneOf: [
            // Layout types
            {
              type: 'object',
              properties: {
                type: { const: 'VerticalSplit' },
                ratios: {
                  type: 'array',
                  items: { type: 'number', minimum: 0 },
                  minItems: 2,
                  maxItems: 4,
                },
                children: {
                  type: 'array',
                  items: { $ref: '#/definitions/CanvasNode' },
                },
                gap: { type: 'number', default: 16 },
              },
              required: ['type', 'ratios', 'children'],
            },
            {
              type: 'object',
              properties: {
                type: { const: 'HorizontalSplit' },
                ratios: {
                  type: 'array',
                  items: { type: 'number', minimum: 0 },
                  minItems: 2,
                  maxItems: 4,
                },
                children: {
                  type: 'array',
                  items: { $ref: '#/definitions/CanvasNode' },
                },
                gap: { type: 'number', default: 16 },
              },
              required: ['type', 'ratios', 'children'],
            },
            {
              type: 'object',
              properties: {
                type: { const: 'Grid' },
                columns: { type: 'number', minimum: 1, maximum: 12 },
                rows: { type: 'number', minimum: 1 },
                children: {
                  type: 'array',
                  items: { $ref: '#/definitions/CanvasNode' },
                },
                gap: { type: 'number', default: 16 },
                responsive: { type: 'boolean', default: true },
              },
              required: ['type', 'columns', 'children'],
            },
            {
              type: 'object',
              properties: {
                type: { const: 'DashboardPanel' },
                title: { type: 'string' },
                collapsible: { type: 'boolean', default: false },
                children: {
                  type: 'array',
                  items: { $ref: '#/definitions/CanvasNode' },
                },
              },
              required: ['type', 'children'],
            },
            // Component type
            {
              type: 'object',
              properties: {
                type: { const: 'Component' },
                componentId: { type: 'string' },
                component: {
                  enum: [...ALLOWED_CANVAS_COMPONENTS],
                  description: 'Must be one of the allowed component types',
                },
                version: { type: 'number', default: 1 },
                props: { type: 'object' },
              },
              required: ['type', 'component', 'componentId'],
            },
          ],
        },
      },
    },
  };
}

/**
 * Validate agent output before applying to canvas
 * Prevents hallucinated components from breaking the UI
 */
export function validateAgentOutput(output: unknown): AgentOutputValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!output || typeof output !== 'object') {
    return {
      valid: false,
      errors: ['Agent output must be an object'],
    };
  }

  const layout = (output as Record<string, unknown>).layout;
  if (!layout) {
    return {
      valid: false,
      errors: ['Agent output missing layout'],
    };
  }

  // Validate all components in the tree
  function validateNode(node: unknown, path: string = 'root'): void {
    if (!node || typeof node !== 'object') {
      errors.push(`Invalid node at ${path}: must be an object`);
      return;
    }
    const nodeObj = node as Record<string, unknown>;

    if (!nodeObj.type || typeof nodeObj.type !== 'string') {
      errors.push(`Missing type at ${path}`);
      return;
    }

    const type = nodeObj.type;

    // Validate component type
    if (type === 'Component') {
      const component = nodeObj.component;
      if (!component || typeof component !== 'string') {
        errors.push(`Missing component name at ${path}`);
        return;
      }

      if (!ALLOWED_CANVAS_COMPONENTS.includes(component as typeof ALLOWED_CANVAS_COMPONENTS[number])) {
        errors.push(
          `Invalid component "${component}" at ${path}. ` +
          `Allowed components: ${ALLOWED_CANVAS_COMPONENTS.join(', ')}`
        );
      }

      if (!nodeObj.componentId || typeof nodeObj.componentId !== 'string') {
        warnings.push(`Missing componentId at ${path} - will generate one`);
      }
    }

    // Validate layout types
    if (['VerticalSplit', 'HorizontalSplit', 'Grid', 'DashboardPanel'].includes(type)) {
      const children = nodeObj.children;
      if (!Array.isArray(children)) {
        errors.push(`Layout at ${path} missing children array`);
        return;
      }

      // Recursively validate children
      children.forEach((child, i) => {
        validateNode(child, `${path}.children[${i}]`);
      });

      // Type-specific validation
      if (type === 'VerticalSplit' || type === 'HorizontalSplit') {
        const ratios = nodeObj.ratios;
        if (!Array.isArray(ratios)) {
          errors.push(`${type} at ${path} missing ratios array`);
        } else if (ratios.length !== children.length) {
          warnings.push(`${type} at ${path} has mismatched ratios and children count`);
        }
      }

      if (type === 'Grid') {
        const columns = nodeObj.columns;
        if (typeof columns !== 'number' || columns < 1 || columns > 12) {
          errors.push(`Grid at ${path} has invalid columns (must be 1-12)`);
        }
      }
    }
  }

  try {
    validateNode(layout);
  } catch (e) {
    return {
      valid: false,
      errors: [(e as Error).message],
    };
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Sanitize agent output by auto-fixing common issues
 */
export function sanitizeAgentOutput(layout: CanvasLayout): CanvasLayout {
  let idCounter = 0;

  function sanitizeNode(node: CanvasLayout): CanvasLayout {
    const nodeObj = node as Record<string, unknown>;
    // Auto-generate componentId if missing
    if (nodeObj.type === 'Component' && !nodeObj.componentId) {
      nodeObj.componentId = `auto_${++idCounter}_${Date.now()}`;
    }

    // Recursively sanitize children
    if (nodeObj.children && Array.isArray(nodeObj.children)) {
      nodeObj.children = (nodeObj.children as CanvasLayout[]).map(sanitizeNode);
    }

    // Fix ratio mismatches
    if ((nodeObj.type === 'VerticalSplit' || nodeObj.type === 'HorizontalSplit') && nodeObj.children) {
      const children = nodeObj.children as CanvasLayout[];
      const ratios = nodeObj.ratios as number[] | undefined;
      if (!ratios || ratios.length !== children.length) {
        // Generate equal ratios
        nodeObj.ratios = Array(children.length).fill(1);
      }
    }

    return node;
  }

  return sanitizeNode(layout);
}
