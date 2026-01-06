/**
 * Trend Chart Component
 * Displays actual vs. target metrics over time using Recharts
 */

import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis
} from 'recharts';
import { Info, TrendingDown, TrendingUp } from 'lucide-react';

export interface TrendDataPoint {
  date: string;
  actual: number | null;
  target: number;
  label?: string;
}

export interface TrendChartProps {
  data: TrendDataPoint[];
  title?: string;
  description?: string;
  unit?: string;
  height?: number;
  loading?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
}

export function TrendChart({
  data,
  title = 'Performance Trend',
  description,
  unit = '$',
  height = 400,
  loading = false,
  showLegend = true,
  showGrid = true
}: TrendChartProps) {
  if (loading) {
    return <LoadingChart height={height} />;
  }

  if (!data || data.length === 0) {
    return <EmptyChart height={height} />;
  }

  // Calculate trend
  const trend = calculateTrend(data);
  const summary = calculateSummary(data);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <TrendIndicator trend={trend} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Current"
          value={summary.current}
          unit={unit}
          color="text-blue-600"
        />
        <SummaryCard
          label="Target"
          value={summary.target}
          unit={unit}
          color="text-gray-600"
        />
        <SummaryCard
          label="Variance"
          value={summary.variance}
          unit="%"
          color={summary.variance >= 0 ? 'text-green-600' : 'text-red-600'}
          showSign
        />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            )}
            
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={formatDate}
            />
            
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => formatValue(value, unit)}
            />
            
            <Tooltip
              content={<CustomTooltip unit={unit} />}
              cursor={{ stroke: '#9ca3af', strokeWidth: 1 }}
            />
            
            {showLegend && (
              <Legend
                wrapperStyle={{ fontSize: '14px' }}
                iconType="line"
              />
            )}
            
            {/* Target Line */}
            <Line
              type="monotone"
              dataKey="target"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Target"
              activeDot={{ r: 6 }}
            />
            
            {/* Actual Line */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', r: 4 }}
              name="Actual"
              activeDot={{ r: 8 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Info Note */}
      <div className="flex items-start space-x-2 text-xs text-gray-500 bg-gray-50 rounded p-3">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <p>
          Chart shows actual performance compared to target over time. 
          Hover over data points for detailed values.
        </p>
      </div>
    </div>
  );
}

/**
 * Custom Tooltip Component
 */
function CustomTooltip({ active, payload, label, unit }: TooltipProps<number, string> & { unit: string }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const actual = payload.find(p => p.dataKey === 'actual')?.value;
  const target = payload.find(p => p.dataKey === 'target')?.value;
  const variance = actual && target ? ((actual - target) / target) * 100 : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
      <p className="text-sm font-semibold text-gray-900">
        {formatDateFull(label as string)}
      </p>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between space-x-4">
          <span className="text-xs text-gray-600">Actual:</span>
          <span className="text-sm font-medium text-blue-600">
            {actual !== null && actual !== undefined 
              ? formatValue(actual, unit)
              : 'No data'}
          </span>
        </div>
        
        <div className="flex items-center justify-between space-x-4">
          <span className="text-xs text-gray-600">Target:</span>
          <span className="text-sm font-medium text-gray-600">
            {target !== null && target !== undefined 
              ? formatValue(target, unit)
              : 'No data'}
          </span>
        </div>
        
        {variance !== null && (
          <div className="flex items-center justify-between space-x-4 pt-1 border-t border-gray-100">
            <span className="text-xs text-gray-600">Variance:</span>
            <span className={`text-sm font-medium ${
              variance >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Trend Indicator Component
 */
function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  const config = {
    up: {
      icon: TrendingUp,
      label: 'Trending Up',
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    down: {
      icon: TrendingDown,
      label: 'Trending Down',
      color: 'text-red-600',
      bg: 'bg-red-50'
    },
    flat: {
      icon: TrendingUp,
      label: 'Stable',
      color: 'text-gray-600',
      bg: 'bg-gray-50'
    }
  };

  const { icon: Icon, label, color, bg } = config[trend];

  return (
    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${bg}`}>
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={`text-sm font-medium ${color}`}>{label}</span>
    </div>
  );
}

/**
 * Summary Card Component
 */
function SummaryCard({
  label,
  value,
  unit,
  color,
  showSign = false
}: {
  label: string;
  value: number | null;
  unit: string;
  color: string;
  showSign?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>
        {value !== null 
          ? `${showSign && value >= 0 ? '+' : ''}${formatValue(value, unit)}`
          : '—'}
      </p>
    </div>
  );
}

/**
 * Loading Chart Component
 */
function LoadingChart({ height }: { height: number }) {
  return (
    <div className="space-y-4">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
        <div className="bg-gray-200 rounded" style={{ height }}></div>
      </div>
    </div>
  );
}

/**
 * Empty Chart Component
 */
function EmptyChart({ height }: { height: number }) {
  return (
    <div 
      className="flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
      style={{ height }}
    >
      <p className="text-gray-500 text-sm">No trend data available</p>
      <p className="text-gray-400 text-xs mt-1">Data will appear here once metrics are tracked</p>
    </div>
  );
}

/**
 * Calculate trend direction
 */
function calculateTrend(data: TrendDataPoint[]): 'up' | 'down' | 'flat' {
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
 * Calculate summary statistics
 */
function calculateSummary(data: TrendDataPoint[]): {
  current: number | null;
  target: number | null;
  variance: number | null;
} {
  const lastPoint = data[data.length - 1];
  
  if (!lastPoint) {
    return { current: null, target: null, variance: null };
  }

  const current = lastPoint.actual;
  const target = lastPoint.target;
  const variance = current && target ? ((current - target) / target) * 100 : null;

  return { current, target, variance };
}

/**
 * Format value with unit
 */
function formatValue(value: number, unit: string): string {
  const absValue = Math.abs(value);

  if (unit === '$' || unit === 'USD') {
    if (absValue >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    } else if (absValue >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    } else if (absValue >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    } else {
      return `$${value.toLocaleString()}`;
    }
  } else if (unit === '%') {
    return `${value.toFixed(1)}%`;
  } else {
    return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;
  }
}

/**
 * Format date for axis
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format date for tooltip
 */
function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
}
