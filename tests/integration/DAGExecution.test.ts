import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfiguredDAG } from '../../../lib/orchestration/configLoader';
import { TaskRegistry } from '../../../lib/orchestration/taskRegistry';

function createRegistry(): TaskRegistry {
  const registry = new TaskRegistry();
  registry.register('opportunity.discover', (context) => ({
    ...context,
    discovery: 'opportunity complete',
    order: [...(context.order || []), 'opportunity'],
  }));
  registry.register('target.commit', (context) => ({
    ...context,
    commitment: 'target locked',
    order: [...(context.order || []), 'target'],
  }));
  registry.register('realization.track', (context) => ({
    ...context,
    realization: 'tracking started',
    order: [...(context.order || []), 'realization'],
  }));
  registry.register('expansion.model', (context) => ({
    ...context,
    expansion: 'model generated',
    order: [...(context.order || []), 'expansion'],
  }));
  registry.register('integrity.validate', (context) => ({
    ...context,
    integrity: 'controls verified',
    order: [...(context.order || []), 'integrity'],
  }));
  registry.register('ingest', (context) => ({
    ...context,
    ingested: true,
    order: [...(context.order || []), 'ingest'],
  }));
  registry.register('transform.a', (context) => ({
    ...context,
    pathA: true,
    order: [...(context.order || []), 'transform-a'],
  }));
  registry.register('transform.b', (context) => ({
    ...context,
    pathB: true,
    order: [...(context.order || []), 'transform-b'],
  }));
  registry.register('quality', (context) => ({
    ...context,
    qualityScore: 0.92,
    order: [...(context.order || []), 'quality'],
  }));
  registry.register('publish', (context) => ({
    ...context,
    published: true,
    order: [...(context.order || []), 'publish'],
  }));
  return registry;
}

async function executePlan(planId: string, registry: TaskRegistry) {
  const plan = loadConfiguredDAG(planId, registry);
  let context: Record<string, any> = {};

  for (const nodeId of plan.executionOrder) {
    const node = plan.tasks.get(nodeId);
    if (!node) continue;
    const result = await node.handler(context);
    if (result) {
      context = result;
    }
  }

  return { context, plan };
}

describe('orchestration DAG loader and execution', () => {
  let registry: TaskRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('builds an execution plan with resolved task handlers', async () => {
    const { context, plan } = await executePlan('value-canvas-lifecycle', registry);

    expect(plan.executionOrder).toEqual([
      'opportunity',
      'target',
      'realization',
      'expansion',
      'integrity',
    ]);
    expect(context.order).toEqual(plan.executionOrder);
    expect(context.integrity).toBe('controls verified');
  });

  it('supports branching DAGs with merge points', async () => {
    const { context, plan } = await executePlan('parallel-quality-check', registry);

    expect(plan.executionOrder[0]).toBe('ingest');
    expect(context.order?.includes('transform-a')).toBe(true);
    expect(context.order?.includes('transform-b')).toBe(true);
    expect(context.published).toBe(true);
  });

  it('throws when a configured task is missing from registry', () => {
    const brokenRegistry = new TaskRegistry();
    expect(() => loadConfiguredDAG('value-canvas-lifecycle', brokenRegistry)).toThrow(/Task handler not found/);
  });

  it('errors when configuration id is unknown', () => {
    expect(() => loadConfiguredDAG('missing', registry)).toThrow(/configuration not found/);
  });
});
