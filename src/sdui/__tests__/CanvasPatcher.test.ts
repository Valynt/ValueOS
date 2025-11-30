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
