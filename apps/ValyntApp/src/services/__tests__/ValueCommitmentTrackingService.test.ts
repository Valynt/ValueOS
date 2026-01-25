import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValueCommitmentTrackingService } from '../ValueCommitmentTrackingService';

// Mocks
vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock GroundTruthIntegrationService completely to avoid loading broken file
vi.mock('../GroundTruthIntegrationService.js', () => ({
  GroundTruthIntegrationService: class {
    constructor() {}
  }
}));

// Use hoisted variables for mocks
const mocks = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();

  const mockChain = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: mockEq,
    single: mockSingle,
  };

  // Configure chain behavior
  mockSelect.mockReturnValue(mockChain);
  mockUpdate.mockReturnValue(mockChain);
  mockInsert.mockReturnValue(mockChain);
  mockEq.mockReturnValue(mockChain);

  const mockFrom = vi.fn().mockReturnValue(mockChain);

  return {
    mockFrom,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockEq,
    mockSingle,
    mockChain
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mocks.mockFrom,
  },
}));

describe('ValueCommitmentTrackingService', () => {
  let service: ValueCommitmentTrackingService;
  let mockGroundTruthService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mocks
    mocks.mockFrom.mockReturnValue(mocks.mockChain);
    mocks.mockSingle.mockResolvedValue({ data: null, error: null });
    mocks.mockInsert.mockResolvedValue({ error: null });

    // Reset return values for chain methods (as they are persistent objects)
    mocks.mockSelect.mockReturnValue(mocks.mockChain);
    mocks.mockUpdate.mockReturnValue(mocks.mockChain);
    mocks.mockInsert.mockReturnValue(mocks.mockChain);
    mocks.mockEq.mockReturnValue(mocks.mockChain);

    const { GroundTruthIntegrationService } = await import('../GroundTruthIntegrationService.js');
    mockGroundTruthService = new GroundTruthIntegrationService();
    service = new ValueCommitmentTrackingService(mockGroundTruthService);
  });

  describe('updateCommitmentStatus', () => {
    it('should update status and create audit entry', async () => {
      const commitmentId = 'comm-1';
      const tenantId = 'tenant-1';
      const userId = 'user-1';
      const status = 'active';
      const progress = 50;

      const mockCommitment = {
        id: commitmentId,
        tenant_id: tenantId,
        status: 'draft',
        progress_percentage: 0
      };

      const updatedCommitment = {
        ...mockCommitment,
        status,
        progress_percentage: progress,
        updated_at: '2023-01-01T00:00:00Z'
      };

      // Mock fetching existing (first call to single)
      mocks.mockSingle.mockResolvedValueOnce({ data: mockCommitment, error: null });

      // Mock update return (second call to single)
      mocks.mockSingle.mockResolvedValueOnce({ data: updatedCommitment, error: null });

      const result = await service.updateCommitmentStatus(
        commitmentId,
        tenantId,
        userId,
        status,
        progress
      );

      expect(result).toEqual(updatedCommitment);

      // Verify fetch
      expect(mocks.mockFrom).toHaveBeenCalledWith('value_commitments');
      expect(mocks.mockSelect).toHaveBeenCalledWith('*');
      expect(mocks.mockEq).toHaveBeenCalledWith('id', commitmentId);
      expect(mocks.mockEq).toHaveBeenCalledWith('tenant_id', tenantId);

      // Verify update
      expect(mocks.mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status,
        progress_percentage: progress
      }));

      // Verify audit
      expect(mocks.mockFrom).toHaveBeenCalledWith('commitment_audits');
      expect(mocks.mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        commitment_id: commitmentId,
        action: 'status_changed',
        user_id: userId,
        previous_values: {
          status: 'draft',
          progress_percentage: 0
        },
        new_values: {
          status: 'active',
          progress_percentage: 50
        }
      }));
    });

    it('should throw error if commitment not found', async () => {
        mocks.mockSingle.mockResolvedValueOnce({ data: null, error: null });

        await expect(service.updateCommitmentStatus(
            'comm-1', 'tenant-1', 'user-1', 'active'
        )).rejects.toThrow('Commitment not found');
    });

    it('should propagate update error', async () => {
        const mockCommitment = { id: 'comm-1', status: 'draft' };
        mocks.mockSingle.mockResolvedValueOnce({ data: mockCommitment, error: null });

        const updateError = new Error('Update failed');
        mocks.mockSingle.mockResolvedValueOnce({ data: null, error: updateError });

        await expect(service.updateCommitmentStatus(
            'comm-1', 'tenant-1', 'user-1', 'active'
        )).rejects.toThrow('Update failed');
    });
  });
});
