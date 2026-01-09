import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUsageMetrics } from '../UsageMetrics';

describe('useUsageMetrics', () => {
  const organizationId = 'test-org-id';

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('fetches metrics from API with correct headers', async () => {
    const mockResponse = {
      usage: {
        llm_tokens: 5000,
        user_seats: 2,
        storage_gb: 0.5,
        api_calls: 100,
        agent_executions: 10
      },
      quotas: {
        llm_tokens: 10000,
        user_seats: 3,
        storage_gb: 1,
        api_calls: 1000,
        agent_executions: 100
      }
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useUsageMetrics(organizationId));

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Check fetch call
    expect(global.fetch).toHaveBeenCalledWith('/api/billing/usage', {
      headers: {
        'x-tenant-id': organizationId,
        'Content-Type': 'application/json',
      },
    });

    // Check metrics mapping
    const metrics = result.current.metrics;
    expect(metrics).toHaveLength(5);

    // Verify specific metrics
    const userMetric = metrics.find(m => m.label === 'Active Users');
    expect(userMetric).toBeDefined();
    expect(userMetric?.current).toBe(2);
    expect(userMetric?.limit).toBe(3);

    const storageMetric = metrics.find(m => m.label === 'Storage');
    expect(storageMetric).toBeDefined();
    expect(storageMetric?.current).toBe(0.5);
    expect(storageMetric?.limit).toBe(1);

    const apiMetric = metrics.find(m => m.label === 'API Calls');
    expect(apiMetric).toBeDefined();
    expect(apiMetric?.current).toBe(100);
    expect(apiMetric?.limit).toBe(1000);

    const llmMetric = metrics.find(m => m.label === 'LLM Tokens');
    expect(llmMetric).toBeDefined();
    expect(llmMetric?.current).toBe(5000);
    expect(llmMetric?.limit).toBe(10000);

    const agentMetric = metrics.find(m => m.label === 'Agent Executions');
    expect(agentMetric).toBeDefined();
    expect(agentMetric?.current).toBe(10);
    expect(agentMetric?.limit).toBe(100);
  });

  it('handles API errors', async () => {
    (global.fetch as any).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useUsageMetrics(organizationId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.metrics).toHaveLength(0);
  });
});
