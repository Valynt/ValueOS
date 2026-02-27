/**
 * Realization Portal View
 * Main customer-facing portal for value realization tracking
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CustomerContainer, CustomerLayout, CustomerSection } from '../../components/Customer/CustomerLayout';
import { ValueSummaryCard } from '../../components/Customer/ValueSummaryCard';
import { Metric, MetricsTable } from '../../components/Customer/MetricsTable';
import { TrendChart, TrendDataPoint } from '../../components/Customer/TrendChart';
import { BenchmarkComparison } from '../../components/Customer/BenchmarkComparison';
import { ExportActions } from '../../components/Customer/ExportActions';
import { customerAccessService } from '../../services/CustomerAccessService';
import { logger } from '../../lib/logger';
import { useErrorTracking, usePageTracking, useTokenTracking } from '../../hooks/usePortalAnalytics';

interface ValueCaseData {
  id: string;
  name: string;
  company_name: string;
  description: string | null;
  lifecycle_stage: string;
}

interface MetricsData {
  metrics: Metric[];
  summary: {
    total_metrics: number;
    on_track: number;
    at_risk: number;
    off_track: number;
    pending: number;
    overall_achievement: number;
  };
}

interface PortalData {
  valueCase: ValueCaseData | null;
  metrics: MetricsData | null;
  trendData: TrendDataPoint[];
  totalValue: number;
  targetValue: number;
  trend: 'up' | 'down' | 'flat';
}

export function RealizationPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);

  // Analytics tracking
  const { trackValidation, trackExpired } = useTokenTracking();
  const trackError = useErrorTracking();
  
  // Track page view with company context
  usePageTracking('realization-portal', {
    valueCaseId: data?.valueCase?.id,
    companyName: data?.valueCase?.company_name,
  });

  useEffect(() => {
    if (!token) {
      const errorMsg = 'No access token provided. Please use the link from your email.';
      setError(errorMsg);
      setLoading(false);
      trackError(errorMsg, 'MISSING_TOKEN');
      return;
    }

    loadPortalData(token);
  }, [token]);

  const loadPortalData = async (token: string) => {
    try {
      setLoading(true);
      setError(null);

      // Validate token
      const validation = await customerAccessService.validateCustomerToken(token);
      
      if (!validation.is_valid || !validation.value_case_id) {
        const errorMsg = validation.error_message || 'Invalid or expired access token.';
        setError(errorMsg);
        setLoading(false);
        
        // Track token validation failure
        if (errorMsg.includes('expired')) {
          trackExpired({ token });
        } else {
          trackValidation(false, { token, errorMessage: errorMsg });
        }
        return;
      }

      // Track successful token validation
      trackValidation(true, { 
        token, 
        valueCaseId: validation.value_case_id 
      });

      // Fetch all data in parallel
      const [valueCaseResponse, metricsResponse] = await Promise.all([
        fetchValueCase(token),
        fetchMetrics(token)
      ]);

      if (!valueCaseResponse || !metricsResponse) {
        setError('Failed to load portal data. Please try again later.');
        setLoading(false);
        return;
      }

      // Calculate trend data from metrics
      const trendData = calculateTrendData(metricsResponse.metrics);
      
      // Calculate total values
      const { totalValue, targetValue } = calculateTotalValues(metricsResponse.metrics);
      
      // Determine trend
      const trend = determineTrend(trendData);

      setData({
        valueCase: valueCaseResponse,
        metrics: metricsResponse,
        trendData,
        totalValue,
        targetValue,
        trend
      });

      setLoading(false);
    } catch (err) {
      logger.error('Error loading portal data', err as Error);
      setError('An unexpected error occurred. Please contact support.');
      setLoading(false);
    }
  };

  const handleMetricClick = (metric: Metric) => {
    logger.info('Metric clicked', { metricId: metric.id, metricName: metric.metric_name });
    // Could open a modal with detailed metric information
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    logger.info('Export requested', { format, valueCaseId: data?.valueCase?.id });
    // Export functionality will be implemented in ExportActions component
  };

  if (!token) {
    return (
      <CustomerLayout error="No access token provided. Please use the link from your email." />
    );
  }

  return (
    <CustomerLayout
      companyName={data?.valueCase?.company_name}
      loading={loading}
      error={error}
    >
      {data && (
        <CustomerContainer>
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              {data.valueCase?.name || 'Value Realization Dashboard'}
            </h1>
            {data.valueCase?.description && (
              <p className="text-gray-600 mt-2">{data.valueCase.description}</p>
            )}
          </div>

          {/* Value Summary */}
          <ValueSummaryCard
            totalValue={data.totalValue}
            targetValue={data.targetValue}
            trend={data.trend}
            period="Last 90 Days"
          />

          {/* Trend Chart */}
          {data.trendData.length > 0 && (
            <CustomerSection
              title="Performance Trend"
              description="Track your value realization over time"
            >
              <TrendChart
                data={data.trendData}
                title=""
                unit="$"
                height={350}
              />
            </CustomerSection>
          )}

          {/* Metrics Table */}
          <CustomerSection
            title="Detailed Metrics"
            description={`${data.metrics?.summary.total_metrics || 0} metrics tracked`}
          >
            <MetricsTable
              metrics={data.metrics?.metrics || []}
              onMetricClick={handleMetricClick}
            />
          </CustomerSection>

          {/* Benchmark Comparison */}
          <CustomerSection
            title="Industry Benchmarks"
            description="See how you compare to industry peers"
          >
            <BenchmarkComparison
              valueCaseId={data.valueCase?.id || ''}
              token={token}
            />
          </CustomerSection>

          {/* Export Actions */}
          <div className="mt-8">
            <ExportActions
              valueCaseId={data.valueCase?.id || ''}
              companyName={data.valueCase?.company_name || ''}
              onExport={handleExport}
            />
          </div>
        </CustomerContainer>
      )}
    </CustomerLayout>
  );
}

