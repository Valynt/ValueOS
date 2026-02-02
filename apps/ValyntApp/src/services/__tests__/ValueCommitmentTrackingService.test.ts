
import { ValueCommitmentTrackingService } from '../ValueCommitmentTrackingService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

const { mockSupabase } = vi.hoisted(() => {
  return {
    mockSupabase: {
      from: vi.fn(),
    }
  }
});

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('../GroundTruthIntegrationService', () => ({
  GroundTruthIntegrationService: class {},
}));

describe('ValueCommitmentTrackingService', () => {
  let service: ValueCommitmentTrackingService;
  let mockGroundTruthService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGroundTruthService = {};
    service = new ValueCommitmentTrackingService(mockGroundTruthService);
  });

  it('updateMetricValue should update metric in database', async () => {
    const metricId = 'metric-123';
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const currentValue = 100;
    const lastMeasuredAt = '2023-01-01T00:00:00Z';

    const mockUpdatedMetric = {
      id: metricId,
      tenant_id: tenantId,
      commitment_id: 'commitment-123',
      current_value: currentValue,
      last_measured_at: lastMeasuredAt,
    };

    const queryBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockUpdatedMetric, error: null }),
    };
    mockSupabase.from.mockReturnValue(queryBuilder);

    const result = await service.updateMetricValue(metricId, tenantId, userId, currentValue, lastMeasuredAt);

    expect(mockSupabase.from).toHaveBeenCalledWith('commitment_metrics');
    expect(queryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      current_value: currentValue,
      last_measured_at: lastMeasuredAt,
    }));
    // Since eq is called multiple times, we can check calls
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', metricId);
    expect(queryBuilder.eq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(result).toEqual(mockUpdatedMetric);
  });

  it('updateMetricValue should throw error if supabase returns error', async () => {
    const metricId = 'metric-123';
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const currentValue = 100;

    const mockError = { message: 'DB Error' };

    const queryBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
    };
    mockSupabase.from.mockReturnValue(queryBuilder);

    await expect(service.updateMetricValue(metricId, tenantId, userId, currentValue)).rejects.toEqual(mockError);
  });

  it('getCommitment should fetch commitment and related data', async () => {
    const commitmentId = 'commitment-123';
    const tenantId = 'tenant-123';

    const mockCommitment = {
      id: commitmentId,
      tenant_id: tenantId,
      title: 'Test Commitment',
      status: 'in_progress',
      progress_percentage: 50,
      target_completion_date: new Date(Date.now() + 86400000).toISOString(), // +1 day
    };
    const mockStakeholders = [{ id: 's-1', role: 'owner' }];
    const mockMilestones = [{ id: 'm-1', status: 'completed', title: 'M1' }, { id: 'm-2', status: 'pending', title: 'M2' }];
    const mockMetrics = [{ id: 'met-1', current_value: 50, target_value: 100, metric_name: 'Met1' }];
    const mockRisks = [{ id: 'r-1', risk_score: 5, risk_title: 'Risk1' }];
    const mockAudits = [{ id: 'a-1', action: 'created' }];

    const mockCommitmentResponse = {
      ...mockCommitment,
      commitment_stakeholders: mockStakeholders,
      commitment_milestones: mockMilestones,
      commitment_metrics: mockMetrics,
      commitment_risks: mockRisks,
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'value_commitments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockCommitmentResponse, error: null }),
        };
      }
      if (table === 'commitment_audits') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockAudits, error: null }),
        };
      }
      return { select: vi.fn() };
    });

    const result = await service.getCommitment(commitmentId, tenantId);

    expect(result).not.toBeNull();
    if (result) {
        expect(result.commitment).toEqual(mockCommitment);
        expect(result.stakeholders).toEqual(mockStakeholders);
        expect(result.milestones).toEqual(mockMilestones);
        expect(result.metrics).toEqual(mockMetrics);
        expect(result.risks).toEqual(mockRisks);
        expect(result.recent_audits).toEqual(mockAudits);

        // Check progress calculation
        // Milestones: 1 completed out of 2 => 50%
        expect(result.progress.milestone_completion).toBe(50);
        // Metrics: 50/100 => 50%
        expect(result.progress.metric_achievement).toBe(50);
        // Risk: 1 medium risk (score 5)
        expect(result.progress.risk_level).toBe('medium');
    }
  });

  it('getCommitment should return null if commitment not found', async () => {
    const commitmentId = 'missing-id';
    const tenantId = 'tenant-123';

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'value_commitments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
        };
      }
      // Other tables return empty
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });

    const result = await service.getCommitment(commitmentId, tenantId);
    expect(result).toBeNull();
  });
});
