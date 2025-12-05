import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, CheckCircle2, RefreshCcw, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

type MetricKey = 'adoption' | 'quality' | 'sentiment' | 'performance';

interface LaunchMetric {
  key: MetricKey;
  label: string;
  value: number;
  target: number;
  unit: string;
  direction: 'above' | 'below';
  trend: number[];
  description: string;
  secondary?: {
    label: string;
    value: number;
    target?: number;
    unit?: string;
  };
  updatedAt?: string;
}

interface SupabaseMetricRow {
  metric_key?: string;
  current_value?: number;
  target_value?: number;
  unit?: string;
  direction?: 'above' | 'below';
  trend_window?: number[];
  description?: string;
  secondary_label?: string;
  secondary_value?: number;
  secondary_target?: number;
  secondary_unit?: string;
  updated_at?: string;
}

const defaultMetrics: LaunchMetric[] = [
  {
    key: 'adoption',
    label: 'Adoption: Cohort Active >3 days/week',
    value: 78,
    target: 75,
    unit: '% active',
    direction: 'above',
    trend: [63, 68, 71, 73, 76, 78],
    description: 'Tracks weekly active rate for the beta cohort across all tenants.'
  },
  {
    key: 'quality',
    label: 'Quality: Open P0/P1 Defects',
    value: 2,
    target: 3,
    unit: 'open issues',
    direction: 'below',
    trend: [5, 5, 4, 4, 3, 2],
    description: 'Sev0/Sev1 tickets that block launch readiness across critical paths.'
  },
  {
    key: 'sentiment',
    label: 'Sentiment: Rolling NPS / CSAT',
    value: 42,
    target: 30,
    unit: 'NPS',
    direction: 'above',
    trend: [24, 28, 31, 36, 39, 42],
    description: 'Rolling 4-week survey results from power users and exec sponsors.',
    secondary: {
      label: 'CSAT',
      value: 4.5,
      target: 4.0,
      unit: '/5'
    }
  },
  {
    key: 'performance',
    label: 'Performance: p95 Latency',
    value: 920,
    target: 1000,
    unit: 'ms',
    direction: 'below',
    trend: [1380, 1220, 1100, 1040, 980, 920],
    description: 'End-to-end p95 latency for primary workflows (ingest → decision → render).'
  }
];

const formatValue = (value: number, unit: string) => {
  if (unit.includes('ms')) return `${value.toLocaleString()} ms`;
  if (unit.includes('%')) {
    const suffix = unit.replace('%', '').trim();
    return `${value}%${suffix ? ` ${suffix}` : ''}`;
  }
  return `${value} ${unit}`.trim();
};

const meetsTarget = (metric: LaunchMetric) =>
  metric.direction === 'above' ? metric.value >= metric.target : metric.value <= metric.target;

const trendDirection = (trend: number[]) => {
  if (trend.length < 2) return 0;
  const delta = trend[trend.length - 1] - trend[0];
  return delta;
};

