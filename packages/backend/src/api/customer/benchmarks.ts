/**
 * Customer Portal API - Benchmarks Endpoint
 * GET /api/customer/benchmarks/:token
 */

import { Request, Response } from 'express';
import { customerAccessService } from '../../services/CustomerAccessService';
import { supabase } from '@shared/lib/supabase';
import { logger } from '@shared/lib/logger';
import { z } from 'zod';

// Request validation schema
const BenchmarksRequestSchema = z.object({
  token: z.string().min(1, 'Token is required')
});

// Query parameters schema
const BenchmarksQuerySchema = z.object({
  kpi_name: z.string().optional(),
  industry: z.string().optional()
});

export interface BenchmarkData {
  id: string;
  kpi_name: string;
  industry: string;
  company_size: string | null;
  p25: number;
  median: number;
  p75: number;
  best_in_class: number;
  unit: string;
  source: string;
  vintage: string;
  sample_size: number | null;
}

export interface BenchmarkComparison {
  kpi_name: string;
  current_value: number | null;
  benchmark: BenchmarkData;
  percentile: number | null;
  gap_to_median: number | null;
  gap_to_best_in_class: number | null;
  performance_rating: 'excellent' | 'good' | 'average' | 'below_average' | 'poor' | 'unknown';
}

export interface BenchmarksResponse {
  value_case_id: string;
  company_name: string;
  industry: string;
  comparisons: BenchmarkComparison[];
}

/**
 * Get benchmarks for customer portal
 */
export async function getCustomerBenchmarks(req: Request, res: Response): Promise<void> {
  try {
    // Validate request parameters
    const { token } = BenchmarksRequestSchema.parse(req.params);
    const { kpi_name, industry } = BenchmarksQuerySchema.parse(req.query);

    logger.info('Customer benchmarks request', { kpi_name, industry });

    // Validate token
    const validation = await customerAccessService.validateCustomerToken(token);
    
    if (!validation.is_valid || !validation.value_case_id) {
      res.status(401).json({
        error: 'Unauthorized',
        message: validation.error_message || 'Invalid token'
      });
      return;
    }

    const valueCaseId = validation.value_case_id;

    // Get value case details
    const { data: valueCase, error: vcError } = await supabase
      .from('value_cases')
      .select('id, company_name, custom_fields')
      .eq('id', valueCaseId)
      .single();

    if (vcError || !valueCase) {
      logger.error('Failed to fetch value case', vcError);
      res.status(404).json({
        error: 'Not Found',
        message: 'Value case not found'
      });
      return;
    }

    // Extract industry from custom_fields or use query parameter
    const valueCaseIndustry = valueCase.custom_fields?.industry || industry;

    if (!valueCaseIndustry) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Industry information is required'
      });
      return;
    }

    // Build benchmark query
    let benchmarkQuery = supabase
      .from('benchmarks')
      .select('*')
      .eq('industry', valueCaseIndustry)
      .order('kpi_name');

    // Filter by specific KPI if provided
    if (kpi_name) {
      benchmarkQuery = benchmarkQuery.eq('kpi_name', kpi_name);
    }

    const { data: benchmarks, error: benchError } = await benchmarkQuery;

    if (benchError) {
      logger.error('Failed to fetch benchmarks', benchError);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch benchmarks'
      });
      return;
    }

    // Get current metrics for comparison
    const { data: metrics, error: metricsError } = await supabase
      .from('realization_metrics')
      .select('metric_name, actual_value')
      .eq('value_case_id', valueCaseId)
      .not('actual_value', 'is', null);

    if (metricsError) {
      logger.error('Failed to fetch metrics for comparison', metricsError);
    }

    // Create metric lookup map
    const metricMap = new Map(
      (metrics || []).map(m => [m.metric_name, m.actual_value])
    );

    // Build comparisons
    const comparisons: BenchmarkComparison[] = (benchmarks || []).map(benchmark => {
      const currentValue = metricMap.get(benchmark.kpi_name) || null;
      
      return {
        kpi_name: benchmark.kpi_name,
        current_value: currentValue,
        benchmark,
        percentile: currentValue ? calculatePercentile(currentValue, benchmark) : null,
        gap_to_median: currentValue ? currentValue - benchmark.median : null,
        gap_to_best_in_class: currentValue ? currentValue - benchmark.best_in_class : null,
        performance_rating: currentValue ? ratePerformance(currentValue, benchmark) : 'unknown'
      };
    });

    // Build response
    const response: BenchmarksResponse = {
      value_case_id: valueCaseId,
      company_name: valueCase.company_name,
      industry: valueCaseIndustry,
      comparisons
    };

    logger.info('Customer benchmarks retrieved successfully', {
      valueCaseId,
      benchmarksCount: benchmarks?.length || 0,
      comparisonsCount: comparisons.length
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

    logger.error('Error in getCustomerBenchmarks', error as Error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  }
}

/**
 * Calculate percentile rank for a value
 */
function calculatePercentile(value: number, benchmark: BenchmarkData): number {
  if (value <= benchmark.p25) {
    return Math.round((value / benchmark.p25) * 25);
  } else if (value <= benchmark.median) {
    const range = benchmark.median - benchmark.p25;
    const position = value - benchmark.p25;
    return Math.round(25 + (position / range) * 25);
  } else if (value <= benchmark.p75) {
    const range = benchmark.p75 - benchmark.median;
    const position = value - benchmark.median;
    return Math.round(50 + (position / range) * 25);
  } else if (value <= benchmark.best_in_class) {
    const range = benchmark.best_in_class - benchmark.p75;
    const position = value - benchmark.p75;
    return Math.round(75 + (position / range) * 25);
  } else {
    return 100;
  }
}

/**
 * Rate performance based on percentile
 */
function ratePerformance(
  value: number,
  benchmark: BenchmarkData
): 'excellent' | 'good' | 'average' | 'below_average' | 'poor' {
  const percentile = calculatePercentile(value, benchmark);
  
  if (percentile >= 90) return 'excellent';
  if (percentile >= 75) return 'good';
  if (percentile >= 50) return 'average';
  if (percentile >= 25) return 'below_average';
  return 'poor';
}
