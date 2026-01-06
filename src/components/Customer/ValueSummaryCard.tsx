/**
 * Value Summary Card Component
 * Displays total value delivered vs. target with achievement percentage
 */

import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '../ui/card';

export interface ValueSummaryCardProps {
  totalValue: number;
  targetValue: number;
  trend: 'up' | 'down' | 'flat';
  currency?: string;
  period?: string;
  loading?: boolean;
}

export function ValueSummaryCard({
  totalValue,
  targetValue,
  trend,
  currency = 'USD',
  period = 'Last 90 Days',
  loading = false
}: ValueSummaryCardProps) {
  // Calculate achievement percentage
  const achievement = targetValue > 0 ? (totalValue / targetValue) * 100 : 0;
  const variance = totalValue - targetValue;
  const variancePercent = targetValue > 0 ? ((variance / targetValue) * 100) : 0;

  // Determine status color
  const statusColor = achievement >= 100 ? 'text-green-600' : 
                      achievement >= 80 ? 'text-yellow-600' : 
                      'text-red-600';

  const statusBg = achievement >= 100 ? 'bg-green-50' : 
                   achievement >= 80 ? 'bg-yellow-50' : 
                   'bg-red-50';

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Total Value Delivered
            </p>
            <p className="text-xs text-gray-400 mt-1">{period}</p>
          </div>
          <TrendIndicator trend={trend} />
        </div>

        {/* Main Value */}
        <div className="space-y-2">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-gray-900">
              {formatCurrency(totalValue, currency)}
            </span>
          </div>
          
          <div className="text-sm text-gray-600">
            vs {formatCurrency(targetValue, currency)} target
          </div>
        </div>

        {/* Achievement Badge */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 rounded-full ${statusBg}`}>
              <span className={`text-sm font-semibold ${statusColor}`}>
                {achievement.toFixed(0)}% achieved
              </span>
            </div>
          </div>

          {/* Variance */}
          <div className="text-right">
            <div className={`text-sm font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {variance >= 0 ? '+' : ''}{formatCurrency(variance, currency)}
            </div>
            <div className={`text-xs ${variance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Performance Message */}
        <div className="pt-2">
          <p className="text-xs text-gray-500">
            {getPerformanceMessage(achievement)}
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Trend Indicator Component
 */
function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  const config = {
    up: {
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-100',
      label: 'Trending up'
    },
    down: {
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-100',
      label: 'Trending down'
    },
    flat: {
      icon: Minus,
      color: 'text-gray-600',
      bg: 'bg-gray-100',
      label: 'Stable'
    }
  };

  const { icon: Icon, color, bg, label } = config[trend];

  return (
    <div 
      className={`flex items-center space-x-1 px-2 py-1 rounded-full ${bg}`}
      title={label}
    >
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={`text-xs font-medium ${color}`}>
        {label}
      </span>
    </div>
  );
}

/**
 * Format currency value
 */
function formatCurrency(value: number, currency: string): string {
  const absValue = Math.abs(value);
  
  // Format large numbers with K, M, B suffixes
  if (absValue >= 1_000_000_000) {
    return `${currency === 'USD' ? '$' : ''}${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (absValue >= 1_000_000) {
    return `${currency === 'USD' ? '$' : ''}${(value / 1_000_000).toFixed(2)}M`;
  } else if (absValue >= 1_000) {
    return `${currency === 'USD' ? '$' : ''}${(value / 1_000).toFixed(0)}K`;
  } else {
    return `${currency === 'USD' ? '$' : ''}${value.toLocaleString()}`;
  }
}

/**
 * Get performance message based on achievement
 */
function getPerformanceMessage(achievement: number): string {
  if (achievement >= 120) {
    return '🎉 Exceptional performance! Significantly exceeding targets.';
  } else if (achievement >= 100) {
    return '✅ Great work! Meeting or exceeding all targets.';
  } else if (achievement >= 80) {
    return '⚠️ Good progress, but some targets need attention.';
  } else if (achievement >= 60) {
    return '⚠️ Below target. Review metrics to identify improvement areas.';
  } else {
    return '❌ Significantly below target. Immediate action recommended.';
  }
}

/**
 * Compact version for dashboards
 */
export function ValueSummaryCardCompact({
  totalValue,
  targetValue,
  trend,
  currency = 'USD'
}: Omit<ValueSummaryCardProps, 'period' | 'loading'>) {
  const achievement = targetValue > 0 ? (totalValue / targetValue) * 100 : 0;

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex-1">
        <p className="text-sm text-gray-500">Total Value</p>
        <p className="text-xl font-bold text-gray-900">
          {formatCurrency(totalValue, currency)}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-600">
          {achievement.toFixed(0)}%
        </span>
        <TrendIndicator trend={trend} />
      </div>
    </div>
  );
}
