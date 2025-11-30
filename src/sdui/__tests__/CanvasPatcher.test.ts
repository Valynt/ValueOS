import { describe, it, expect } from 'vitest';
import { CanvasPatcher } from '../canvas/CanvasPatcher';
import { CanvasLayout } from '../canvas/types';

const component = (id: string): CanvasLayout => ({
  type: 'Component',
  componentId: id,
  component: 'KPICard',
  version: 1,
  props: {},
});

describe('CanvasPatcher.reorderChildren', () => {
  it('reorders nested children when path includes "children" segments', () => {
    const layout: CanvasLayout = {
      type: 'VerticalSplit',
      ratios: [40, 60],
      gap: 16,
      children: [
        {
          type: 'DashboardPanel',
          title: 'Panel',
          collapsible: false,
          children: [component('kpi_a'), component('kpi_b'), component('kpi_c')],
        },
        component('root_kpi'),
      ],
    };

    const delta = {
      operations: [
        {
          op: 'reorder' as const,
          parentPath: '/children/0/children',
          fromIndex: 0,
          toIndex: 2,
        },
      ],
      timestamp: Date.now(),
    };

    const result = CanvasPatcher.applyDelta(layout, delta);
    const nestedChildren =
      result.children[0].type === 'DashboardPanel'
        ? result.children[0].children
        : [];

    expect(nestedChildren.map((child) => child.componentId)).toEqual([
      'kpi_b',
      'kpi_c',
      'kpi_a',
    ]);
  });

  it('reorders root children when parentPath points to /children', () => {
    const layout: CanvasLayout = {
      type: 'VerticalSplit',
      ratios: [50, 50],
      gap: 16,
      children: [component('kpi_a'), component('kpi_b')],
    };

    const delta = {
      operations: [
        {
          op: 'reorder' as const,
          parentPath: '/children',
          fromIndex: 1,
          toIndex: 0,
        },
      ],
      timestamp: Date.now(),
    };

    const result = CanvasPatcher.applyDelta(layout, delta);

    expect(result.children.map((child) => child.componentId)).toEqual([
      'kpi_b',
      'kpi_a',
    ]);
  });
});

describe('CanvasPatcher add/replace/remove', () => {
  it('adds and replaces values at nested paths', () => {
    const layout: CanvasLayout = {
      type: 'VerticalSplit',
      ratios: [50, 50],
      gap: 16,
      children: [component('kpi_a')],
    };

    const delta = {
      operations: [
        {
          op: 'add' as const,
          path: '/children/1',
          value: component('kpi_b'),
        },
        {
          op: 'replace' as const,
          path: '/children/0/component',
          value: 'MetricBadge',
        },
      ],
      timestamp: Date.now(),
    };

    const result = CanvasPatcher.applyDelta(layout, delta);
    expect(result.children[0].component).toBe('MetricBadge');
    expect(result.children[1].componentId).toBe('kpi_b');
  });

  it('removes values at array paths safely', () => {
    const layout: CanvasLayout = {
      type: 'Grid',
      columns: 2,
      gap: 16,
      children: [component('kpi_a'), component('kpi_b'), component('kpi_c')],
    };

    const delta = {
      operations: [
        {
          op: 'remove' as const,
          path: '/children/1',
        },
      ],
      timestamp: Date.now(),
    };

    const result = CanvasPatcher.applyDelta(layout, delta);
    expect(result.children.map((c) => c.componentId)).toEqual(['kpi_a', 'kpi_c']);
  });
});
