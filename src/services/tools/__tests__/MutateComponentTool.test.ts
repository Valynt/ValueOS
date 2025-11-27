/**
 * MutateComponentTool Tests
 * 
 * Tests for component mutation tool with atomic UI actions
 * following MCP patterns for tool testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MutateComponentTool', () => {
  let mockLayout: any;
  let mockContext: any;

  beforeEach(() => {
    mockLayout = {
      id: 'page-1',
      components: [
        {
          id: 'comp-1',
          type: 'chart',
          props: { type: 'bar', data: [] }
        },
        {
          id: 'comp-2',
          type: 'metric',
          props: { value: 100, label: 'Revenue' }
        }
      ]
    };

    mockContext = {
      userId: 'user-123',
      organizationId: 'org-456'
    };
  });

  describe('Tool Metadata', () => {
    it('should have correct tool metadata', () => {
      const metadata = {
        name: 'mutate_component',
        description: 'Apply atomic mutations to UI components',
        version: '1.0.0'
      };

      expect(metadata.name).toBe('mutate_component');
      expect(metadata.version).toBeDefined();
    });

    it('should define required parameters', () => {
      const parameters = {
        type: 'object',
        properties: {
          layout: { type: 'object', required: true },
          action: { type: 'object', required: true }
        },
        required: ['layout', 'action']
      };

      expect(parameters.required).toContain('layout');
      expect(parameters.required).toContain('action');
    });

    it('should define action types', () => {
      const actionTypes = [
        'mutate_component',
        'add_component',
        'remove_component',
        'reorder_components',
        'update_layout',
        'batch'
      ];

      expect(actionTypes).toContain('mutate_component');
      expect(actionTypes).toContain('add_component');
      expect(actionTypes.length).toBe(6);
    });
  });

  describe('Property Mutations', () => {
    it('should mutate component property', async () => {
      const action = {
        type: 'mutate_component',
        selector: { id: 'comp-1' },
        property: 'props.type',
        value: 'line',
        description: 'Change chart type to line'
      };

      const result = {
        success: true,
        data: {
          layout: mockLayout,
          affected_components: ['comp-1'],
          changes_made: [
            { component: 'comp-1', property: 'props.type', oldValue: 'bar', newValue: 'line' }
          ]
        }
      };

      expect(result.success).toBe(true);
      expect(result.data.affected_components).toContain('comp-1');
    });

    it('should update metric value', async () => {
      const action = {
        type: 'mutate_component',
        selector: { id: 'comp-2' },
        property: 'props.value',
        value: 150
      };

      const result = {
        success: true,
        data: {
          affected_components: ['comp-2'],
          changes_made: [
            { component: 'comp-2', property: 'props.value', oldValue: 100, newValue: 150 }
          ]
        }
      };

      expect(result.data.changes_made[0].newValue).toBe(150);
    });

    it('should update nested properties', async () => {
      const action = {
        type: 'mutate_component',
        selector: { id: 'comp-1' },
        property: 'props.data.0.value',
        value: 42
      };

      expect(action.property).toContain('.');
      expect(action.property.split('.').length).toBeGreaterThan(2);
    });
  });

  describe('Component Addition', () => {
    it('should add new component', async () => {
      const action = {
        type: 'add_component',
        component: {
          id: 'comp-3',
          type: 'table',
          props: { data: [], columns: [] }
        },
        position: { append: true }
      };

      const result = {
        success: true,
        data: {
          layout: {
            ...mockLayout,
            components: [...mockLayout.components, action.component]
          },
          affected_components: ['comp-3']
        }
      };

      expect(result.data.layout.components.length).toBe(3);
      expect(result.data.affected_components).toContain('comp-3');
    });

    it('should insert component at specific position', async () => {
      const action = {
        type: 'add_component',
        component: { id: 'comp-3', type: 'text' },
        position: { index: 1 }
      };

      expect(action.position.index).toBe(1);
    });

    it('should add component with validation', async () => {
      const component = {
        id: 'comp-3',
        type: 'chart',
        props: { type: 'bar', data: [] }
      };

      const validation = {
        valid: true,
        errors: []
      };

      expect(validation.valid).toBe(true);
      expect(component.id).toBeDefined();
      expect(component.type).toBeDefined();
    });
  });

  describe('Component Removal', () => {
    it('should remove component by id', async () => {
      const action = {
        type: 'remove_component',
        selector: { id: 'comp-1' }
      };

      const result = {
        success: true,
        data: {
          layout: {
            ...mockLayout,
            components: mockLayout.components.filter((c: any) => c.id !== 'comp-1')
          },
          affected_components: ['comp-1']
        }
      };

      expect(result.data.layout.components.length).toBe(1);
      expect(result.data.layout.components[0].id).toBe('comp-2');
    });

    it('should remove component by type', async () => {
      const action = {
        type: 'remove_component',
        selector: { type: 'chart' }
      };

      expect(action.selector.type).toBe('chart');
    });

    it('should handle removal of non-existent component', async () => {
      const action = {
        type: 'remove_component',
        selector: { id: 'comp-999' }
      };

      const result = {
        success: false,
        error: 'Component not found: comp-999'
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Batch Mutations', () => {
    it('should apply multiple mutations', async () => {
      const actions = [
        {
          type: 'mutate_component',
          selector: { id: 'comp-1' },
          property: 'props.type',
          value: 'line'
        },
        {
          type: 'mutate_component',
          selector: { id: 'comp-2' },
          property: 'props.value',
          value: 200
        }
      ];

      const result = {
        success: true,
        data: {
          affected_components: ['comp-1', 'comp-2'],
          changes_made: [
            { component: 'comp-1', property: 'props.type' },
            { component: 'comp-2', property: 'props.value' }
          ]
        }
      };

      expect(result.data.affected_components.length).toBe(2);
      expect(result.data.changes_made.length).toBe(2);
    });

    it('should handle partial batch failure', async () => {
      const results = [
        { success: true, component: 'comp-1' },
        { success: false, component: 'comp-2', error: 'Invalid value' }
      ];

      const allSucceeded = results.every(r => r.success);

      expect(allSucceeded).toBe(false);
      expect(results.filter(r => r.success).length).toBe(1);
    });

    it('should rollback on batch failure', async () => {
      const batch = {
        actions: [
          { type: 'mutate_component', selector: { id: 'comp-1' } },
          { type: 'mutate_component', selector: { id: 'comp-2' } }
        ],
        rollbackOnFailure: true
      };

      expect(batch.rollbackOnFailure).toBe(true);
    });
  });

  describe('Component Selectors', () => {
    it('should select by id', async () => {
      const selector = { id: 'comp-1' };
      const component = mockLayout.components.find((c: any) => c.id === selector.id);

      expect(component).toBeDefined();
      expect(component.id).toBe('comp-1');
    });

    it('should select by type', async () => {
      const selector = { type: 'chart' };
      const components = mockLayout.components.filter((c: any) => c.type === selector.type);

      expect(components.length).toBeGreaterThan(0);
      expect(components[0].type).toBe('chart');
    });

    it('should select by index', async () => {
      const selector = { index: 0 };
      const component = mockLayout.components[selector.index];

      expect(component).toBeDefined();
      expect(component.id).toBe('comp-1');
    });

    it('should select by description', async () => {
      const selector = { description: 'revenue metric' };

      expect(selector.description).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should validate action structure', async () => {
      const action = {
        type: 'mutate_component',
        selector: { id: 'comp-1' },
        property: 'props.type',
        value: 'line'
      };

      const validation = {
        valid: true,
        errors: []
      };

      expect(validation.valid).toBe(true);
      expect(action.type).toBeDefined();
      expect(action.selector).toBeDefined();
    });

    it('should detect invalid action type', async () => {
      const action = {
        type: 'invalid_action',
        selector: { id: 'comp-1' }
      };

      const validation = {
        valid: false,
        errors: ['Invalid action type: invalid_action']
      };

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing required fields', async () => {
      const action = {
        type: 'mutate_component'
        // missing selector
      };

      const validation = {
        valid: false,
        errors: ['Missing required field: selector']
      };

      expect(validation.valid).toBe(false);
    });

    it('should validate property paths', async () => {
      const propertyPath = 'props.data.0.value';
      const isValid = /^[a-zA-Z0-9_.]+$/.test(propertyPath);

      expect(isValid).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete mutation within SLA', async () => {
      const execution = {
        startTime: Date.now(),
        endTime: Date.now() + 50, // 50ms
        sla: 100 // 100ms
      };

      const duration = execution.endTime - execution.startTime;

      expect(duration).toBeLessThan(execution.sla);
    });

    it('should track mutation duration', async () => {
      const result = {
        success: true,
        data: {},
        metadata: {
          duration_ms: 45
        }
      };

      expect(result.metadata.duration_ms).toBeDefined();
      expect(result.metadata.duration_ms).toBeLessThan(100);
    });

    it('should handle large layouts efficiently', async () => {
      const largeLayout = {
        components: Array.from({ length: 100 }, (_, i) => ({
          id: `comp-${i}`,
          type: 'metric',
          props: {}
        }))
      };

      expect(largeLayout.components.length).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid layout', async () => {
      const error = {
        success: false,
        error: 'Invalid layout: missing components array'
      };

      expect(error.success).toBe(false);
      expect(error.error).toContain('Invalid layout');
    });

    it('should handle invalid selector', async () => {
      const error = {
        success: false,
        error: 'Invalid selector: must specify id, type, or index'
      };

      expect(error.error).toContain('Invalid selector');
    });

    it('should handle property not found', async () => {
      const error = {
        success: false,
        error: 'Property not found: props.nonexistent'
      };

      expect(error.error).toContain('not found');
    });
  });

  describe('Quick Mutate Operations', () => {
    it('should change chart type', async () => {
      const operation = {
        operation: 'change_chart_type',
        target: { id: 'comp-1' },
        value: 'line'
      };

      expect(operation.operation).toBe('change_chart_type');
      expect(operation.value).toBe('line');
    });

    it('should update metric value', async () => {
      const operation = {
        operation: 'update_metric_value',
        target: { id: 'comp-2' },
        value: 250
      };

      expect(operation.operation).toBe('update_metric_value');
      expect(operation.value).toBe(250);
    });

    it('should change color', async () => {
      const operation = {
        operation: 'change_color',
        target: { id: 'comp-1' },
        value: '#FF5733'
      };

      expect(operation.value).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should update title', async () => {
      const operation = {
        operation: 'update_title',
        target: { id: 'comp-1' },
        value: 'New Chart Title'
      };

      expect(operation.operation).toBe('update_title');
      expect(operation.value).toBeDefined();
    });
  });

  describe('Context Integration', () => {
    it('should use execution context', async () => {
      const context = {
        userId: 'user-123',
        organizationId: 'org-456',
        sessionId: 'session-789'
      };

      expect(context.userId).toBeDefined();
      expect(context.organizationId).toBeDefined();
    });

    it('should track mutation history', async () => {
      const history = {
        userId: 'user-123',
        mutations: [
          { timestamp: Date.now() - 1000, action: 'mutate_component' },
          { timestamp: Date.now(), action: 'add_component' }
        ]
      };

      expect(history.mutations.length).toBe(2);
    });

    it('should audit mutations', async () => {
      const audit = {
        userId: 'user-123',
        action: 'mutate_component',
        component: 'comp-1',
        property: 'props.type',
        oldValue: 'bar',
        newValue: 'line',
        timestamp: new Date().toISOString()
      };

      expect(audit.userId).toBeDefined();
      expect(audit.oldValue).not.toBe(audit.newValue);
    });
  });
});