/**
 * Fetch value case data
 */
async function fetchValueCase(token: string): Promise<ValueCaseData | null> {
  try {
    const response = await fetch(`/api/customer/value-case/${token}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Failed to fetch value case', error as Error);
    return null;
  }
}

/**
 * Fetch metrics data
 */
async function fetchMetrics(token: string): Promise<MetricsData | null> {
  try {
    const response = await fetch(`/api/customer/metrics/${token}?period=90d`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Failed to fetch metrics', error as Error);
    return null;
  }
}

/**
 * Calculate trend data from metrics
 */
function calculateTrendData(metrics: Metric[]): TrendDataPoint[] {
  // Group metrics by date (simplified - in production, use actual date fields)
  const now = new Date();
  const points: TrendDataPoint[] = [];

  // Generate last 12 weeks of data
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - (i * 7));

    // Calculate cumulative values for this date
    const actual = metrics.reduce((sum, m) => {
      return sum + (m.actual_value || 0);
    }, 0);

    const target = metrics.reduce((sum, m) => {
      return sum + m.predicted_value;
    }, 0);

    points.push({
      date: date.toISOString().split('T')[0],
      actual: actual > 0 ? actual : null,
      target
    });
  }

  return points;
}

/**
 * Calculate total values from metrics
 */
function calculateTotalValues(metrics: Metric[]): { totalValue: number; targetValue: number } {
  const totalValue = metrics.reduce((sum, m) => sum + (m.actual_value || 0), 0);
  const targetValue = metrics.reduce((sum, m) => sum + m.predicted_value, 0);

  return { totalValue, targetValue };
}

/**
 * Determine trend from data points
 */
function determineTrend(data: TrendDataPoint[]): 'up' | 'down' | 'flat' {
  const validData = data.filter(d => d.actual !== null);
  if (validData.length < 2) return 'flat';

  const firstValue = validData[0].actual!;
  const lastValue = validData[validData.length - 1].actual!;
  const change = ((lastValue - firstValue) / firstValue) * 100;

  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'flat';
}

/**
 * Error Boundary for Portal
 */
export class RealizationPortalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Portal error boundary caught error', error, { errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <CustomerLayout error="An unexpected error occurred. Please refresh the page or contact support." />
      );
    }

    return this.props.children;
  }
}
