/**
 * Rules Enforcer Tests
 * 
 * Tests for the Global and Local rules enforcement system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RulesEnforcer,
  buildGlobalRuleContext,
  buildLocalRuleContext,
  getRulesEnforcer,
  resetRulesEnforcer,
  enforceRules,
  isActionAllowed,
  getAllRuleIds,
} from '../index';
import {
  RULE_BLOCK_DANGEROUS_COMMANDS,
  RULE_TENANT_ISOLATION,
  RULE_PII_REDACTION,
  RULE_LOOP_STEP_LIMIT,
  RULE_SESSION_COST_LIMIT,
} from '../GlobalRules';
import {
  RULE_TOOL_ACCESS,
  RULE_STAGE_TRANSITION,
  RULE_APPROVAL_WORKFLOW,
} from '../LocalRules';

describe('GlobalRules', () => {
  describe('GR-001: Block Dangerous Commands', () => {
    it('should block DROP TABLE commands', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'execute_query',
        payload: { query: 'DROP TABLE users;' },
        environment: 'production',
      });

      const result = RULE_BLOCK_DANGEROUS_COMMANDS.check(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Dangerous command pattern');
    });

    it('should block rm -rf commands', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'execute_command',
        payload: { command: 'rm -rf /var/data' },
        environment: 'production',
      });

      const result = RULE_BLOCK_DANGEROUS_COMMANDS.check(context);
      expect(result.passed).toBe(false);
    });

    it('should allow safe queries', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'execute_query',
        payload: { query: 'SELECT * FROM users WHERE tenant_id = $1' },
        environment: 'production',
      });

      const result = RULE_BLOCK_DANGEROUS_COMMANDS.check(context);
      expect(result.passed).toBe(true);
    });
  });

  describe('GR-010: Tenant Isolation', () => {
    it('should block database operations without tenant_id', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'query_database',
        payload: { table: 'value_trees' },
        environment: 'production',
      });

      const result = RULE_TENANT_ISOLATION.check(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('tenant_id');
    });

    it('should allow operations with matching tenant_id', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'query_database',
        payload: { 
          table: 'value_trees',
          filters: { tenant_id: 'tenant-1' },
        },
        environment: 'production',
      });

      const result = RULE_TENANT_ISOLATION.check(context);
      expect(result.passed).toBe(true);
    });

    it('should block cross-tenant access attempts', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'query_database',
        payload: { 
          table: 'value_trees',
          filters: { tenant_id: 'tenant-2' }, // Different tenant!
        },
        environment: 'production',
      });

      const result = RULE_TENANT_ISOLATION.check(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Cross-tenant');
    });
  });

  describe('GR-020: PII Detection', () => {
    it('should detect SSN patterns', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'process_data',
        payload: { data: 'User SSN: 123-45-6789' },
        environment: 'production',
      });

      const result = RULE_PII_REDACTION.check(context);
      expect(result.passed).toBe(false);
      expect(result.details?.detectedTypes).toContain('ssn');
    });

    it('should detect credit card patterns', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'process_data',
        payload: { data: 'Card: 4111111111111111' },
        environment: 'production',
      });

      const result = RULE_PII_REDACTION.check(context);
      expect(result.passed).toBe(false);
      expect(result.details?.detectedTypes).toContain('credit_card');
    });

    it('should allow non-PII data', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'process_data',
        payload: { data: 'Normal business data with no PII' },
        environment: 'production',
      });

      const result = RULE_PII_REDACTION.check(context);
      expect(result.passed).toBe(true);
    });
  });

  describe('GR-030: Loop Step Limit', () => {
    it('should block when loop steps exceed limit', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'process',
        payload: { loopSteps: 15 },
        environment: 'production', // Max 10 in production
      });

      const result = RULE_LOOP_STEP_LIMIT.check(context);
      expect(result.passed).toBe(false);
    });

    it('should allow within limits in development', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'process',
        payload: { loopSteps: 15 },
        environment: 'development', // Max 20 in development
      });

      const result = RULE_LOOP_STEP_LIMIT.check(context);
      expect(result.passed).toBe(true);
    });
  });

  describe('GR-031: Session Cost Limit', () => {
    it('should block when session cost exceeds limit', () => {
      const context = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'process',
        payload: { sessionCost: 30.00 },
        environment: 'production', // Max $25 in production
      });

      const result = RULE_SESSION_COST_LIMIT.check(context);
      expect(result.passed).toBe(false);
    });
  });
});

describe('LocalRules', () => {
  describe('LR-001: Tool Access Control', () => {
    it('should allow coordinator to use plan_task', () => {
      const context = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'use_tool',
        tool: 'plan_task',
        payload: {},
      });

      const result = RULE_TOOL_ACCESS.check(context);
      expect(result.passed).toBe(true);
    });

    it('should deny coordinator access to execute_sql', () => {
      const context = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'use_tool',
        tool: 'execute_sql',
        payload: {},
      });

      const result = RULE_TOOL_ACCESS.check(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('explicitly denied');
    });

    it('should require approval for finalize_workflow', () => {
      const context = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'use_tool',
        tool: 'finalize_workflow',
        payload: {},
      });

      const result = RULE_TOOL_ACCESS.check(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('requires human approval');
    });
  });

  describe('LR-020: Stage Transition', () => {
    it('should allow valid transition from opportunity to target', () => {
      const context = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'transition_stage',
        payload: { targetStage: 'target' },
        workflowContext: {
          workflowId: 'wf-1',
          stage: 'opportunity',
          previousStages: [],
        },
      });

      const result = RULE_STAGE_TRANSITION.check(context);
      expect(result.passed).toBe(true);
    });

    it('should block invalid transition from opportunity to realization', () => {
      const context = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'transition_stage',
        payload: { targetStage: 'realization' },
        workflowContext: {
          workflowId: 'wf-1',
          stage: 'opportunity',
          previousStages: [],
        },
      });

      const result = RULE_STAGE_TRANSITION.check(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Invalid stage transition');
    });
  });

  describe('LR-021: Approval Workflow', () => {
    it('should require approval for large expenses', () => {
      const context = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'outcome_engineer',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'submit_expense',
        payload: { expenseAmount: 1000 }, // > $500 threshold
      });

      const result = RULE_APPROVAL_WORKFLOW.check(context);
      expect(result.passed).toBe(false);
      expect(result.fallbackAction).toBe('trigger_approval_workflow');
    });

    it('should allow small expenses without approval', () => {
      const context = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'outcome_engineer',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'submit_expense',
        payload: { expenseAmount: 100 }, // < $500 threshold
      });

      const result = RULE_APPROVAL_WORKFLOW.check(context);
      expect(result.passed).toBe(true);
    });
  });
});

describe('RulesEnforcer', () => {
  beforeEach(() => {
    resetRulesEnforcer();
  });

  afterEach(() => {
    resetRulesEnforcer();
  });

  describe('enforce', () => {
    it('should pass when all rules pass', async () => {
      const enforcer = new RulesEnforcer({ environment: 'development' });
      
      const globalContext = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'plan_task',
        payload: { tenant_id: 'tenant-1' },
        environment: 'development',
      });

      const localContext = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'plan_task',
        tool: 'plan_task',
        payload: {},
        environment: 'development',
      });

      const result = await enforcer.enforce(globalContext, localContext);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should block when global rule fails', async () => {
      const enforcer = new RulesEnforcer({ environment: 'production' });
      
      const globalContext = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'execute',
        payload: { command: 'DROP TABLE users;' },
        environment: 'production',
      });

      const localContext = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'execute',
        payload: {},
        environment: 'production',
      });

      const result = await enforcer.enforce(globalContext, localContext);
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.ruleId === 'GR-001')).toBe(true);
    });

    it('should include user messages on violations', async () => {
      const enforcer = new RulesEnforcer({ environment: 'production' });
      
      const globalContext = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'use_tool',
        payload: {},
        environment: 'production',
      });

      const localContext = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'use_tool',
        tool: 'execute_sql', // Denied tool
        payload: {},
        environment: 'production',
      });

      const result = await enforcer.enforce(globalContext, localContext);
      expect(result.userMessages.length).toBeGreaterThan(0);
    });
  });

  describe('audit mode', () => {
    it('should allow violations in audit mode but log them', async () => {
      const enforcer = new RulesEnforcer({
        environment: 'production',
        auditMode: true,
      });
      
      const globalContext = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'execute',
        payload: { command: 'DROP TABLE users;' },
        environment: 'production',
      });

      const localContext = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'execute',
        payload: {},
        environment: 'production',
      });

      const result = await enforcer.enforce(globalContext, localContext);
      expect(result.allowed).toBe(true); // Allowed despite violation
      expect(result.violations.length).toBeGreaterThan(0); // But violations recorded
    });
  });

  describe('metrics', () => {
    it('should track rule metrics', async () => {
      const enforcer = new RulesEnforcer({ environment: 'development' });
      
      const globalContext = buildGlobalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'test',
        payload: {},
        environment: 'development',
      });

      const localContext = buildLocalRuleContext({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'test',
        payload: {},
        environment: 'development',
      });

      await enforcer.enforce(globalContext, localContext);
      await enforcer.enforce(globalContext, localContext);

      const metrics = enforcer.getAggregatedMetrics();
      expect(metrics.totalChecks).toBeGreaterThan(0);
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    resetRulesEnforcer();
  });

  describe('enforceRules', () => {
    it('should work with minimal params', async () => {
      const result = await enforceRules({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'plan_task',
        payload: {},
      });

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('violations');
    });
  });

  describe('isActionAllowed', () => {
    it('should return boolean', async () => {
      const result = await isActionAllowed({
        agentId: 'agent-1',
        agentType: 'coordinator',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        action: 'plan_task',
        payload: {},
      });

      expect(typeof result).toBe('boolean');
    });
  });

  describe('getAllRuleIds', () => {
    it('should return all rule IDs', () => {
      const ids = getAllRuleIds();
      
      expect(ids.global).toContain('GR-001');
      expect(ids.global).toContain('GR-010');
      expect(ids.local).toContain('LR-001');
      expect(ids.local).toContain('LR-020');
    });
  });
});
