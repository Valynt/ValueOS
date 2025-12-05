import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock3, Loader2, RefreshCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PerformanceMetric {
  id: string;
  session_id: string;
  agent_id: string | null;
  operation: string;
  duration_ms: number;
  alert_triggered: boolean;
  alert_threshold_ms?: number;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);

  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

export const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMetrics = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      setError(error.message);
    } else {
      setMetrics(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    refreshMetrics();
  }, []);

  const summary = useMemo(() => {
    const durations = metrics.map(m => m.duration_ms);
    const alerts = metrics.filter(m => m.alert_triggered).length;

    return {
      average: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      p95: percentile(durations, 95),
      max: durations.length ? Math.max(...durations) : 0,
      alerts,
    };
  }, [metrics]);

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-gray-500">Performance Monitoring</p>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Execution Metrics</h1>
        </div>
        <button
          onClick={refreshMetrics}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-100"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load performance metrics: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Average Latency</span>
            <Clock3 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-semibold text-gray-900 mt-2">{summary.average} ms</div>
          <p className="text-xs text-gray-500">Across last {metrics.length} executions</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>p95 Latency</span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-semibold text-gray-900 mt-2">{Math.round(summary.p95)} ms</div>
          <p className="text-xs text-gray-500">95th percentile response time</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Peak Latency</span>
            <Clock3 className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-semibold text-gray-900 mt-2">{summary.max} ms</div>
          <p className="text-xs text-gray-500">Slowest agent run observed</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Alerts</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className={`text-2xl font-semibold mt-2 ${summary.alerts > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {summary.alerts}
          </div>
          <p className="text-xs text-gray-500">Runs over 1000ms threshold</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent Executions</h2>
            <p className="text-sm text-gray-500">Latest performance samples from performance_metrics</p>
          </div>
          <span className="text-xs text-gray-500">Showing last {metrics.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Operation</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Session</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Agent</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Duration</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Threshold</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500 text-sm">
                    <div className="inline-flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading performance samples…</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && metrics.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500 text-sm">
                    No performance metrics have been captured yet.
                  </td>
                </tr>
              )}

              {!loading &&
                metrics.map(metric => (
                  <tr key={metric.id} className={metric.alert_triggered ? 'bg-amber-50' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{metric.operation}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{metric.session_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{metric.agent_id || 'n/a'}</td>
                    <td className={`px-4 py-3 text-sm font-semibold ${metric.alert_triggered ? 'text-amber-600' : 'text-gray-900'}`}>
                      {metric.duration_ms} ms
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {metric.alert_threshold_ms ?? 1000} ms
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(metric.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
