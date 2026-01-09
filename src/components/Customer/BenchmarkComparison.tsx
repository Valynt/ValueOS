/**
 * Benchmark Comparison Component
 * Displays customer performance vs. industry benchmarks
 */

import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, Target, TrendingUp } from 'lucide-react';
import { logger } from '../../lib/logger';

export interface BenchmarkComparisonProps {
  valueCaseId: string;
  token: string;
  loading?: boolean;
}

interface BenchmarkData {
  kpi_name: string;
  current_value: number | null;
  benchmark: {
    p25: number;
    median: number;
    p75: number;
    best_in_class: number;
    source: string;
  };
  percentile: number | null;
  performance_rating: 'excellent' | 'good' | 'average' | 'below_average' | 'poor' | 'unknown';
}

export function BenchmarkComparison({ valueCaseId, token, loading: externalLoading }: BenchmarkComparisonProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  useEffect(() => {
    if (externalLoading) {
      setLoading(true);
      return;
    }

    loadBenchmarks();
  }, [valueCaseId, token, externalLoading]);

  const loadBenchmarks = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/customer/benchmarks/${token}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setBenchmarks(data.comparisons || []);
      
      // Select first KPI by default
      if (data.comparisons && data.comparisons.length > 0) {
        setSelectedKpi(data.comparisons[0].kpi_name);
      }

      setLoading(false);
    } catch (err) {
      logger.error('Failed to load benchmarks', err as Error);
      setError('Failed to load benchmark data');
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (benchmarks.length === 0) {
    return <EmptyState />;
  }

  const selectedBenchmark = benchmarks.find(b => b.kpi_name === selectedKpi) || benchmarks[0];

  return (
    <div className="space-y-6">
      {/* KPI Selector */}
      <div className="flex flex-wrap gap-2">
        {benchmarks.map(benchmark => (
          <button
            key={benchmark.kpi_name}
            onClick={() => setSelectedKpi(benchmark.kpi_name)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedKpi === benchmark.kpi_name
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
            }`}
          >
            {benchmark.kpi_name}
          </button>
        ))}
      </div>

      {/* Performance Summary */}
      <PerformanceSummary benchmark={selectedBenchmark} />

      {/* Benchmark Chart */}
      <BenchmarkChart benchmark={selectedBenchmark} />

      {/* Percentile Indicator */}
      <PercentileIndicator benchmark={selectedBenchmark} />

      {/* Data Source */}
      <div className="text-xs text-gray-500 text-center">
        Data source: {selectedBenchmark.benchmark.source}
      </div>
    </div>
  );
}

/**
 * Performance Summary Cards
 */
function PerformanceSummary({ benchmark }: { benchmark: BenchmarkData }) {
  const rating = benchmark.performance_rating;
  const percentile = benchmark.percentile || 0;

  const ratingConfig = {
    excellent: { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50', icon: Award },
    good: { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingUp },
    average: { label: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Target },
    below_average: { label: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-50', icon: Target },
    poor: { label: 'Poor', color: 'text-red-600', bg: 'bg-red-50', icon: Target },
    unknown: { label: 'Unknown', color: 'text-gray-600', bg: 'bg-gray-50', icon: Target }
  };

  const config = ratingConfig[rating];
  const Icon = config.icon;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Your Performance */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-500 mb-1">Your Performance</p>
        <p className="text-2xl font-bold text-gray-900">
          {benchmark.current_value !== null 
            ? benchmark.current_value.toLocaleString()
            : 'No data'}
        </p>
      </div>

      {/* Industry Median */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-500 mb-1">Industry Median</p>
        <p className="text-2xl font-bold text-gray-900">
          {benchmark.benchmark.median.toLocaleString()}
        </p>
      </div>

      {/* Rating */}
      <div className={`border border-gray-200 rounded-lg p-4 ${config.bg}`}>
        <p className="text-sm text-gray-500 mb-1">Rating</p>
        <div className="flex items-center space-x-2">
          <Icon className={`h-6 w-6 ${config.color}`} />
          <p className={`text-2xl font-bold ${config.color}`}>
            {config.label}
          </p>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {percentile}th percentile
        </p>
      </div>
    </div>
  );
}

/**
 * Benchmark Chart
 */
function BenchmarkChart({ benchmark }: { benchmark: BenchmarkData }) {
  const chartData = [
    { name: '25th', value: benchmark.benchmark.p25, label: 'P25' },
    { name: 'Median', value: benchmark.benchmark.median, label: 'Median' },
    { name: '75th', value: benchmark.benchmark.p75, label: 'P75' },
    { name: 'Best', value: benchmark.benchmark.best_in_class, label: 'Best in Class' },
    ...(benchmark.current_value !== null 
      ? [{ name: 'You', value: benchmark.current_value, label: 'Your Performance' }]
      : [])
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-4">Industry Comparison</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px'
            }}
          />
          <Legend />
          <Bar dataKey="value" name={benchmark.kpi_name} radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry.name === 'You' ? '#3b82f6' : '#9ca3af'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Percentile Indicator
 */
function PercentileIndicator({ benchmark }: { benchmark: BenchmarkData }) {
  const percentile = benchmark.percentile || 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-4">Your Percentile Rank</h4>
      
      {/* Percentile Bar */}
      <div className="relative h-12 bg-gray-100 rounded-full overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-200 via-yellow-200 via-green-200 to-green-400"></div>
        
        {/* Percentile Markers */}
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <span className="text-xs text-gray-600">0</span>
          <span className="text-xs text-gray-600">25</span>
          <span className="text-xs text-gray-600">50</span>
          <span className="text-xs text-gray-600">75</span>
          <span className="text-xs text-gray-600">100</span>
        </div>
        
        {/* Your Position */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-blue-600"
          style={{ left: `${percentile}%` }}
        >
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
            You: {percentile}th
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <p className="text-sm text-gray-600 mt-4 text-center">
        {getPercentileInterpretation(percentile)}
      </p>
    </div>
  );
}

/**
 * Get percentile interpretation
 */
function getPercentileInterpretation(percentile: number): string {
  if (percentile >= 90) {
    return 'Outstanding! You\'re performing better than 90% of companies in your industry.';
  } else if (percentile >= 75) {
    return 'Great performance! You\'re in the top quartile of your industry.';
  } else if (percentile >= 50) {
    return 'Good performance. You\'re above the industry median.';
  } else if (percentile >= 25) {
    return 'Room for improvement. You\'re below the industry median.';
  } else {
    return 'Significant opportunity for improvement compared to industry peers.';
  }
}

/**
 * Loading State
 */
function LoadingState() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex space-x-2">
        <div className="h-10 bg-gray-200 rounded w-32"></div>
        <div className="h-10 bg-gray-200 rounded w-32"></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
      </div>
      <div className="h-80 bg-gray-200 rounded"></div>
    </div>
  );
}

/**
 * Error State
 */
function ErrorState({ error }: { error: string }) {
  return (
    <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
      <p className="text-red-600 font-medium">{error}</p>
      <p className="text-red-500 text-sm mt-2">Please try again later</p>
    </div>
  );
}

/**
 * Empty State
 */
function EmptyState() {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <p className="text-gray-500">No benchmark data available</p>
      <p className="text-gray-400 text-sm mt-1">Benchmarks will appear once industry data is available</p>
    </div>
  );
}
