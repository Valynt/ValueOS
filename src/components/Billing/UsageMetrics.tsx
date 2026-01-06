/**
 * Usage Metrics Components
 * Phase 3: System Observability
 * 
 * Color-coded usage metrics with warning system:
 * - Green: < 75% usage
 * - Yellow: 75-90% usage (warning)
 * - Red: > 90% usage (critical)
 */

import React from 'react';
import { AlertTriangle, TrendingUp, Users, Database, Zap } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface UsageMetric {
  label: string;
  current: number;
  limit: number;
  unit: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export type UsageLevel = 'safe' | 'warning' | 'critical';

// ============================================================================
// Usage Level Calculation
// ============================================================================

/**
 * Calculate usage level based on percentage
 * - safe: < 75%
 * - warning: 75-90%
 * - critical: > 90%
 */
export function getUsageLevel(current: number, limit: number): UsageLevel {
  const percentage = (current / limit) * 100;
  
  if (percentage >= 90) return 'critical';
  if (percentage >= 75) return 'warning';
  return 'safe';
}

/**
 * Get color classes for usage level
 */
export function getUsageLevelColors(level: UsageLevel) {
  const colors = {
    safe: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      bar: 'bg-green-500',
      icon: 'text-green-600',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      bar: 'bg-yellow-500',
      icon: 'text-yellow-600',
    },
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      bar: 'bg-red-500',
      icon: 'text-red-600',
    },
  };

  return colors[level];
}

// ============================================================================
// Usage Progress Bar
// ============================================================================

/**
 * Progress bar with color-coded warning system
 */
