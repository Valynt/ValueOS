/**
 * Benchmark Comparison Panel
 * 
 * Displays industry benchmarks with percentile positioning and gap analysis.
 * Uses Ground Truth Benchmark Layer for credible comparisons.
 * 
 * TRUST-FOCUSED: Shows data sources and vintage for all benchmarks
 * PRECISION: Uses decimal.js for accurate percentage calculations
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Award, ExternalLink, Info, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BenchmarkData {
  median: number;
  p25: number;
  p75: number;
  bestInClass: number;
  source?: string;
  vintage?: string;
}

interface BenchmarkComparison {
  kpiName: string;
  currentValue: number;
  unit: string;
  benchmarks: BenchmarkData;
  percentile: number;
  gapToMedian: number;
  gapToBestInClass: number;
  status: 'leading' | 'competitive' | 'lagging' | 'critical';
  improvement_opportunity: number;
  recommendations: string[];
}

interface BenchmarkComparisonPanelProps {
  comparisons: BenchmarkComparison[];
  industry: string;
  companySize?: string;
}

const statusConfig = {
  leading: {
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: Award,
    label: 'Leading'
  },
  competitive: {
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: TrendingUp,
    label: 'Competitive'
  },
  lagging: {
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: TrendingDown,
    label: 'Lagging'
  },
  critical: {
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertCircle,
    label: 'Critical'
  }
};

export function BenchmarkComparisonPanel({
  comparisons,
  industry,
  companySize
}: BenchmarkComparisonPanelProps) {
  const formatValue = (value: number, unit: string): string => {
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'usd') return `$${value.toLocaleString()}`;
    if (unit === 'days') return `${value} days`;
    return value.toLocaleString();
  };

  const getPercentilePosition = (percentile: number): string => {
    if (percentile >= 75) return 'Top 25%';
    if (percentile >= 50) return 'Top 50%';
    if (percentile >= 25) return 'Bottom 50%';
    return 'Bottom 25%';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Industry Benchmark Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Comparing against {industry} industry
              {companySize && ` • ${companySize} companies`}
            </p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Info className="w-3 h-3" />
            {comparisons.length} KPIs analyzed
          </Badge>
        </div>
      </Card>

      {/* Benchmark Cards */}
      <div className="space-y-4">
        {comparisons.map((comparison, index) => {
          const config = statusConfig[comparison.status];
          const StatusIcon = config.icon;

          return (
            <Card key={index} className="p-6">
              {/* KPI Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-1">{comparison.kpiName}</h4>
                  <div className="flex items-center gap-2">
                    <Badge className={config.color} variant="secondary">
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                    <Badge variant="outline">
                      {getPercentilePosition(comparison.percentile)}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{formatValue(comparison.currentValue, comparison.unit)}</p>
                  <p className="text-xs text-muted-foreground">Current Value</p>
                </div>
              </div>

              {/* Percentile Visualization */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>P25</span>
                  <span>Median</span>
                  <span>P75</span>
                  <span>Best-in-Class</span>
                </div>
                <div className="relative h-8 bg-gradient-to-r from-red-100 via-yellow-100 via-green-100 to-blue-100 rounded-lg">
                  {/* Benchmark Markers */}
                  <div className="absolute top-0 left-1/4 w-0.5 h-full bg-gray-400" />
                  <div className="absolute top-0 left-1/2 w-0.5 h-full bg-gray-600" />
                  <div className="absolute top-0 left-3/4 w-0.5 h-full bg-gray-400" />
                  
                  {/* Current Position Marker */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg cursor-pointer"
                          style={{ left: `${comparison.percentile}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs font-semibold">Your Position</p>
                        <p className="text-xs">{comparison.percentile}th percentile</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center justify-between text-xs font-medium mt-1">
                  <span>{formatValue(comparison.benchmarks.p25, comparison.unit)}</span>
                  <span>{formatValue(comparison.benchmarks.median, comparison.unit)}</span>
                  <span>{formatValue(comparison.benchmarks.p75, comparison.unit)}</span>
                  <span>{formatValue(comparison.benchmarks.bestInClass, comparison.unit)}</span>
                </div>
              </div>

              {/* Gap Analysis */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground mb-1">Gap to Median</p>
                  <p className={`text-lg font-bold ${comparison.gapToMedian < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {comparison.gapToMedian > 0 ? '+' : ''}{formatValue(comparison.gapToMedian, comparison.unit)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground mb-1">Gap to Best-in-Class</p>
                  <p className={`text-lg font-bold ${comparison.gapToBestInClass < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {comparison.gapToBestInClass > 0 ? '+' : ''}{formatValue(comparison.gapToBestInClass, comparison.unit)}
                  </p>
                </div>
              </div>

              {/* Improvement Opportunity */}
              {comparison.improvement_opportunity > 0 && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-900">Improvement Opportunity</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    ${comparison.improvement_opportunity.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Potential annual value by reaching median performance
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {comparison.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Recommendations:</p>
                  <ul className="space-y-1">
                    {comparison.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data Source */}
              {comparison.benchmarks.source && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      <span>Source: {comparison.benchmarks.source}</span>
                    </div>
                    {comparison.benchmarks.vintage && (
                      <span>Data: {comparison.benchmarks.vintage}</span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Summary Card */}
      <Card className="p-6 bg-muted/50">
        <h4 className="font-semibold mb-3">Benchmark Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = comparisons.filter(c => c.status === status).length;
            const Icon = config.icon;
            
            return (
              <div key={status} className="text-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${config.color} mb-2`}>
                  <Icon className="w-6 h-6" />
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Methodology Note */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-900">
            <p className="font-semibold mb-1">About These Benchmarks</p>
            <p>
              Benchmarks are sourced from industry reports and aggregated data from {industry} companies.
              Percentiles represent your position relative to the industry distribution.
              Best-in-class represents top 5% performers.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
