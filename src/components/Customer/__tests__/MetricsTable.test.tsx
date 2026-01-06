/**
 * Metrics Table Component Tests
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Metric, MetricsTable } from '../MetricsTable';

const mockMetrics: Metric[] = [
  {
    id: '1',
    metric_name: 'Cost Savings',
    metric_type: 'cost',
    predicted_value: 500000,
    actual_value: 620000,
    variance: 120000,
    variance_pct: 24,
    status: 'on_track',
    unit: '$'
  },
  {
    id: '2',
    metric_name: 'Time Saved',
    metric_type: 'efficiency',
    predicted_value: 2000,
    actual_value: 1850,
    variance: -150,
    variance_pct: -7.5,
    status: 'at_risk',
    unit: 'hours'
  },
  {
    id: '3',
    metric_name: 'Revenue Lift',
    metric_type: 'revenue',
    predicted_value: 1500000,
    actual_value: null,
    variance: null,
    variance_pct: null,
    status: 'pending',
    unit: '$'
  }
];

describe('MetricsTable', () => {
  it('should render all metrics', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText('Cost Savings')).toBeInTheDocument();
    expect(screen.getByText('Time Saved')).toBeInTheDocument();
    expect(screen.getByText('Revenue Lift')).toBeInTheDocument();
  });

  it('should display metric values correctly', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText('$500,000')).toBeInTheDocument();
    expect(screen.getByText('$620,000')).toBeInTheDocument();
    expect(screen.getByText('2,000 hrs')).toBeInTheDocument();
  });

  it('should display variance percentages', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText('+24.0%')).toBeInTheDocument();
    expect(screen.getByText('-7.5%')).toBeInTheDocument();
  });

  it('should display status badges', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('should display metric type badges', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Efficiency')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('should handle null actual values', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    // Revenue Lift has null actual value
    const rows = screen.getAllByRole('row');
    const revenueRow = rows.find(row => row.textContent?.includes('Revenue Lift'));
    expect(revenueRow?.textContent).toContain('—');
  });

  it('should sort by metric name ascending', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    const sortButton = screen.getByText('Metric').closest('button');
    fireEvent.click(sortButton!);

    const rows = screen.getAllByRole('row');
    const metricNames = Array.from(rows)
      .slice(1) // Skip header
      .map(row => row.querySelector('td')?.textContent);

    expect(metricNames[0]).toBe('Cost Savings');
    expect(metricNames[1]).toBe('Revenue Lift');
    expect(metricNames[2]).toBe('Time Saved');
  });

  it('should sort by metric name descending', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    const sortButton = screen.getByText('Metric').closest('button');
    fireEvent.click(sortButton!); // First click: asc
    fireEvent.click(sortButton!); // Second click: desc

    const rows = screen.getAllByRole('row');
    const metricNames = Array.from(rows)
      .slice(1)
      .map(row => row.querySelector('td')?.textContent);

    expect(metricNames[0]).toBe('Time Saved');
    expect(metricNames[1]).toBe('Revenue Lift');
    expect(metricNames[2]).toBe('Cost Savings');
  });

  it('should filter by status', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    const onTrackButton = screen.getByText(/On Track \(1\)/);
    fireEvent.click(onTrackButton);

    expect(screen.getByText('Cost Savings')).toBeInTheDocument();
    expect(screen.queryByText('Time Saved')).not.toBeInTheDocument();
    expect(screen.queryByText('Revenue Lift')).not.toBeInTheDocument();
  });

  it('should show correct filter counts', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText(/All \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/On Track \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/At Risk \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Off Track \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/Pending \(1\)/)).toBeInTheDocument();
  });

  it('should display showing count', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText('Showing 3 of 3 metrics')).toBeInTheDocument();
  });

  it('should update showing count when filtered', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    const onTrackButton = screen.getByText(/On Track \(1\)/);
    fireEvent.click(onTrackButton);

    expect(screen.getByText('Showing 1 of 3 metrics')).toBeInTheDocument();
  });

  it('should call onMetricClick when row is clicked', () => {
    const onMetricClick = vi.fn();
    render(<MetricsTable metrics={mockMetrics} onMetricClick={onMetricClick} />);

    const firstRow = screen.getByText('Cost Savings').closest('tr');
    fireEvent.click(firstRow!);

    expect(onMetricClick).toHaveBeenCalledWith(mockMetrics[0]);
  });

  it('should display loading state', () => {
    const { container } = render(<MetricsTable metrics={[]} loading={true} />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should display empty state when no metrics', () => {
    render(<MetricsTable metrics={[]} />);

    expect(screen.getByText('No metrics available')).toBeInTheDocument();
  });

  it('should highlight active sort column', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    const sortButton = screen.getByText('Variance').closest('button');
    fireEvent.click(sortButton!);

    // Check that sort indicator is visible (ArrowUp or ArrowDown icon)
    expect(sortButton?.querySelector('svg')).toBeInTheDocument();
  });

  it('should apply hover styles to rows when clickable', () => {
    const { container } = render(
      <MetricsTable metrics={mockMetrics} onMetricClick={() => {}} />
    );

    const firstRow = container.querySelector('tbody tr');
    expect(firstRow).toHaveClass('cursor-pointer');
  });

  it('should format currency values correctly', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText('$500,000')).toBeInTheDocument();
    expect(screen.getByText('$620,000')).toBeInTheDocument();
  });

  it('should format hour values correctly', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText('2,000 hrs')).toBeInTheDocument();
    expect(screen.getByText('1,850 hrs')).toBeInTheDocument();
  });

  it('should show positive variance in green', () => {
    const { container } = render(<MetricsTable metrics={mockMetrics} />);

    const positiveVariance = container.querySelector('.text-green-600');
    expect(positiveVariance?.textContent).toBe('+24.0%');
  });

  it('should show negative variance in red', () => {
    const { container } = render(<MetricsTable metrics={mockMetrics} />);

    const negativeVariance = container.querySelector('.text-red-600');
    expect(negativeVariance?.textContent).toBe('-7.5%');
  });

  it('should display all status filter buttons', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    expect(screen.getByText(/All/)).toBeInTheDocument();
    expect(screen.getByText(/On Track/)).toBeInTheDocument();
    expect(screen.getByText(/At Risk/)).toBeInTheDocument();
    expect(screen.getByText(/Off Track/)).toBeInTheDocument();
    expect(screen.getByText(/Pending/)).toBeInTheDocument();
  });

  it('should highlight active filter button', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    const allButton = screen.getByText(/All \(3\)/).closest('button');
    expect(allButton).toHaveClass('bg-blue-100', 'text-blue-700');
  });

  it('should sort by variance percentage', () => {
    render(<MetricsTable metrics={mockMetrics} />);

    const sortButton = screen.getByText('Variance').closest('button');
    fireEvent.click(sortButton!);

    // Should sort with nulls last, then by variance_pct ascending
    const rows = screen.getAllByRole('row');
    const variances = Array.from(rows)
      .slice(1)
      .map(row => {
        const cells = row.querySelectorAll('td');
        return cells[4]?.textContent;
      });

    expect(variances[0]).toContain('-7.5%');
    expect(variances[1]).toContain('+24.0%');
    expect(variances[2]).toContain('—');
  });
});
