/**
 * Agent LLM Output Constraints
 * 
 * Generates JSON schemas for OpenAI function calling to prevent hallucination
 * Validates agent output before rendering
 */

import { ALLOWED_CANVAS_COMPONENTS, AgentFunctionSchema, AgentOutputValidation, CanvasLayout } from './types';

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
  
  const layout = (output as any).layout;
  if (!layout) {
    return {
      valid: false,
      errors: ['Agent output missing layout'],
    };
  }
  
  // Validate all components in the tree
  function validateNode(node: any, path: string = 'root'): void {
    if (!node || typeof node !== 'object') {
      errors.push(`Invalid node at ${path}: must be an object`);
      return;
    }
    
    if (!node.type) {
      errors.push(`Missing type at ${path}`);
      return;
    }
    
    // Validate component type
    if (node.type === 'Component') {
      if (!node.component) {
        errors.push(`Missing component name at ${path}`);
        return;
      }
      
      if (!ALLOWED_CANVAS_COMPONENTS.includes(node.component as any)) {
        errors.push(
          `Invalid component "${node.component}" at ${path}. ` +
          `Allowed components: ${ALLOWED_CANVAS_COMPONENTS.join(', ')}`
        );
      }
      
      if (!node.componentId) {
        warnings.push(`Missing componentId at ${path} - will generate one`);
      }
    }
    
    // Validate layout types
    if (['VerticalSplit', 'HorizontalSplit', 'Grid', 'DashboardPanel'].includes(node.type)) {
      if (!node.children || !Array.isArray(node.children)) {
        errors.push(`Layout at ${path} missing children array`);
        return;
      }
      
      // Recursively validate children
      node.children.forEach((child: any, i: number) => {
        validateNode(child, `${path}.children[${i}]`);
      });
      
      // Type-specific validation
      if (node.type === 'VerticalSplit' || node.type === 'HorizontalSplit') {
        if (!node.ratios || !Array.isArray(node.ratios)) {
          errors.push(`${node.type} at ${path} missing ratios array`);
        } else if (node.ratios.length !== node.children.length) {
          warnings.push(`${node.type} at ${path} has mismatched ratios and children count`);
        }
      }
      
      if (node.type === 'Grid') {
        if (typeof node.columns !== 'number' || node.columns < 1 || node.columns > 12) {
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
  
  function sanitizeNode(node: any): any {
    // Auto-generate componentId if missing
    if (node.type === 'Component' && !node.componentId) {
      node.componentId = `auto_${++idCounter}_${Date.now()}`;
    }
    
    // Recursively sanitize children
    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map(sanitizeNode);
    }
    
    // Fix ratio mismatches
    if ((node.type === 'VerticalSplit' || node.type === 'HorizontalSplit') && node.children) {
      if (!node.ratios || node.ratios.length !== node.children.length) {
        // Generate equal ratios
        node.ratios = Array(node.children.length).fill(1);
      }
    }
    
    return node;
  }
  
  return sanitizeNode(layout);
}
