/**
 * Agent Optimization Performance Tests
 *
 * Tests for the optimized agent coordination intelligence improvements
 * including intelligent routing, context sharing, and parallel execution.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AgentType } from '../../src/services/agent-types';
import { getCategorizedCircuitBreakerManager } from '../../src/services/CircuitBreakerManager';
import { getContextOptimizer } from '../../src/services/ContextOptimizer';
import { getEnhancedParallelExecutor } from '../../src/services/EnhancedParallelExecutor';
import { getIntelligentCoordinator } from '../../src/services/IntelligentCoordinator';
import { getSecureSharedContext } from '../../src/services/SecureSharedContext';

// ============================================================================
// Test Utilities
// ============================================================================

const createMockRequest = (agent: AgentType, query: string, context?: Record<string, any>) => ({
  agent,
  query,
  context,
  sessionId: 'test-session-123',
  userId: 'test-user-456',
  traceId: 'test-trace-789',
});

const createSecurityContext = (tenantId: string, userId: string) => ({
  tenantId,
  userId,
  permissions: ['data.read', 'agents.execute'],
  trustLevel: 'medium' as const,
  sessionId: 'test-session',
  traceId: 'test-trace',
});

// ============================================================================
// Intelligent Coordinator Tests
// ============================================================================

describe('Intelligent Coordinator', () => {
  let coordinator: ReturnType<typeof getIntelligentCoordinator>;

  beforeEach(() => {
    coordinator = getIntelligentCoordinator();
    coordinator.clearCache();
  });

  afterEach(() => {
    coordinator.clearCache();
  });

  describe('Request Analysis', () => {
    it('should analyze simple request correctly', async () => {
      const request = createMockRequest('opportunity', 'What is the market size?');

      const plan = await coordinator.routeRequest(request);

      expect(plan.strategy).toBe('direct');
      expect(plan.agents).toHaveLength(1);
      expect(plan.agents[0]).toBe('opportunity');
      expect(plan.confidence).toBeGreaterThan(0.8);
    });

    it('should analyze moderate complexity request', async () => {
      const request = createMockRequest('target', 'Analyze ROI for this opportunity with financial data', {
        financialData: { revenue: 1000000, costs: 500000 }
      });

      const plan = await coordinator.routeRequest(request);

      expect(plan.strategy).toBe('pipeline');
      expect(plan.agents.length).toBeGreaterThan(1);
      expect(plan.agents).toContain('target');
      expect(plan.confidence).toBeGreaterThan(0.7);
    });

    it('should analyze complex request with multiple domains', async () => {
      const request = createMockRequest('coordinator', 'Research market, analyze financials, and create narrative report', {
        includeResearch: true,
        includeFinancial: true,
        includeCommunication: true
      });

      const plan = await coordinator.routeRequest(request);

      expect(plan.strategy).toBe('dag');
      expect(plan.agents.length).toBeGreaterThan(3);
      expect(plan.agents).toContain('research');
      expect(plan.agents).toContain('financial-modeling');
      expect(plan.agents).toContain('communicator');
      expect(plan.confidence).toBeGreaterThan(0.6);
    });

    it('should handle security level assessment', async () => {
      const request = createMockRequest('integrity', 'Validate compliance for sensitive data', {
        sensitiveData: true,
        complianceRequired: true
      });

      const plan = await coordinator.routeRequest(request);

      expect(plan.securityLevel).toBe('critical');
      expect(plan.contextSharing.securityValidations.length).toBeGreaterThan(0);
    });

    it('should cache similar requests', async () => {
      const request = createMockRequest('opportunity', 'What is the market size?');

      const plan1 = await coordinator.routeRequest(request);
      const plan2 = await coordinator.routeRequest(request);

      expect(plan1.planId).toBe(plan2.planId); // Should be adapted from cache
      expect(coordinator.getCacheStats().hitRate).toBeGreaterThan(0);
    });
  });

  describe('Performance Optimization', () => {
    it('should reduce token consumption through context optimization', async () => {
      const largeContent = 'A'.repeat(5000); // Large content
      const request = createMockRequest('research', largeContent);

      const plan = await coordinator.routeRequest(request);

      expect(plan.costEstimate).toBeLessThan(1.0); // Should be optimized
      expect(plan.optimizationScore).toBeGreaterThan(0.7);
    });

    it('should estimate duration accurately', async () => {
      const request = createMockRequest('opportunity', 'Simple analysis request');

      const plan = await coordinator.routeRequest(request);

      expect(plan.estimatedDuration).toBeLessThan(10000); // Should be fast
    });
  });
});

// ============================================================================
// Secure Shared Context Tests
// ============================================================================

describe('Secure Shared Context', () => {
  let sharedContext: ReturnType<typeof getSecureSharedContext>;

  beforeEach(() => {
    sharedContext = getSecureSharedContext();
    sharedContext.clearAllContexts();
  });

  afterEach(() => {
    sharedContext.clearAllContexts();
  });

  describe('Context Sharing', () => {
    it('should allow context sharing between compatible agents', async () => {
      const securityContext = createSecurityContext('tenant-123', 'user-456');

      const shareRequest = {
        fromAgent: 'research' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'market-data',
        data: { marketSize: 1000000, growthRate: 0.05 },
        securityContext,
        auditMetadata: { action: 'test-share' }
      };

      const result = await sharedContext.shareContext(shareRequest);

      expect(result).toBe(true);
    });

    it('should deny context sharing between incompatible agents', async () => {
      const securityContext = createSecurityContext('tenant-123', 'user-456');

      const shareRequest = {
        fromAgent: 'integrity' as AgentType,
        toAgent: 'communicator' as AgentType,
        contextKey: 'audit-data',
        data: { auditResults: [] },
        securityContext,
        auditMetadata: { action: 'test-share' }
      };

      const result = await sharedContext.shareContext(shareRequest);

      expect(result).toBe(false);
    });

    it('should validate security permissions', async () => {
      const lowSecurityContext = createSecurityContext('tenant-123', 'user-456');
      lowSecurityContext.permissions = ['data.read']; // Limited permissions

      const shareRequest = {
        fromAgent: 'research' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'sensitive-data',
        data: { confidentialInfo: 'secret' },
        securityContext: lowSecurityContext,
        auditMetadata: { action: 'test-share' }
      };

      const result = await sharedContext.shareContext(shareRequest);

      expect(result).toBe(false);
    });

    it('should retrieve shared context with proper validation', async () => {
      const securityContext = createSecurityContext('tenant-123', 'user-456');

      // First share context
      const shareRequest = {
        fromAgent: 'research' as AgentType,
        toAgent: 'opportunity' as AgentType,
        contextKey: 'market-data',
        data: { marketSize: 1000000 },
        securityContext,
        auditMetadata: { action: 'test-share' }
      };

      await sharedContext.shareContext(shareRequest);

      // Retrieve context
      const retrieved = await sharedContext.retrieveSharedContext(
        'research' as AgentType,
        'opportunity' as AgentType,
        'market-data',
        securityContext
      );

      expect(retrieved).toEqual({ marketSize: 1000000 });
    });
  });

  describe('Context Management', () => {
    it('should create shared context for session', async () => {
      const securityContext = createSecurityContext('tenant-123', 'user-456');

      const sharedContext = await sharedContext.getSharedContext('session-789', securityContext);

      expect(sharedContext.sessionId).toBe('session-789');
      expect(sharedContext.tenantId).toBe('tenant-123');
      expect(sharedContext.userId).toBe('user-456');
    });

    it('should create agent-specific context', async () => {
      const securityContext = createSecurityContext('tenant-123', 'user-456');

      const agentContext = await sharedContext.getAgentContext('opportunity', 'session-789', securityContext);

      expect(agentContext.agentType).toBe('opportunity');
      expect(agentContext.sessionId).toBe('session-789');
      expect(agentContext.permissions).toContain('opportunity.execute');
    });

    it('should cleanup expired contexts', async () => {
      const securityContext = createSecurityContext('tenant-123', 'user-456');

      // Create context that will expire
      await sharedContext.getSharedContext('session-expire', securityContext);

      // Wait for expiration (simulate)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup expired contexts
      sharedContext.clearExpiredContexts();

      const stats = sharedContext.getContextStats();
      expect(stats.sharedContexts).toBe(0);
    });
  });
});

// ============================================================================
// Circuit Breaker Manager Tests
// ============================================================================

describe('Categorized Circuit Breaker Manager', () => {
  let circuitBreakerManager: ReturnType<typeof getCategorizedCircuitBreakerManager>;

  beforeEach(() => {
    circuitBreakerManager = getCategorizedCircuitBreakerManager();
  });

  afterEach(() => {
    circuitBreakerManager.resetAllCircuitBreakers();
  });

  describe('Categorization', () => {
    it('should categorize agents correctly', () => {
      const researchStatus = circuitBreakerManager.getCategoryStatus('data-gathering');
      const valueStatus = circuitBreakerManager.getCategoryStatus('value-analysis');
      const communicationStatus = circuitBreakerManager.getCategoryStatus('communication');
      const validationStatus = circuitBreakerManager.getCategoryStatus('validation');

      expect(researchStatus).toBeDefined();
      expect(valueStatus).toBeDefined();
      expect(communicationStatus).toBeDefined();
      expect(validationStatus).toBeDefined();
    });

    it('should group similar agents together', () => {
      const researchAgent = circuitBreakerManager.getAgentStatus('research');
      const benchmarkAgent = circuitBreakerManager.getAgentStatus('benchmark');
      const companyIntelligenceAgent = circuitBreakerManager.getAgentStatus('company-intelligence');

      // All should be in the same category
      expect(researchAgent?.category).toBe('data-gathering');
      expect(benchmarkAgent?.category).toBe('data-gathering');
      expect(companyIntelligenceAgent?.category).toBe('data-gathering');
    });

    it('should apply category-specific configurations', () => {
      const dataGatheringStats = circuitBreakerManager.getCategoryStatus('data-gathering');
      const validationStats = circuitBreakerManager.getCategoryStatus('validation');

      // Validation should have stricter thresholds
      expect(validationStats?.failureThreshold).toBeLessThan(dataGatheringStats?.failureThreshold);
      expect(validationStats?.timeoutMs).toBeLessThan(dataGatheringStats?.timeoutMs);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics accurately', () => {
      const metrics = circuitBreakerManager.getPerformanceMetrics();

      expect(metrics.totalRequests).toBeGreaterThanOrEqual(0);
      expect(metrics.averageFailureRate).toBeGreaterThanOrEqual(0);
      expect(metrics.categoryPerformance).toBeDefined();
    });

    it('should calculate reliability metrics', () => {
      const metrics = circuitBreakerManager.getPerformanceMetrics();

      Object.values(metrics.categoryPerformance).forEach(category => {
        expect(category.reliability).GreaterThanOrEqual(0);
        expect(category.reliability).LessThanOrEqual(1);
      });
    });
  });
});

// ============================================================================
// Context Optimizer Tests
// ============================================================================

describe('Context Optimizer', () => {
  let contextOptimizer: ReturnType<typeof getContextOptimizer>;

  beforeEach(() => {
    contextOptimizer = getContextOptimizer();
    contextOptimizer.clearExpiredContexts();
  });

  afterEach(() => {
    contextOptimizer.clearExpiredContexts();
  });

  describe('Content Optimization', () => {
    it('should optimize large content', async () => {
      const largeContent = 'This is a very long content that should be optimized to reduce token consumption while preserving important information. '.repeat(100);

      const optimization = await contextOptimizer.optimizeContext('research', 'session-123', largeContent);

      expect(optimization.optimizedSize).toBeLessThan(optimization.originalSize);
      expect(optimization.compression.compressionRatio).toBeLessThan(1.0);
      expect(optimization.optimizationScore).toBeGreaterThan(0.5);
    });

    it('should preserve critical information', async () => {
      const contentWithCritical = 'CRITICAL: This must be preserved. NORMAL: This can be compressed. LOW: This can be removed.';

      const optimization = await contextOptimizer.optimizeContext('integrity', 'session-123', contentWithCritical);

      expect(optimization.retainedContent).toContain('CRITICAL: This must be preserved');
      expect(optimization.discardedContent).toContain('LOW: This can be removed');
    });

    it('should use appropriate compression method', async () => {
      const veryLargeContent = 'A'.repeat(5000);

      const optimization = await contextOptimizer.optimizeContext('research', 'session-123', veryLargeContent);

      expect(optimization.compression.compressionMethod).toBeOneOf(['truncation', 'summarization', 'semantic', 'hybrid']);
      expect(optimization.compression.quality).toBeOneOf(['high', 'medium', 'low']);
    });
  });

  describe('Caching', () => {
    it('should cache optimized content', async () => {
      const content = 'Cacheable content that should be reused';

      const optimization1 = await contextOptimizer.optimizeContext('research', 'session-123', content);
      const optimization2 = await contextOptimizer.optimizeContext('research', 'session-123', content);

      expect(optimization1.windowId).toBe(optimization2.windowId);
      expect(optimization1.optimizedSize).toBe(optimization2.optimizedSize);
    });

    it('should respect cache TTL', async () => {
      const content = 'Content with TTL';

      const optimization = await contextOptimizer.optimizeContext('research', 'session-123', content);

      const stats = contextOptimizer.getOptimizationStats();
      expect(stats.cacheSize).toBe(1);

      // Wait for expiration (simulate)
      await new Promise(resolve => setTimeout(resolve, 100));

      contextOptimizer.clearExpiredContexts();

      const expiredStats = contextOptimizer.getOptimizationStats();
      expect(expiredStats.cacheSize).toBe(0);
    });

    it('should achieve cache hit rate', async () => {
      const content = 'Frequently accessed content';

      // Multiple optimizations of same content
      await contextOptimizer.optimizeContext('research', 'session-123', content);
      await contextOptimizer.optimizeContext('research', 'session-123', content);
      await contextOptimizer.optimizeContext('research', 'session-123', content);

      const stats = contextOptimizer.getOptimizationStats();
      expect(stats.cacheHitRate).toBeGreaterThan(0.5);
    });
  });

  describe('Performance Metrics', () => {
    it('should track optimization statistics', async () => {
      const stats = contextOptimizer.getOptimizationStats();

      expect(stats.activeWindows).toBeGreaterThanOrEqual(0);
      expect(stats.averageCompressionRatio).GreaterThanOrEqual(0);
      expect(stats.averageOptimizationScore).GreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// Enhanced Parallel Executor Tests
// ============================================================================

describe('Enhanced Parallel Executor', () => {
  let executor: ReturnType<typeof getEnhancedParallelExecutor>;

  beforeEach(() => {
    executor = getEnhancedParallelExecutor();
  });

  describe('Task Execution', () => {
    it('should execute single task', async () => {
      const task = {
        id: 'task-1',
        agentType: 'opportunity' as AgentType,
        query: 'Simple test query',
        priority: 'medium' as const,
        dependencies: [],
        estimatedDuration: 5000,
        timeoutMs: 10000,
        retryConfig: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          multiplier: 2,
        },
      };

      const result = await executor.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-1');
      expect(result.agentType).toBe('opportunity');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle task failure gracefully', async () => {
      const task = {
        id: 'task-fail',
        agentType: 'opportunity' as AgentType,
        query: 'This will fail',
        priority: 'low' as const,
        dependencies: [],
        estimatedDuration: 5000,
        timeoutMs: 1000, // Short timeout to force failure
        retryConfig: {
          maxAttempts: 1,
          initialDelay: 100,
          maxDelay: 1000,
          multiplier: 2,
        },
      };

      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Group Execution', () => {
    it('should execute parallel group', async () => {
      const tasks = [
        createMockTask('research', 'Research task 1'),
        createMockTask('benchmark', 'Benchmark task 1'),
        createMockTask('company-intelligence', 'Company task 1'),
      ];

      const group = createParallelGroup('test-group', tasks, {
        executionStrategy: 'parallel',
        maxConcurrency: 3,
      });

      const result = await executor.executeGroup(group, {
        planId: 'test-plan',
        groups: [group],
        executionOrder: [['test-group']],
        totalEstimatedDuration: 15000,
        maxConcurrency: 3,
        resourceRequirements: {
          maxConcurrentAgents: 3,
          memoryRequirement: 'medium',
          tokenRequirement: 3000,
          securityLevel: 'medium',
        },
        riskAssessment: {
          complexity: 'moderate',
          failureProbability: 0.1,
          dataSensitivity: 'medium',
          complianceRisk: 'low',
          recommendations: [],
        },
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should execute sequential group', async () => {
      const tasks = [
        createMockTask('opportunity', 'First task'),
        createMockTask('target', 'Second task'),
        createMockTask('realization', 'Third task'),
      ];

      const group = createParallelGroup('sequential-group', tasks, {
        executionStrategy: 'sequential',
        dependencies: ['task-1', 'task-2'], // task-2 depends on task-1
      });

      const result = await executor.executeGroup(group, {
        planId: 'sequential-plan',
        groups: [group],
        executionOrder: [['sequential-group']],
        totalEstimatedDuration: 15000,
        maxConcurrency: 1,
        resourceRequirements: {
          maxConcurrentAgents: 1,
          memoryRequirement: 'medium',
          tokenRequirement: 3000,
          securityLevel: 'medium',
        },
        riskAssessment: {
          complexity: 'moderate',
          failureProbability: 0.1,
          dataSensitivity: 'medium',
          complianceRisk: 'low',
          recommendations: [],
        },
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should execute pipeline group', async () => {
      const tasks = [
        createMockTask('research', 'Research phase'),
        createMockTask('opportunity', 'Analysis phase'),
        createMockTask('communicator', 'Reporting phase'),
      ];

      const group = createParallelGroup('pipeline-group', tasks, {
        executionStrategy: 'pipeline',
      });

      const result = await executor.executeGroup(group, {
        planId: 'pipeline-plan',
        groups: [group],
        executionOrder: [['pipeline-group']],
        totalEstimatedDuration: 15000,
        maxConcurrency: 1,
        resourceRequirements: {
          maxConcurrentAgents: 1,
          memoryRequirement: 'medium',
          tokenRequirement: 3000,
          securityLevel: 'medium',
        },
        riskAssessment: {
          complexity: 'moderate',
          failureProbability: 0.1,
          dataSensitivity: 'medium',
          complianceRisk: 'low',
          recommendations: [],
        },
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should handle group failures', async () => {
      const tasks = [
        createMockTask('opportunity', 'Task that will succeed'),
        createMockTask('target', 'Task that will fail'),
        createMockTask('realization', 'Task that will fail'),
      ];

      const group = createParallelGroup('failure-group', tasks, {
        executionStrategy: 'parallel',
        maxConcurrency: 3,
      });

      const result = await executor.executeGroup(group, {
        planId: 'failure-plan',
        groups: [group],
        executionOrder: [['failure-group']],
        totalEstimatedDuration: 15000,
        maxConcurrency: 3,
        resourceRequirements: {
          maxConcurrentAgents: 3,
          memoryRequirement: 'medium',
          tokenRequirement: 5000,
          securityLevel: 'medium',
        },
        riskAssessment: {
          complexity: 'moderate',
          failureProbability: 0.6, // High failure probability
          dataSensitivity: 'medium',
          complianceRisk: 'low',
          recommendations: [],
        },
      });

      expect(result.success).toBe(false);
      expect(result.failedGroups).toContain('failure-group');
      expect(result.results).toHaveLength(3);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate parallelism efficiency', async () => {
      const tasks = [
        createMockTask('research', 'Task 1'),
        createMockTask('benchmark', 'Task 2'),
        createMockTask('company-intelligence', 'Task 3'),
        createMockTask('opportunity', 'Task 4'),
        createMockTask('target', 'Task 5'),
      ];

      const group = createParallelGroup('performance-test', tasks, {
        executionStrategy: 'parallel',
        maxConcurrency: 3,
      });

      const result = await executor.executeGroup(group, {
        planId: 'performance-plan',
        groups: [group],
        executionOrder: [['performance-test']],
        totalEstimatedDuration: 25000, // Sequential estimate
        maxConcurrency: 3,
        resourceRequirements: {
          maxConcurrentAgents: 3,
          memoryRequirement: 'high',
          tokenRequirement: 5000,
          securityLevel: 'medium',
        },
        riskAssessment: {
          complexity: 'moderate',
          failureProbability: 0.1,
          dataSensitivity: 'medium',
          complianceRisk: 'low',
          recommendations: [],
        },
      });

      expect(result.performance.parallelismEfficiency).toBeGreaterThan(1.0);
      expect(result.performance.resourceUtilization).toBeGreaterThan(0.5);
      expect(result.performance.throughput).toBeGreaterThan(0);
    });

    it('should handle resource utilization', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createMockTask('opportunity', `Task ${i + 1}`)
      );

      const group = createParallelGroup('resource-test', tasks, {
        executionStrategy: 'parallel',
        maxConcurrency: 5,
      });

      const result = await executor.executeGroup(group, {
        planId: 'resource-plan',
        groups: [group],
        executionOrder: [['resource-test']],
        totalEstimatedDuration: 50000,
        maxConcurrency: 5,
        resourceRequirements: {
          maxConcurrentAgents: 5,
          memoryRequirement: 'high',
          tokenRequirement: 10000,
          securityLevel: 'medium',
        },
        riskAssessment: {
          complexity: 'complex',
          failureProbability: 0.1,
          dataSensitivity: 'medium',
          complianceRisk: 'low',
          recommendations: [],
        },
      });

      expect(result.performance.resourceUtilization).toBeGreaterThan(0.8);
      expect(result.performance.averageTaskDuration).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Agent Optimization Integration', () => {
  let coordinator: ReturnType<typeof getIntelligentCoordinator>;
  let sharedContext: ReturnType<typeof getSecureSharedContext>;
  let circuitBreakerManager: ReturnType<typeof getCategorizedCircuitBreakerManager>;
  let contextOptimizer: ReturnType<typeof getContextOptimizer>;
  let parallelExecutor: ReturnType<typeof getEnhancedParallelExecutor>;

  beforeEach(() => {
    coordinator = getIntelligentCoordinator();
    sharedContext = getSecureSharedContext();
    circuitBreakerManager = getCategorizedCircuitBreakerManager();
    contextOptimizer = getContextOptimizer();
    parallelExecutor = getEnhancedParallelExecutor();

    // Clear all caches
    coordinator.clearCache();
    sharedContext.clearAllContexts();
    circuitBreakerManager.resetAllCircuitBreakers();
    contextOptimizer.clearExpiredContexts();
  });

  it('should optimize end-to-end workflow', async () => {
    // Create a complex workflow
    const tasks = [
      createMockTask('research', 'Research market trends and competitor analysis'),
      createMockTask('opportunity', 'Identify opportunities based on research'),
      createMockTask('target', 'Create financial models and ROI projections'),
      createMockTask('realization', 'Track performance metrics'),
      createMockTask('communicator', 'Generate executive summary'),
    ];

    const group = createParallelGroup('integration-test', tasks, {
      executionStrategy: 'hybrid',
      maxConcurrency: 3,
    });

    const plan = createParallelExecutionPlan([group], {
      riskAssessment: {
        complexity: 'complex',
        failureProbability: 0.15,
        dataSensitivity: 'medium',
        complianceRisk: 'medium',
        recommendations: ['Monitor closely', 'Have rollback plan'],
      },
    });

    const result = await parallelExecutor.executeParallelPlan(plan);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(6);
    expect(result.totalDuration).toBeLessThan(60000); // Should complete in under 1 minute
    expect(result.performance.parallelismEfficiency).toBeGreaterThan(1.5);
  });

  it('should maintain security boundaries throughout optimization', async () => {
    const securityContext = createSecurityContext('tenant-123', 'user-456');

    // Test that security validation is enforced
    const shareRequest = {
      fromAgent: 'research' as AgentType,
      toAgent: 'integrity' as AgentType,
      contextKey: 'test-data',
      data: { sensitive: true },
      securityContext,
      auditMetadata: { action: 'integration-test' },
    };

    const shareResult = await sharedContext.shareContext(shareRequest);
    expect(shareResult).toBe(false);

    // Test that circuit breaker respects security levels
    const integrityStats = circuitBreakerManager.getCategoryStatus('validation');
    expect(integrityStats?.failureThreshold).toBeLessThan(3); // Stricter for validation
  });

  it('should achieve performance improvements', async () => {
    const startTime = Date.now();

    // Execute optimized workflow
    const tasks = [
      createMockTask('research', 'Quick research task'),
      createMockTask('opportunity', 'Quick opportunity analysis'),
      createMockTask('communicator', 'Quick summary'),
    ];

    const group = createParallelGroup('performance-integration', tasks, {
      executionStrategy: 'parallel',
      maxConcurrency: 3,
    });

    const plan = createParallelExecutionPlan([group]);
    const result = await parallelExecutor.executeParallelPlan(plan);

    const duration = Date.now() - startTime;

    // Should complete quickly due to optimization
    expect(duration).toBeLessThan(30000); // Under 30 seconds
    expect(result.performance.parallelismEfficiency).toBeGreaterThan(1.2);
    expect(result.totalTokens).toBeLessThan(5000); // Reduced token usage
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

function createMockTask(agentType: AgentType, query: string, options: Partial<ParallelTask> = {}): ParallelTask {
  return {
    id: `task-${agentType}-${Date.now()}`,
    agentType,
    query,
    priority: 'medium',
    dependencies: [],
    estimatedDuration: 5000,
    timeoutMs: 10000,
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2,
    },
    ...options,
  };
}

function createMockTask(agentType: AgentType, query: string, options: Partial<ParallelTask> = {}): ParallelTask {
  return {
    id: `task-${agentType}-${Date.now()}`,
    agentType,
    query,
    priority: 'medium',
    dependencies: [],
    estimatedDuration: 5000,
    timeoutMs: 10000,
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2,
    },
    ...options,
  };
}
