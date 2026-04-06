import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hubspotMock = vi.hoisted(() => ({
  isConnected: vi.fn(),
  searchDeals: vi.fn(),
  addDealNote: vi.fn(),
}));

vi.mock('@mcp/crm/modules/HubSpotModule', () => ({
  HubSpotModule: class {
    constructor() { return hubspotMock; }
  },
}));

const integrationControlMock = vi.hoisted(() => ({
  areIntegrationsEnabled: vi.fn(),
}));

vi.mock('../IntegrationControlService', () => ({
  integrationControlService: integrationControlMock,
}));

vi.mock('../../lib/supabase', () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}));

import { crmIntegrationService } from '../crm/CRMIntegrationService.ts'

describe('CRMIntegrationService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevMocks = process.env.DEV_MOCKS_ENABLED;

  beforeEach(() => {
    hubspotMock.isConnected.mockReset();
    hubspotMock.searchDeals.mockReset();
    hubspotMock.addDealNote.mockReset();
    integrationControlMock.areIntegrationsEnabled.mockReset();
    integrationControlMock.areIntegrationsEnabled.mockResolvedValue(true);
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

    await expect(crmIntegrationService.fetchDeals('test-tenant')).rejects.toThrow(
      'CRM provider is not connected',
    );
    expect(hubspotMock.searchDeals).not.toHaveBeenCalled();
  });



  it('throws when provider is not connected instead of returning mock deals', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_MOCKS_ENABLED = 'true';
    hubspotMock.isConnected.mockReturnValue(false);

    await expect(crmIntegrationService.fetchDeals('test-tenant')).rejects.toThrow(
      'CRM provider is not connected',
    );

    expect(hubspotMock.searchDeals).not.toHaveBeenCalled();
  });

  it('syncAnalysisToDeal uses real CRM path when connected', async () => {
    hubspotMock.isConnected.mockReturnValue(true);
    hubspotMock.addDealNote.mockResolvedValue(true);

    const result = await crmIntegrationService.syncAnalysisToDeal('HS-123', {
      analysisSummary: 'summary',
      valueHypotheses: [],
      keyMetrics: [],
    }, 'test-tenant');

    expect(hubspotMock.addDealNote).toHaveBeenCalledWith('HS-123', expect.stringContaining('ValueOS Analysis'));
    expect(result).toEqual({
      success: true,
      message: 'Analysis synced to HubSpot successfully.',
    });
  });

  it('returns empty array when integrations are disabled', async () => {
    integrationControlMock.areIntegrationsEnabled.mockResolvedValue(false);

    const result = await crmIntegrationService.fetchDeals('test-tenant');

    expect(integrationControlMock.areIntegrationsEnabled).toHaveBeenCalledWith('test-tenant');
    expect(hubspotMock.searchDeals).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
