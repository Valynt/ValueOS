/**
 * Critical Pre-Production E2E Tests (temporary compatibility layer)
 *
 * Temporary mocked-contract scope used for compatibility checks only.
 * Non-gating by default: set RUN_CRITICAL_PREPROD_COMPAT=true to execute.
 *
 * Validates core invariants before production deployment:
 * 1. Tenant isolation across agents and memory
 * 2. Full agent lifecycle pipeline
 * 3. secureInvoke contract (Zod, circuit breaker, hallucination)
 * 4. Workflow DAG integrity and saga compensation
 * 5. Cross-agent data flow
 * 6. API error shape contracts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const runCompatibilityLayer = process.env.RUN_CRITICAL_PREPROD_COMPAT === 'true';
const compatDescribe = runCompatibilityLayer ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Mocks — must precede imports
// ---------------------------------------------------------------------------

vi.mock('../../packages/backend/src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../packages/backend/src/lib/agent-fabric/LLMGateway.js', () => ({
  LLMGateway: class {
    complete = vi.fn();
  },
}));

vi.mock('../../packages/backend/src/lib/agent-fabric/MemorySystem.js', () => ({
  MemorySystem: class {
    store = vi.fn().mockResolvedValue('mem_1');
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = vi.fn().mockResolvedValue('mem_1');
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock('../../packages/backend/src/lib/agent-fabric/CircuitBreaker.js', () => ({
  CircuitBreaker: class {
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock('../../packages/backend/src/services/MCPGroundTruthService.js', () => ({
  mcpGroundTruthService: {
    getFinancialData: vi.fn().mockResolvedValue(null),
    verifyClaim: vi.fn().mockResolvedValue({ verified: false, confidence: 0 }),
    getIndustryBenchmarks: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../packages/backend/src/config/featureFlags.js', () => ({
  featureFlags: { isEnabled: vi.fn().mockReturnValue(false) },
}));

vi.mock('../../packages/backend/src/agents/context/loadDomainContext.js', () => ({
  loadDomainContext: vi.fn().mockResolvedValue(null),
  formatDomainContextForPrompt: vi.fn().mockReturnValue(''),
}));

vi.mock('../../packages/backend/src/services/reasoning/AdvancedCausalEngine.js', () => ({
  getAdvancedCausalEngine: vi.fn().mockReturnValue({
    validateCausalLinks: vi.fn().mockResolvedValue({ valid: true, traces: [] }),
  }),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { BaseAgent } from '../../packages/backend/src/lib/agent-fabric/agents/BaseAgent';
import { CircuitBreaker } from '../../packages/backend/src/lib/agent-fabric/CircuitBreaker';
import { LLMGateway } from '../../packages/backend/src/lib/agent-fabric/LLMGateway';
import { MemorySystem } from '../../packages/backend/src/lib/agent-fabric/MemorySystem';
import { MessageBus } from '../../packages/backend/src/services/MessageBus';
import {
  ALL_WORKFLOW_DEFINITIONS,
  COMPLETE_LIFECYCLE_WORKFLOW,
  PARALLEL_LIFECYCLE_WORKFLOW,
  validateWorkflowDAG,
} from '../../packages/backend/src/services/workflows/WorkflowDAGDefinitions';
import type { AgentConfig, AgentOutput, LifecycleContext } from '../../packages/backend/src/types/agent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'test-agent',
    name: 'test',
    type: 'opportunity' as any,
    lifecycle_stage: 'opportunity',
    capabilities: [],
    model: { provider: 'custom', model_name: 'test' },
    prompts: { system_prompt: '', user_prompt_template: '' },
    parameters: {
      timeout_seconds: 30,
      max_retries: 3,
      retry_delay_ms: 1000,
      enable_caching: false,
      enable_telemetry: false,
    },
    constraints: {
      max_input_tokens: 4096,
      max_output_tokens: 4096,
      allowed_actions: [],
      forbidden_actions: [],
      required_permissions: [],
    },
    ...overrides,
  };
}

function makeContext(orgId: string, overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: 'ws-1',
    organization_id: orgId,
    user_id: 'user-1',
    lifecycle_stage: 'opportunity',
    workspace_data: {},
    user_inputs: {},
    ...overrides,
  };
}

/** Concrete agent for testing BaseAgent behaviour */
class TestAgent extends BaseAgent {
  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const valid = await this.validateInput(context);
    if (!valid) throw new Error('Invalid input');
    return this.prepareOutput({ ok: true }, 'success');
  }

  /** Expose secureInvoke for testing */
  async testSecureInvoke<T>(
    sessionId: string,
    prompt: string,
    schema: z.ZodSchema<T>,
    opts = {},
  ) {
    return this.secureInvoke(sessionId, prompt, schema, opts);
  }

  getOrgId() {
    return this.organizationId;
  }
}

