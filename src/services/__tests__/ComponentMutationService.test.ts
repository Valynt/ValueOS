/**
 * Tests for ComponentMutationService
 */

import { ComponentMutationService } from '../ComponentMutationService';
import { SDUIPageDefinition } from '../../sdui/schema';
import {
  createPropertyUpdate,
  createMutateAction,
  createAddAction,
  createRemoveAction,
  createBatchAction,
  validateAtomicAction,
} from '../../sdui/AtomicUIActions';

describe('ComponentMutationService', () => {
  let service: ComponentMutationService;
  let mockLayout: SDUIPageDefinition;

  beforeEach(() => {
    service = new ComponentMutationService();
    mockLayout = {
      type: 'page',
      version: 1,
      sections: [
        {
          component: 'StatCard',
          version: '1.0',
          props: {
            label: 'Revenue',
            value: '$1M',
            icon: 'dollar-sign',
          },
        },
        {
          component: 'InteractiveChart',
          version: '1.0',
          props: {
            title: 'ROI Timeline',
            type: 'line',
            data: [
              { name: 'Q1', value: 50, color: '#3b82f6' },
              { name: 'Q2', value: 120, color: '#3b82f6' },
            ],
          },
        },
        {
          component: 'StatCard',
          version: '1.0',
          props: {
            label: 'Profit',
            value: '$500K',
            icon: 'trending-up',
          },
        },
      ],
      metadata: {},
    };
  });

  describe('mutate_component', () => {
    it('should update component property by type', async () => {
      const action = createPropertyUpdate(
        { type: 'InteractiveChart' },
        'props.type',
        'bar'
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[1].props.type).toBe('bar');
      expect(result.affected_components).toContain('InteractiveChart_1');
    });

    it('should update component property by index', async () => {
      const action = createPropertyUpdate(
        { index: 0 },
        'props.value',
        '$2M'
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[0].props.value).toBe('$2M');
    });

    it('should update nested property', async () => {
      const action = createPropertyUpdate(
        { type: 'InteractiveChart' },
        'props.data[0].color',
        '#10b981'
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[1].props.data[0].color).toBe('#10b981');
    });

    it('should update multiple properties', async () => {
      const action = createMutateAction(
        { type: 'StatCard', index: 0 },
        [
          { path: 'props.value', operation: 'set', value: '$3M' },
          { path: 'props.icon', operation: 'set', value: 'trending-up' },
        ]
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[0].props.value).toBe('$3M');
      expect(layout.sections[0].props.icon).toBe('trending-up');
    });

    it('should merge object properties', async () => {
      const action = createMutateAction(
        { type: 'InteractiveChart' },
        [
          {
            path: 'props.config',
            operation: 'merge',
            value: { showLegend: true },
          },
        ]
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[1].props.config).toEqual({ showLegend: true });
    });

    it('should append to array', async () => {
      const action = createMutateAction(
        { type: 'InteractiveChart' },
        [
          {
            path: 'props.data',
            operation: 'append',
            value: { name: 'Q3', value: 180, color: '#3b82f6' },
          },
        ]
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[1].props.data).toHaveLength(3);
      expect(layout.sections[1].props.data[2].name).toBe('Q3');
    });

    it('should remove property', async () => {
      const action = createMutateAction(
        { type: 'StatCard', index: 0 },
        [{ path: 'props.icon', operation: 'remove' }]
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[0].props.icon).toBeUndefined();
    });

    it('should fail when component not found', async () => {
      const action = createPropertyUpdate(
        { type: 'NonExistentComponent' },
        'props.value',
        'test'
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No components matched');
    });

    it('should match by props', async () => {
      const action = createPropertyUpdate(
        { type: 'StatCard', props: { label: 'Revenue' } },
        'props.value',
        '$5M'
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[0].props.value).toBe('$5M');
      // Should not affect other StatCard
      expect(layout.sections[2].props.value).toBe('$500K');
    });
  });

  describe('add_component', () => {
    it('should add component at end', async () => {
      const action = createAddAction(
        {
          component: 'StatCard',
          props: {
            label: 'New Metric',
            value: '100',
          },
        },
        { append: true }
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections).toHaveLength(4);
      expect(layout.sections[3].component).toBe('StatCard');
      expect(layout.sections[3].props.label).toBe('New Metric');
    });

    it('should add component at specific index', async () => {
      const action = createAddAction(
        {
          component: 'StatCard',
          props: { label: 'Inserted', value: '50' },
        },
        { index: 1 }
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections).toHaveLength(4);
      expect(layout.sections[1].props.label).toBe('Inserted');
      // Original index 1 should now be at index 2
      expect(layout.sections[2].component).toBe('InteractiveChart');
    });

    it('should add component before another', async () => {
      const action = createAddAction(
        {
          component: 'StatCard',
          props: { label: 'Before Chart', value: '75' },
        },
        { before: { type: 'InteractiveChart' } }
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[1].props.label).toBe('Before Chart');
      expect(layout.sections[2].component).toBe('InteractiveChart');
    });

    it('should add component after another', async () => {
      const action = createAddAction(
        {
          component: 'StatCard',
          props: { label: 'After Chart', value: '90' },
        },
        { after: { type: 'InteractiveChart' } }
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[2].props.label).toBe('After Chart');
    });
  });

  describe('remove_component', () => {
    it('should remove component by type', async () => {
      const action = createRemoveAction({ type: 'InteractiveChart' });

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections).toHaveLength(2);
      expect(layout.sections.every((s) => s.component !== 'InteractiveChart')).toBe(true);
    });

    it('should remove component by index', async () => {
      const action = createRemoveAction({ index: 1 });

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections).toHaveLength(2);
      // Index 1 (InteractiveChart) should be removed
      expect(layout.sections[0].component).toBe('StatCard');
      expect(layout.sections[1].component).toBe('StatCard');
    });

    it('should remove multiple matching components', async () => {
      const action = createRemoveAction({ type: 'StatCard' });

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections).toHaveLength(1);
      expect(layout.sections[0].component).toBe('InteractiveChart');
    });

    it('should fail when component not found', async () => {
      const action = createRemoveAction({ type: 'NonExistent' });

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No components matched');
    });
  });

  describe('reorder_components', () => {
    it('should reorder components', async () => {
      const action = {
        type: 'reorder_components' as const,
        order: [2, 0, 1], // Move last to first
      };

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[0].props.label).toBe('Profit');
      expect(layout.sections[1].props.label).toBe('Revenue');
      expect(layout.sections[2].component).toBe('InteractiveChart');
    });

    it('should handle partial reordering', async () => {
      const action = {
        type: 'reorder_components' as const,
        order: [1, 0], // Only reorder first two
      };

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections).toHaveLength(2);
      expect(layout.sections[0].component).toBe('InteractiveChart');
      expect(layout.sections[1].component).toBe('StatCard');
    });
  });

  describe('batch_action', () => {
    it('should apply multiple actions', async () => {
      const action = createBatchAction([
        createPropertyUpdate({ index: 0 }, 'props.value', '$10M'),
        createPropertyUpdate({ index: 2 }, 'props.value', '$5M'),
        createPropertyUpdate({ type: 'InteractiveChart' }, 'props.type', 'bar'),
      ]);

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[0].props.value).toBe('$10M');
      expect(layout.sections[2].props.value).toBe('$5M');
      expect(layout.sections[1].props.type).toBe('bar');
    });

    it('should stop on first failure', async () => {
      const action = createBatchAction([
        createPropertyUpdate({ index: 0 }, 'props.value', '$10M'),
        createPropertyUpdate({ type: 'NonExistent' }, 'props.value', 'fail'),
        createPropertyUpdate({ index: 2 }, 'props.value', '$5M'),
      ]);

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(false);
      // First action should have applied
      expect(layout.sections[0].props.value).toBe('$10M');
      // Third action should not have applied
      expect(layout.sections[2].props.value).toBe('$500K');
    });
  });

  describe('validation', () => {
    it('should validate action schema', async () => {
      const invalidAction = {
        type: 'mutate_component',
        // Missing selector
        mutations: [{ path: 'props.value', operation: 'set', value: 'test' }],
      } as any;

      const { result } = await service.applyAction(mockLayout, invalidAction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid action');
    });

    it('should validate mutation operations', async () => {
      const action = createMutateAction(
        { index: 0 },
        [
          {
            path: 'props.value',
            operation: 'invalid_op' as any,
            value: 'test',
          },
        ]
      );

      const validation = validateAtomicAction(action);
      expect(validation.valid).toBe(false);
    });
  });

  describe('path parsing', () => {
    it('should parse simple property path', async () => {
      const action = createPropertyUpdate({ index: 0 }, 'props.value', 'test');

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[0].props.value).toBe('test');
    });

    it('should parse nested property path', async () => {
      const action = createPropertyUpdate(
        { type: 'InteractiveChart' },
        'props.data[0].value',
        999
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[1].props.data[0].value).toBe(999);
    });

    it('should parse deep nested path', async () => {
      // Add nested structure
      mockLayout.sections[0].props.nested = { deep: { value: 'original' } };

      const action = createPropertyUpdate(
        { index: 0 },
        'props.nested.deep.value',
        'updated'
      );

      const { layout, result } = await service.applyAction(mockLayout, action);

      expect(result.success).toBe(true);
      expect(layout.sections[0].props.nested.deep.value).toBe('updated');
    });
  });

  describe('immutability', () => {
    it('should not mutate original layout', async () => {
      const originalLayout = JSON.parse(JSON.stringify(mockLayout));
      const action = createPropertyUpdate({ index: 0 }, 'props.value', '$999M');

      await service.applyAction(mockLayout, action);

      expect(mockLayout).toEqual(originalLayout);
    });
  });

  describe('applyActions', () => {
    it('should apply multiple actions in sequence', async () => {
      const actions = [
        createPropertyUpdate({ index: 0 }, 'props.value', '$10M'),
        createPropertyUpdate({ index: 1 }, 'props.type', 'bar'),
        createPropertyUpdate({ index: 2 }, 'props.value', '$5M'),
      ];

      const { layout, results } = await service.applyActions(mockLayout, actions);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(layout.sections[0].props.value).toBe('$10M');
      expect(layout.sections[1].props.type).toBe('bar');
      expect(layout.sections[2].props.value).toBe('$5M');
    });

    it('should stop on first failure', async () => {
      const actions = [
        createPropertyUpdate({ index: 0 }, 'props.value', '$10M'),
        createPropertyUpdate({ type: 'NonExistent' }, 'props.value', 'fail'),
        createPropertyUpdate({ index: 2 }, 'props.value', '$5M'),
      ];

      const { layout, results } = await service.applyActions(mockLayout, actions);

      expect(results).toHaveLength(2); // Stopped after failure
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(layout.sections[0].props.value).toBe('$10M');
      expect(layout.sections[2].props.value).toBe('$500K'); // Not updated
    });
  });
});
