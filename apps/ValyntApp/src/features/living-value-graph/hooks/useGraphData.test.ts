import { describe, expect, it } from 'vitest';

import { transformToGraph } from './useGraphData';

type TestRow = {
  id: string;
  parent_id: string | null;
  label: string;
  driver_type: string | null;
  impact_estimate: number | null;
  confidence: number | null;
};

function buildRow(overrides: Partial<TestRow> & Pick<TestRow, 'id'>): Record<string, unknown> {
  const row: TestRow = {
    id: overrides.id,
    parent_id: overrides.parent_id ?? null,
    label: overrides.label ?? `Node ${overrides.id}`,
    driver_type: overrides.driver_type ?? null,
    impact_estimate: overrides.impact_estimate ?? null,
    confidence: overrides.confidence ?? null,
  };

  return {
    id: row.id,
    case_id: 'case-1',
    organization_id: 'org-1',
    parent_id: row.parent_id,
    node_key: null,
    label: row.label,
    description: null,
    driver_type: row.driver_type,
    impact_estimate: row.impact_estimate,
    confidence: row.confidence,
    sort_order: 0,
    source_agent: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('transformToGraph', () => {
  it('aggregates impact and averages confidence using only positive confidences', () => {
    const rows = [
      buildRow({ id: 'parent', impact_estimate: 100, confidence: 0.8, driver_type: 'revenue' }),
      buildRow({ id: 'child-1', parent_id: 'parent', impact_estimate: 50, confidence: 0, driver_type: 'cost' }),
      buildRow({ id: 'child-2', parent_id: 'parent', impact_estimate: null, confidence: null, driver_type: 'risk' }),
      buildRow({ id: 'child-3', parent_id: 'parent', impact_estimate: 25, confidence: 0.4, driver_type: 'efficiency' }),
    ];

    const graph = transformToGraph('case-1', rows as Parameters<typeof transformToGraph>[1]);

    expect(graph.globalMetrics.npv).toBe(175);
    expect(graph.globalMetrics.confidence).toBeCloseTo(0.6);
    expect(graph.globalMetrics.defensibilityScore).toBeCloseTo(0.54);
    expect(graph.evidenceCoverage).toBeCloseTo(0.6);
  });

  it('builds directional edges and node adjacency lists without cloning', () => {
    const rows = [
      buildRow({ id: 'root', impact_estimate: 10, confidence: 0.2, driver_type: 'revenue' }),
      buildRow({ id: 'child-a', parent_id: 'root', impact_estimate: 5, confidence: 0.5, driver_type: 'cost' }),
      buildRow({ id: 'child-b', parent_id: 'root', impact_estimate: 6, confidence: 0.7, driver_type: 'risk' }),
    ];

    const graph = transformToGraph('case-1', rows as Parameters<typeof transformToGraph>[1]);

    expect(Object.values(graph.edges)).toEqual([
      { id: 'edge-0', source: 'child-a', target: 'root', type: 'input' },
      { id: 'edge-1', source: 'child-b', target: 'root', type: 'input' },
    ]);
    expect(graph.nodes.root.inputs).toEqual(['child-a', 'child-b']);
    expect(graph.nodes.root.outputs).toEqual([]);
    expect(graph.nodes['child-a'].outputs).toEqual(['root']);
    expect(graph.nodes['child-a'].inputs).toEqual([]);
    expect(graph.nodes['child-b'].outputs).toEqual(['root']);
    expect(graph.nodes['child-b'].inputs).toEqual([]);
  });

  it('returns zero confidence when all confidence values are non-positive', () => {
    const rows = [
      buildRow({ id: 'node-1', impact_estimate: 20, confidence: 0 }),
      buildRow({ id: 'node-2', impact_estimate: 30, confidence: null }),
    ];

    const graph = transformToGraph('case-1', rows as Parameters<typeof transformToGraph>[1]);

    expect(graph.globalMetrics.npv).toBe(50);
    expect(graph.globalMetrics.confidence).toBe(0);
    expect(graph.globalMetrics.defensibilityScore).toBe(0);
    expect(graph.evidenceCoverage).toBe(0);
  });
});
