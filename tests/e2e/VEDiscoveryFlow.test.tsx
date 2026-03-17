import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpportunityDiscovery } from '../../apps/ValyntApp/src/features/canvas/OpportunityDiscovery';
import { GroundTruthService } from '../../apps/ValyntApp/src/features/canvas/services/GroundTruthService';

// Mock the MCP Server and API Client
vi.mock('../../apps/ValyntApp/src/mcp-ground-truth', () => ({
  createMCPServer: vi.fn().mockResolvedValue({
    executeTool: vi.fn().mockImplementation((toolName, args) => {
      if (toolName === 'get_metric_value') {
        return Promise.resolve({
          success: true,
          data: {
            metricId: args.metricId,
            name: 'Revenue per Employee',
            value: 250000,
            unit: 'USD',
            source: 'SEC EDGAR (Tier 1)',
            benchmarks: {
              p25: 180000,
              p50: 250000,
              p75: 350000
            }
          }
        });
      }
      return Promise.resolve({ success: false, error: 'Tool not found' });
    })
  })
}));

describe('VE Discovery Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the discovery workspace and fetch benchmarks', async () => {
    render(<OpportunityDiscovery />);

    // Check for main headings
    expect(screen.getByText(/Discovery: Identify Pain Points/i)).toBeDefined();
    expect(screen.getByText(/Ground Truth Explorer/i)).toBeDefined();

    // Simulate fetching a benchmark
    const fetchButton = screen.getByText(/Fetch Benchmark/i);
    fireEvent.click(fetchButton);

    // Wait for the result to appear
    await waitFor(() => {
      expect(screen.getByText(/Revenue per Employee/i)).toBeDefined();
      expect(screen.getByText(/250,000 USD/i)).toBeDefined();
      expect(screen.getByText(/SEC EDGAR \(Tier 1\)/i)).toBeDefined();
    });

    // Verify confidence badge
    expect(screen.getByText(/High/i)).toBeDefined();
  });

  it('should handle agent interactions in the panel', async () => {
    render(<OpportunityDiscovery />);
    
    const input = screen.getByPlaceholderText(/Describe a pain point/i);
    const sendButton = screen.getByText(/Send/i);

    fireEvent.change(input, { target: { value: 'Manual data entry is slow' } });
    fireEvent.click(sendButton);

    // Verify "thinking" state (mocked in useAgent)
    expect(screen.getByText(/Agent is thinking/i)).toBeDefined();
  });
});
