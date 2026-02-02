
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

  it('updateCommitmentStatus should update status and create audit entry', async () => {
    const commitmentId = 'commitment-123';
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const status = 'in_progress';
    const progressPercentage = 50;
    const reason = 'Started work';

    const mockExistingCommitment = {
      id: commitmentId,
      tenant_id: tenantId,
      status: 'pending',
      progress_percentage: 0,
    };

    const mockUpdatedCommitment = {
      ...mockExistingCommitment,
      status,
      progress_percentage: progressPercentage,
      updated_at: '2023-01-01T00:00:00Z',
    };

    const queryBuilder = {
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: mockExistingCommitment, error: null }) // First call for fetching existing
        .mockResolvedValueOnce({ data: mockUpdatedCommitment, error: null }), // Second call for update
    };
    mockSupabase.from.mockReturnValue(queryBuilder);

    const result = await service.updateCommitmentStatus(commitmentId, tenantId, userId, status as any, progressPercentage, reason);

    // Verify existing commitment fetch
    expect(mockSupabase.from).toHaveBeenCalledWith('value_commitments');
    expect(queryBuilder.select).toHaveBeenCalled();

    // Verify update
    expect(queryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      status,
      progress_percentage: progressPercentage,
    }));

    // Verify audit entry creation
    expect(mockSupabase.from).toHaveBeenCalledWith('commitment_audits');
    expect(queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      commitment_id: commitmentId,
      action: 'status_changed',
      previous_values: { status: 'pending', progress_percentage: 0 },
      new_values: { status, progress_percentage: progressPercentage },
      change_reason: reason,
    }));

    expect(result).toEqual(mockUpdatedCommitment);
  });
});
