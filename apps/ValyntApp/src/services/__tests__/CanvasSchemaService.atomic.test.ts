
import { describe, expect, it } from 'vitest';
import { CanvasSchemaService } from '../CanvasSchemaService';
import { SDUIPageDefinition } from '../../sdui/schema';
import { AtomicUIAction } from '../../sdui/AtomicUIActions';

describe('CanvasSchemaService - Atomic Actions', () => {
  // We can instantiate with no args because the constructor handles optional args
  const service = new CanvasSchemaService();

  const initialSchema: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'Header',
        version: 1,
        props: { title: 'Old Title' }
      },
      {
        type: 'component',
        component: 'StatCard',
        version: 1,
        props: {
          id: 'stat-1',
          value: 10,
          tags: ['a', 'b']
        }
      },
      {
        type: 'component',
        component: 'StatCard',
        version: 1,
        props: {
          id: 'stat-2',
          value: 20
        }
      }
    ]
  };

  it('should apply mutate_component action (set)', async () => {
    // Correct selector
    const validActions: AtomicUIAction[] = [{
        type: 'mutate_component',
        selector: { type: 'Header' },
        mutations: [
          { path: 'props.title', operation: 'set', value: 'New Title' }
        ]
    }];

    // @ts-ignore - accessing private method for test
    const result = await service.applyAtomicActions(initialSchema, validActions);

    expect(result.sections[0].props.title).toBe('New Title');
    expect(result.sections).toHaveLength(3);
  });

  it('should apply mutate_component action (append)', async () => {
    const actions: AtomicUIAction[] = [{
      type: 'mutate_component',
      selector: { props: { id: 'stat-1' } },
      mutations: [
        { path: 'props.tags', operation: 'append', value: 'c' }
      ]
    }];

    // @ts-ignore
    const result = await service.applyAtomicActions(initialSchema, actions);
    expect(result.sections[1].props.tags).toEqual(['a', 'b', 'c']);
  });

  it('should apply add_component action (append to end)', async () => {
    const actions: AtomicUIAction[] = [{
      type: 'add_component',
      component: {
        component: 'Footer',
        props: { text: 'Copyright' }
      },
      position: { append: true }
    }];

    // @ts-ignore
    const result = await service.applyAtomicActions(initialSchema, actions);
    expect(result.sections).toHaveLength(4);
    expect(result.sections[3].component).toBe('Footer');
  });

  it('should apply add_component action (insert at index)', async () => {
    const actions: AtomicUIAction[] = [{
        type: 'add_component',
        component: {
          component: 'Banner',
          props: {}
        },
        position: { index: 1 }
      }];

      // @ts-ignore
      const result = await service.applyAtomicActions(initialSchema, actions);
      expect(result.sections).toHaveLength(4);
      expect(result.sections[1].component).toBe('Banner');
      expect(result.sections[2].component).toBe('StatCard'); // Shifted
  });

  it('should apply remove_component action', async () => {
    const actions: AtomicUIAction[] = [{
      type: 'remove_component',
      selector: { index: 1 }
    }];

    // @ts-ignore
    const result = await service.applyAtomicActions(initialSchema, actions);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[1].props.id).toBe('stat-2');
  });

  it('should apply reorder_components action', async () => {
    const actions: AtomicUIAction[] = [{
      type: 'reorder_components',
      order: [2, 0, 1] // indices
    }];

    // @ts-ignore
    const result = await service.applyAtomicActions(initialSchema, actions);
    expect(result.sections[0].props.id).toBe('stat-2'); // Original index 2
    expect(result.sections[1].component).toBe('Header'); // Original index 0
    expect(result.sections[2].props.id).toBe('stat-1'); // Original index 1
  });

  it('should handle nested paths and array indices', async () => {
      const complexSchema: SDUIPageDefinition = {
          ...initialSchema,
          sections: [
              {
                  type: 'component',
                  component: 'Chart',
                  version: 1,
                  props: {
                      data: [
                          { id: 1, val: 100 },
                          { id: 2, val: 200 }
                      ]
                  }
              }
          ]
      };

      const actions: AtomicUIAction[] = [{
          type: 'mutate_component',
          selector: { type: 'Chart' },
          mutations: [
              { path: 'props.data[1].val', operation: 'set', value: 300 }
          ]
      }];

      // @ts-ignore
      const result = await service.applyAtomicActions(complexSchema, actions);
      expect(result.sections[0].props.data[1].val).toBe(300);
  });
});
