/**
 * Customer Portal API Tests
 */

import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCustomerBenchmarks } from '../customer/benchmarks.js'
import { getCustomerMetrics } from '../customer/metrics.js'
import { getCustomerValueCase } from '../customer/value-case.js'

const {
  mockValidateCustomerToken,
  mockSupabaseFrom,
  mockSupabaseRpc,
  mockSharedSupabaseClient,
  mockBackendSupabaseClient,
  mockGetValueTreeByValueCase,
  mockGetRoiModelByValueCase,
  mockDeriveKpiTargetsForValueCase,
} = vi.hoisted(() => {
  const mockValidateCustomerToken = vi.fn();
  const mockSupabaseFrom = vi.fn();
  const mockSupabaseRpc = vi.fn();
  const mockGetValueTreeByValueCase = vi.fn();
  const mockGetRoiModelByValueCase = vi.fn();
  const mockDeriveKpiTargetsForValueCase = vi.fn();
  const buildClient = () => ({
    auth: {},
    storage: {},
    realtime: {},
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
    channel: vi.fn(),
    removeChannel: vi.fn(),
    getChannels: vi.fn(),
    removeAllChannels: vi.fn(),
  });

  return {
    mockValidateCustomerToken,
    mockSupabaseFrom,
    mockSupabaseRpc,
    mockSharedSupabaseClient: buildClient(),
    mockBackendSupabaseClient: buildClient(),
    mockGetValueTreeByValueCase,
    mockGetRoiModelByValueCase,
    mockDeriveKpiTargetsForValueCase,
  };
});

// Mock dependencies
vi.mock('../../services/tenant/CustomerAccessService', async () => {
  const actual = await vi.importActual<typeof import('../../services/tenant/CustomerAccessService')>(
    '../../services/tenant/CustomerAccessService'
  );

  return {
    ...actual,
    customerAccessService: {
      ...actual.customerAccessService,
      validateCustomerToken: mockValidateCustomerToken,
    },
  };
});

vi.mock('@shared/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@shared/lib/supabase')>('@shared/lib/supabase');

  return {
    ...actual,
    supabase: mockSharedSupabaseClient,
    getSupabaseClient: vi.fn(() => mockSharedSupabaseClient),
  };
});

vi.mock('../../lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('../../lib/supabase')>('../../lib/supabase');

  return {
    ...actual,
    supabase: mockBackendSupabaseClient,
    getSupabaseClient: vi.fn(() => mockBackendSupabaseClient),
    createServerSupabaseClient: vi.fn(() => mockBackendSupabaseClient),
    createUserSupabaseClient: vi.fn(() => mockBackendSupabaseClient),
  };
});

vi.mock('../../services/value/ValueTreeService', async () => {
  const actual = await vi.importActual<typeof import('../../services/value/ValueTreeService')>(
    '../../services/value/ValueTreeService'
  );

  return {
    ...actual,
    ValueTreeService: vi.fn(function () {
      return {
        getByValueCase: mockGetValueTreeByValueCase,
      };
    }),
  };
});

vi.mock('../../services/value/RoiModelService', async () => {
  const actual = await vi.importActual<typeof import('../../services/value/RoiModelService')>(
    '../../services/value/RoiModelService'
  );

  return {
    ...actual,
    RoiModelService: vi.fn(function () {
      return {
        getByValueCase: mockGetRoiModelByValueCase,
      };
    }),
  };
});

vi.mock('../../services/value/KpiTargetService', async () => {
  const actual = await vi.importActual<typeof import('../../services/value/KpiTargetService')>(
    '../../services/value/KpiTargetService'
  );

  return {
    ...actual,
    KpiTargetService: vi.fn(function () {
      return {
        deriveForValueCase: mockDeriveKpiTargetsForValueCase,
      };
    }),
  };
});

