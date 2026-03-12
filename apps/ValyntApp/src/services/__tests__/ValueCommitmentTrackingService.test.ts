import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValueCommitmentTrackingService } from '../ValueCommitmentTrackingService';
import { GroundTruthIntegrationService } from '../GroundTruthIntegrationService';
import { supabase } from '../../lib/supabase';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../GroundTruthIntegrationService.js', () => ({
  GroundTruthIntegrationService: class {},
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ValueCommitmentTrackingService', () => {
  let service: ValueCommitmentTrackingService;
  let mockGroundTruthService: GroundTruthIntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGroundTruthService = new GroundTruthIntegrationService() as any;
    service = new ValueCommitmentTrackingService(mockGroundTruthService);
  });

  describe('createRisk', () => {
    it('should insert risk into database and return it', async () => {
      const commitmentId = '123e4567-e89b-12d3-a456-426614174000';
      const tenantId = '123e4567-e89b-12d3-a456-426614174001';
      const userId = '123e4567-e89b-12d3-a456-426614174002';
      const riskData = {
        risk_title: 'Test Risk',
        risk_score: 10,
        status: 'identified' as const,
      };

      const insertedRisk = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        commitment_id: commitmentId,
        tenant_id: tenantId,
        ...riskData,
        identified_at: '2023-01-01T00:00:00.000Z',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const mockSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: insertedRisk, error: null }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      (supabase!.from as any).mockImplementation(mockFrom);

      const result = await service.createRisk(commitmentId, tenantId, userId, riskData);

      expect(supabase!.from).toHaveBeenCalledWith('commitment_risks');
      // Verify usage of insert
      // Note: we can't easily check exact args because identified_at is generated inside
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        commitment_id: commitmentId,
        tenant_id: tenantId,
        risk_title: 'Test Risk',
      }));
      expect(result).toEqual(insertedRisk);
    });

    it('should throw error if insert fails', async () => {
      const error = { message: 'DB Error' };
      const mockSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      });
      (supabase!.from as any).mockReturnValue({
        insert: mockInsert,
      });

      await expect(service.createRisk(
        '123e4567-e89b-12d3-a456-426614174000',
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174002',
        { risk_title: 'R' } as any
      )).rejects.toEqual(error);
    });
  });
});
