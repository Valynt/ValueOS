import React from 'react';
import { Database, Users, Zap } from 'lucide-react';

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

export const USAGE_PERCENTAGE_CRITICAL = 90;
export const USAGE_PERCENTAGE_WARNING = 75;
export const MAX_PERCENTAGE = 100;

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
  const percentage = (current / limit) * MAX_PERCENTAGE;

  if (percentage >= USAGE_PERCENTAGE_CRITICAL) return 'critical';
  if (percentage >= USAGE_PERCENTAGE_WARNING) return 'warning';
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