describe('Customer Portal API', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      params: {},
      query: {}
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
      on: vi.fn(),
    };

    vi.clearAllMocks();
    mockValidateCustomerToken.mockReset();
    mockSupabaseFrom.mockReset();
    mockSupabaseRpc.mockReset();
    mockGetValueTreeByValueCase.mockReset();
    mockGetRoiModelByValueCase.mockReset();
    mockDeriveKpiTargetsForValueCase.mockReset();
  });

  describe('GET /api/customer/metrics/:token', () => {
    it('should return metrics for valid token', async () => {
      const mockToken = 'valid-token';
      const mockValueCaseId = 'value-case-123';

      mockReq.params = { token: mockToken };
      mockReq.query = { period: '90d' };

      // Mock token validation
      mockValidateCustomerToken.mockResolvedValue({
        value_case_id: mockValueCaseId,
        is_valid: true,
        error_message: null
      });

      // Mock value case and metrics fetches
      const metricsQuery = {
        data: [
          {
            id: '1',
            metric_name: 'Cost Savings',
            metric_type: 'cost',
            predicted_value: 500000,
            actual_value: 620000,
            status: 'on_track'
          }
        ],
        error: null,
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn(),
        gte: vi.fn(),
        then: vi.fn((resolve) => Promise.resolve(resolve({ data: metricsQuery.data, error: metricsQuery.error }))),
      };
      metricsQuery.select.mockReturnValue(metricsQuery);
      metricsQuery.eq.mockReturnValue(metricsQuery);
      metricsQuery.order.mockReturnValue(metricsQuery);
      metricsQuery.gte.mockReturnValue(metricsQuery);

      mockSupabaseFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockValueCaseId,
              company_name: 'Acme Corp',
              name: 'Q1 2026 Business Case'
            },
            error: null
          })
        })
        .mockReturnValueOnce(metricsQuery);

      await getCustomerMetrics(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          value_case_id: mockValueCaseId,
          company_name: 'Acme Corp',
          metrics: expect.any(Array),
          summary: expect.objectContaining({
            total_metrics: 1,
            on_track: 1
          })
        })
      );
    });

    it('should return 401 for invalid token', async () => {
      mockReq.params = { token: 'invalid-token' };

      mockValidateCustomerToken.mockResolvedValue({
        value_case_id: null,
        is_valid: false,
        error_message: 'Invalid token'
      });

      await getCustomerMetrics(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Invalid token'
        })
      );
    });

    it('should return 400 for invalid parameters', async () => {
      mockReq.params = {}; // Missing token

      await getCustomerMetrics(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request'
        })
      );
    });
  });

  describe('GET /api/customer/value-case/:token', () => {
    it('should return value case details for valid token', async () => {
      const mockToken = 'valid-token';
      const mockValueCaseId = 'value-case-123';

      mockReq.params = { token: mockToken };

      mockValidateCustomerToken.mockResolvedValue({
        value_case_id: mockValueCaseId,
        is_valid: true,
        error_message: null
      });

      mockGetValueTreeByValueCase.mockResolvedValue({
        nodes: [
          { id: 'driver-1', label: 'Cost Savings', driverType: 'cost', value: 500000 },
        ],
      });
      mockGetRoiModelByValueCase.mockResolvedValue({
        outputs: { roi: 1.5, npv: 250000, payback_period_months: 12 },
      });
      mockDeriveKpiTargetsForValueCase.mockResolvedValue([
        { metric: 'driver-1', targetValue: 620000, unit: 'USD' },
      ]);

      // Mock value case and opportunities fetches
      const opportunitiesQuery = {
        data: [],
        error: null,
        select: vi.fn(),
        eq: vi.fn(),
        then: vi.fn((resolve) => Promise.resolve(resolve({ data: opportunitiesQuery.data, error: opportunitiesQuery.error }))),
      };
      opportunitiesQuery.select.mockReturnValue(opportunitiesQuery);
      opportunitiesQuery.eq.mockReturnValue(opportunitiesQuery);

      mockSupabaseFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockValueCaseId,
              tenant_id: 'tenant-123',
              name: 'Q1 2026 Business Case',
              company_name: 'Acme Corp',
              description: null,
              lifecycle_stage: 'realization',
              status: 'active',
              buyer_persona: null,
              persona_fit_score: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-02T00:00:00.000Z'
            },
            error: null
          })
        })
        .mockReturnValueOnce(opportunitiesQuery);

      await getCustomerValueCase(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockValueCaseId,
          company_name: 'Acme Corp',
          opportunities: expect.any(Array),
          value_drivers: expect.any(Array)
        })
      );
    });

    it('should return 404 for non-existent value case', async () => {
      mockReq.params = { token: 'valid-token' };

      mockValidateCustomerToken.mockResolvedValue({
        value_case_id: 'non-existent',
        is_valid: true,
        error_message: null
      });

      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      });

      await getCustomerValueCase(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });

  describe('GET /api/customer/benchmarks/:token', () => {
    it('should return benchmarks for valid token', async () => {
      const mockToken = 'valid-token';
      const mockValueCaseId = 'value-case-123';

      mockReq.params = { token: mockToken };
      mockReq.query = { industry: 'technology' };

      mockValidateCustomerToken.mockResolvedValue({
        value_case_id: mockValueCaseId,
        is_valid: true,
        error_message: null
      });

      // Mock value case fetch
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockValueCaseId,
            company_name: 'Acme Corp',
            custom_fields: { industry: 'technology' }
          },
          error: null
        })
      });

      // Mock benchmarks fetch
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: '1',
              kpi_name: 'Customer Acquisition Cost',
              industry: 'technology',
              p25: 100,
              median: 150,
              p75: 200,
              best_in_class: 250
            }
          ],
          error: null
        })
      });

      // Mock metrics fetch
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      });

      await getCustomerBenchmarks(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          value_case_id: mockValueCaseId,
          company_name: 'Acme Corp',
          industry: 'technology',
          comparisons: expect.any(Array)
        })
      );
    });

    it('should return 400 when industry is missing', async () => {
      mockReq.params = { token: 'valid-token' };

      mockValidateCustomerToken.mockResolvedValue({
        value_case_id: 'value-case-123',
        is_valid: true,
        error_message: null
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'value-case-123',
            company_name: 'Acme Corp',
            custom_fields: {} // No industry
          },
          error: null
        })
      });

      await getCustomerBenchmarks(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: 'Industry information is required'
        })
      );
    });
  });
});
