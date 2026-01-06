/**
 * Metrics Table Component
 * Displays metrics with sorting and filtering capabilities
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Clock, Filter, XCircle } from 'lucide-react';

export interface Metric {
  id: string;
  metric_name: string;
  metric_type: 'revenue' | 'cost' | 'efficiency' | 'adoption';
  predicted_value: number;
  actual_value: number | null;
  variance: number | null;
  variance_pct: number | null;
  status: 'on_track' | 'at_risk' | 'off_track' | 'pending';
  unit: string;
}

export interface MetricsTableProps {
  metrics: Metric[];
  loading?: boolean;
  onMetricClick?: (metric: Metric) => void;
}

type SortField = 'metric_name' | 'predicted_value' | 'actual_value' | 'variance_pct' | 'status';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'on_track' | 'at_risk' | 'off_track' | 'pending';

export function MetricsTable({ metrics, loading = false, onMetricClick }: MetricsTableProps) {
  const [sortField, setSortField] = useState<SortField>('metric_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Filter and sort metrics
  const processedMetrics = useMemo(() => {
    let filtered = metrics;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null values
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      // String comparison
      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Number comparison
      return sortDirection === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    });

    return sorted;
  }, [metrics, sortField, sortDirection, statusFilter]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return <LoadingTable />;
  }

  if (metrics.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter by status:</span>
          <StatusFilterButtons 
            activeFilter={statusFilter}
            onFilterChange={setStatusFilter}
            metrics={metrics}
          />
        </div>
        <div className="text-sm text-gray-500">
          Showing {processedMetrics.length} of {metrics.length} metrics
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <SortButton
                  label="Metric"
                  field="metric_name"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </span>
              </th>
              <th className="px-6 py-3 text-right">
                <SortButton
                  label="Target"
                  field="predicted_value"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="px-6 py-3 text-right">
                <SortButton
                  label="Actual"
                  field="actual_value"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="px-6 py-3 text-right">
                <SortButton
                  label="Variance"
                  field="variance_pct"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="px-6 py-3 text-center">
                <SortButton
                  label="Status"
                  field="status"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedMetrics.map((metric) => (
              <tr
                key={metric.id}
                onClick={() => onMetricClick?.(metric)}
                className={`hover:bg-gray-50 transition-colors ${
                  onMetricClick ? 'cursor-pointer' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {metric.metric_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <MetricTypeBadge type={metric.metric_type} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatValue(metric.predicted_value, metric.unit)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {metric.actual_value !== null ? (
                    <span className="font-medium text-gray-900">
                      {formatValue(metric.actual_value, metric.unit)}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {metric.variance_pct !== null ? (
                    <VarianceDisplay variance={metric.variance_pct} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <StatusBadge status={metric.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Sort Button Component
 */
function SortButton({
  label,
  field,
  currentField,
  direction,
  onSort
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentField === field;

  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
    >
      <span>{label}</span>
      {isActive ? (
        direction === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

/**
 * Status Filter Buttons
 */
function StatusFilterButtons({
  activeFilter,
  onFilterChange,
  metrics
}: {
  activeFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  metrics: Metric[];
}) {
  const counts = metrics.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'on_track', label: 'On Track' },
    { value: 'at_risk', label: 'At Risk' },
    { value: 'off_track', label: 'Off Track' },
    { value: 'pending', label: 'Pending' }
  ];

  return (
    <div className="flex items-center space-x-2">
      {filters.map(filter => {
        const count = filter.value === 'all' ? metrics.length : counts[filter.value] || 0;
        const isActive = activeFilter === filter.value;

        return (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter.label} ({count})
          </button>
        );
      })}
    </div>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: Metric['status'] }) {
  const config = {
    on_track: {
      icon: CheckCircle2,
      label: 'On Track',
      color: 'text-green-700',
      bg: 'bg-green-100'
    },
    at_risk: {
      icon: AlertTriangle,
      label: 'At Risk',
      color: 'text-yellow-700',
      bg: 'bg-yellow-100'
    },
    off_track: {
      icon: XCircle,
      label: 'Off Track',
      color: 'text-red-700',
      bg: 'bg-red-100'
    },
    pending: {
      icon: Clock,
      label: 'Pending',
      color: 'text-gray-700',
      bg: 'bg-gray-100'
    }
  };

  const { icon: Icon, label, color, bg } = config[status];

  return (
    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${color}`}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </span>
  );
}

/**
 * Metric Type Badge Component
 */
function MetricTypeBadge({ type }: { type: Metric['metric_type'] }) {
  const config = {
    revenue: { label: 'Revenue', color: 'text-blue-700', bg: 'bg-blue-50' },
    cost: { label: 'Cost', color: 'text-purple-700', bg: 'bg-purple-50' },
    efficiency: { label: 'Efficiency', color: 'text-green-700', bg: 'bg-green-50' },
    adoption: { label: 'Adoption', color: 'text-orange-700', bg: 'bg-orange-50' }
  };

  const { label, color, bg } = config[type];

  return (
    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${bg} ${color}`}>
      {label}
    </span>
  );
}

/**
 * Variance Display Component
 */
function VarianceDisplay({ variance }: { variance: number }) {
  const isPositive = variance >= 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';

  return (
    <span className={`font-medium ${color}`}>
      {isPositive ? '+' : ''}{variance.toFixed(1)}%
    </span>
  );
}

/**
 * Format value with unit
 */
function formatValue(value: number, unit: string): string {
  if (unit === '$' || unit === 'USD') {
    return `$${value.toLocaleString()}`;
  } else if (unit === '%') {
    return `${value.toFixed(1)}%`;
  } else if (unit === 'hours' || unit === 'hrs') {
    return `${value.toLocaleString()} hrs`;
  } else {
    return `${value.toLocaleString()} ${unit}`;
  }
}

/**
 * Loading State
 */
function LoadingTable() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded"></div>
        ))}
      </div>
    </div>
  );
}

/**
 * Empty State
 */
function EmptyState() {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <p className="text-gray-500 text-sm">No metrics available</p>
      <p className="text-gray-400 text-xs mt-1">Metrics will appear here once data is available</p>
    </div>
  );
}