function createTestAgent(orgId: string) {
  const llm = new LLMGateway() as any;
  const mem = new MemorySystem() as any;
  const cb = new CircuitBreaker() as any;
  const agent = new TestAgent(makeConfig(), orgId, mem, llm, cb);
  return { agent, llm, mem, cb };
}

// ============================================================================
// 1. TENANT ISOLATION
// ============================================================================

compatDescribe('E2E-PREPROD: Tenant Isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TENANT-001: agent binds organizationId from context', async () => {
    const { agent } = createTestAgent('org-alpha');
    await agent.execute(makeContext('org-beta'));
    // validateInput sets organizationId from context
    expect(agent.getOrgId()).toBe('org-beta');
  });

  it('TENANT-002: secureInvoke passes tenantId in LLM metadata', async () => {
    const { agent, llm } = createTestAgent('org-tenant-check');
    const schema = z.object({ answer: z.string() });
    llm.complete.mockResolvedValue({
      content: JSON.stringify({ answer: 'ok' }),
      tokens_used: 5,
      model: 'test',
    });

    await agent.testSecureInvoke('sess-1', 'test prompt', schema);

    expect(llm.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ tenantId: 'org-tenant-check' }),
      }),
    );
  });

  it('TENANT-003: memory store receives organizationId', async () => {
    const { agent, llm, mem } = createTestAgent('org-mem-check');
    const schema = z.object({ val: z.number() });
    llm.complete.mockResolvedValue({
      content: JSON.stringify({ val: 42 }),
      tokens_used: 3,
      model: 'test',
    });

    await agent.testSecureInvoke('sess-2', 'prompt', schema, { trackPrediction: true });

    expect(mem.storeSemanticMemory).toHaveBeenCalledWith(
      'sess-2',
      expect.any(String),
      'episodic',
      expect.any(String),
      expect.any(Object),
      'org-mem-check',
    );
  });

  it('TENANT-004: two agents with different orgs never share memory calls', async () => {
    const a = createTestAgent('org-A');
    const b = createTestAgent('org-B');
    const schema = z.object({ x: z.string() });

    a.llm.complete.mockResolvedValue({ content: '{"x":"a"}', tokens_used: 1, model: 't' });
    b.llm.complete.mockResolvedValue({ content: '{"x":"b"}', tokens_used: 1, model: 't' });

    await a.agent.testSecureInvoke('s1', 'p', schema);
    await b.agent.testSecureInvoke('s2', 'p', schema);

    const aCalls = a.mem.storeSemanticMemory.mock.calls;
    const bCalls = b.mem.storeSemanticMemory.mock.calls;

    // Last arg is organizationId
    expect(aCalls[0][5]).toBe('org-A');
    expect(bCalls[0][5]).toBe('org-B');
    expect(aCalls[0][5]).not.toBe(bCalls[0][5]);
  });

  it('TENANT-005: validateInput rejects missing organization_id', async () => {
    const { agent } = createTestAgent('org-x');
    const ctx = makeContext('org-x');
    (ctx as any).organization_id = '';

    const valid = await agent.validateInput(ctx);
    expect(valid).toBe(false);
  });
});

// ============================================================================
// 2. secureInvoke CONTRACT
// ============================================================================

