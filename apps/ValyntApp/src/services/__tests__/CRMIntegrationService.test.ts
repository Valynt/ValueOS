import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks to be available in vi.mock
const { mockIsConnected, mockSearchDeals, mockAreIntegrationsEnabled } = vi.hoisted(() => ({
  mockIsConnected: vi.fn(),
  mockSearchDeals: vi.fn(),
  mockAreIntegrationsEnabled: vi.fn(),
}));

// Mock dependencies
vi.mock('../IntegrationControlService', () => ({
  integrationControlService: {
    areIntegrationsEnabled: mockAreIntegrationsEnabled,
  },
}));

// Mock HubSpotModule
vi.mock('../../mcp-crm/modules/HubSpotModule', () => {
  return {
    HubSpotModule: class {
      isConnected = mockIsConnected;
      searchDeals = mockSearchDeals;
    },
  };
});

// Import service after mocks
import { crmIntegrationService } from '../CRMIntegrationService';
import { integrationControlService } from '../IntegrationControlService';

describe('CRMIntegrationService', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected.mockReturnValue(true);
    mockSearchDeals.mockResolvedValue({ deals: [] });
  });

  it('should throw if integrations are disabled', async () => {
    mockAreIntegrationsEnabled.mockResolvedValue(false);

    await expect(crmIntegrationService.fetchDeals(tenantId)).rejects.toThrow('Integrations are currently disabled for your organization.');
  });

  it('should fetch deals if integrations are enabled', async () => {
    mockAreIntegrationsEnabled.mockResolvedValue(true);

    const deals = await crmIntegrationService.fetchDeals(tenantId);

    expect(deals).toEqual([]);
    expect(mockAreIntegrationsEnabled).toHaveBeenCalledWith(tenantId);
  });
});
