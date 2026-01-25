import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValueCommitmentTrackingService } from '../ValueCommitmentTrackingService';

// Mock dependencies
const mockGroundTruthService = class {
  validateCommitment = vi.fn();
};

vi.mock('../GroundTruthIntegrationService.js', () => {
  return {
    GroundTruthIntegrationService: mockGroundTruthService
  };
});

// Also mock the non-js path just in case
vi.mock('../GroundTruthIntegrationService', () => {
  return {
    GroundTruthIntegrationService: mockGroundTruthService
  };
});

// Mock TenantAwareService to avoid BaseService import issues and simplify testing
vi.mock('../TenantAwareService', () => {
  return {
    TenantAwareService: class {
      updateWithTenantCheck = vi.fn();
      queryWithTenantCheck = vi.fn();
      insertWithTenantCheck = vi.fn();
      getUserTenants = vi.fn();
      validateTenantAccess = vi.fn();
      constructor() {}
    }
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  }
}));

vi.mock('../../lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })
}));

describe('ValueCommitmentTrackingService', () => {
  let service: ValueCommitmentTrackingService;
  let groundTruthService: any;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockCommitmentId = 'commitment-123';

  beforeEach(() => {
    vi.clearAllMocks();
    groundTruthService = new mockGroundTruthService();
    service = new ValueCommitmentTrackingService(groundTruthService);

    // Mock protected methods of TenantAwareService
    (service as any).getUserTenants = vi.fn().mockResolvedValue([mockTenantId]);
    (service as any).validateTenantAccess = vi.fn().mockResolvedValue(undefined);
  });

  describe('updateCommitmentStatus', () => {
    it('should update status and create audit entry', async () => {
        const mockExisting = {
            id: mockCommitmentId,
            tenant_id: mockTenantId,
            status: 'draft',
            progress_percentage: 0,
        };

        const mockUpdated = {
            ...mockExisting,
            status: 'in_progress',
            progress_percentage: 10,
            updated_at: '2023-01-01T00:00:00Z'
        };

        // Mock queryWithTenantCheck
        (service as any).queryWithTenantCheck = vi.fn().mockResolvedValue([mockExisting]);

        // Mock updateWithTenantCheck
        (service as any).updateWithTenantCheck = vi.fn().mockResolvedValue(mockUpdated);

        // Mock insertWithTenantCheck (for audit)
        (service as any).insertWithTenantCheck = vi.fn().mockResolvedValue({});

        const result = await service.updateCommitmentStatus(
            mockCommitmentId,
            mockTenantId,
            mockUserId,
            'in_progress',
            10,
            'Started work'
        );

        expect(result).toEqual(mockUpdated);
        expect((service as any).queryWithTenantCheck).toHaveBeenCalledWith(
            "value_commitments",
            mockUserId,
            { id: mockCommitmentId, tenant_id: mockTenantId }
        );
        expect((service as any).updateWithTenantCheck).toHaveBeenCalledWith(
            "value_commitments",
            mockUserId,
            mockCommitmentId,
            expect.objectContaining({
                status: 'in_progress',
                progress_percentage: 10
            })
        );
        expect((service as any).insertWithTenantCheck).toHaveBeenCalledWith(
            "commitment_audits",
            mockUserId,
            mockTenantId,
            expect.objectContaining({
                commitment_id: mockCommitmentId,
                action: 'status_changed',
                change_reason: 'Started work'
            })
        );
    });

    it('should throw if commitment not found', async () => {
        (service as any).queryWithTenantCheck = vi.fn().mockResolvedValue([]);

        await expect(service.updateCommitmentStatus(
            mockCommitmentId,
            mockTenantId,
            mockUserId,
            'in_progress'
        )).rejects.toThrow(`Commitment ${mockCommitmentId} not found`);
    });
  });
});
