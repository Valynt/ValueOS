import { describe, expect, it } from 'vitest';
import { parseDAGDefinition, validateAgainstSchema } from '../../../lib/orchestration/parser';
import { DAG_JSON_SCHEMA } from '../../../lib/orchestration/types';

const validDefinition = {
  id: 'sample',
  name: 'Sample DAG',
  version: 1,
  entrypoints: ['start'],
  nodes: [
    { id: 'start', name: 'Start', task: 'start-task', depends_on: [] },
    { id: 'middle', name: 'Middle', task: 'middle-task', depends_on: ['start'] },
    { id: 'end', name: 'End', task: 'end-task', depends_on: ['middle'] },
  ],
};

describe('DAG schema validation', () => {
  it('exposes JSON schema contract for external validation', () => {
    const nodeSchema = DAG_JSON_SCHEMA.properties.nodes.items.properties;
    expect(nodeSchema.id.type).toBe('string');
    expect(DAG_JSON_SCHEMA.required).toContain('nodes');
  });

  it('validates a correct DAG and returns topological order', () => {
    const { definition, order } = parseDAGDefinition(validDefinition);
    expect(definition.nodes).toHaveLength(3);
    expect(order).toEqual(['start', 'middle', 'end']);
  });

  it('rejects DAGs with schema violations', () => {
    const errors = validateAgainstSchema({ ...validDefinition, nodes: 'invalid' });
    expect(errors[0].path).toBe('nodes');
  });

  it('detects dependency cycles and reports them', () => {
    const cyclic = {
      ...validDefinition,
      nodes: [
        { id: 'start', name: 'Start', task: 'start-task', depends_on: ['end'] },
        { id: 'middle', name: 'Middle', task: 'middle-task', depends_on: ['start'] },
        { id: 'end', name: 'End', task: 'end-task', depends_on: ['middle'] },
      ],
    };

    expect(() => parseDAGDefinition(cyclic)).toThrow(/cycle detected/);
  });

  it('validates dependency references exist', () => {
    const missingDep = {
      ...validDefinition,
      nodes: [
        { id: 'start', name: 'Start', task: 'start-task', depends_on: [] },
        { id: 'middle', name: 'Middle', task: 'middle-task', depends_on: ['unknown'] },
      ],
    };

    expect(() => parseDAGDefinition(missingDep)).toThrow(/dependency unknown/);
  });
});
