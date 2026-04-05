import { describe, expect, it } from 'vitest';

import {
  VALUE_LIFECYCLE_SCHEMA_VERSION_V1,
  ValueLifecycleSchema,
  deserializeValueLifecyclePayload,
  serializeValueLifecyclePayload,
} from '../agent-schemas';

const confidence = {
  score: 0.72,
  basis: 'mixed' as const,
  explanation: 'Initial estimate based on mixed discovery inputs',
  evidenceCount: 0,
};

describe('Value lifecycle schemas', () => {
  it('requires schemaVersion on lifecycle payloads', () => {
    const parsed = ValueLifecycleSchema.parse({
      schemaVersion: VALUE_LIFECYCLE_SCHEMA_VERSION_V1,
      stage: 'INITIATED',
      organizationId: '11111111-1111-1111-1111-111111111111',
      opportunityId: '22222222-2222-2222-2222-222222222222',
      accountName: 'Acme Corp',
      problemStatement: 'Manual process delays sales cycles',
      stakeholders: [],
      baselineMetrics: [],
      evidence: [],
      assumptions: [],
      confidence,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(parsed.schemaVersion).toBe('v1');
  });

  it('serializes and deserializes payloads with schemaVersion', () => {
    const serialized = serializeValueLifecyclePayload({
      schemaVersion: VALUE_LIFECYCLE_SCHEMA_VERSION_V1,
      stage: 'DRAFTING',
      organizationId: '11111111-1111-1111-1111-111111111111',
      opportunityId: '22222222-2222-2222-2222-222222222222',
      hypothesisId: '33333333-3333-3333-3333-333333333333',
      title: 'Automate pipeline hygiene',
      statement: 'Automation reduces rep admin time and increases selling time',
      valueDriver: 'Productivity',
      valueRange: {
        low: 10000,
        expected: 25000,
        high: 40000,
      },
      assumptions: [],
      evidence: [],
      confidence: {
        ...confidence,
        score: 0.8,
      },
      draftedAt: '2026-01-01T00:00:00.000Z',
    });

    const parsed = deserializeValueLifecyclePayload(serialized);

    expect(parsed).toMatchObject({
      schemaVersion: 'v1',
      stage: 'DRAFTING',
    });
  });
});
