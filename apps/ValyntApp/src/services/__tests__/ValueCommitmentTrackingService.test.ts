import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValueCommitmentTrackingService } from '../ValueCommitmentTrackingService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock GroundTruthIntegrationService with a factory
vi.mock('../GroundTruthIntegrationService', () => {
  return {
    GroundTruthIntegrationService: class {
      constructor() {}
    }
  };
});

// Mock the missing module to allow GroundTruthIntegrationService to load if it was imported by other means
// This path is relative to the test file.
// The actual file imports from "../mcp-ground-truth/modules/ESOModule" (relative to service)
// which corresponds to "../../mcp-ground-truth/modules/ESOModule" relative to test.
vi.mock('../../mcp-ground-truth/modules/ESOModule', () => ({
  ESOModule: class {
    async initialize() {}
  }
}));

describe('ValueCommitmentTrackingService', () => {
  let service: ValueCommitmentTrackingService;
  let mockGroundTruthService: any;
  let mockSupabase: any;
  let mockBuilder: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGroundTruthService = {};

    // Mock builder that can be awaited or chained
    mockBuilder = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(),
      // Make it thenable to support await insert(...)
      then: (resolve: any) => resolve({ data: null, error: null }),
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue(mockBuilder),
    };

    service = new ValueCommitmentTrackingService(mockGroundTruthService, mockSupabase as unknown as SupabaseClient);
  });

  it('should create a commitment and insert into db', async () => {
    const inputData = {
      title: 'Test Commitment',
      description: 'Test Description',
      commitment_type: 'financial' as const,
      priority: 'high' as const,
      currency: 'USD',
      tags: ['test'],
    };

    const expectedCommitment = {
      id: 'commitment-123',
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      session_id: 'session-1',
      ...inputData,
      status: 'draft',
      progress_percentage: 0,
      confidence_level: 0,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      committed_at: new Date().toISOString(),
    };

    const expectedStakeholder = {
      id: 'stakeholder-123',
      commitment_id: 'commitment-123',
      user_id: 'user-1',
      role: 'owner',
    };

    // Configure single() return values for sequential calls
    // 1. insert commitment -> select -> single
    // 2. addStakeholder -> insert -> select -> single
    mockBuilder.single
      .mockResolvedValueOnce({ data: expectedCommitment, error: null })
      .mockResolvedValueOnce({ data: expectedStakeholder, error: null });

    const result = await service.createCommitment(
      'tenant-1',
      'user-1',
      'session-1',
      inputData
    );

    expect(mockSupabase.from).toHaveBeenCalledWith('value_commitments');
    expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      session_id: 'session-1',
      title: 'Test Commitment',
    }));

    // Check for audit log insert (table: commitment_audits)
    expect(mockSupabase.from).toHaveBeenCalledWith('commitment_audits');

    // Check for stakeholder insert (table: commitment_stakeholders)
    expect(mockSupabase.from).toHaveBeenCalledWith('commitment_stakeholders');

    expect(result).toEqual(expectedCommitment);
  });
});
