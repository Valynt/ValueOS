/**
 * Usage Meter Component
 * Displays usage progress bars for each metric
 */

import React from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { BillingMetric, formatMetricName, formatUsageAmount } from '../../config/billing';

interface UsageMeterProps {
  metric: BillingMetric;
  usage: number;
  quota: number;
  className?: string;
}

export const UsageMeter: React.FC<UsageMeterProps> = ({
  metric,
  usage,
  quota,
  className = '',
}) => {
  const percentage = quota > 0 ? Math.min((usage / quota) * 100, 100) : 0;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 100;
  const remaining = Math.max(quota - usage, 0);

  const getColor = () => {
    if (isCritical) return 'bg-red-500';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    if (isCritical) return 'text-red-600';
    if (isWarning) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <span className="font-medium text-gray-900">
            {formatMetricName(metric)}
          </span>
          {(isWarning || isCritical) && (
            <AlertTriangle
              className={`w-4 h-4 ml-2 ${isCritical ? 'text-red-500' : 'text-yellow-500'}`}
            />
          )}
        </div>
        <div className={`text-sm ${getTextColor()}`}>
          {percentage.toFixed(0)}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Usage Stats */}
      <div className="flex justify-between mt-2 text-sm text-gray-600">
        <span>
          Used: {formatUsageAmount(metric, usage)}
        </span>
        <span>
          Remaining: {formatUsageAmount(metric, remaining)}
        </span>
      </div>

      {/* Warning Message */}
      {isCritical && (
        <div className="mt-2 text-sm text-red-600 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-1" />
          Quota exceeded - Upgrade your plan
        </div>
      )}
      {isWarning && !isCritical && (
        <div className="mt-2 text-sm text-yellow-600 flex items-center">
          <TrendingUp className="w-4 h-4 mr-1" />
          Approaching quota limit
        </div>
      )}
    </div>
  );
};

export default UsageMeter;
