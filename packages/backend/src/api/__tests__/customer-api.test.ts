/**
 * Customer Portal API Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { getCustomerMetrics } from '../customer/metrics';
import { getCustomerValueCase } from '../customer/value-case';
import { getCustomerBenchmarks } from '../customer/benchmarks';
import { customerAccessService } from '../services/CustomerAccessService';
import { supabase } from '@shared/lib/supabase';

// Mock dependencies
vi.mock('../../services/CustomerAccessService');
vi.mock('../../lib/supabase');

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
      json: jsonMock
    };

    vi.clearAllMocks();
  });

  describe('GET /api/customer/metrics/:token', () => {
    it('should return metrics for valid token', async () => {
      const mockToken = 'valid-token';
      const mockValueCaseId = 'value-case-123';

      mockReq.params = { token: mockToken };
      mockReq.query = { period: '90d' };

      // Mock token validation
      vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
        value_case_id: mockValueCaseId,
        is_valid: true,
        error_message: null
      });

      // Mock value case fetch
      (supabase.from as any).mockReturnValue({
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
      });

      // Mock metrics fetch
      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
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
          error: null
        })
      });

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

      vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
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

      vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
        value_case_id: mockValueCaseId,
        is_valid: true,
        error_message: null
      });

      // Mock value case fetch
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockValueCaseId,
            name: 'Q1 2026 Business Case',
            company_name: 'Acme Corp',
            lifecycle_stage: 'realization'
          },
          error: null
        }),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        }),
        limit: vi.fn().mockReturnThis()
      });

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

      vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
        value_case_id: 'non-existent',
        is_valid: true,
        error_message: null
      });

      (supabase.from as any).mockReturnValue({
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

      vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
        value_case_id: mockValueCaseId,
        is_valid: true,
        error_message: null
      });

      // Mock value case fetch
      (supabase.from as any).mockReturnValueOnce({
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
      (supabase.from as any).mockReturnValueOnce({
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
      (supabase.from as any).mockReturnValueOnce({
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

      vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
        value_case_id: 'value-case-123',
        is_valid: true,
        error_message: null
      });

      (supabase.from as any).mockReturnValue({
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
