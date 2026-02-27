/**
 * Realization Portal Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RealizationPortal } from '../RealizationPortal';
import { customerAccessService } from '../../../services/CustomerAccessService';

// Mock dependencies
vi.mock('../../../services/CustomerAccessService');
vi.mock('../../../components/Customer/BenchmarkComparison', () => ({
  BenchmarkComparison: () => <div>Benchmark Comparison</div>
}));
vi.mock('../../../components/Customer/ExportActions', () => ({
  ExportActions: () => <div>Export Actions</div>
}));

// Mock fetch
global.fetch = vi.fn();

const mockValueCase = {
  id: 'vc-123',
  name: 'Q1 2026 Business Case',
  company_name: 'Acme Corp',
  description: 'Test description',
  lifecycle_stage: 'realization'
};

const mockMetrics = {
  metrics: [
    {
      id: '1',
      metric_name: 'Cost Savings',
      metric_type: 'cost' as const,
      predicted_value: 500000,
      actual_value: 620000,
      variance: 120000,
      variance_pct: 24,
      status: 'on_track' as const,
      unit: '$'
    }
  ],
  summary: {
    total_metrics: 1,
    on_track: 1,
    at_risk: 0,
    off_track: 0,
    pending: 0,
    overall_achievement: 124
  }
};

function renderWithRouter(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
}

describe('RealizationPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful token validation
    vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
      value_case_id: 'vc-123',
      is_valid: true,
      error_message: null
    });

    // Mock successful API calls
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/value-case/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockValueCase)
        });
      }
      if (url.includes('/metrics/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMetrics)
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('should show error when no token provided', () => {
    renderWithRouter(<RealizationPortal />);

    expect(screen.getByText(/No access token provided/)).toBeInTheDocument();
  });

  it('should validate token on mount', async () => {
    // Set URL with token
    window.history.pushState({}, '', '?token=test-token');

    renderWithRouter(<RealizationPortal />);

    await waitFor(() => {
      expect(customerAccessService.validateCustomerToken).toHaveBeenCalledWith('test-token');
    });
  });

  it('should show error for invalid token', async () => {
    window.history.pushState({}, '', '?token=invalid-token');

    vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
      value_case_id: null,
      is_valid: false,
      error_message: 'Token has expired'
    });

    renderWithRouter(<RealizationPortal />);

    await waitFor(() => {
      expect(screen.getByText(/Token has expired/)).toBeInTheDocument();
    });
  });

  it('should load and display portal data', async () => {
    window.history.pushState({}, '', '?token=valid-token');

    renderWithRouter(<RealizationPortal />);

    await waitFor(() => {
      expect(screen.getByText('Q1 2026 Business Case')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });
  });

  it('should display company name in layout', async () => {
    window.history.pushState({}, '', '?token=valid-token');

    renderWithRouter(<RealizationPortal />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  it('should fetch value case and metrics in parallel', async () => {
    window.history.pushState({}, '', '?token=valid-token');

    renderWithRouter(<RealizationPortal />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/value-case/valid-token')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/metrics/valid-token')
      );
    });
  });

  it('should render all portal sections', async () => {
    window.history.pushState({}, '', '?token=valid-token');

    renderWithRouter(<RealizationPortal />);

    await waitFor(() => {
      expect(screen.getByText('Performance Trend')).toBeInTheDocument();
      expect(screen.getByText('Detailed Metrics')).toBeInTheDocument();
      expect(screen.getByText('Industry Benchmarks')).toBeInTheDocument();
      expect(screen.getByText('Benchmark Comparison')).toBeInTheDocument();
      expect(screen.getByText('Export Actions')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    window.history.pushState({}, '', '?token=valid-token');

    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    renderWithRouter(<RealizationPortal />);

    await waitFor(() => {
      expect(screen.getByText(/unexpected error occurred/)).toBeInTheDocument();
    });
  });
});
