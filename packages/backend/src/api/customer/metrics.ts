/**
 * Customer Portal API - Metrics Endpoint
 * GET /api/customer/metrics
 */

import { logger } from '@shared/lib/logger';
import { createRequestSupabaseClient } from '../../lib/supabase.js';
import { Request, Response } from 'express';
import { z } from 'zod';

import { customerAccessService } from '../../services/tenant/CustomerAccessService';
import { extractCustomerAccessToken } from './tokenTransport';

// Query parameters schema
const MetricsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).optional().default('90d'),
  metric_type: z.enum(['revenue', 'cost', 'efficiency', 'adoption', 'all']).optional().default('all')
});

export interface MetricData {
  id: string;
  metric_name: string;
  metric_type: string;
  predicted_value: number;
  predicted_date: string;
  actual_value: number | null;
  actual_date: string | null;
  variance: number | null;
  variance_pct: number | null;
  status: 'on_track' | 'at_risk' | 'off_track' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface MetricsResponse {
  value_case_id: string;
  company_name: string;
  metrics: MetricData[];
  summary: {
    total_metrics: number;
    on_track: number;
    at_risk: number;
    off_track: number;
    pending: number;
    overall_achievement: number;
  };
  period: string;
}

/**
 * Get metrics for customer portal
 */
export async function getCustomerMetrics(req: Request, res: Response): Promise<void> {
  try {
    const extracted = extractCustomerAccessToken(req);
    if (extracted.error === 'url_path_token_not_allowed') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Token in URL path is not allowed. Provide token via header or request body.'
      });
      return;
    }
    if (extracted.error === 'query_token_not_allowed') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Token in query string is not allowed. Provide token via header or request body.'
      });
      return;
    }
    if (extracted.error === 'conflicting_tokens') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Conflicting token values in header and body.'
      });
      return;
    }
    if (extracted.error === 'missing_token' || !extracted.token) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing token. Provide token via x-customer-access-token header or request body.'
      });
      return;
    }

    const token = extracted.token;
    const { period, metric_type } = MetricsQuerySchema.parse(req.query);

    logger.info('Customer metrics request', { period, metric_type });

    // Validate token
    const validation = await customerAccessService.validateCustomerToken(token);

    if (!validation.is_valid || !validation.value_case_id || !validation.organization_id) {
      res.status(401).json({
        error: 'Unauthorized',
        message: validation.error_message || 'Invalid token'
      });
      return;
    }

    const valueCaseId = validation.value_case_id;
    const organizationId = validation.organization_id;
    const requestScopedSupabase = createRequestSupabaseClient({ accessToken: token, request: req });

    // Get value case details
    const { data: valueCase, error: vcError } = await requestScopedSupabase
      .from('value_cases')
      .select('id, company_name, name')
      .eq('id', valueCaseId)
      .eq('organization_id', organizationId)
      .single();

    if (vcError || !valueCase) {
      logger.error('Failed to fetch value case', vcError);
      res.status(404).json({
        error: 'Not Found',
        message: 'Value case not found'
      });
      return;
    }

    // Calculate date filter based on period
    const dateFilter = calculateDateFilter(period);

    // Build query for metrics
    let query = requestScopedSupabase
      .from('realization_metrics')
      .select('*')
      .eq('value_case_id', valueCaseId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    // Apply date filter
    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    // Apply metric type filter
    if (metric_type !== 'all') {
      query = query.eq('metric_type', metric_type);
    }

    const { data: metrics, error: metricsError } = await query;

    if (metricsError) {
      logger.error('Failed to fetch metrics', metricsError);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch metrics'
      });
      return;
    }

    // Calculate summary statistics
    const summary = calculateMetricsSummary(metrics || []);

    // Build response
    const response: MetricsResponse = {
      value_case_id: valueCaseId,
      company_name: valueCase.company_name,
      metrics: metrics || [],
      summary,
      period
    };

    logger.info('Customer metrics retrieved successfully', {
      valueCaseId,
      metricsCount: metrics?.length || 0
    });

    res.status(200).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request parameters',
        details: error.errors
      });
      return;
    }

    logger.error('Error in getCustomerMetrics', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  }
}

/**
 * Calculate date filter based on period
 */
function calculateDateFilter(period: string): string | null {
  const now = new Date();

  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    case 'all':
    default:
      return null;
  }
}

/**
 * Calculate summary statistics for metrics
 */
function calculateMetricsSummary(metrics: MetricData[]): MetricsResponse['summary'] {
  const total = metrics.length;

  const statusCounts = metrics.reduce((acc, metric) => {
    const status = metric.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate overall achievement
  const metricsWithActuals = metrics.filter(m => m.actual_value !== null);
  const totalAchievement = metricsWithActuals.reduce((sum, m) => {
    if (m.predicted_value && m.actual_value) {
      return sum + (m.actual_value / m.predicted_value);
    }
    return sum;
  }, 0);

  const overallAchievement = metricsWithActuals.length > 0
    ? (totalAchievement / metricsWithActuals.length) * 100
    : 0;

  return {
    total_metrics: total,
    on_track: statusCounts.on_track || 0,
    at_risk: statusCounts.at_risk || 0,
    off_track: statusCounts.off_track || 0,
    pending: statusCounts.pending || 0,
    overall_achievement: Math.round(overallAchievement)
  };
}
