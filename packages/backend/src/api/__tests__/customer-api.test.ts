/**
 * Customer Portal API Tests
 */

import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCustomerBenchmarks } from '../customer/benchmarks.js';
import { getCustomerMetrics } from '../customer/metrics.js';
import { getCustomerValueCase } from '../customer/value-case.js';

const customerAccessServiceMock = vi.hoisted(() => ({
  validateCustomerToken: vi.fn(),
}));

vi.mock('../../services/tenant/CustomerAccessService.js', () => ({
  customerAccessService: customerAccessServiceMock,
}));
vi.mock('../../services/tenant/CustomerAccessService', () => ({
  customerAccessService: customerAccessServiceMock,
}));
vi.mock('../../services/customer/CustomerValueCaseReadService', () => ({
  customerValueCaseReadService: {
    readByCustomerToken: vi.fn(),
  },
}));

const mockDbClient = {
  from: vi.fn(),
};

vi.mock('../../lib/supabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase.js')>();
  return {
    assertNotTestEnv: vi.fn(),
    ...actual,
    createServiceRoleSupabaseClient: vi.fn(() => mockDbClient),
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
      query: {},
      body: {},
      header: vi.fn().mockReturnValue(undefined),
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
      on: vi.fn(),
    };

    vi.clearAllMocks();
  });

  describe('GET /api/customer/metrics', () => {
    it('returns metrics for valid header token', async () => {
      vi.mocked(mockReq.header as ReturnType<typeof vi.fn>).mockImplementation((name: string) =>
        name.toLowerCase() === 'x-customer-access-token' ? 'valid-token' : undefined,
      );
      mockReq.query = { period: '90d' };

      customerAccessServiceMock.validateCustomerToken.mockResolvedValue({
        value_case_id: 'value-case-123',
        organization_id: 'org-123',
        is_valid: true,
        error_message: null,
      });

      const valueCaseQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'value-case-123', company_name: 'Acme Corp', name: 'Q1 Case' },
          error: null,
        }),
      };
      const metricsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'm1',
              metric_name: 'Cost Savings',
              metric_type: 'cost',
              predicted_value: 100,
              actual_value: 120,
              status: 'on_track',
            },
          ],
          error: null,
        }),
      };

      mockDbClient.from.mockReturnValueOnce(valueCaseQuery).mockReturnValueOnce(metricsQuery);

      await getCustomerMetrics(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ value_case_id: 'value-case-123' }));
    });

    it('rejects URL path token transport with 400', async () => {
      mockReq.params = { token: 'legacy-path-token' };

      await getCustomerMetrics(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Bad Request' }));
    });

    it('accepts POST body token transport', async () => {
      mockReq.body = { token: 'body-token' };
      mockReq.query = { period: 'all' };

      customerAccessServiceMock.validateCustomerToken.mockResolvedValue({
        value_case_id: null,
        organization_id: null,
        is_valid: false,
        error_message: 'Invalid token',
      });

      await getCustomerMetrics(mockReq as Request, mockRes as Response);

      expect(customerAccessServiceMock.validateCustomerToken).toHaveBeenCalledWith('body-token');
      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('GET /api/customer/value-case', () => {
    it('rejects query token transport with 400', async () => {
      mockReq.query = { token: 'legacy-query-token' };

      await getCustomerValueCase(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Bad Request' }));
    });
  });

  describe('GET /api/customer/benchmarks', () => {
    it('returns benchmarks for valid body token', async () => {
      mockReq.body = { token: 'valid-token' };
      mockReq.query = { industry: 'technology' };

      customerAccessServiceMock.validateCustomerToken.mockResolvedValue({
        value_case_id: 'value-case-123',
        organization_id: 'org-123',
        is_valid: true,
        error_message: null,
      });

      const valueCaseQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'value-case-123', company_name: 'Acme Corp', custom_fields: { industry: 'technology' } },
          error: null,
        }),
      };
      const benchmarksQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'b1',
              kpi_name: 'Customer Acquisition Cost',
              industry: 'technology',
              company_size: null,
              p25: 100,
              median: 150,
              p75: 200,
              best_in_class: 250,
              unit: 'usd',
              source: 'test',
              vintage: '2026',
              sample_size: 100,
            },
          ],
          error: null,
        }),
      };
      const metricsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockDbClient.from
        .mockReturnValueOnce(valueCaseQuery)
        .mockReturnValueOnce(benchmarksQuery)
        .mockReturnValueOnce(metricsQuery);

      await getCustomerBenchmarks(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ value_case_id: 'value-case-123' }));
    });

    it('rejects missing token with 400', async () => {
      mockReq.query = { industry: 'technology' };

      await getCustomerBenchmarks(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Bad Request' }));
    });
  });
});
