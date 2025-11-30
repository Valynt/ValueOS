import { describe, it, expect } from 'vitest';
import { valueCaseService } from '../ValueCaseService';

const svc: any = valueCaseService;

describe('ValueCaseService mappers', () => {
  it('maps value_cases rows with company profile and normalizes stage/status', () => {
    const mapped = svc.mapValueCase({
      id: '1',
      name: 'Deal',
      description: 'desc',
      status: 'published',
      quality_score: 7,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      metadata: { stage: 'target' },
      company_profiles: [{ company_name: 'Acme' }],
    });

    expect(mapped.company).toBe('Acme');
    expect(mapped.stage).toBe('target');
    expect(mapped.status).toBe('completed');
  });

  it('maps business_cases rows and defaults unknowns safely', () => {
    const mapped = svc.mapBusinessCase({
      id: '2',
      name: 'Legacy',
      status: 'draft',
      client: 'Beta',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      metadata: { description: 'd', quality_score: 5 },
    });

    expect(mapped.company).toBe('Beta');
    expect(mapped.status).toBe('in-progress');
    expect(mapped.stage).toBe('opportunity');
  });

  it('normalizes invalid stages to opportunity', () => {
    expect(svc.normalizeStage('unknown')).toBe('opportunity');
  });
});
