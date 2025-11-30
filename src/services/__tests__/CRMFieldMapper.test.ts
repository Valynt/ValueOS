import { describe, it, expect } from 'vitest';
import { crmFieldMapper } from '../CRMFieldMapper';
import { CRMDeal, CRMContact } from '../../mcp-crm/types';

const baseDeal: CRMDeal = {
  id: 'deal-1',
  name: 'Big Deal',
  companyName: '',
  stage: 'Negotiation',
  amount: 100000,
  currency: 'USD',
  closeDate: new Date('2024-12-31'),
  properties: {},
  provider: 'hubspot',
};

describe('CRMFieldMapper', () => {
  it('maps missing company to Unknown Company and infers target stage', () => {
    const mapped = crmFieldMapper.mapDealToValueCase(baseDeal, [], 'hubspot');
    expect(mapped.company).toBe('Unknown Company');
    expect(mapped.stage).toBe('target');
    expect(mapped.metadata.crmProvider).toBe('hubspot');
  });

  it('marks first contact as primary and infers roles', () => {
    const contacts: CRMContact[] = [
      { id: 'c1', firstName: 'Sam', lastName: 'CFO', title: 'Chief Financial Officer' },
      { id: 'c2', firstName: 'Dev', lastName: 'Lead', title: 'Engineering Manager' },
    ];

    const stakeholders = crmFieldMapper.mapContacts(contacts);
    expect(stakeholders[0].isPrimary).toBe(true);
    expect(stakeholders[0].role).toBe('Economic Buyer');
    expect(stakeholders[1].role).toBe('Champion');
  });

  it('defaults to opportunity stage when stage is missing', () => {
    const mapped = crmFieldMapper.mapStage(undefined, 'hubspot');
    expect(mapped).toBe('opportunity');
  });
});