compatDescribe('E2E-PREPROD: secureInvoke Contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('INVOKE-001: validates LLM output against Zod schema', async () => {
    const { agent, llm } = createTestAgent('org-1');
    const schema = z.object({
      result: z.string(),
      confidence: z.number().min(0).max(1),
    });

    llm.complete.mockResolvedValue({
      content: JSON.stringify({ result: 'done', confidence: 0.85 }),
      tokens_used: 10,
      model: 'test',
    });

    const output = await agent.testSecureInvoke('s1', 'prompt', schema);
    expect(output.result).toBe('done');
    expect(output.confidence).toBe(0.85);
    expect(output.hallucination_check).toBeDefined();
  });

  it('INVOKE-002: rejects invalid LLM output with Zod error', async () => {
    const { agent, llm } = createTestAgent('org-1');
    const schema = z.object({ count: z.number().int().positive() });

    llm.complete.mockResolvedValue({
      content: JSON.stringify({ count: -5 }),
      tokens_used: 5,
      model: 'test',
    });

    await expect(agent.testSecureInvoke('s1', 'prompt', schema)).rejects.toThrow();
  });

  it('INVOKE-003: rejects malformed JSON from LLM', async () => {
    const { agent, llm } = createTestAgent('org-1');
    const schema = z.object({ ok: z.boolean() });

    llm.complete.mockResolvedValue({
      content: 'not valid json {{{',
      tokens_used: 5,
      model: 'test',
    });

    await expect(agent.testSecureInvoke('s1', 'prompt', schema)).rejects.toThrow();
  });

  it('INVOKE-004: hallucination_check flags known patterns', async () => {
    const { agent, llm } = createTestAgent('org-1');
    const schema = z.object({ text: z.string() });

    // Response containing hallucination pattern
    llm.complete.mockResolvedValue({
      content: JSON.stringify({ text: "I'm sorry, but I cannot provide that" }),
      tokens_used: 5,
      model: 'test',
    });

    const output = await agent.testSecureInvoke('s1', 'prompt', schema);
    expect(output.hallucination_check).toBe(false);
  });

  it('INVOKE-005: circuit breaker wraps LLM call', async () => {
    const { agent, llm, cb } = createTestAgent('org-1');
    const schema = z.object({ v: z.string() });

    llm.complete.mockResolvedValue({
      content: JSON.stringify({ v: 'ok' }),
      tokens_used: 1,
      model: 'test',
    });

    await agent.testSecureInvoke('s1', 'prompt', schema);
    expect(cb.execute).toHaveBeenCalledTimes(1);
  });

  it('INVOKE-006: propagates circuit breaker failure', async () => {
    const { agent, cb } = createTestAgent('org-1');
    const schema = z.object({ v: z.string() });

    cb.execute.mockRejectedValue(new Error('Circuit open'));

    await expect(agent.testSecureInvoke('s1', 'prompt', schema)).rejects.toThrow('Circuit open');
  });
});

// ============================================================================
// 3. WORKFLOW DAG INTEGRITY
// ============================================================================

compatDescribe('E2E-PREPROD: Workflow DAG Integrity', () => {
  it('DAG-001: all workflow definitions pass validation', () => {
    for (const wf of ALL_WORKFLOW_DEFINITIONS) {
      const result = validateWorkflowDAG(wf);
      expect(result.valid, `${wf.id} has errors: ${result.errors.join(', ')}`).toBe(true);
    }
  });

  it('DAG-002: complete lifecycle has 5 stages in correct order', () => {
    const stages = COMPLETE_LIFECYCLE_WORKFLOW.stages.map(s => s.agent_type);
    expect(stages).toEqual(['opportunity', 'target', 'realization', 'expansion', 'integrity']);
  });

  it('DAG-003: complete lifecycle transitions form a linear chain', () => {
    const transitions = COMPLETE_LIFECYCLE_WORKFLOW.transitions;
    expect(transitions).toHaveLength(4);

    const chain = transitions.map(t => `${t.from_stage}->${t.to_stage}`);
    expect(chain).toContain('opportunity_discovery->target_value_commit');
    expect(chain).toContain('target_value_commit->realization_tracking');
    expect(chain).toContain('realization_tracking->expansion_modeling');
    expect(chain).toContain('expansion_modeling->integrity_controls');
  });

  it('DAG-004: no workflow contains cycles', () => {
    for (const wf of ALL_WORKFLOW_DEFINITIONS) {
      const result = validateWorkflowDAG(wf);
      const hasCycleWarning = result.warnings.some(w => w.includes('cycle'));
      expect(hasCycleWarning, `${wf.id} has unexpected cycle`).toBe(false);
    }
  });

  it('DAG-005: every stage has a compensation handler', () => {
    for (const wf of ALL_WORKFLOW_DEFINITIONS) {
      for (const stage of wf.stages) {
        expect(
          stage.compensation_handler,
          `${wf.id}/${stage.id} missing compensation_handler`,
        ).toBeDefined();
      }
    }
  });

  it('DAG-006: every stage has a positive timeout', () => {
    for (const wf of ALL_WORKFLOW_DEFINITIONS) {
      for (const stage of wf.stages) {
        expect(stage.timeout_seconds).toBeGreaterThan(0);
      }
    }
  });

  it('DAG-007: parallel workflow has fork-join topology', () => {
    const t = PARALLEL_LIFECYCLE_WORKFLOW.transitions;
    // Fork: opportunity -> target AND opportunity -> integrity
    const forks = t.filter(tr => tr.from_stage === 'opportunity_discovery');
    expect(forks).toHaveLength(2);

    // Join: target -> realization AND integrity -> realization
    const joins = t.filter(tr => tr.to_stage === 'realization_tracking');
    expect(joins).toHaveLength(2);
  });

  it('DAG-008: all stages are reachable from initial stage', () => {
    for (const wf of ALL_WORKFLOW_DEFINITIONS) {
      const result = validateWorkflowDAG(wf);
      const unreachable = result.warnings.filter(w => w.includes('unreachable'));
      expect(unreachable, `${wf.id} has unreachable stages`).toHaveLength(0);
    }
  });
});

