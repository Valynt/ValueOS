import { describe, expect, it } from 'vitest';
import { createBoltClientMock } from '../utils/mockSupabaseClient';

const tables = {
  value_trees: [{ id: 'tree-1', value_case_id: 'vc-1' }],
  value_tree_nodes: [
    { id: 'node-1', value_tree_id: 'tree-1', node_id: 'cap_1', label: 'Capability', type: 'capability' },
    { id: 'node-2', value_tree_id: 'tree-1', node_id: 'kpi_1', label: 'KPI', type: 'kpi' },
  ],
  value_tree_links: [
    { id: 'link-1', parent_id: 'node-1', child_id: 'node-2', link_type: 'drives', weight: 1 },
  ],
  benchmarks: [
    { id: 'bench-1', kpi_name: 'NPS', industry: 'SaaS', percentile: 50, value: 40 },
    { id: 'bench-2', kpi_name: 'NPS', industry: 'SaaS', percentile: 75, value: 55 },
  ],
};

describe('Database validation', () => {
  it('enforces cascade deletes for value trees', async () => {
    const supabase = createBoltClientMock(JSON.parse(JSON.stringify(tables)));
    await supabase.from('value_trees').delete().eq('id', 'tree-1');

    expect(supabase.tables.value_trees).toHaveLength(0);
    expect(supabase.tables.value_tree_nodes).toHaveLength(0);
    expect(supabase.tables.value_tree_links).toHaveLength(0);
  });

  it('rejects operations when RLS policies block the role', async () => {
    const supabase = createBoltClientMock(JSON.parse(JSON.stringify(tables)), {
      role: 'guest',
      policies: { value_trees: ['owner'] },
    });

    const { error } = await supabase.from('value_trees').insert({ id: 'tree-2', value_case_id: 'vc-1' });
    expect(error?.message).toContain('RLS violation');
  });

  it('mimics recursive traversal by following parent-child links', async () => {
    const supabase = createBoltClientMock(JSON.parse(JSON.stringify(tables)));
    const { data: nodes } = await supabase.from('value_tree_nodes').select('*').eq('value_tree_id', 'tree-1');
    const { data: links } = await supabase.from('value_tree_links').select('*');

    const traversal: string[] = [];
    const visit = (nodeId: string) => {
      traversal.push(nodeId);
      links
        .filter((link: any) => link.parent_id === nodeId)
        .forEach((link: any) => visit(link.child_id));
    };

    visit('node-1');
    expect(traversal).toEqual(['node-1', 'node-2']);
  });

  it('compares benchmark values for validation scenarios', async () => {
    const supabase = createBoltClientMock(JSON.parse(JSON.stringify(tables)));
    const { data } = await supabase.from('benchmarks').select('*').eq('kpi_name', 'NPS');

    const comparison = data.reduce((acc: any, row: any) => ({
      ...acc,
      [row.percentile]: row.value,
    }), {} as Record<string, number>);

    expect(comparison['50']).toBe(40);
    expect(comparison['75']).toBe(55);
  });
});
