/**
 * Trend Chart Component Tests
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendChart, TrendDataPoint } from '../TrendChart';

const mockData: TrendDataPoint[] = [
  { date: '2026-01-01', actual: 100000, target: 100000 },
  { date: '2026-02-01', actual: 120000, target: 110000 },
  { date: '2026-03-01', actual: 150000, target: 120000 },
  { date: '2026-04-01', actual: 180000, target: 130000 }
];

const mockDataWithNulls: TrendDataPoint[] = [
  { date: '2026-01-01', actual: 100000, target: 100000 },
  { date: '2026-02-01', actual: null, target: 110000 },
  { date: '2026-03-01', actual: 150000, target: 120000 }
];

describe('TrendChart', () => {
  it('should render chart with title', () => {
    render(<TrendChart data={mockData} title="Performance Trend" />);

    expect(screen.getByText('Performance Trend')).toBeInTheDocument();
  });

  it('should render chart with description', () => {
    render(
      <TrendChart 
        data={mockData} 
        description="Monthly performance metrics"
      />
    );

    expect(screen.getByText('Monthly performance metrics')).toBeInTheDocument();
  });

  it('should display summary statistics', () => {
    render(<TrendChart data={mockData} />);

    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Variance')).toBeInTheDocument();
  });

  it('should calculate current value from last data point', () => {
    render(<TrendChart data={mockData} unit="$" />);

    // Last actual value is 180000
    expect(screen.getByText('$180K')).toBeInTheDocument();
  });

  it('should calculate target value from last data point', () => {
    render(<TrendChart data={mockData} unit="$" />);

    // Last target value is 130000
    expect(screen.getByText('$130K')).toBeInTheDocument();
  });

  it('should calculate variance percentage', () => {
    render(<TrendChart data={mockData} />);

    // (180000 - 130000) / 130000 * 100 = 38.5%
    expect(screen.getByText('+38.5%')).toBeInTheDocument();
  });

  it('should show trending up indicator', () => {
    render(<TrendChart data={mockData} />);

    expect(screen.getByText('Trending Up')).toBeInTheDocument();
  });

  it('should show trending down indicator', () => {
    const decreasingData: TrendDataPoint[] = [
      { date: '2026-01-01', actual: 180000, target: 100000 },
      { date: '2026-02-01', actual: 150000, target: 110000 },
      { date: '2026-03-01', actual: 120000, target: 120000 },
      { date: '2026-04-01', actual: 100000, target: 130000 }
    ];

    render(<TrendChart data={decreasingData} />);

    expect(screen.getByText('Trending Down')).toBeInTheDocument();
  });

  it('should show stable indicator for flat trend', () => {
    const flatData: TrendDataPoint[] = [
      { date: '2026-01-01', actual: 100000, target: 100000 },
      { date: '2026-02-01', actual: 102000, target: 110000 },
      { date: '2026-03-01', actual: 101000, target: 120000 }
    ];

    render(<TrendChart data={flatData} />);

    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('should handle null actual values', () => {
    render(<TrendChart data={mockDataWithNulls} />);

    // Should still render without errors
    expect(screen.getByText('Performance Trend')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    const { container } = render(<TrendChart data={[]} loading={true} />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should display empty state when no data', () => {
    render(<TrendChart data={[]} />);

    expect(screen.getByText('No trend data available')).toBeInTheDocument();
  });

  it('should format currency values with K suffix', () => {
    render(<TrendChart data={mockData} unit="$" />);

    expect(screen.getByText('$180K')).toBeInTheDocument();
  });

  it('should format currency values with M suffix', () => {
    const largeData: TrendDataPoint[] = [
      { date: '2026-01-01', actual: 2500000, target: 2000000 }
    ];

    render(<TrendChart data={largeData} unit="$" />);

    expect(screen.getByText('$2.50M')).toBeInTheDocument();
  });

  it('should format currency values with B suffix', () => {
    const hugeData: TrendDataPoint[] = [
      { date: '2026-01-01', actual: 2500000000, target: 2000000000 }
    ];

    render(<TrendChart data={hugeData} unit="$" />);

    expect(screen.getByText('$2.50B')).toBeInTheDocument();
  });

  it('should format percentage values', () => {
    const percentData: TrendDataPoint[] = [
      { date: '2026-01-01', actual: 85.5, target: 80.0 }
    ];

    render(<TrendChart data={percentData} unit="%" />);

    expect(screen.getByText('85.5%')).toBeInTheDocument();
  });

  it('should show positive variance in green', () => {
    const { container } = render(<TrendChart data={mockData} />);

    const varianceCard = container.querySelector('.text-green-600');
    expect(varianceCard?.textContent).toContain('+38.5%');
  });

  it('should show negative variance in red', () => {
    const negativeData: TrendDataPoint[] = [
      { date: '2026-01-01', actual: 80000, target: 100000 }
    ];

    const { container } = render(<TrendChart data={negativeData} />);

    const varianceCard = container.querySelector('.text-red-600');
    expect(varianceCard?.textContent).toContain('-20.0%');
  });

  it('should render with custom height', () => {
    const { container } = render(
      <TrendChart data={mockData} height={300} />
    );

    const chartContainer = container.querySelector('.recharts-responsive-container');
    expect(chartContainer).toBeInTheDocument();
  });

  it('should show legend by default', () => {
    render(<TrendChart data={mockData} />);

    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Actual')).toBeInTheDocument();
  });

  it('should hide legend when showLegend is false', () => {
    const { container } = render(
      <TrendChart data={mockData} showLegend={false} />
    );

    const legend = container.querySelector('.recharts-legend-wrapper');
    expect(legend).not.toBeInTheDocument();
  });

  it('should show grid by default', () => {
    const { container } = render(<TrendChart data={mockData} />);

    const grid = container.querySelector('.recharts-cartesian-grid');
    expect(grid).toBeInTheDocument();
  });

  it('should hide grid when showGrid is false', () => {
    const { container } = render(
      <TrendChart data={mockData} showGrid={false} />
    );

    const grid = container.querySelector('.recharts-cartesian-grid');
    expect(grid).not.toBeInTheDocument();
  });

  it('should display info note', () => {
    render(<TrendChart data={mockData} />);

    expect(screen.getByText(/Chart shows actual performance/)).toBeInTheDocument();
  });

  it('should handle single data point', () => {
    const singleData: TrendDataPoint[] = [
      { date: '2026-01-01', actual: 100000, target: 100000 }
    ];

    render(<TrendChart data={singleData} />);

    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('should handle all null actual values', () => {
    const allNullData: TrendDataPoint[] = [
      { date: '2026-01-01', actual: null, target: 100000 },
      { date: '2026-02-01', actual: null, target: 110000 }
    ];

    render(<TrendChart data={allNullData} />);

    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('should show sign on variance when showSign is true', () => {
    render(<TrendChart data={mockData} />);

    // Variance should show + sign for positive values
    expect(screen.getByText(/\+38.5%/)).toBeInTheDocument();
  });

  it('should render ResponsiveContainer', () => {
    const { container } = render(<TrendChart data={mockData} />);

    const responsiveContainer = container.querySelector('.recharts-responsive-container');
    expect(responsiveContainer).toBeInTheDocument();
  });

  it('should render LineChart', () => {
    const { container } = render(<TrendChart data={mockData} />);

    const lineChart = container.querySelector('.recharts-line-chart');
    expect(lineChart).toBeInTheDocument();
  });

  it('should render two lines (actual and target)', () => {
    const { container } = render(<TrendChart data={mockData} />);

    const lines = container.querySelectorAll('.recharts-line');
    expect(lines.length).toBe(2);
  });

  it('should use dashed line for target', () => {
    const { container } = render(<TrendChart data={mockData} />);

    const targetLine = container.querySelector('[stroke-dasharray="5 5"]');
    expect(targetLine).toBeInTheDocument();
  });

  it('should use solid line for actual', () => {
    const { container } = render(<TrendChart data={mockData} />);

    const actualLine = container.querySelector('[stroke="#3b82f6"]');
    expect(actualLine).toBeInTheDocument();
  });
});