export const LaunchReadinessDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<LaunchMetric[]>(defaultMetrics);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    setNote(null);

    try {
      const { data, error } = await supabase.from('launch_readiness_metrics').select('*');

      if (error || !data || data.length === 0) {
        if (error) {
          console.warn('Falling back to default launch readiness metrics', error.message);
        }
        setNote('Using sample data because Supabase launch_readiness_metrics is unavailable.');
        setMetrics(defaultMetrics);
        return;
      }

      const mapped = data
        .map(row => mapRowToMetric(row))
        .filter((metric): metric is LaunchMetric => Boolean(metric));

      if (mapped.length === 0) {
        setNote('Using sample data because no launch readiness rows were returned.');
        setMetrics(defaultMetrics);
      } else {
        setMetrics(mapped);
      }
    } catch (err) {
      console.error('Error loading launch readiness metrics', err);
      setNote('Using sample data because live metrics could not be loaded.');
      setMetrics(defaultMetrics);
    } finally {
      setLoading(false);
    }
  };

  const overallGoForLaunch = useMemo(() => metrics.every(metric => meetsTarget(metric)), [metrics]);

  const atRisk = useMemo(() => metrics.filter(metric => !meetsTarget(metric)), [metrics]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Sprint Epic 4 · Go/No-Go</p>
            <h1 className="text-3xl font-bold text-gray-900">Launch Readiness Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">
              Red/green indicators against the decision gates: adoption, quality, sentiment, and performance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadMetrics}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
            >
              <RefreshCcw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Refresh signals
            </button>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                overallGoForLaunch ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {overallGoForLaunch ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Go for launch
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4" /> Hold for remediation
                </>
              )}
            </span>
          </div>
        </header>

        {note && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Fallback data</p>
              <p>{note}</p>
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map(metric => {
            const isHealthy = meetsTarget(metric);
            const trendDelta = trendDirection(metric.trend);
            const isPositiveTrend = metric.direction === 'above' ? trendDelta >= 0 : trendDelta <= 0;
            const trendStart = metric.trend[0] ?? metric.value;
            const trendEnd = metric.trend[metric.trend.length - 1] ?? metric.value;

            return (
              <div
                key={metric.key}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{metric.label}</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-semibold text-gray-900">{formatValue(metric.value, metric.unit)}</p>
                      <span className="text-xs text-gray-500">Target {formatValue(metric.target, metric.unit)}</span>
                    </div>
                    {metric.secondary && (
                      <p className="text-sm text-gray-600">
                        {metric.secondary.label}: <span className="font-semibold">{formatValue(metric.secondary.value, metric.secondary.unit ?? '')}</span>
                        {metric.secondary.target ? ` (target ${formatValue(metric.secondary.target, metric.secondary.unit ?? '')})` : ''}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                      isHealthy ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isHealthy ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                    {isHealthy ? 'Green' : 'Red'}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <div className="inline-flex items-center gap-1">
                    {isPositiveTrend ? (
                      <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-rose-500" />
                    )}
                    <span>
                      {isPositiveTrend ? 'Improving' : 'Declining'} ({trendStart} → {trendEnd})
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-gray-400">
                    {metric.direction === 'above' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>{metric.direction === 'above' ? 'Higher is better' : 'Lower is better'}</span>
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-600 leading-relaxed">{metric.description}</div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Executive Summary</p>
                <h2 className="text-xl font-semibold text-gray-900">Go/No-Go Decision Gates</h2>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                  overallGoForLaunch ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {overallGoForLaunch ? 'Ready to proceed' : 'Needs attention'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {metrics.map(metric => {
                const isHealthy = meetsTarget(metric);
                return (
                  <div key={metric.key} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="space-y-1">
                        <p className="text-gray-700 font-medium">{metric.label}</p>
                        <p className="text-gray-500">
                          {formatValue(metric.value, metric.unit)} vs {formatValue(metric.target, metric.unit)} target
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                          isHealthy ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isHealthy ? 'Green' : 'Red'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Risks & Mitigations</h3>
              <span className="text-xs font-medium text-gray-500">Auto-generated from red metrics</span>
            </div>
            {atRisk.length === 0 ? (
              <p className="text-sm text-emerald-700">All gates are green. No blocking risks detected.</p>
            ) : (
              <ul className="space-y-3">
                {atRisk.map(metric => (
                  <li key={metric.key} className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-rose-700">
                      <ShieldAlert className="h-4 w-4" /> {metric.label}
                    </div>
                    <p className="mt-1 text-rose-800">
                      Current {formatValue(metric.value, metric.unit)} vs target {formatValue(metric.target, metric.unit)}. Assign owner to remediate before GA.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

function mapRowToMetric(row: SupabaseMetricRow): LaunchMetric | null {
  const key = (row.metric_key || '').toLowerCase() as MetricKey;

  if (!['adoption', 'quality', 'sentiment', 'performance'].includes(key)) {
    return null;
  }

  const direction = row.direction ?? (key === 'quality' || key === 'performance' ? 'below' : 'above');
  const base: LaunchMetric = {
    key,
    label: labelForKey(key),
    value: row.current_value ?? 0,
    target: row.target_value ?? 0,
    unit: row.unit ?? unitForKey(key),
    direction,
    trend: row.trend_window ?? [],
    description: row.description ?? descriptionForKey(key),
    updatedAt: row.updated_at
  };

  if (key === 'sentiment') {
    base.secondary = {
      label: row.secondary_label || 'CSAT',
      value: row.secondary_value ?? defaultMetrics.find(m => m.key === 'sentiment')?.secondary?.value ?? 0,
      target: row.secondary_target,
      unit: row.secondary_unit ?? '/5'
    };
  }

  return base;
}

function labelForKey(key: MetricKey) {
  switch (key) {
    case 'adoption':
      return 'Adoption: Cohort Active >3 days/week';
    case 'quality':
      return 'Quality: Open P0/P1 Defects';
    case 'sentiment':
      return 'Sentiment: Rolling NPS / CSAT';
    case 'performance':
      return 'Performance: p95 Latency';
  }
}

function unitForKey(key: MetricKey) {
  switch (key) {
    case 'adoption':
      return '% active';
    case 'quality':
      return 'open issues';
    case 'sentiment':
      return 'NPS';
    case 'performance':
      return 'ms';
  }
}

function descriptionForKey(key: MetricKey) {
  switch (key) {
    case 'adoption':
      return 'Tracks weekly active rate for the beta cohort across all tenants.';
    case 'quality':
      return 'Sev0/Sev1 tickets that block launch readiness across critical paths.';
    case 'sentiment':
      return 'Rolling 4-week survey results from power users and exec sponsors.';
    case 'performance':
      return 'End-to-end p95 latency for primary workflows (ingest → decision → render).';
  }
}

export default LaunchReadinessDashboard;
