import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../lib/supabase';

// Mock dependencies BEFORE importing the service under test
vi.mock('../GroundTruthIntegrationService', () => {
  return {
    GroundTruthIntegrationService: class {
      constructor() {}
      validateCommitment() { return Promise.resolve({}); }
    }
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

// Now import the service
import { ValueCommitmentTrackingService } from '../ValueCommitmentTrackingService';
import { GroundTruthIntegrationService } from '../GroundTruthIntegrationService';

describe('ValueCommitmentTrackingService', () => {
  let service: ValueCommitmentTrackingService;
  let mockGroundTruthService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGroundTruthService = new GroundTruthIntegrationService() as any;
    service = new ValueCommitmentTrackingService(mockGroundTruthService);
  });

  describe('updateMilestoneProgress', () => {
    it('should update milestone progress in database', async () => {
      const milestoneId = 'ms-123';
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const progressPercentage = 50;
      const commitmentId = 'commit-123';

      const mockUpdate = vi.fn().mockReturnThis();
      const mockUpdateCommitment = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: milestoneId,
          commitment_id: commitmentId,
          progress_percentage: progressPercentage,
        },
        error: null
      });

      const mockSelectMilestones = vi.fn().mockResolvedValue({
        data: [
            { progress_percentage: 50 },
            { progress_percentage: 100 }
        ],
        error: null
      });

      // We need to mock different responses based on the table name
      (supabase!.from as any).mockImplementation((table: string) => {
        if (table === 'commitment_milestones') {
           return {
             update: mockUpdate,
             eq: mockEq,
             select: () => ({
                single: mockSingle,
                // Handle the case where we fetch all milestones for recalculation
                // The implementation might use .select('*').eq('commitment_id', ...)
                eq: (field: string, value: any) => {
                    if (field === 'commitment_id') {
                        return mockSelectMilestones();
                    }
                    // default for single update flow
                     return {
                        single: mockSingle
                     }
                }
             })
           }
        }
        if (table === 'value_commitments') {
            return {
                update: mockUpdateCommitment,
                eq: mockEq,
                select: mockSelect,
                single: mockSingle
            }
        }
        return {
             update: mockUpdate,
             eq: mockEq,
             select: mockSelect,
             single: mockSingle
        };
      });

      const result = await service.updateMilestoneProgress(milestoneId, tenantId, userId, progressPercentage);

      expect(supabase!.from).toHaveBeenCalledWith('commitment_milestones');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        progress_percentage: progressPercentage
      }));
      // Check if commit update was called (recalculation)
      expect(supabase!.from).toHaveBeenCalledWith('value_commitments');
      expect(mockUpdateCommitment).toHaveBeenCalled();
    });
  });
});
