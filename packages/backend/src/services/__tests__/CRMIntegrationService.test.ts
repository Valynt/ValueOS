import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hubspotMock = {
  isConnected: vi.fn(),
  searchDeals: vi.fn(),
  addDealNote: vi.fn(),
};

vi.mock('@mcp/crm/modules/HubSpotModule', () => ({
  HubSpotModule: vi.fn(() => hubspotMock),
}));

import { crmIntegrationService } from '../CRMIntegrationService';

describe('CRMIntegrationService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevMocks = process.env.DEV_MOCKS_ENABLED;

  beforeEach(() => {
    hubspotMock.isConnected.mockReset();
    hubspotMock.searchDeals.mockReset();
    hubspotMock.addDealNote.mockReset();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDevMocks === undefined) {
      delete process.env.DEV_MOCKS_ENABLED;
    } else {
      process.env.DEV_MOCKS_ENABLED = originalDevMocks;
    }
  });

  it('does not return mock deals in production even when dev mocks are enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_MOCKS_ENABLED = 'true';
    hubspotMock.isConnected.mockReturnValue(false);
    hubspotMock.searchDeals.mockResolvedValue({ deals: [] });

    const result = await crmIntegrationService.fetchDeals();

    expect(hubspotMock.searchDeals).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
