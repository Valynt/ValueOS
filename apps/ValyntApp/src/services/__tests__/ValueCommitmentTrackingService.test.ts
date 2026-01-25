import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValueCommitmentTrackingService } from '../ValueCommitmentTrackingService';
import { GroundTruthIntegrationService } from '../GroundTruthIntegrationService';

// Define hoisted mocks
const { mockFrom, mockBuilder, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockBuilder: any = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: mockSingle,
  };

  // Implement chaining
  mockBuilder.update.mockReturnValue(mockBuilder);
  mockBuilder.eq.mockReturnValue(mockBuilder);
  mockBuilder.select.mockReturnValue(mockBuilder);

  const mockFrom = vi.fn().mockReturnValue(mockBuilder);

  return { mockFrom, mockBuilder, mockSingle };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Mock GroundTruthIntegrationService
vi.mock('../GroundTruthIntegrationService', () => {
  return {
    GroundTruthIntegrationService: class {
      validateCommitment() { return {}; }
    }
  };
});

describe('ValueCommitmentTrackingService', () => {
  let service: ValueCommitmentTrackingService;
  let groundTruthService: GroundTruthIntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset implementation
    mockBuilder.update.mockReturnValue(mockBuilder);
    mockBuilder.eq.mockReturnValue(mockBuilder);
    mockBuilder.select.mockReturnValue(mockBuilder);
    mockFrom.mockReturnValue(mockBuilder);

    // Create instance of mocked GroundTruthIntegrationService
    groundTruthService = new GroundTruthIntegrationService() as any;
    service = new ValueCommitmentTrackingService(groundTruthService);
  });

  describe('updateStakeholder', () => {
    it('should update stakeholder and return the result', async () => {
      const stakeholderId = 'stakeholder-123';
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const updates = { accountability_percentage: 50 };
      const updatedStakeholder = {
        id: stakeholderId,
        tenant_id: tenantId,
        ...updates,
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      mockSingle.mockResolvedValue({ data: updatedStakeholder, error: null });

      const result = await service.updateStakeholder(stakeholderId, tenantId, userId, updates);

      expect(mockFrom).toHaveBeenCalledWith('commitment_stakeholders');
      expect(mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        ...updates,
        updated_at: expect.any(String)
      }));
      // Check that .eq was called for both id and tenant_id
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', stakeholderId);
      expect(mockBuilder.eq).toHaveBeenCalledWith('tenant_id', tenantId);

      expect(result).toEqual(updatedStakeholder);
    });

    it('should throw error if update fails', async () => {
        const error = new Error('Update failed');
        mockSingle.mockResolvedValue({ data: null, error });

        await expect(service.updateStakeholder('id', 'tenant', 'user', {}))
            .rejects.toThrow('Update failed');
    });

    it('should throw error if stakeholder not found', async () => {
        mockSingle.mockResolvedValue({ data: null, error: null });

        await expect(service.updateStakeholder('id', 'tenant', 'user', {}))
            .rejects.toThrow('Stakeholder not found');
    });
  });
});
