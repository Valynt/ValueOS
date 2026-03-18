import { describe, expect, it } from 'vitest';

import { SemanticMemory } from '../semantic/index.js';

import {
  createEmbedding,
  createTenantSemanticFixture,
  TENANT_ALPHA_ID,
  TENANT_BETA_ID,
} from './utils/tenantMemoryFixtures.js';

describe('SemanticMemory tenant retrieval boundaries', () => {
  it('scopes semantic retrieval to the requesting organization', async () => {
    const fixture = createTenantSemanticFixture();
    const semanticMemory = new SemanticMemory(fixture.store);

    const sharedEmbedding = createEmbedding(105);

    await fixture.writeFact({
      organizationId: TENANT_ALPHA_ID,
      type: 'opportunity',
      content: 'alpha: increase margin by reducing churn',
      embedding: sharedEmbedding,
    });

    await fixture.writeFact({
      organizationId: TENANT_BETA_ID,
      type: 'opportunity',
      content: 'beta: increase margin by reducing churn',
      embedding: sharedEmbedding,
    });

    const results = await semanticMemory.search({
      embedding: sharedEmbedding,
      organizationId: TENANT_ALPHA_ID,
      threshold: 0.6,
      limit: 10,
      attachProvenance: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.fact.organizationId).toBe(TENANT_ALPHA_ID);
    expect(results.some((result) => result.fact.organizationId === TENANT_BETA_ID)).toBe(false);
  });

  it('rejects semantic writes that omit tenant_id metadata', async () => {
    const fixture = createTenantSemanticFixture();

    await expect(
      fixture.store.insert({
        id: crypto.randomUUID(),
        type: 'workflow_result',
        content: 'missing tenant metadata should fail',
        embedding: createEmbedding(200),
        metadata: {},
        status: 'approved',
        version: 1,
        organizationId: TENANT_ALPHA_ID,
        confidenceScore: 0.95,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow('semantic metadata must include tenant_id matching organizationId');
  });

  it('prevents cross-tenant similarity leakage on near-identical facts', async () => {
    const fixture = createTenantSemanticFixture();
    const semanticMemory = new SemanticMemory(fixture.store);

    const duplicatedEmbedding = createEmbedding(305);

    await fixture.writeFact({
      organizationId: TENANT_ALPHA_ID,
      type: 'target_definition',
      content: 'alpha target: 20% growth in Q4',
      embedding: duplicatedEmbedding,
    });

    await fixture.writeFact({
      organizationId: TENANT_BETA_ID,
      type: 'target_definition',
      content: 'beta target: 20% growth in Q4',
      embedding: duplicatedEmbedding,
    });

    const results = await semanticMemory.search({
      embedding: duplicatedEmbedding,
      organizationId: TENANT_ALPHA_ID,
      type: 'target_definition',
      threshold: 0.6,
      limit: 10,
      attachProvenance: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.fact.content).toContain('alpha target');
    expect(results.every((result) => result.fact.organizationId === TENANT_ALPHA_ID)).toBe(true);
  });

  it('fails retrieval requests that omit organization tenant scoping', async () => {
    const fixture = createTenantSemanticFixture();
    const semanticMemory = new SemanticMemory(fixture.store);

    await expect(
      semanticMemory.search({
        embedding: createEmbedding(10),
        threshold: 0.7,
        limit: 5,
      } as never),
    ).rejects.toThrow();
  });
});
