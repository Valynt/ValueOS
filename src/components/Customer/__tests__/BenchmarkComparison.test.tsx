/**
 * Benchmark Comparison Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BenchmarkComparison } from '../BenchmarkComparison';

// Mock fetch
global.fetch = vi.fn();

const mockBenchmarks = {
  comparisons: [
    {
      kpi_name: 'Customer Acquisition Cost',
      current_value: 150,
      benchmark: {
        p25: 100,
        median: 150,
        p75: 200,
        best_in_class: 250,
        source: 'Industry Report 2026'
      },
      percentile: 50,
      performance_rating: 'average' as const
    },
    {
      kpi_name: 'Customer Lifetime Value',
      current_value: 5000,
      benchmark: {
        p25: 3000,
        median: 4000,
        p75: 5000,
        best_in_class: 7000,
        source: 'Industry Report 2026'
      },
      percentile: 75,
      performance_rating: 'good' as const
    }
  ]
};

describe('BenchmarkComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockBenchmarks)
    });
  });

  it('should load and display benchmarks', async () => {
    render(<BenchmarkComparison valueCaseId="vc-123" token="test-token" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/customer/benchmarks/test-token');
    });

    await waitFor(() => {
      expect(screen.getByText('Customer Acquisition Cost')).toBeInTheDocument();
    });
  });

  it('should display performance summary', async () => {
    render(<BenchmarkComparison valueCaseId="vc-123" token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Your Performance')).toBeInTheDocument();
      expect(screen.getByText('Industry Median')).toBeInTheDocument();
      expect(screen.getByText('Rating')).toBeInTheDocument();
    });
  });

  it('should switch between KPIs', async () => {
    render(<BenchmarkComparison valueCaseId="vc-123" token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Customer Acquisition Cost')).toBeInTheDocument();
    });

    const clvButton = screen.getByText('Customer Lifetime Value');
    fireEvent.click(clvButton);

    await waitFor(() => {
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });
  });

  it('should display percentile indicator', async () => {
    render(<BenchmarkComparison valueCaseId="vc-123" token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Your Percentile Rank')).toBeInTheDocument();
      expect(screen.getByText(/50th percentile/)).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    render(<BenchmarkComparison valueCaseId="vc-123" token="test-token" loading={true} />);

    const loadingElement = document.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('should handle API errors', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<BenchmarkComparison valueCaseId="vc-123" token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load benchmark data/)).toBeInTheDocument();
    });
  });

  it('should show empty state when no benchmarks', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ comparisons: [] })
    });

    render(<BenchmarkComparison valueCaseId="vc-123" token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('No benchmark data available')).toBeInTheDocument();
    });
  });

  it('should display data source', async () => {
    render(<BenchmarkComparison valueCaseId="vc-123" token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText(/Industry Report 2026/)).toBeInTheDocument();
    });
  });
});
