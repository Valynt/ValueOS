/**
 * BenchmarkComparisonPanel Component
 *
 * Displays benchmark comparisons against industry standards.
 * Shows how the customer's metrics compare to peers.
 */

import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Building2,
  Users,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface BenchmarkComparison {
  metric: string;
  customerValue: number;
  industryAverage: number;
  topQuartile: number;
  unit: string;
  higherIsBetter: boolean;
}

export interface BenchmarkComparisonPanelProps {
  /** Array of benchmark comparisons */
  comparisons: BenchmarkComparison[];
  /** Industry name for context */
  industry: string;
  /** Company size for peer comparison */
  companySize?: 'small' | 'medium' | 'large' | 'enterprise';
}

const SIZE_LABELS: Record<string, string> = {
  small: '1-50 employees',
  medium: '51-200 employees',
  large: '201-1000 employees',
  enterprise: '1000+ employees',
};

function getPerformanceLevel(
  customerValue: number,
  industryAverage: number,
  topQuartile: number,
  higherIsBetter: boolean
): 'above' | 'average' | 'below' {
  if (higherIsBetter) {
    if (customerValue >= topQuartile) return 'above';
    if (customerValue >= industryAverage) return 'average';
    return 'below';
  } else {
    if (customerValue <= topQuartile) return 'above';
    if (customerValue <= industryAverage) return 'average';
    return 'below';
  }
}

function getPercentile(
  customerValue: number,
  industryAverage: number,
  topQuartile: number,
  higherIsBetter: boolean
): number {
  // Simplified percentile calculation
  const range = Math.abs(topQuartile - industryAverage);
  if (range === 0) return 50;

  if (higherIsBetter) {
    if (customerValue >= topQuartile) return 90;
    if (customerValue >= industryAverage) {
      return 50 + ((customerValue - industryAverage) / range) * 25;
    }
    return Math.max(10, 50 - ((industryAverage - customerValue) / industryAverage) * 40);
  } else {
    if (customerValue <= topQuartile) return 90;
    if (customerValue <= industryAverage) {
      return 50 + ((industryAverage - customerValue) / range) * 25;
    }
    return Math.max(10, 50 - ((customerValue - industryAverage) / industryAverage) * 40);
  }
}

function formatValue(value: number, unit: string): string {
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === '$') {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  }
  if (unit === 'days') return `${value.toFixed(0)} days`;
  if (unit === 'hours') return `${value.toFixed(1)} hrs`;
  return `${value.toFixed(1)} ${unit}`;
}

export function BenchmarkComparisonPanel({
  comparisons,
  industry,
  companySize,
}: BenchmarkComparisonPanelProps) {
  const aboveCount = comparisons.filter(
    (c) => getPerformanceLevel(c.customerValue, c.industryAverage, c.topQuartile, c.higherIsBetter) === 'above'
  ).length;
  const belowCount = comparisons.filter(
    (c) => getPerformanceLevel(c.customerValue, c.industryAverage, c.topQuartile, c.higherIsBetter) === 'below'
  ).length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Industry Benchmarks</h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{industry}</span>
          </div>
          {companySize && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{SIZE_LABELS[companySize]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 mb-6 p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <span className="text-sm">
            <span className="font-medium text-green-600">{aboveCount}</span> above average
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-600" />
          <span className="text-sm">
            <span className="font-medium text-red-600">{belowCount}</span> below average
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Minus className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-medium">{comparisons.length - aboveCount - belowCount}</span> at average
          </span>
        </div>
      </div>

      {/* Benchmark Cards */}
      <div className="space-y-4">
        {comparisons.map((comparison, index) => (
          <BenchmarkCard key={index} comparison={comparison} />
        ))}
      </div>
    </Card>
  );
}

interface BenchmarkCardProps {
  comparison: BenchmarkComparison;
}

function BenchmarkCard({ comparison }: BenchmarkCardProps) {
  const level = getPerformanceLevel(
    comparison.customerValue,
    comparison.industryAverage,
    comparison.topQuartile,
    comparison.higherIsBetter
  );
  const percentile = getPercentile(
    comparison.customerValue,
    comparison.industryAverage,
    comparison.topQuartile,
    comparison.higherIsBetter
  );

  const TrendIcon = level === 'above' ? TrendingUp : level === 'below' ? TrendingDown : Minus;

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium">{comparison.metric}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              'text-2xl font-bold',
              level === 'above' && 'text-green-600',
              level === 'average' && 'text-amber-600',
              level === 'below' && 'text-red-600'
            )}>
              {formatValue(comparison.customerValue, comparison.unit)}
            </span>
            <Badge className={cn(
              'text-xs',
              level === 'above' && 'bg-green-100 text-green-700',
              level === 'average' && 'bg-amber-100 text-amber-700',
              level === 'below' && 'bg-red-100 text-red-700'
            )}>
              <TrendIcon className="w-3 h-3 mr-1" />
              {level === 'above' ? 'Above' : level === 'below' ? 'Below' : 'At'} Average
            </Badge>
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Top Quartile: {formatValue(comparison.topQuartile, comparison.unit)}</p>
          <p>Industry Avg: {formatValue(comparison.industryAverage, comparison.unit)}</p>
        </div>
      </div>

      {/* Percentile Bar */}
      <div className="relative">
        <Progress value={percentile} className="h-2" />
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>0%</span>
          <span>Industry Average</span>
          <span>Top 25%</span>
        </div>
        {/* Marker for industry average */}
        <div
          className="absolute top-0 w-0.5 h-2 bg-muted-foreground"
          style={{ left: '50%' }}
        />
        {/* Marker for top quartile */}
        <div
          className="absolute top-0 w-0.5 h-2 bg-green-600"
          style={{ left: '75%' }}
        />
      </div>
    </div>
  );
}

/**
 * Compact version for summary display
 */
export function BenchmarkSummaryBadge({
  comparisons,
}: {
  comparisons: BenchmarkComparison[];
}) {
  const aboveCount = comparisons.filter(
    (c) => getPerformanceLevel(c.customerValue, c.industryAverage, c.topQuartile, c.higherIsBetter) === 'above'
  ).length;
  const total = comparisons.length;
  const percentage = Math.round((aboveCount / total) * 100);

  return (
    <Badge className={cn(
      percentage >= 70 && 'bg-green-100 text-green-700',
      percentage >= 40 && percentage < 70 && 'bg-amber-100 text-amber-700',
      percentage < 40 && 'bg-red-100 text-red-700'
    )}>
      <BarChart3 className="w-3 h-3 mr-1" />
      {aboveCount}/{total} above benchmark
    </Badge>
  );
}
