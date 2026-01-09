import React from 'react';
import { COMMON_USAGE_METRICS, getUsageLevel, UsageMetric } from './UsageUtils';

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

        const response = await fetch('/api/billing/usage');
        if (!response.ok) {
          throw new Error('Failed to fetch usage metrics');
        }

        const data = await response.json();
        const { usage, quotas } = data;

        const newMetrics: UsageMetric[] = [
          COMMON_USAGE_METRICS.users(usage.user_seats || 0, quotas.user_seats || 0),
          COMMON_USAGE_METRICS.storage(usage.storage_gb || 0, quotas.storage_gb || 0),
          COMMON_USAGE_METRICS.apiCalls(usage.api_calls || 0, quotas.api_calls || 0),
        ];

        setMetrics(newMetrics);
      } catch (err) {
        console.error('Error fetching usage metrics:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));

        // Fallback to safe defaults if fetch fails
        // This ensures the dashboard doesn't crash completely
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