export const UsageProgressBar: React.FC<{
  current: number;
  limit: number;
  showPercentage?: boolean;
}> = ({ current, limit, showPercentage = true }) => {
  const percentage = Math.min((current / limit) * 100, 100);
  const level = getUsageLevel(current, limit);
  const colors = getUsageLevelColors(level);

  return (
    <div className="space-y-1">
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.bar} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <div className="flex justify-between text-xs">
          <span className={colors.text}>{percentage.toFixed(1)}% used</span>
          {level !== 'safe' && (
            <span className={colors.text}>
              {level === 'warning' ? '⚠️ Approaching limit' : '🚨 Limit exceeded'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Usage Metric Card
// ============================================================================

/**
 * Card displaying a single usage metric with color-coded warning
 */
export const UsageMetricCard: React.FC<UsageMetric> = ({
  label,
  current,
  limit,
  unit,
  icon: Icon = TrendingUp,
}) => {
  const level = getUsageLevel(current, limit);
  const colors = getUsageLevelColors(level);
  const percentage = (current / limit) * 100;

  return (
    <div
      className={`
        p-4 rounded-lg border-2 transition-all
        ${colors.bg} ${colors.border}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Icon className={`h-5 w-5 ${colors.icon}`} />
          <h4 className="font-medium text-gray-900">{label}</h4>
        </div>
        {level !== 'safe' && (
          <AlertTriangle className={`h-5 w-5 ${colors.icon}`} />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-gray-900">
            {current.toLocaleString()}
          </span>
          <span className="text-sm text-gray-600">
            of {limit.toLocaleString()} {unit}
          </span>
        </div>

        <UsageProgressBar current={current} limit={limit} showPercentage={false} />

        <div className={`text-sm font-medium ${colors.text}`}>
          {percentage.toFixed(1)}% used
          {level === 'warning' && ' - Consider upgrading'}
          {level === 'critical' && ' - Upgrade required'}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Usage Metrics Grid
// ============================================================================

/**
 * Grid of usage metric cards
 */
export const UsageMetricsGrid: React.FC<{
  metrics: UsageMetric[];
}> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.map((metric, index) => (
        <UsageMetricCard key={index} {...metric} />
      ))}
    </div>
  );
};

// ============================================================================
// Usage Summary Banner
// ============================================================================

/**
 * Banner showing overall usage status
 */
export const UsageSummaryBanner: React.FC<{
  metrics: UsageMetric[];
}> = ({ metrics }) => {
  // Find the highest usage level
  const highestLevel = metrics.reduce<UsageLevel>((highest, metric) => {
    const level = getUsageLevel(metric.current, metric.limit);
    if (level === 'critical') return 'critical';
    if (level === 'warning' && highest !== 'critical') return 'warning';
    return highest;
  }, 'safe');

  if (highestLevel === 'safe') return null;

  const colors = getUsageLevelColors(highestLevel);
  const criticalMetrics = metrics.filter(
    (m) => getUsageLevel(m.current, m.limit) === 'critical'
  );
  const warningMetrics = metrics.filter(
    (m) => getUsageLevel(m.current, m.limit) === 'warning'
  );

  return (
    <div
      className={`
        p-4 rounded-lg border-2 mb-6
        ${colors.bg} ${colors.border}
      `}
    >
      <div className="flex items-start space-x-3">
        <AlertTriangle className={`h-6 w-6 ${colors.icon} flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <h3 className={`font-semibold ${colors.text}`}>
            {highestLevel === 'critical'
              ? 'Usage Limit Exceeded'
              : 'Approaching Usage Limits'}
          </h3>
          <p className="text-sm text-gray-700 mt-1">
            {criticalMetrics.length > 0 && (
              <>
                <strong>Critical:</strong>{' '}
                {criticalMetrics.map((m) => m.label).join(', ')}
                {warningMetrics.length > 0 && '. '}
              </>
            )}
            {warningMetrics.length > 0 && (
              <>
                <strong>Warning:</strong>{' '}
                {warningMetrics.map((m) => m.label).join(', ')}
              </>
            )}
          </p>
          <button
            className={`
              mt-3 px-4 py-2 rounded-lg font-medium transition-colors
              ${
                highestLevel === 'critical'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-yellow-600 text-white hover:bg-yellow-700'
              }
            `}
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Usage Trend Chart (Simple)
// ============================================================================

/**
 * Simple usage trend visualization
 */
export const UsageTrendIndicator: React.FC<{
  current: number;
  previous: number;
  label: string;
}> = ({ current, previous, label }) => {
  const change = current - previous;
  const percentChange = previous > 0 ? (change / previous) * 100 : 0;
  const isIncrease = change > 0;

  return (
    <div className="flex items-center space-x-2 text-sm">
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium text-gray-900">
        {current.toLocaleString()}
      </span>
      <span
        className={`
          flex items-center
          ${isIncrease ? 'text-red-600' : 'text-green-600'}
        `}
      >
        <TrendingUp
          className={`h-4 w-4 ${isIncrease ? '' : 'rotate-180'}`}
        />
        {Math.abs(percentChange).toFixed(1)}%
      </span>
    </div>
  );
};

// ============================================================================
// Preset Usage Metrics
// ============================================================================

/**
 * Common usage metrics for billing dashboard
 */
export const COMMON_USAGE_METRICS = {
  users: (current: number, limit: number): UsageMetric => ({
    label: 'Active Users',
    current,
    limit,
    unit: 'users',
    icon: Users,
  }),
  storage: (current: number, limit: number): UsageMetric => ({
    label: 'Storage',
    current,
    limit,
    unit: 'GB',
    icon: Database,
  }),
  apiCalls: (current: number, limit: number): UsageMetric => ({
    label: 'API Calls',
    current,
    limit,
    unit: 'calls',
    icon: Zap,
  }),
};

// ============================================================================
// Hook for Usage Metrics
// ============================================================================

/**
 * Hook to fetch and manage usage metrics
 */
export function useUsageMetrics(organizationId: string) {
  const [metrics, setMetrics] = React.useState<UsageMetric[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        // TODO: Fetch from API
        // const response = await fetch(`/api/billing/usage/${organizationId}`);
        // const data = await response.json();
        
        // Mock data for now
        const mockMetrics: UsageMetric[] = [
          COMMON_USAGE_METRICS.users(8, 10),
          COMMON_USAGE_METRICS.storage(7.5, 10),
          COMMON_USAGE_METRICS.apiCalls(850, 1000),
        ];
        
        setMetrics(mockMetrics);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      fetchMetrics();
    }
  }, [organizationId]);

  return {
    metrics,
    loading,
    error,
    hasWarnings: metrics.some((m) => getUsageLevel(m.current, m.limit) !== 'safe'),
    hasCritical: metrics.some((m) => getUsageLevel(m.current, m.limit) === 'critical'),
  };
}
