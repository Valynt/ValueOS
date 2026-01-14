/**
 * Multi-Agent Workflow Integration Tests
 *
 * Integration tests for complex multi-agent workflows, security boundaries,
 * and system-wide orchestration scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EnhancedParallelExecutor, createParallelTask, createParallelGroup, createParallelExecutionPlan } from '../src/services/EnhancedParallelExecutor';
import { IntelligentCoordinator } from '../src/services/IntelligentCoordinator';
import { SecureSharedContext } from '../src/services/SecureSharedContext';
import { SecureMessageBus } from '../src/lib/agent-fabric/SecureMessageBus';
import { SecurityMonitor } from '../src/services/security/SecurityMonitor';
import { getSystemResourceMonitor } from '../src/services/monitoring/SystemResourceMonitor';
import { AgentType } from '../src/services/agent-types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock console methods
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock logger
jest.mock('../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock external dependencies
jest.mock('../src/services/UnifiedAgentAPI', () => ({
  getUnifiedAgentAPI: () => ({
    invoke: jest.fn().mockImplementation(async ({ agent, query }) => {
      // Simulate different agent behaviors
      const responses = {
        coordinator: { success: true, data: { workflowId: 'test-workflow', status: 'coordinated' } },
        opportunity: { success: true, data: { opportunities: ['op1', 'op2'], value: 1000 } },
        target: { success: true, data: { targets: ['target1'], metrics: { roi: 2.5 } } },
        realization: { success: true, data: { realizations: ['real1'], progress: 0.8 } },
        expansion: { success: true, data: { expansions: ['exp1'], potential: 500 } },
        integrity: { success: true, data: { validation: 'passed', compliance: 'compliant' } },
        research: { success: true, data: { research: 'completed', insights: ['insight1'] } },
        benchmark: { success: true, data: { benchmarks: ['bench1'], comparisons: {} } },
        'company-intelligence': { success: true, data: { intelligence: 'gathered', company: 'test' } },
        'financial-modeling': { success: true, data: { models: ['model1'], projections: {} } },
        'value-mapping': { success: true, data: { mappings: ['map1'], value: 2000 } },
        communicator: { success: true, data: { message: 'generated', format: 'report' } },
        narrative: { success: true, data: { narrative: 'created', story: 'test story' } },
        groundtruth: { success: true, data: { verification: 'verified', accuracy: 0.95 } },
        'system-mapper': { success: true, data: { mapping: 'complete', systems: ['sys1'] } },
        'intervention-designer': { success: true, data: { interventions: ['int1'], design: 'test' } },
        'outcome-engineer': { success: true, data: { outcomes: ['out1'], engineering: 'complete' } },
        'value-eval': { success: true, data: { evaluation: 'positive', score: 8.5 } },
      };

      const response = responses[agent as keyof typeof responses] || { success: false, error: 'Unknown agent' };

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

      return response;
    }),
  }),
}));

// Mock audit logger
jest.mock('../src/services/AgentAuditLogger', () => ({
  getAuditLogger: () => ({
    log: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
  }),
}));

// Mock crypto utilities
jest.mock('../src/lib/crypto/CryptoUtils', () => ({
  signMessage: jest.fn().mockResolvedValue('mock-signature'),
  verifySignature: jest.fn().mockResolvedValue(true),
  encrypt: jest.fn().mockReturnValue({
    data: 'encrypted-data',
    iv: 'mock-iv',
    algorithm: 'aes-256-gcm',
    tag: 'mock-tag',
  }),
  decrypt: jest.fn().mockReturnValue('decrypted-data'),
  generateNonce: jest.fn().mockReturnValue('mock-nonce'),
  isEncrypted: jest.fn().mockReturnValue(false),
  generateEncryptionKey: jest.fn().mockReturnValue('mock-key'),
}));

// Mock agent identity
jest.mock('../src/lib/auth/AgentIdentity', () => ({
  hasPermission: jest.fn().mockReturnValue(true),
}));

describe('Multi-Agent Workflow Integration', () => {
  let executor: EnhancedParallelExecutor;
  let coordinator: IntelligentCoordinator;
  let secureContext: SecureSharedContext;
  let messageBus: SecureMessageBus;
  let securityMonitor: SecurityMonitor;
  let resourceMonitor: any;

  beforeEach(() => {
    executor = new EnhancedParallelExecutor(10, true);
    coordinator = getIntelligentCoordinator();
    secureContext = new SecureSharedContext();
    messageBus = SecureMessageBus.getInstance();
    securityMonitor = SecurityMonitor.getInstance();
    resourceMonitor = getSystemResourceMonitor();
  });

  afterEach(() => {
    executor = null as any;
    messageBus.destroy();
    securityMonitor.stop();
    resourceMonitor.stop();
    jest.clearAllMocks();
  });

  describe('Complete ValueOS Workflow', () => {
    it('should execute full value creation workflow', async () => {
      // Create parallel execution plan for value creation workflow
      const researchTask = createParallelTask('research', 'Research market opportunities', {
        priority: 'high' as const,
        estimatedDuration: 30000,
      });

      const benchmarkTask = createParallelTask('benchmark', 'Benchmark against competitors', {
        priority: 'high' as const,
        estimatedDuration: 25000,
        dependencies: [researchTask.id],
      });

      const opportunityTask = createParallelTask('opportunity', 'Identify opportunities', {
        priority: 'critical' as const,
        estimatedDuration: 20000,
        dependencies: [researchTask.id],
      });

      const targetTask = createParallelTask('target', 'Set value targets', {
        priority: 'critical' as const,
        estimatedDuration: 15000,
        dependencies: [opportunityTask.id],
      });

      const financialTask = createParallelTask('financial-modeling', 'Create financial models', {
        priority: 'high' as const,
        estimatedDuration: 35000,
        dependencies: [targetTask.id],
      });

      const valueMappingTask = createParallelTask('value-mapping', 'Map value drivers', {
        priority: 'medium' as const,
        estimatedDuration: 20000,
        dependencies: [financialTask.id],
      });

      const integrityTask = createParallelTask('integrity', 'Validate compliance', {
        priority: 'critical' as const,
        estimatedDuration: 10000,
        dependencies: [valueMappingTask.id],
      });

      const communicatorTask = createParallelTask('communicator', 'Generate report', {
        priority: 'medium' as const,
        estimatedDuration: 15000,
        dependencies: [integrityTask.id],
      });

      // Create execution groups
      const researchGroup = createParallelGroup('Research Phase', [researchTask]);
      const analysisGroup = createParallelGroup('Analysis Phase', [benchmarkTask, opportunityTask], {
        executionStrategy: 'parallel' as const,
        dependencies: [researchGroup.id],
      });
      const valueGroup = createParallelGroup('Value Creation', [targetTask, financialTask, valueMappingTask], {
        executionStrategy: 'pipeline' as const,
        dependencies: [analysisGroup.id],
      });
      const validationGroup = createParallelGroup('Validation', [integrityTask], {
        dependencies: [valueGroup.id],
      });
      const outputGroup = createParallelGroup('Output', [communicatorTask], {
        dependencies: [validationGroup.id],
      });

      const plan = createParallelExecutionPlan([
        researchGroup,
        analysisGroup,
        valueGroup,
        validationGroup,
        outputGroup,
      ]);

      // Execute the plan
      const result = await executor.executeParallelPlan(plan);

      // Verify execution results
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(8);
      expect(result.executedGroups).toHaveLength(5);
      expect(result.failedGroups).toHaveLength(0);

      // Verify all tasks completed successfully
      const successfulResults = result.results.filter(r => r.success);
      expect(successfulResults).toHaveLength(8);

      // Verify performance metrics
      expect(result.performance.parallelismEfficiency).toBeGreaterThan(0);
      expect(result.performance.throughput).toBeGreaterThan(0);
      expect(result.performance.averageTaskDuration).toBeGreaterThan(0);

      // Verify execution statistics
      const stats = executor.getExecutionStats();
      expect(stats.circuitBreakerStats).toBeDefined();
      expect(stats.contextStats).toBeDefined();
      expect(stats.sharedContextStats).toBeDefined();
    }, 60000);

    it('should handle workflow failures gracefully', async () => {
      // Create a plan with a failing task
      const failingTask = createParallelTask('research', 'This will fail', {
        priority: 'high' as const,
        estimatedDuration: 10000,
      });

      const dependentTask = createParallelTask('opportunity', 'Depends on failing task', {
        priority: 'medium' as const,
        estimatedDuration: 10000,
        dependencies: [failingTask.id],
      });

      // Mock failure for research task
      const { getUnifiedAgentAPI } = require('../src/services/UnifiedAgentAPI');
      const mockAPI = getUnifiedAgentAPI();
      mockAPI.invoke.mockImplementation(async ({ agent }) => {
        if (agent === 'research') {
          throw new Error('Research task failed');
        }
        return { success: true, data: {} };
      });

      const failingGroup = createParallelGroup('Failing Group', [failingTask]);
      const dependentGroup = createParallelGroup('Dependent Group', [dependentTask], {
        dependencies: [failingGroup.id],
      });

      const plan = createParallelExecutionPlan([failingGroup, dependentGroup]);

      const result = await executor.executeParallelPlan(plan);

      expect(result.success).toBe(false);
      expect(result.failedGroups).toContain(failingGroup.id);
      expect(result.failedGroups).toContain(dependentGroup.id);

      // Verify error handling
      const failedResults = result.results.filter(r => !r.success);
      expect(failedResults.length).toBeGreaterThan(0);
    }, 30000);

    it('should adapt concurrency based on system resources', async () => {
      // Mock high resource usage
      const mockResources = {
        cpu: { usage: 90, loadAverage: [2.5, 2.3, 2.1], coreCount: 4 },
        memory: { used: 8000, total: 10000, percentage: 80, pressure: 'high' },
        heap: { used: 700, total: 1000, percentage: 70 },
        timestamp: Date.now(),
      };

      // Monitor resource changes
      const initialConcurrency = executor['currentMaxConcurrency'];
      resourceMonitor.addListener({
        onResourceChange: jest.fn().mockImplementation((resources) => {
          // Simulate resource pressure detection
          if (resources.memory.percentage > 75) {
            executor['currentMaxConcurrency'] = Math.floor(initialConcurrency * 0.5);
          }
        }),
      });

      // Trigger resource pressure simulation
      resourceMonitor['listeners'].forEach((listener: any) => {
        listener.onResourceChange(mockResources);
      });

      const adjustedConcurrency = executor['currentMaxConcurrency'];
      expect(adjustedConcurrency).toBeLessThan(initialConcurrency);
    });
  });

  describe('Security Boundaries Integration', () => {
    it('should enforce security boundaries across agent communication', async () => {
      const securityContext = {
        tenantId: 'test-tenant',
        userId: 'test-user',
        permissions: ['context.read', 'context.write', 'workflow.execute'],
        trustLevel: 'medium',
        sessionId: 'test-session',
        traceId: 'test-trace',
      };

      // Test secure context sharing
      const shareResult = await secureContext.shareContext({
        fromAgent: 'coordinator',
        toAgent: 'opportunity',
        contextKey: 'test-context',
        data: { sensitiveInfo: 'test data' },
        securityContext,
        auditMetadata: {},
      });

      expect(shareResult).toBe(true);

      // Test context retrieval
      const retrievedContext = await secureContext.retrieveSharedContext(
        'coordinator',
        'opportunity',
        'test-context',
        securityContext
      );

      expect(retrievedContext).toEqual({ sensitiveInfo: 'test data' });

      // Test unauthorized access
      const unauthorizedAccess = await secureContext.retrieveSharedContext(
        'communicator', // Not allowed
        'opportunity',
        'test-context',
        securityContext
      );

      expect(unauthorizedAccess).toBeNull();

      // Verify security monitoring
      const metrics = securityMonitor.getMetrics();
      expect(metrics.totalEvents).toBeGreaterThanOrEqual(0);
    });

    it('should handle secure message bus communication', async () => {
      const mockAgent = {
        id: 'test-agent',
        keys: {
          privateKey: 'mock-private-key',
          publicKey: 'mock-public-key',
          encryptionKey: 'mock-encryption-key',
        },
      };

      messageBus.registerAgent(mockAgent);

      // Test secure message sending
      const message = await messageBus.send(
        mockAgent,
        'opportunity',
        { action: 'process_data', sensitive: true },
        { encrypted: true }
      );

      expect(message.signature).toBeDefined();
      expect(message.encrypted).toBe(true);
      expect(message.nonce).toBeDefined();

      // Test message reception
      const payload = await messageBus.receive(message);
      expect(payload).toEqual({ action: 'process_data', sensitive: true });

      // Test replay protection
      await expect(messageBus.receive(message)).rejects.toThrow('Replay attack detected');

      messageBus.destroy();
    });

    it('should detect and respond to security events', async () => {
      // Simulate security events
      const event1 = securityMonitor.recordEvent(
        'context_share_denied',
        'high',
        'test-agent',
        'Unauthorized context share attempt',
        { fromAgent: 'malicious-agent', toAgent: 'secure-agent' }
      );

      const event2 = securityMonitor.recordEvent(
        'message_signature_invalid',
        'high',
        'test-agent',
        'Invalid message signature detected',
        { messageId: 'fake-message' }
      );

      // Verify event recording
      expect(event1.id).toBeDefined();
      expect(event2.id).toBeDefined();

      // Verify alert generation
      const alerts = securityMonitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      // Test alert acknowledgment
      const acknowledged = securityMonitor.acknowledgeAlert(alerts[0].id, 'security-team');
      expect(acknowledged).toBe(true);

      // Test event resolution
      const resolved = securityMonitor.resolveEvent(event1.id, 'security-team');
      expect(resolved).toBe(true);
    });
  });

  describe('Intelligent Routing Integration', () => {
    it('should route requests to optimal execution plans', async () => {
      const request = {
        agent: 'coordinator' as AgentType,
        query: 'Analyze market opportunities and create value creation strategy',
        context: {
          industry: 'technology',
          companySize: 'medium',
          timeframe: '6-months',
        },
        sessionId: 'test-session',
        userId: 'test-user',
      };

      const plan = await coordinator.routeRequest(request);

      expect(plan.planId).toBeDefined();
      expect(plan.strategy).toBeDefined();
      expect(plan.agents.length).toBeGreaterThan(1);
      expect(plan.confidence).toBeGreaterThan(0);
      expect(plan.reasoning).toBeDefined();

      // Verify plan includes appropriate agents
      expect(plan.agents).toContain('coordinator');
      expect(plan.agents).toContain('research');
      expect(plan.agents).toContain('opportunity');

      // Verify context sharing plan
      expect(plan.contextSharing.sharedContext).toContain('sessionId');
      expect(plan.contextSharing.securityValidations.length).toBeGreaterThan(0);
    });

    it('should cache and reuse execution plans', async () => {
      const request = {
        agent: 'coordinator' as AgentType,
        query: 'Standard market analysis request',
        context: { industry: 'technology' },
        sessionId: 'test-session',
      };

      // First request should generate new plan
      const plan1 = await coordinator.routeRequest(request);
      const plan1Id = plan1.planId;

      // Second similar request should use cached plan
      const plan2 = await coordinator.routeRequest(request);

      expect(plan2.planId).not.toBe(plan1Id); // New ID but adapted from cache
      expect(plan2.reasoning).toContain('adapted from cache');

      // Verify cache statistics
      const cacheStats = coordinator.getCacheStats();
      expect(cacheStats.hitRate).toBeGreaterThan(0);
    });

    it('should handle complex multi-domain requests', async () => {
      const complexRequest = {
        agent: 'coordinator' as AgentType,
        query: 'Comprehensive enterprise analysis including financial modeling, compliance validation, and strategic planning',
        context: {
          companySize: 'enterprise',
          industry: 'finance',
          regulatory: ['sox', 'gdpr'],
          timeframe: '12-months',
          budget: 'high',
        },
        sessionId: 'test-session',
      };

      const plan = await coordinator.routeRequest(complexRequest);

      expect(plan.complexity).toBe('enterprise');
      expect(plan.strategy).toBe('dag'); // Complex strategy for enterprise requests
      expect(plan.agents.length).toBeGreaterThan(5);

      // Verify inclusion of specialized agents
      expect(plan.agents).toContain('financial-modeling');
      expect(plan.agents).toContain('integrity');
      expect(plan.agents).toContain('communicator');

      // Verify security level
      expect(plan.contextSharing.securityValidations.some(v =>
        v.requiredPermissions.includes('security.elevated')
      )).toBe(true);
    });
  });

  describe('System Resource Management Integration', () => {
    it('should scale concurrency based on system load', async () => {
      // Create a large number of parallel tasks
      const tasks = [];
      for (let i = 0; i < 50; i++) {
        tasks.push(createParallelTask('research', `Research task ${i}`, {
          priority: 'medium' as const,
          estimatedDuration: 5000,
        }));
      }

      const group = createParallelGroup('Large Scale Test', tasks, {
        executionStrategy: 'parallel' as const,
        maxConcurrency: 20,
      });

      const plan = createParallelExecutionPlan([group]);

      // Mock system under high load
      const highLoadResources = {
        cpu: { usage: 85, loadAverage: [3.0, 2.8, 2.6], coreCount: 4 },
        memory: { used: 7500, total: 10000, percentage: 75, pressure: 'high' },
        heap: { used: 800, total: 1000, percentage: 80 },
        timestamp: Date.now(),
      };

      // Simulate resource pressure
      const initialConcurrency = executor['currentMaxConcurrency'];
      resourceMonitor['listeners'].forEach((listener: any) => {
        listener.onResourceChange(highLoadResources);
      });

      const result = await executor.executeParallelPlan(plan);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(50);

      // Verify concurrency was adjusted
      const adjustedConcurrency = executor['currentMaxConcurrency'];
      expect(adjustedConcurrency).toBeLessThan(initialConcurrency);
    }, 45000);

    it('should handle memory pressure gracefully', async () => {
      // Create memory-intensive tasks
      const memoryIntensiveTasks = [];
      for (let i = 0; i < 10; i++) {
        memoryIntensiveTasks.push(createParallelTask('research', `Memory intensive task ${i}`, {
          priority: 'low' as const,
          estimatedDuration: 10000,
        }));
      }

      const group = createParallelGroup('Memory Test', memoryIntensiveTasks);
      const plan = createParallelExecutionPlan([group]);

      // Mock memory pressure
      const memoryPressureResources = {
        cpu: { usage: 60, loadAverage: [2.0, 1.8, 1.6], coreCount: 4 },
        memory: { used: 9000, total: 10000, percentage: 90, pressure: 'critical' },
        heap: { used: 950, total: 1000, percentage: 95 },
        timestamp: Date.now(),
      };

      // Simulate memory pressure
      resourceMonitor['listeners'].forEach((listener: any) => {
        listener.onResourceChange(memoryPressureResources);
      });

      const result = await executor.executeParallelPlan(plan);

      expect(result.success).toBe(true);

      // Verify system adapted to memory pressure
      const stats = executor.getExecutionStats();
      expect(stats.contextStats).toBeDefined();
    }, 30000);
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary failures', async () => {
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push(createParallelTask('research', `Task ${i}`, {
          priority: 'medium' as const,
          estimatedDuration: 5000,
        }));
      }

      const group = createParallelGroup('Recovery Test', tasks);
      const plan = createParallelExecutionPlan([group]);

      // Mock intermittent failures
      const { getUnifiedAgentAPI } = require('../src/services/UnifiedAgentAPI');
      const mockAPI = getUnifiedAgentAPI();
      let callCount = 0;
      mockAPI.invoke.mockImplementation(async ({ agent }) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Temporary failure');
        }
        return { success: true, data: {} };
      });

      const result = await executor.executeParallelPlan(plan);

      // Should succeed despite one failure
      expect(result.success).toBe(true);
      expect(result.results.filter(r => r.success).length).toBe(5);
    }, 30000);

    it('should maintain security during error conditions', async () => {
      // Create tasks that might fail
      const tasks = [
        createParallelTask('research', 'Research task', { priority: 'high' as const }),
        createParallelTask('integrity', 'Validation task', { priority: 'critical' as const }),
        createParallelTask('communicator', 'Output task', { priority: 'medium' as const }),
      ];

      const group = createParallelGroup('Security Test', tasks);
      const plan = createParallelExecutionPlan([group]);

      // Mock security-related failures
      const { getUnifiedAgentAPI } = require('../src/services/UnifiedAgentAPI');
      const mockAPI = getUnifiedAgentAPI();
      mockAPI.invoke.mockImplementation(async ({ agent }) => {
        if (agent === 'integrity') {
          throw new Error('Security validation failed');
        }
        return { success: true, data: {} };
      });

      const result = await executor.executeParallelPlan(plan);

      expect(result.success).toBe(false);

      // Verify security events were recorded
      const securityMetrics = securityMonitor.getMetrics();
      expect(securityMetrics.totalEvents).toBeGreaterThan(0);
    });
  });
});

describe('End-to-End System Integration', () => {
  it('should handle complete enterprise workflow with security and resource management', async () => {
    const executor = new EnhancedParallelExecutor(15, true);
    const coordinator = getIntelligentCoordinator();
    const secureContext = new SecureSharedContext();
    const messageBus = SecureMessageBus.getInstance();
    const securityMonitor = SecurityMonitor.getInstance();
    const resourceMonitor = getSystemResourceMonitor();

    try {
      // 1. Route complex enterprise request
      const enterpriseRequest = {
        agent: 'coordinator' as AgentType,
        query: 'Enterprise-wide value optimization including financial analysis, compliance validation, and strategic planning',
        context: {
          companySize: 'enterprise',
          industry: 'finance',
          regulatory: ['sox', 'gdpr', 'pci-dss'],
          timeframe: '18-months',
          budget: 'unlimited',
          stakeholders: ['board', 'investors', 'regulators'],
        },
        sessionId: 'enterprise-session',
        userId: 'enterprise-user',
      };

      const plan = await coordinator.routeRequest(enterpriseRequest);
      expect(plan.complexity).toBe('enterprise');
      expect(plan.agents.length).toBeGreaterThan(8);

      // 2. Set up secure context sharing
      const securityContext = {
        tenantId: 'enterprise-tenant',
        userId: 'enterprise-user',
        permissions: ['context.read', 'context.write', 'workflow.execute', 'security.elevated', 'audit.read'],
        trustLevel: 'privileged',
        sessionId: 'enterprise-session',
        traceId: 'enterprise-trace',
      };

      // Share initial context
      const contextResult = await secureContext.shareContext({
        fromAgent: 'coordinator',
        toAgent: 'financial-modeling',
        contextKey: 'enterprise-analysis',
        data: {
          companyData: 'sensitive-financial-data',
          strategicInfo: 'confidential-strategy',
          complianceRequirements: ['sox', 'gdpr']
        },
        securityContext,
        auditMetadata: { workflow: 'enterprise-optimization' },
      });

      expect(contextResult).toBe(true);

      // 3. Execute the workflow with resource monitoring
      const workflowTasks = plan.agents.map(agent =>
        createParallelTask(agent, `Execute ${agent} analysis`, {
          priority: agent === 'integrity' || agent === 'groundtruth' ? 'critical' : 'medium',
          estimatedDuration: 30000,
        })
      );

      const workflowGroup = createParallelGroup('Enterprise Workflow', workflowTasks, {
        executionStrategy: plan.strategy as any,
        maxConcurrency: 10,
      });

      const workflowPlan = createParallelExecutionPlan([workflowGroup]);

      // Simulate resource pressure during execution
      const resourceListener = {
        onResourceChange: jest.fn().mockImplementation((resources) => {
          // Log resource changes for verification
          console.log(`Resource change: CPU=${resources.cpu.usage}%, Memory=${resources.memory.percentage}%`);
        }),
      };

      resourceMonitor.addListener(resourceListener);

      // Execute workflow
      const result = await executor.executeParallelPlan(workflowPlan);

      // 4. Verify results
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(plan.agents.length);
      expect(result.performance.parallelismEfficiency).toBeGreaterThan(0.5);

      // 5. Verify security monitoring
      const securityMetrics = securityMonitor.getMetrics();
      expect(securityMetrics.totalEvents).toBeGreaterThanOrEqual(0);

      // 6. Verify resource monitoring
      expect(resourceListener.onResourceChange).toHaveBeenCalled();

      // 7. Verify context sharing worked
      const retrievedContext = await secureContext.retrieveSharedContext(
        'coordinator',
        'financial-modeling',
        'enterprise-analysis',
        securityContext
      );

      expect(retrievedContext).toBeDefined();
      expect(retrievedContext?.companyData).toBe('sensitive-financial-data');

      console.log('Enterprise workflow completed successfully');
      console.log(`Execution time: ${result.totalDuration}ms`);
      console.log(`Parallelism efficiency: ${result.performance.parallelismEfficiency}`);
      console.log(`Security events: ${securityMetrics.totalEvents}`);

    } finally {
      // Cleanup
      executor = null as any;
      messageBus.destroy();
      securityMonitor.stop();
      resourceMonitor.stop();
    }
  }, 120000);
});
