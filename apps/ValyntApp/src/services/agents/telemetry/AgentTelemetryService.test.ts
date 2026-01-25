import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentTelemetryService } from './AgentTelemetryService';
import { AgentRequest, AgentResponse } from '../core/IAgent';

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random(),
}));

describe('AgentTelemetryService Cost Calculation', () => {
  it('should calculate actual cost correctly', () => {
    const request: AgentRequest = {
      agentType: 'opportunity',
      query: 'test query',
    };

    const traceId = agentTelemetryService.startExecutionTrace(request);

    const response: AgentResponse = {
      success: true,
      confidence: 'high',
      metadata: {
        executionId: 'exec-1',
        agentType: 'opportunity',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        tokenUsage: {
          input: 100,
          output: 50,
          total: 150,
          cost: 0.05, // $0.05 cost
        },
        cacheHit: false,
        retryCount: 0,
        circuitBreakerTripped: false,
      },
    };

    agentTelemetryService.completeExecutionTrace(traceId, response);

    // Get metrics
    const metrics = agentTelemetryService.getValueLifecycleMetrics();
    const opportunityMetrics = metrics.agentMetrics['opportunity'];

    // Verify correct calculations
    expect(opportunityMetrics.avgCost).toBe(0.05);
    expect(metrics.totalCost).toBe(0.05);
  });
});
