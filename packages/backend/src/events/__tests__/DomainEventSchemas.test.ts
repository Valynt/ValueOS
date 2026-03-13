import { describe, expect, it } from 'vitest';

import { validateDomainEvent } from '../DomainEventSchemas.js';

describe('DomainEventSchemas narrative.drafted compatibility', () => {
  const envelope = {
    id: crypto.randomUUID(),
    emittedAt: new Date().toISOString(),
    traceId: 'trace-compat-001',
    tenantId: crypto.randomUUID(),
    actorId: 'user-001',
  };

  it('accepts normalized narrative.drafted fields', () => {
    const payload = validateDomainEvent('narrative.drafted', {
      ...envelope,
      valueCaseId: 'case-123',
      defenseReadinessScore: 0.81,
      format: 'executive_summary',
    });

    expect(payload.valueCaseId).toBe('case-123');
    expect(payload.defenseReadinessScore).toBe(0.81);
  });

  it('rejects legacy snake_case tenant and payload fields', () => {
    expect(() => validateDomainEvent('narrative.drafted', {
      ...envelope,
      organization_id: envelope.tenantId,
      value_case_id: 'case-123',
      defense_readiness_score: 0.81,
      format: 'executive_summary',
    })).toThrow(/Invalid payload for domain event/);
  });

  it('strips legacy snake_case fields when normalized keys are present', () => {
    const payload = validateDomainEvent('narrative.drafted', {
      ...envelope,
      organization_id: envelope.tenantId,
      valueCaseId: 'case-123',
      value_case_id: 'legacy-case-ignored',
      defenseReadinessScore: 0.81,
      defense_readiness_score: 0.5,
      format: 'executive_summary',
    });

    // Normalized fields are preserved
    expect(payload.valueCaseId).toBe('case-123');
    expect(payload.defenseReadinessScore).toBe(0.81);

    // Legacy snake_case fields are stripped from the parsed payload
    expect('organization_id' in payload).toBe(false);
    expect('value_case_id' in payload).toBe(false);
    expect('defense_readiness_score' in payload).toBe(false);
  });
});
