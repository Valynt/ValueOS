import { describe, expect, it } from 'vitest';

import { VectorMemory } from '../vector/index.js';
import {
  TENANT_ALPHA_ID,
  TENANT_BETA_ID,
  createEmbedding,
  createTenantVectorFixture,
} from './utils/tenantMemoryFixtures.js';

describe('VectorMemory tenant isolation boundaries', () => {
  it('returns only chunks scoped to the requested tenant for similarity search', async () => {
    const fixture = createTenantVectorFixture();
    const vectorMemory = new VectorMemory(fixture.store);

    const sharedEmbedding = createEmbedding(42);

    await fixture.writeChunk({
      tenantId: TENANT_ALPHA_ID,
      artifactId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      content: 'alpha chunk about EBITDA uplift',
      embedding: sharedEmbedding,
    });

    await fixture.writeChunk({
      tenantId: TENANT_BETA_ID,
      artifactId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      content: 'beta chunk with identical vector signature',
      embedding: sharedEmbedding,
    });

    const results = await vectorMemory.vectorSearch({
      tenantId: TENANT_ALPHA_ID,
      queryEmbedding: sharedEmbedding,
      threshold: 0.6,
      limit: 10,
      attachProvenance: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.tenantId).toBe(TENANT_ALPHA_ID);
    expect(results.some((result) => result.chunk.tenantId === TENANT_BETA_ID)).toBe(false);
  });

  it('rejects writes that omit tenant_id metadata', async () => {
    const fixture = createTenantVectorFixture();

    await expect(
      fixture.store.insertChunk({
        id: crypto.randomUUID(),
        tenantId: TENANT_ALPHA_ID,
        artifactId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        content: 'invalid chunk without tenant metadata',
        embedding: createEmbedding(11),
        chunkIndex: 0,
        metadata: {},
      }),
    ).rejects.toThrow('chunk metadata must include tenant_id matching tenantId');
  });

  it('prevents cross-tenant similarity leakage in hybrid retrieval', async () => {
    const fixture = createTenantVectorFixture();
    const vectorMemory = new VectorMemory(fixture.store);

    const sameEmbedding = createEmbedding(84);

    await fixture.writeChunk({
      tenantId: TENANT_ALPHA_ID,
      artifactId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      content: 'alpha expansion plan',
      embedding: sameEmbedding,
    });

    await fixture.writeChunk({
      tenantId: TENANT_BETA_ID,
      artifactId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      content: 'beta expansion plan',
      embedding: sameEmbedding,
    });

    const results = await vectorMemory.hybridSearch({
      tenantId: TENANT_ALPHA_ID,
      queryText: 'expansion',
      queryEmbedding: sameEmbedding,
      threshold: 0.6,
      limit: 10,
      attachProvenance: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.content).toContain('alpha');
    expect(results.every((result) => result.chunk.tenantId === TENANT_ALPHA_ID)).toBe(true);
  });
});