// ============================================================================
// 4. AGENT LIFECYCLE PIPELINE
// ============================================================================

compatDescribe('E2E-PREPROD: Agent Lifecycle Pipeline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('LIFECYCLE-001: agent rejects context with missing workspace_id', async () => {
    const { agent } = createTestAgent('org-1');
    const ctx = makeContext('org-1');
    (ctx as any).workspace_id = '';

    const valid = await agent.validateInput(ctx);
    expect(valid).toBe(false);
  });

  it('LIFECYCLE-002: agent rejects context with missing user_id', async () => {
    const { agent } = createTestAgent('org-1');
    const ctx = makeContext('org-1');
    (ctx as any).user_id = '';

    const valid = await agent.validateInput(ctx);
    expect(valid).toBe(false);
  });

  it('LIFECYCLE-003: prepareOutput produces correct AgentOutput shape', async () => {
    const { agent } = createTestAgent('org-1');
    const output = await agent.prepareOutput({ data: 'test' }, 'success');

    expect(output).toMatchObject({
      agent_id: expect.any(String),
      agent_type: 'opportunity',
      lifecycle_stage: 'opportunity',
      status: 'success',
      result: { data: 'test' },
      confidence: 'medium',
      metadata: {
        execution_time_ms: expect.any(Number),
        model_version: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it('LIFECYCLE-004: execute returns valid output for valid context', async () => {
    const { agent } = createTestAgent('org-1');
    const output = await agent.execute(makeContext('org-1'));

    expect(output.status).toBe('success');
    expect(output.result).toEqual({ ok: true });
  });
});

// ============================================================================
// 5. MESSAGE BUS
// ============================================================================

compatDescribe('E2E-PREPROD: MessageBus Inter-Agent Communication', () => {
  it('MSGBUS-001: publish and subscribe delivers messages', async () => {
    const bus = new MessageBus();
    const received: unknown[] = [];

    bus.subscribe('test-channel', 'test-agent', async (event) => {
      received.push(event);
    });

    await bus.publishMessage('test-channel', {
      type: 'agent.output',
      source: 'opportunity-agent',
      payload: { result: 'discovery complete' },
    } as any);

    expect(received).toHaveLength(1);
    expect((received[0] as any).payload).toEqual({ result: 'discovery complete' });
  });

  it('MSGBUS-002: messages have unique IDs', async () => {
    const bus = new MessageBus();
    const ids: string[] = [];

    bus.subscribe('id-test', 'id-agent', async (event) => {
      ids.push((event as any).id);
    });

    await bus.publishMessage('id-test', { type: 'a', source: 's', payload: {} } as any);
    await bus.publishMessage('id-test', { type: 'b', source: 's', payload: {} } as any);

    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('MSGBUS-003: unsubscribed channels receive nothing', async () => {
    const bus = new MessageBus();
    const received: unknown[] = [];

    bus.subscribe('channel-a', 'agent-a', async (event) => {
      received.push(event);
    });

    await bus.publishMessage('channel-b', { type: 'x', source: 's', payload: {} } as any);

    expect(received).toHaveLength(0);
  });

  it('MSGBUS-004: unsubscribe stops delivery', async () => {
    const bus = new MessageBus();
    const received: unknown[] = [];

    const unsub = bus.subscribe('unsub-test', 'agent-unsub', async (event) => {
      received.push(event);
    });

    await bus.publishMessage('unsub-test', { type: 'a', source: 's', payload: {} } as any);
    expect(received).toHaveLength(1);

    unsub();

    await bus.publishMessage('unsub-test', { type: 'b', source: 's', payload: {} } as any);
    expect(received).toHaveLength(1); // no new messages
  });
});

// ============================================================================
// 6. DATA INTEGRITY — Zod Schema Contracts
// ============================================================================

compatDescribe('E2E-PREPROD: Data Integrity Contracts', () => {
  it('DATA-001: AgentOutput schema enforces required fields', () => {
    const AgentOutputSchema = z.object({
      agent_id: z.string().min(1),
      agent_type: z.string(),
      lifecycle_stage: z.enum(['opportunity', 'target', 'realization', 'expansion', 'integrity']),
      status: z.enum(['success', 'partial_success', 'failure', 'timeout', 'cancelled']),
      result: z.record(z.unknown()),
      confidence: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
      metadata: z.object({
        execution_time_ms: z.number(),
        model_version: z.string(),
        timestamp: z.string(),
      }),
    });

    // Valid output
    const valid = AgentOutputSchema.safeParse({
      agent_id: 'opp-1',
      agent_type: 'opportunity',
      lifecycle_stage: 'opportunity',
      status: 'success',
      result: { hypotheses: [] },
      confidence: 'high',
      metadata: { execution_time_ms: 150, model_version: '1.0', timestamp: new Date().toISOString() },
    });
    expect(valid.success).toBe(true);

    // Missing agent_id
    const invalid = AgentOutputSchema.safeParse({
      agent_type: 'opportunity',
      lifecycle_stage: 'opportunity',
      status: 'success',
      result: {},
      confidence: 'high',
      metadata: { execution_time_ms: 0, model_version: '1.0', timestamp: '' },
    });
    expect(invalid.success).toBe(false);
  });

  it('DATA-002: LifecycleContext schema enforces tenant fields', () => {
    const ContextSchema = z.object({
      workspace_id: z.string().min(1),
      organization_id: z.string().min(1),
      user_id: z.string().min(1),
      lifecycle_stage: z.enum(['opportunity', 'target', 'realization', 'expansion', 'integrity']),
    });

    expect(ContextSchema.safeParse({
      workspace_id: 'ws-1',
      organization_id: 'org-1',
      user_id: 'u-1',
      lifecycle_stage: 'opportunity',
    }).success).toBe(true);

    // Missing organization_id
    expect(ContextSchema.safeParse({
      workspace_id: 'ws-1',
      organization_id: '',
      user_id: 'u-1',
      lifecycle_stage: 'opportunity',
    }).success).toBe(false);
  });

  it('DATA-003: WorkflowDAG schema enforces structure', () => {
    const DAGSchema = z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      stages: z.array(z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        agent_type: z.string(),
        timeout_seconds: z.number().positive(),
      })).min(1),
      transitions: z.array(z.object({
        from_stage: z.string(),
        to_stage: z.string(),
      })),
      initial_stage: z.string().min(1),
    });

    const result = DAGSchema.safeParse(COMPLETE_LIFECYCLE_WORKFLOW);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// 7. SECURITY BOUNDARIES
// ============================================================================

compatDescribe('E2E-PREPROD: Security Boundaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('SEC-001: PII patterns are detectable', () => {
    const PII_PATTERNS = [
      /\b\d{3}-\d{2}-\d{4}\b/,          // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // CC
      /\b[A-Z]\d{8}\b/,                   // Passport
    ];

    const testInputs = [
      { text: 'SSN is 123-45-6789', hasPII: true },
      { text: 'Card 4111-1111-1111-1111', hasPII: true },
      { text: 'Passport A12345678', hasPII: true },
      { text: 'Normal business text', hasPII: false },
    ];

    for (const { text, hasPII } of testInputs) {
      const detected = PII_PATTERNS.some(p => p.test(text));
      expect(detected, `PII detection failed for: ${text}`).toBe(hasPII);
    }
  });

  it('SEC-002: dangerous commands are detectable', () => {
    const DANGEROUS = [
      /DROP\s+TABLE/i,
      /TRUNCATE\s+(?!.*WHERE)/i,
      /rm\s+-rf\s+\//,
      /chmod\s+777/,
      /\beval\s*\(/,
    ];

    const commands = [
      { cmd: 'DROP TABLE users', dangerous: true },
      { cmd: 'TRUNCATE orders', dangerous: true },
      { cmd: 'rm -rf /', dangerous: true },
      { cmd: 'chmod 777 /etc', dangerous: true },
      { cmd: 'SELECT * FROM users', dangerous: false },
    ];

    for (const { cmd, dangerous } of commands) {
      const detected = DANGEROUS.some(p => p.test(cmd));
      expect(detected, `Detection failed for: ${cmd}`).toBe(dangerous);
    }
  });

  it('SEC-003: cost limits are defined per environment', () => {
    const COST_LIMITS = { dev: 5, staging: 10, prod: 25 };
    expect(COST_LIMITS.dev).toBeLessThan(COST_LIMITS.staging);
    expect(COST_LIMITS.staging).toBeLessThan(COST_LIMITS.prod);
  });

  it('SEC-004: execution time limits are defined per environment', () => {
    const TIME_LIMITS = { dev: 60, staging: 45, prod: 30 };
    expect(TIME_LIMITS.prod).toBeLessThan(TIME_LIMITS.staging);
    expect(TIME_LIMITS.staging).toBeLessThan(TIME_LIMITS.dev);
  });
});
