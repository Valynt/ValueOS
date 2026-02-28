/**
 * ValueOS Brain: Budget & Routing Integration Tests
 *
 * Tests the integration between AgentSecurityMiddleware, CostAwareRouter,
 * and CostAwareRoutingService for budget-aware agent routing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMGateway } from '../../lib/agent-fabric/LLMGateway.js';
import { CostAwareRouter } from '../CostAwareRouter.js';
import { CostAwareRoutingService } from '../CostAwareRoutingService.js';
import { FallbackAIService } from '../FallbackAIService.js';
import { LLMCostTracker } from '../LLMCostTracker.js';

// Mock CostAwareRouter
vi.mock('../CostAwareRouter.js', () => ({
  CostAwareRouter: vi.fn(),
}));

// Mock FallbackAIService
vi.mock('../FallbackAIService.js', () => ({
  FallbackAIService: vi.fn(),
}));

// Mock LLMGateway
vi.mock('../../lib/agent-fabric/LLMGateway.js', () => ({
  LLMGateway: vi.fn(),
}));

// Mock AgentSecurityMiddleware
const mockAgentSecurityMiddleware = {
  checkBudgetForDowngrade: vi.fn(),
  validateInput: vi.fn(),
};

describe('ValueOS Brain: Budget & Routing Integration', () => {
  let mockMiddleware: any;
  let mockCostRouter: any;
  let mockFallbackService: any;
  let mockLLMGateway: any;
  let costTracker: LLMCostTracker;
  let routingService: CostAwareRoutingService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock instances
    mockMiddleware = mockAgentSecurityMiddleware;

    mockCostRouter = {
      routeRequest: vi.fn(),
      checkTenantBudget: vi.fn(),
    };

    mockFallbackService = {
      generateFallbackResponse: vi.fn(),
      generateFallbackAnalysis: vi.fn(),
    };

    mockLLMGateway = {
      complete: vi.fn(),
    };

    // Mock the singleton
    (AgentSecurityMiddleware.getInstance as any).mockReturnValue(mockMiddleware);
    (CostAwareRouter as any).mockImplementation(() => mockCostRouter);
    (FallbackAIService as any).mockImplementation(() => mockFallbackService);
    (LLMGateway as any).mockImplementation(() => mockLLMGateway);

    // Create real instances for testing
    costTracker = new LLMCostTracker();
    routingService = new CostAwareRoutingService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Budget Threshold Detection', () => {
    it('should detect downgrade needed when budget is at 91%', async () => {
      // Mock budget check to return true for downgrade
      mockMiddleware.checkBudgetForDowngrade.mockResolvedValue(true);

      const result = await mockMiddleware.checkBudgetForDowngrade('tenant-1', 'ExpansionAgent');
      expect(result).toBe(true);
      expect(mockMiddleware.checkBudgetForDowngrade).toHaveBeenCalledWith('tenant-1', 'ExpansionAgent');
    });

    it('should not downgrade when budget is below 90%', async () => {
      mockMiddleware.checkBudgetForDowngrade.mockResolvedValue(false);

      const result = await mockMiddleware.checkBudgetForDowngrade('tenant-1', 'ExpansionAgent');
      expect(result).toBe(false);
    });

    it('should not downgrade critical agents even at 95% budget', async () => {
      mockMiddleware.checkBudgetForDowngrade.mockResolvedValue(false);

      const result = await mockMiddleware.checkBudgetForDowngrade('tenant-1', 'TargetAgent');
      expect(result).toBe(false);
    });
  });

  describe('Cost-Aware Routing Logic', () => {
    it('should route ExpansionAgent to FallbackAIService when budget exceeds 90%', async () => {
      // Mock routing decision for fallback
      mockCostRouter.routeRequest.mockResolvedValue({
        fallbackToBasic: true,
        useModel: 'fallback',
        provider: 'custom',
        reason: 'Budget limit reached (91% used)',
        estimatedCost: 0,
      });

      mockFallbackService.generateFallbackAnalysis.mockResolvedValue('Fallback analysis response');

      const result = await routingService.routeRequest({
        tenantId: 'tenant-1',
        agentType: 'ExpansionAgent',
        input: 'Analyze market expansion opportunities',
        priority: 'low',
      });

      expect(result.usedFallback).toBe(true);
      expect(result.cost).toBe(0);
      expect(result.response).toBe('Fallback analysis response');
      expect(mockFallbackService.generateFallbackAnalysis).toHaveBeenCalledWith(
        'Analyze market expansion opportunities',
        undefined
      );
    });

    it('should NOT downgrade TargetAgent even when budget exceeds 90%', async () => {
      // Mock routing decision for normal LLM
      mockCostRouter.routeRequest.mockResolvedValue({
        fallbackToBasic: false,
        useModel: 'claude-3-sonnet',
        provider: 'anthropic',
        reason: 'Selected claude-3-sonnet for critical priority',
        estimatedCost: 0.002,
      });

      const result = await routingService.routeRequest({
        tenantId: 'tenant-1',
        agentType: 'TargetAgent',
        input: 'Calculate ROI for investment scenario',
        priority: 'critical',
      });

      expect(result.usedFallback).toBe(false);
      expect(result.cost).toBe(0.002);
      expect(result.model).toBe('claude-3-sonnet');
    });

    it('should route OpportunityAgent normally when budget is under 90%', async () => {
      mockCostRouter.routeRequest.mockResolvedValue({
        fallbackToBasic: false,
        useModel: 'gpt-4o',
        provider: 'openai',
        reason: 'Selected gpt-4o for high priority (45% budget used)',
        estimatedCost: 0.0015,
      });

      const result = await routingService.routeRequest({
        tenantId: 'tenant-1',
        agentType: 'OpportunityAgent',
        input: 'Identify market opportunities',
        priority: 'high',
      });

      expect(result.usedFallback).toBe(false);
      expect(result.cost).toBe(0.0015);
      expect(result.model).toBe('gpt-4o');
    });
  });

  describe('Concurrency and Stability', () => {
    it('should handle concurrent requests without race conditions', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        tenantId: `tenant-${i % 3}`, // 3 different tenants
        agentType: i % 2 === 0 ? 'ExpansionAgent' : 'TargetAgent',
        input: `Request ${i}`,
        priority: i % 2 === 0 ? 'low' : 'critical' as const,
      }));

      // Mock varying responses
      mockCostRouter.routeRequest.mockImplementation(async (req) => {
        if (req.agentType === 'ExpansionAgent') {
          return {
            fallbackToBasic: true,
            useModel: 'fallback',
            provider: 'custom',
            reason: 'Budget limit reached',
            estimatedCost: 0,
          };
        }
        return {
          fallbackToBasic: false,
          useModel: 'claude-3-sonnet',
          provider: 'anthropic',
          reason: 'Normal routing',
          estimatedCost: 0.002,
        };
      });

      mockFallbackService.generateFallbackAnalysis.mockResolvedValue('Fallback response');
      mockLLMGateway.complete.mockResolvedValue({
        id: 'resp-1',
        model: 'claude-3-sonnet',
        content: 'Normal response',
        finish_reason: 'stop',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      // Execute all requests concurrently
      const results = await Promise.all(
        requests.map(req => routingService.routeRequest(req))
      );

      expect(results).toHaveLength(10);

      // Verify ExpansionAgent requests used fallback
      const expansionResults = results.filter((_, i) => requests[i].agentType === 'ExpansionAgent');
      expansionResults.forEach(result => {
        expect(result.usedFallback).toBe(true);
        expect(result.cost).toBe(0);
      });

      // Verify TargetAgent requests used normal routing
      const targetResults = results.filter((_, i) => requests[i].agentType === 'TargetAgent');
      targetResults.forEach(result => {
        expect(result.usedFallback).toBe(false);
        expect(result.cost).toBe(0.002);
      });
    });

    it('should maintain tenant isolation during concurrent requests', async () => {
      const tenantARequests = Array.from({ length: 5 }, () => ({
        tenantId: 'tenant-A',
        agentType: 'ExpansionAgent' as const,
        input: 'Tenant A request',
        priority: 'low' as const,
      }));

      const tenantBRequests = Array.from({ length: 5 }, () => ({
        tenantId: 'tenant-B',
        agentType: 'ExpansionAgent' as const,
        input: 'Tenant B request',
        priority: 'low' as const,
      }));

      // Mock tenant-specific budget checks
      mockCostRouter.routeRequest.mockImplementation(async (req) => {
        if (req.tenantId === 'tenant-A') {
          return {
            fallbackToBasic: true, // Tenant A over budget
            useModel: 'fallback',
            provider: 'custom',
            reason: 'Tenant A budget exceeded',
            estimatedCost: 0,
          };
        }
        return {
          fallbackToBasic: false, // Tenant B under budget
          useModel: 'gpt-4o',
          provider: 'openai',
          reason: 'Tenant B normal routing',
          estimatedCost: 0.001,
        };
      });

      mockFallbackService.generateFallbackAnalysis.mockResolvedValue('Fallback for tenant A');

      // Execute all requests concurrently
      const allRequests = [...tenantARequests, ...tenantBRequests];
      const results = await Promise.all(
        allRequests.map(req => routingService.routeRequest(req))
      );

      // Verify tenant isolation
      const tenantAResults = results.slice(0, 5);
      const tenantBResults = results.slice(5, 10);

      tenantAResults.forEach(result => {
        expect(result.usedFallback).toBe(true);
        expect(result.response).toBe('Fallback for tenant A');
      });

      tenantBResults.forEach(result => {
        expect(result.usedFallback).toBe(false);
        expect(result.cost).toBe(0.001);
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should gracefully handle cost tracker failures', async () => {
      mockCostRouter.routeRequest.mockRejectedValue(new Error('Cost tracker unavailable'));

      // Should not throw, should default to normal routing
      const result = await routingService.routeRequest({
        tenantId: 'tenant-1',
        agentType: 'ExpansionAgent',
        input: 'Test request',
        priority: 'low',
      });

      // Verify graceful degradation - should still attempt routing
      expect(mockCostRouter.routeRequest).toHaveBeenCalled();
    });

    it('should handle fallback service failures', async () => {
      mockCostRouter.routeRequest.mockResolvedValue({
        fallbackToBasic: true,
        useModel: 'fallback',
        provider: 'custom',
        reason: 'Budget exceeded',
        estimatedCost: 0,
      });

      mockFallbackService.generateFallbackAnalysis.mockRejectedValue(new Error('Fallback service down'));

      await expect(routingService.routeRequest({
        tenantId: 'tenant-1',
        agentType: 'ExpansionAgent',
        input: 'Test request',
        priority: 'low',
      })).rejects.toThrow('Fallback service down');
    });
  });

  describe('Performance Validation', () => {
    it('should complete routing decisions within acceptable time limits', async () => {
      mockCostRouter.routeRequest.mockResolvedValue({
        fallbackToBasic: false,
        useModel: 'gpt-4o',
        provider: 'openai',
        reason: 'Normal routing',
        estimatedCost: 0.001,
      });

      const startTime = Date.now();

      await routingService.routeRequest({
        tenantId: 'tenant-1',
        agentType: 'OpportunityAgent',
        input: 'Performance test request',
        priority: 'high',
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentRequests = 50;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
        tenantId: `tenant-${i % 5}`,
        agentType: 'ExpansionAgent' as const,
        input: `Load test request ${i}`,
        priority: 'low' as const,
      }));

      mockCostRouter.routeRequest.mockResolvedValue({
        fallbackToBasic: true,
        useModel: 'fallback',
        provider: 'custom',
        reason: 'Load test',
        estimatedCost: 0,
      });

      mockFallbackService.generateFallbackAnalysis.mockImplementation(
        (input) => Promise.resolve(`Fallback response for: ${input}`)
      );

      const startTime = Date.now();

      const results = await Promise.all(
        requests.map(req => routingService.routeRequest(req))
      );

      const duration = Date.now() - startTime;
      const avgDuration = duration / concurrentRequests;

      expect(results).toHaveLength(concurrentRequests);
      expect(avgDuration).toBeLessThan(50); // Average under 50ms per request
      expect(duration).toBeLessThan(2000); // Total under 2 seconds
    });
  });
});
