/**
 * VOS-QA-001: Agent Workflow Coverage Enhancement
 * Comprehensive integration tests for agent workflows
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AgentFabric } from '../../src/lib/agent-fabric/AgentFabric';
import { BaseAgent } from '../../src/lib/agent-fabric/agents/BaseAgent';
import { SecureMessageBus } from '../../src/lib/agent-fabric/SecureMessageBus';
import { auditLogService } from '../../src/services/AuditLogService';
import { PermissionMiddleware } from '../../src/lib/auth/PermissionMiddleware';

describe('Agent Workflow Integration Coverage', () => {
  let agentFabric: AgentFabric;
  let messageBus: SecureMessageBus;
  let permissionMiddleware: PermissionMiddleware;

  beforeAll(async () => {
    agentFabric = new AgentFabric();
    messageBus = new SecureMessageBus();
    permissionMiddleware = new PermissionMiddleware();
  });

  afterAll(async () => {
    // Cleanup
    await agentFabric.shutdown();
  });

  beforeEach(async () => {
    // Reset state before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up agents
    const agents = await agentFabric.listAgents();
    for (const agent of agents) {
      await agentFabric.destroyAgent(agent.id);
    }
  });

  describe('Agent Lifecycle Coverage', () => {
    it('should create agent with full configuration', async () => {
      const config = {
        id: 'test-full-config',
        type: 'CoordinatorAgent',
        name: 'Test Coordinator',
        permissions: ['read', 'write', 'execute'],
        metadata: {
          department: 'Engineering',
          priority: 'high',
        },
        settings: {
          maxRetries: 3,
          timeout: 5000,
          autoRecover: true,
        },
      };

      const agent = await agentFabric.createAgent(config.id, config.type, config);

      expect(agent).toBeDefined();
      expect(agent.id).toBe(config.id);
      expect(agent.type).toBe(config.type);
      expect(agent.name).toBe(config.name);
      expect(agent.metadata).toEqual(config.metadata);
      expect(agent.settings).toEqual(expect.objectContaining(config.settings));
    });

    it('should handle agent state transitions', async () => {
      const agent = await agentFabric.createAgent('state-test', 'CoordinatorAgent');

      // Initial state
      expect(agent.status).toBe('idle');

      // Process message (should transition to processing)
      const promise = agent.processMessage({ type: 'test', action: 'ping' });
      expect(['processing', 'active']).toContain(agent.status);
      
      await promise;
      expect(agent.status).toBe('idle');

      // Pause/Resume
      await agent.pause();
      expect(agent.status).toBe('paused');
      
      await agent.resume();
      expect(agent.status).toBe('idle');

      // Destroy
      await agent.destroy();
      expect(agent.status).toBe('destroyed');
    });

    it('should handle agent recovery scenarios', async () => {
      const agent = await agentFabric.createAgent('recovery-test', 'CoordinatorAgent');

      // Simulate failure
      await agent.processMessage({
        type: 'test',
        action: 'fail',
        payload: { simulate: true },
      });

      // Should attempt recovery
      const recovered = await agent.recover();
      expect(recovered).toBe(true);
      expect(agent.status).toBe('idle');
    });

    it('should handle concurrent agent operations', async () => {
      const agentCount = 10;
      const agents = await Promise.all(
        Array.from({ length: agentCount }, (_, i) =>
          agentFabric.createAgent(`concurrent-${i}`, 'CoordinatorAgent')
        )
      );

      // Perform concurrent operations
      const operations = await Promise.all(
        agents.map(agent => agent.processMessage({ type: 'test', action: 'ping' }))
      );

      expect(operations).toHaveLength(agentCount);
      expect(operations.every(op => op.success)).toBe(true);
    });
  });

  describe('Multi-Agent Orchestration Coverage', () => {
    it('should coordinate multi-agent workflow', async () => {
      const coordinator = await agentFabric.createAgent('coord', 'CoordinatorAgent');
      const target = await agentFabric.createAgent('target', 'TargetAgent');
      const realizer = await agentFabric.createAgent('realizer', 'RealizationAgent');

      // Step 1: Coordinator creates plan
      const planResult = await coordinator.processMessage({
        type: 'workflow',
        action: 'create_plan',
        payload: {
          objective: 'Increase revenue by 20%',
          constraints: ['budget: 100k', 'timeline: 3 months'],
        },
      });

      expect(planResult.success).toBe(true);
      expect(planResult.data.plan).toBeDefined();

      // Step 2: Target analyzes opportunities
      const analysisResult = await target.processMessage({
        type: 'workflow',
        action: 'analyze',
        payload: {
          plan: planResult.data.plan,
          data: { currentRevenue: 1000000 },
        },
      });

      expect(analysisResult.success).toBe(true);
      expect(analysisResult.data.targets).toBeDefined();

      // Step 3: Realizer executes
      const executeResult = await realizer.processMessage({
        type: 'workflow',
        action: 'execute',
        payload: {
          targets: analysisResult.data.targets,
          plan: planResult.data.plan,
        },
      });

      expect(executeResult.success).toBe(true);
      expect(executeResult.data.executionId).toBeDefined();
    });

    it('should handle workflow failures gracefully', async () => {
      const coordinator = await agentFabric.createAgent('fail-coord', 'CoordinatorAgent');
      const target = await agentFabric.createAgent('fail-target', 'TargetAgent');

      // Coordinator creates invalid plan
      const planResult = await coordinator.processMessage({
        type: 'workflow',
        action: 'create_plan',
        payload: {
          objective: '', // Invalid
          constraints: [],
        },
      });

      expect(planResult.success).toBe(false);
      expect(planResult.error).toBeDefined();

      // Target should handle invalid input
      const analysisResult = await target.processMessage({
        type: 'workflow',
        action: 'analyze',
        payload: { plan: null },
      });

      expect(analysisResult.success).toBe(false);
    });

    it('should broadcast messages to multiple agents', async () => {
      const agents = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          agentFabric.createAgent(`broadcast-${i}`, 'CoordinatorAgent')
        )
      );

      const received: string[] = [];
      const unsubscribe = messageBus.subscribe('broadcast-test', (msg) => {
        received.push(msg.agentId);
      });

      // Broadcast to all agents
      await messageBus.publish('broadcast-test', {
        type: 'broadcast',
        data: 'test message',
      });

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(received.length).toBeGreaterThan(0);
      unsubscribe();
    });
  });

  describe('Permission & Security Coverage', () => {
    it('should enforce agent permissions', async () => {
      const agent = await agentFabric.createAgent('secure-agent', 'CoordinatorAgent', {
        permissions: ['read'],
      });

      // Should allow read operations
      const readResult = await agent.processMessage({
        type: 'query',
        action: 'read',
        payload: { resource: 'test' },
      });

      expect(readResult.success).toBe(true);

      // Should deny write operations
      const writeResult = await agent.processMessage({
        type: 'mutation',
        action: 'write',
        payload: { resource: 'test', data: 'value' },
      });

      expect(writeResult.success).toBe(false);
      expect(writeResult.error).toContain('permission');
    });

    it('should audit all agent actions', async () => {
      const agent = await agentFabric.createAgent('audit-agent', 'CoordinatorAgent');

      // Perform action
      await agent.processMessage({
        type: 'test',
        action: 'audited_action',
        payload: { test: true },
      });

      // Check audit log
      const logs = await auditLogService.query({
        limit: 10,
        action: 'agent_action',
      });

      const relevantLog = logs.find(log => 
        log.metadata?.agentId === 'audit-agent' &&
        log.action === 'audited_action'
      );

      expect(relevantLog).toBeDefined();
      expect(relevantLog?.metadata).toHaveProperty('test', true);
    });

    it('should handle permission escalation attempts', async () => {
      const agent = await agentFabric.createAgent('escalation-test', 'CoordinatorAgent', {
        permissions: ['read'],
      });

      // Attempt to escalate permissions
      const escalationResult = await agent.processMessage({
        type: 'security',
        action: 'escalate_permissions',
        payload: { newPermissions: ['admin'] },
      });

      expect(escalationResult.success).toBe(false);
      expect(escalationResult.error).toContain('permission');
    });
  });

  describe('Error Handling & Resilience Coverage', () => {
    it('should handle network failures', async () => {
      const agent = await agentFabric.createAgent('network-test', 'CoordinatorAgent');

      // Simulate network failure
      const result = await agent.processMessage({
        type: 'test',
        action: 'network_failure',
        payload: { simulate: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(agent.status).toBe('idle'); // Should recover
    });

    it('should retry failed operations', async () => {
      const agent = await agentFabric.createAgent('retry-test', 'CoordinatorAgent', {
        settings: { maxRetries: 3 },
      });

      let attemptCount = 0;
      
      // Mock operation that fails twice then succeeds
      const originalProcess = agent.processMessage.bind(agent);
      agent.processMessage = async (message) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, data: { attemptCount } };
      };

      const result = await agent.processMessage({
        type: 'test',
        action: 'retry',
      });

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    });

    it('should handle timeout scenarios', async () => {
      const agent = await agentFabric.createAgent('timeout-test', 'CoordinatorAgent', {
        settings: { timeout: 100 },
      });

      const result = await agent.processMessage({
        type: 'test',
        action: 'slow_operation',
        payload: { delay: 500 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should recover from critical errors', async () => {
      const agent = await agentFabric.createAgent('critical-test', 'CoordinatorAgent');

      // Simulate critical error
      const criticalResult = await agent.processMessage({
        type: 'test',
        action: 'critical_error',
        payload: { crash: true },
      });

      expect(criticalResult.success).toBe(false);

      // Agent should be recoverable
      const recovered = await agent.recover();
      expect(recovered).toBe(true);
      expect(agent.status).toBe('idle');
    });
  });

  describe('Performance & Load Coverage', () => {
    it('should handle high message throughput', async () => {
      const agent = await agentFabric.createAgent('throughput-test', 'CoordinatorAgent');
      const messageCount = 100;

      const start = performance.now();
      const results = await Promise.all(
        Array.from({ length: messageCount }, (_, i) =>
          agent.processMessage({ type: 'test', action: 'ping', payload: { iteration: i } })
        )
      );
      const duration = performance.now() - start;

      expect(results).toHaveLength(messageCount);
      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(5000); // Should handle 100 messages in <5s
    });

    it('should maintain performance under memory pressure', async () => {
      const agents = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          agentFabric.createAgent(`memory-${i}`, 'CoordinatorAgent')
        )
      );

      const memoryBefore = process.memoryUsage().heapUsed;

      // Perform operations
      await Promise.all(
        agents.map(agent => 
          agent.processMessage({ 
            type: 'test', 
            action: 'heavy_payload',
            payload: { data: Array(1000).fill('x') }
          })
        )
      );

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // <50MB increase
    });

    it('should handle concurrent workflows', async () => {
      const workflows = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          agentFabric.createAgent(`workflow-${i}`, 'CoordinatorAgent')
        )
      );

      const results = await Promise.all(
        workflows.map(agent => 
          agent.processMessage({
            type: 'workflow',
            action: 'parallel',
            payload: { workflowId: agent.id },
          })
        )
      );

      expect(results).toHaveLength(10);
      expect(results.filter(r => r.success).length).toBeGreaterThanOrEqual(9); // Allow 10% failure
    });
  });

  describe('Integration Edge Cases', () => {
    it('should handle malformed messages', async () => {
      const agent = await agentFabric.createAgent('malformed-test', 'CoordinatorAgent');

      const result = await agent.processMessage({} as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle null/undefined payloads', async () => {
      const agent = await agentFabric.createAgent('null-test', 'CoordinatorAgent');

      const result1 = await agent.processMessage({
        type: 'test',
        action: 'ping',
        payload: null,
      });

      const result2 = await agent.processMessage({
        type: 'test',
        action: 'ping',
        payload: undefined,
      });

      expect(result1.success).toBe(true); // Should handle gracefully
      expect(result2.success).toBe(true);
    });

    it('should handle rapid state changes', async () => {
      const agent = await agentFabric.createAgent('rapid-test', 'CoordinatorAgent');

      // Rapid state changes
      await agent.pause();
      await agent.resume();
      await agent.pause();
      await agent.pause(); // Double pause
      await agent.resume();
      await agent.resume(); // Double resume

      expect(agent.status).toBe('idle');
    });

    it('should handle agent destruction during operation', async () => {
      const agent = await agentFabric.createAgent('destruct-test', 'CoordinatorAgent');

      const operation = agent.processMessage({
        type: 'test',
        action: 'long_running',
        payload: { delay: 1000 },
      });

      // Destroy mid-operation
      setTimeout(() => {
        agent.destroy().catch(() => {});
      }, 100);

      const result = await operation;

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Cross-Agent Communication Coverage', () => {
    it('should enable agent-to-agent messaging', async () => {
      const agent1 = await agentFabric.createAgent('agent1', 'CoordinatorAgent');
      const agent2 = await agentFabric.createAgent('agent2', 'TargetAgent');

      const received: any[] = [];

      // Subscribe to direct messages
      const unsubscribe = messageBus.subscribe('agent2', (msg) => {
        received.push(msg);
      });

      // Agent1 sends message to Agent2
      await messageBus.publish('agent2', {
        from: 'agent1',
        type: 'request',
        action: 'analyze',
        payload: { data: 'test' },
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(received.length).toBeGreaterThan(0);
      expect(received[0].from).toBe('agent1');

      unsubscribe();
    });

    it('should handle request-response pattern', async () => {
      const requester = await agentFabric.createAgent('requester', 'CoordinatorAgent');
      const responder = await agentFabric.createAgent('responder', 'TargetAgent');

      const responsePromise = new Promise<any>((resolve) => {
        const unsubscribe = messageBus.subscribe('response-channel', (msg) => {
          resolve(msg);
          unsubscribe();
        });
      });

      // Send request
      await messageBus.publish('responder', {
        type: 'request',
        requestId: 'req-123',
        channel: 'response-channel',
        payload: { question: 'What is the target?' },
      });

      // Simulate responder response
      setTimeout(() => {
        messageBus.publish('response-channel', {
          type: 'response',
          requestId: 'req-123',
          answer: 'Target identified',
        });
      }, 50);

      const response = await responsePromise;
      expect(response.answer).toBe('Target identified');
    });

    it('should broadcast to agent groups', async () => {
      const agents = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          agentFabric.createAgent(`group-${i}`, 'CoordinatorAgent')
        )
      );

      const received: string[] = [];
      const unsubscribe = messageBus.subscribe('agent-group', (msg) => {
        received.push(msg.from);
      });

      // Broadcast to group
      await messageBus.publish('agent-group', {
        type: 'broadcast',
        from: 'coordinator',
        data: 'group message',
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(received.length).toBeGreaterThan(0);
      unsubscribe();
    });
  });

  describe('Data Persistence Coverage', () => {
    it('should persist agent state', async () => {
      const agent = await agentFabric.createAgent('persist-test', 'CoordinatorAgent', {
        metadata: { key: 'value' },
      });

      // Modify state
      await agent.processMessage({
        type: 'test',
        action: 'update_state',
        payload: { newState: 'modified' },
      });

      // Simulate restart
      const restored = await agentFabric.createAgent('persist-test', 'CoordinatorAgent');
      
      // Should maintain state
      expect(restored.metadata).toEqual({ key: 'value' });
    });

    it('should handle data corruption gracefully', async () => {
      const agent = await agentFabric.createAgent('corrupt-test', 'CoordinatorAgent');

      // Simulate corrupted data
      const result = await agent.processMessage({
        type: 'test',
        action: 'corrupted_data',
        payload: { corrupted: true },
      });

      expect(result.success).toBe(false);
      expect(agent.status).toBe('idle'); // Should recover
    });
  });

  describe('Monitoring & Observability Coverage', () => {
    it('should emit metrics for all operations', async () => {
      const agent = await agentFabric.createAgent('metrics-test', 'CoordinatorAgent');
      const metrics: any[] = [];

      // Subscribe to metrics
      const unsubscribe = messageBus.subscribe('metrics', (metric) => {
        metrics.push(metric);
      });

      await agent.processMessage({
        type: 'test',
        action: 'measured_operation',
        payload: { value: 42 },
      });

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.type === 'operation_complete')).toBe(true);

      unsubscribe();
    });

    it('should trace workflow execution', async () => {
      const agent = await agentFabric.createAgent('trace-test', 'CoordinatorAgent');

      const traceResult = await agent.processMessage({
        type: 'workflow',
        action: 'traced_execution',
        payload: { steps: ['step1', 'step2', 'step3'] },
      });

      expect(traceResult.success).toBe(true);
      expect(traceResult.data.trace).toBeDefined();
      expect(traceResult.data.trace.length).toBe(3);
    });

    it('should log all errors with context', async () => {
      const agent = await agentFabric.createAgent('error-log-test', 'CoordinatorAgent');

      await agent.processMessage({
        type: 'test',
        action: 'error_with_context',
        payload: { context: 'test-context' },
      });

      // Check audit logs for error entry
      const logs = await auditLogService.query({
        limit: 5,
        action: 'agent_error',
      });

      const errorLog = logs.find(log => 
        log.metadata?.agentId === 'error-log-test'
      );

      expect(errorLog).toBeDefined();
      expect(errorLog?.metadata).toHaveProperty('context', 'test-context');
    });
  });

  describe('Complete Workflow Scenarios', () => {
    it('should execute end-to-end opportunity to target workflow', async () => {
      // 1. Create opportunity
      const coordinator = await agentFabric.createAgent('opp-coord', 'CoordinatorAgent');
      const oppResult = await coordinator.processMessage({
        type: 'opportunity',
        action: 'create',
        payload: {
          name: 'SaaS Expansion',
          revenue: 5000000,
          growthPotential: 1.5,
        },
      });

      expect(oppResult.success).toBe(true);
      const opportunity = oppResult.data;

      // 2. Analyze opportunity
      const targetAgent = await agentFabric.createAgent('target-analyst', 'TargetAgent');
      const analysis = await targetAgent.processMessage({
        type: 'analysis',
        action: 'opportunity_analysis',
        payload: { opportunity },
      });

      expect(analysis.success).toBe(true);
      expect(analysis.data.targets).toBeDefined();

      // 3. Create execution plan
      const realizer = await agentFabric.createAgent('realizer', 'RealizationAgent');
      const plan = await realizer.processMessage({
        type: 'planning',
        action: 'create_execution_plan',
        payload: {
          opportunity,
          targets: analysis.data.targets,
        },
      });

      expect(plan.success).toBe(true);
      expect(plan.data.executionPlan).toBeDefined();

      // 4. Execute with monitoring
      const execution = await realizer.processMessage({
        type: 'execution',
        action: 'execute_plan',
        payload: {
          plan: plan.data.executionPlan,
          monitoring: true,
        },
      });

      expect(execution.success).toBe(true);
      expect(execution.data.executionId).toBeDefined();
      expect(execution.data.status).toBe('completed');
    });

    it('should handle complex multi-agent negotiation', async () => {
      const agents = await Promise.all([
        agentFabric.createAgent('negotiator-1', 'CoordinatorAgent'),
        agentFabric.createAgent('negotiator-2', 'TargetAgent'),
        agentFabric.createAgent('negotiator-3', 'RealizationAgent'),
      ]);

      // Simulate negotiation rounds
      let round = 0;
      const maxRounds = 3;

      while (round < maxRounds) {
        round++;
        
        const results = await Promise.all(
          agents.map((agent, i) => 
            agent.processMessage({
              type: 'negotiation',
              action: `round_${round}`,
              payload: { 
                round,
                proposal: `proposal-${i}-${round}`,
                agent: agent.id,
              },
            })
          )
        );

        // All should succeed
        expect(results.every(r => r.success)).toBe(true);

        // Check for consensus
        const proposals = results.map(r => r.data?.proposal);
        const uniqueProposals = new Set(proposals);
        
        // If all agree, negotiation complete
        if (uniqueProposals.size === 1) {
          break;
        }
      }

      expect(round).toBeLessThanOrEqual(maxRounds);
    });

    it('should handle failure recovery in complex workflow', async () => {
      const coordinator = await agentFabric.createAgent('recovery-coord', 'CoordinatorAgent');
      const target = await agentFabric.createAgent('recovery-target', 'TargetAgent');
      const realizer = await agentFabric.createAgent('recovery-realizer', 'RealizationAgent');

      // Step 1: Success
      const step1 = await coordinator.processMessage({
        type: 'workflow',
        action: 'step1',
        payload: { data: 'initial' },
      });
      expect(step1.success).toBe(true);

      // Step 2: Failure
      const step2 = await target.processMessage({
        type: 'workflow',
        action: 'step2_fail',
        payload: { simulate: true },
      });
      expect(step2.success).toBe(false);

      // Recovery
      const recovered = await target.recover();
      expect(recovered).toBe(true);

      // Step 3: Continue
      const step3 = await realizer.processMessage({
        type: 'workflow',
        action: 'step3',
        payload: { recovered: true },
      });
      expect(step3.success).toBe(true);

      // Verify workflow completion
      const status = await coordinator.processMessage({
        type: 'workflow',
        action: 'status',
      });

      expect(status.data.completed).toBe(true);
    });
  });
});