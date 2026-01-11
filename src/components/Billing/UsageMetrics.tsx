/**
 * Usage Metrics Components
 * Phase 3: System Observability
 *
 * Color-coded usage metrics with warning system:
 * - Green: < 75% usage
 * - Yellow: 75-90% usage (warning)
 * - Red: >= 90% usage (critical)
 */

import React from 'react';
import { AlertTriangle, TrendingUp, Users, Database, Zap, Bot } from 'lucide-react';
import type { UsageSummary } from '../../types/billing';

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
// Constants
// ============================================================================

export const MAX_PERCENTAGE = 100;
export const CRITICAL_THRESHOLD = 90;
export const WARNING_THRESHOLD = 75;

// ============================================================================
// Usage Level Calculation
// ============================================================================

/**
 * Calculate usage level based on percentage
 * - safe: < 75%
 * - warning: 75-90%
 * - critical: >= 90%
 */
export function getUsageLevel(current: number, limit: number): UsageLevel {
  // Defensive: treat missing/zero limits as critical if there is usage, otherwise safe.
  if (!Number.isFinite(limit) || limit <= 0) {
    return current > 0 ? 'critical' : 'safe';
  }

  const percentage = (current / limit) * MAX_PERCENTAGE;

  if (percentage >= CRITICAL_THRESHOLD) return 'critical';
  if (percentage >= WARNING_THRESHOLD) return 'warning';
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
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 0;
  const rawPercentage = safeLimit > 0 ? (current / safeLimit) * MAX_PERCENTAGE : 0;
  const percentage = Math.min(Math.max(rawPercentage, 0), MAX_PERCENTAGE);
  const level = getUsageLevel(current, limit);
  const colors = getUsageLevelColors(level);

  const statusText =
    level === 'safe'
      ? 'Usage within limits'
      : level === 'warning'
        ? 'Approaching limit'
        : 'Limit exceeded';

  return (
    <div className="space-y-1" aria-label="Usage" role="group">
      <div
        className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeLimit || undefined}
        aria-valuenow={Number.isFinite(current) ? current : 0}
        aria-valuetext={`${percentage.toFixed(1)}% used. ${statusText}.`}
      >
        <div
          className={`h-full ${colors.bar} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <div className="flex justify-between text-xs">
          <span className={colors.text}>{percentage.toFixed(1)}% used</span>
          {level !== 'safe' && <span className={colors.text}>{statusText}</span>}
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

  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 0;
  const percentage = safeLimit > 0 ? (current / safeLimit) * MAX_PERCENTAGE : 0;

  return (
    <div
      className={`p-4 rounded-lg border-2 transition-all ${colors.bg} ${colors.border}`}
      aria-label={`${label} usage`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Icon className={`h-5 w-5 ${colors.icon}`} aria-hidden="true" />
          <h4 className="font-medium text-gray-900">{label}</h4>
        </div>
        {level !== 'safe' && (
          <AlertTriangle className={`h-5 w-5 ${colors.icon}`} aria-hidden="true" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-gray-900">{current.toLocaleString()}</span>
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
      {metrics.map((metric) => (
        <UsageMetricCard key={metric.label} {...metric} />
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
  const highestLevel = metrics.reduce<UsageLevel>((highest, metric) => {
    const level = getUsageLevel(metric.current, metric.limit);
    if (level === 'critical') return 'critical';
    if (level === 'warning' && highest !== 'critical') return 'warning';
    return highest;
  }, 'safe');

  if (highestLevel === 'safe') return null;

  const colors = getUsageLevelColors(highestLevel);
  const criticalMetrics = metrics.filter((m) => getUsageLevel(m.current, m.limit) === 'critical');
  const warningMetrics = metrics.filter((m) => getUsageLevel(m.current, m.limit) === 'warning');

  return (
    <div className={`p-4 rounded-lg border-2 mb-6 ${colors.bg} ${colors.border}`} role="status">
      <div className="flex items-start space-x-3">
        <AlertTriangle className={`h-6 w-6 ${colors.icon} flex-shrink-0 mt-0.5`} aria-hidden="true" />
        <div className="flex-1">
          <h3 className={`font-semibold ${colors.text}`}>
            {highestLevel === 'critical' ? 'Usage Limit Exceeded' : 'Approaching Usage Limits'}
          </h3>
          <p className="text-sm text-gray-700 mt-1">
            {criticalMetrics.length > 0 && (
              <>
                <strong>Critical:</strong> {criticalMetrics.map((m) => m.label).join(', ')}
                {warningMetrics.length > 0 && '. '}
              </>
            )}
            {warningMetrics.length > 0 && (
              <>
                <strong>Warning:</strong> {warningMetrics.map((m) => m.label).join(', ')}
              </>
            )}
          </p>
          <button
            type="button"
            className={`mt-3 px-4 py-2 rounded-lg font-medium transition-colors ${
              highestLevel === 'critical'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-yellow-600 text-white hover:bg-yellow-700'
            }`}
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
  const percentChange = previous > 0 ? (change / previous) * MAX_PERCENTAGE : 0;
  const isIncrease = change > 0;

  return (
    <div className="flex items-center space-x-2 text-sm">
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium text-gray-900">{current.toLocaleString()}</span>
      <span className={`flex items-center ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
        <TrendingUp className={`h-4 w-4 ${isIncrease ? '' : 'rotate-180'}`} aria-hidden="true" />
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

        // Prefer tenant-aware requests.
        const response = await fetch('/api/billing/usage', {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch usage metrics');
        }

        const data: UsageSummary = await response.json();

        // Use mapped metrics so the dashboard can evolve without changing API shape.
        const mappedMetrics: UsageMetric[] = [
          {
            label: 'Active Users',
            current: data.usage.user_seats,
            limit: data.quotas.user_seats,
            unit: 'users',
            icon: Users,
          },
          {
            label: 'Storage',
            current: data.usage.storage_gb,
            limit: data.quotas.storage_gb,
            unit: 'GB',
            icon: Database,
          },
          {
            label: 'API Calls',
            current: data.usage.api_calls,
            limit: data.quotas.api_calls,
            unit: 'calls',
            icon: Zap,
          },
          {
            label: 'LLM Tokens',
            current: data.usage.llm_tokens,
            limit: data.quotas.llm_tokens,
            unit: 'tokens',
            icon: TrendingUp,
          },
          {
            label: 'Agent Executions',
            current: data.usage.agent_executions,
            limit: data.quotas.agent_executions,
            unit: 'executions',
            icon: Bot,
          },
        ];

        setMetrics(mappedMetrics);
      } catch (err) {
        console.error('Error fetching usage metrics:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));

        // Fallback to safe defaults if fetch fails
        setMetrics([
          COMMON_USAGE_METRICS.users(0, 1),
          COMMON_USAGE_METRICS.storage(0, 1),
          COMMON_USAGE_METRICS.apiCalls(0, 1),
        ]);
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
