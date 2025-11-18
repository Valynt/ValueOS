import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react';
import { MetricBadge } from './MetricBadge';

/**
 * Status of KPI realization
 */
export type RealizationStatus = 'on-track' | 'at-risk' | 'off-track' | 'achieved';

/**
 * Single KPI realization data
 */
export interface KPIRealization {
  kpiName: string;
  baseline: number;
  target: number;
  actual: number;
  unit?: string;
  status?: RealizationStatus;
  lastUpdated?: Date;
}

/**
 * Props for RealizationDashboard component
 */
export interface RealizationDashboardProps {
  /**
   * Single KPI data (for simple dashboard)
   */
  kpiName?: string;
  baseline?: number;
  target?: number;
  actual?: number;
  unit?: string;

  /**
   * Multiple KPIs data (for comprehensive dashboard)
   */
  kpis?: KPIRealization[];

  /**
   * Dashboard title
   */
  title?: string;

  /**
   * Show detailed metrics
   */
  showDetails?: boolean;

  /**
   * Show trend indicators
   */
  showTrends?: boolean;

  /**
   * Callback when KPI is clicked
   */
  onKPIClick?: (kpiName: string) => void;
}

/**
 * Calculate realization status based on actual vs target
 */
const calculateStatus = (baseline: number, target: number, actual: number): RealizationStatus => {
  const targetProgress = ((actual - baseline) / (target - baseline)) * 100;

  if (actual >= target) return 'achieved';
  if (targetProgress >= 80) return 'on-track';
  if (targetProgress >= 50) return 'at-risk';
  return 'off-track';
};

/**
 * Get status color classes
 */
const getStatusClasses = (status: RealizationStatus) => {
  switch (status) {
    case 'achieved':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'on-track':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'at-risk':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'off-track':
      return 'bg-red-100 text-red-800 border-red-300';
  }
};

/**
 * Get status icon
 */
const getStatusIcon = (status: RealizationStatus) => {
  switch (status) {
    case 'achieved':
      return <CheckCircle className="h-5 w-5" />;
    case 'on-track':
      return <TrendingUp className="h-5 w-5" />;
    case 'at-risk':
      return <AlertTriangle className="h-5 w-5" />;
    case 'off-track':
      return <TrendingDown className="h-5 w-5" />;
  }
};

/**
 * Single KPI Card Component
 */
const KPICard: React.FC<{
  kpi: KPIRealization;
  showDetails: boolean;
  showTrends: boolean;
  onClick?: () => void;
}> = ({ kpi, showDetails, showTrends, onClick }) => {
  const status = kpi.status || calculateStatus(kpi.baseline, kpi.target, kpi.actual);
  const progress = ((kpi.actual - kpi.baseline) / (kpi.target - kpi.baseline)) * 100;
  const improvement = ((kpi.actual - kpi.baseline) / kpi.baseline) * 100;

  return (
    <div
      className={`p-4 border rounded-lg shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid="kpi-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{kpi.kpiName}</h3>
          {kpi.lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              Updated: {kpi.lastUpdated.toLocaleDateString()}
            </p>
          )}
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${getStatusClasses(status)}`}>
          {getStatusIcon(status)}
          <span className="capitalize">{status.replace('-', ' ')}</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex flex-wrap gap-2 mb-3">
        <MetricBadge
          label="Baseline"
          value={kpi.baseline}
          unit={kpi.unit}
          tone="info"
          size="small"
        />
        <MetricBadge
          label="Target"
          value={kpi.target}
          unit={kpi.unit}
          tone="success"
          size="small"
        />
        <MetricBadge
          label="Actual"
          value={kpi.actual}
          unit={kpi.unit}
          tone={status === 'achieved' || status === 'on-track' ? 'success' : 'warning'}
          size="small"
        />
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Progress to Target</span>
          <span className="font-semibold">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              status === 'achieved' || status === 'on-track'
                ? 'bg-green-500'
                : status === 'at-risk'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Improvement from Baseline:</span>
            <span className={`font-semibold ${improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {improvement >= 0 ? '+' : ''}
              {improvement.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Gap to Target:</span>
            <span className="font-semibold text-gray-900">
              {(kpi.target - kpi.actual).toFixed(1)} {kpi.unit}
            </span>
          </div>
        </div>
      )}

      {/* Trend Indicator */}
      {showTrends && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm">
            {improvement > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-green-600 font-medium">Improving</span>
              </>
            ) : improvement < 0 ? (
              <>
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-red-600 font-medium">Declining</span>
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600 font-medium">Stable</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * RealizationDashboard - Displays baseline vs. target vs. actual results
 *
 * Used in the Realization stage to track and visualize value delivery
 * against commitments.
 *
 * @example
 * ```tsx
 * <RealizationDashboard
 *   kpis={[
 *     {
 *       kpiName: 'Lead Conversion Rate',
 *       baseline: 15,
 *       target: 25,
 *       actual: 22,
 *       unit: '%'
 *     }
 *   ]}
 *   showDetails
 *   showTrends
 * />
 * ```
 */
export const RealizationDashboard: React.FC<RealizationDashboardProps> = ({
  kpiName,
  baseline,
  target,
  actual,
  unit,
  kpis,
  title = 'Value Realization',
  showDetails = true,
  showTrends = true,
  onKPIClick,
}) => {
  // Handle single KPI mode
  const kpiData: KPIRealization[] = kpis
    ? kpis
    : kpiName && baseline !== undefined && target !== undefined && actual !== undefined
    ? [{ kpiName, baseline, target, actual, unit }]
    : [];

  if (kpiData.length === 0) {
    return (
      <div className="p-8 border border-gray-200 rounded-lg bg-gray-50 text-center">
        <p className="text-gray-600">No realization data available</p>
      </div>
    );
  }

  // Calculate summary statistics
  const totalKPIs = kpiData.length;
  const achievedKPIs = kpiData.filter(
    (kpi) =>
      (kpi.status || calculateStatus(kpi.baseline, kpi.target, kpi.actual)) === 'achieved'
  ).length;
  const onTrackKPIs = kpiData.filter(
    (kpi) =>
      (kpi.status || calculateStatus(kpi.baseline, kpi.target, kpi.actual)) === 'on-track'
  ).length;
  const atRiskKPIs = kpiData.filter(
    (kpi) =>
      (kpi.status || calculateStatus(kpi.baseline, kpi.target, kpi.actual)) === 'at-risk'
  ).length;
  const offTrackKPIs = kpiData.filter(
    (kpi) =>
      (kpi.status || calculateStatus(kpi.baseline, kpi.target, kpi.actual)) === 'off-track'
  ).length;

  const overallProgress =
    kpiData.reduce((sum, kpi) => {
      const progress = ((kpi.actual - kpi.baseline) / (kpi.target - kpi.baseline)) * 100;
      return sum + Math.min(Math.max(progress, 0), 100);
    }, 0) / totalKPIs;

  return (
    <div className="space-y-6" data-testid="realization-dashboard">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">
          Tracking {totalKPIs} KPI{totalKPIs !== 1 ? 's' : ''} against committed targets
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 font-medium">Achieved</p>
          <p className="text-3xl font-bold text-green-900 mt-1">{achievedKPIs}</p>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700 font-medium">On Track</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">{onTrackKPIs}</p>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700 font-medium">At Risk</p>
          <p className="text-3xl font-bold text-yellow-900 mt-1">{atRiskKPIs}</p>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">Off Track</p>
          <p className="text-3xl font-bold text-red-900 mt-1">{offTrackKPIs}</p>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Overall Progress</h3>
          <span className="text-2xl font-bold text-gray-900">
            {Math.round(overallProgress)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {kpiData.map((kpi, index) => (
          <KPICard
            key={`${kpi.kpiName}-${index}`}
            kpi={kpi}
            showDetails={showDetails}
            showTrends={showTrends}
            onClick={onKPIClick ? () => onKPIClick(kpi.kpiName) : undefined}
          />
        ))}
      </div>
    </div>
  );
};
