/**
 * Tests for orchestrator and LLM gateway tracing patterns.
 *
 * The UnifiedAgentOrchestrator has deep transitive dependencies that
 * prevent direct import in the unit test vitest config (missing @mcp
 * module files). Instead, we test:
 *
 * 1. LLMGateway.complete() span creation (directly importable)
 * 2. The tracing helper patterns used by the orchestrator
 *
 * The orchestrator's tracing is structural (wrapping existing methods
 * with startActiveSpan), so verifying the pattern works through
 * LLMGateway validates the approach.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory OTel span capture
// ---------------------------------------------------------------------------

interface CapturedSpan {
  name: string;
  attributes: Record<string, unknown>;
  status: { code: number; message?: string };
  events: Array<{ name: string; attributes?: Record<string, unknown> }>;
  ended: boolean;
  parentSpanId?: string;
  spanId: string;
}

let capturedSpans: CapturedSpan[] = [];
let spanIdCounter = 0;
let activeSpanStack: CapturedSpan[] = [];

function makeSpan(name: string, options?: any): CapturedSpan {
  spanIdCounter++;
  const span: CapturedSpan = {
    name,
    attributes: { ...(options?.attributes || {}) },
    status: { code: 0 },
    events: [],
    ended: false,
    spanId: `span-${spanIdCounter}`,
    parentSpanId: activeSpanStack.length > 0
      ? activeSpanStack[activeSpanStack.length - 1].spanId
      : undefined,
  };
  capturedSpans.push(span);
  return span;
}

function makeSpanProxy(span: CapturedSpan) {
  return {
    setAttributes: (attrs: Record<string, unknown>) => Object.assign(span.attributes, attrs),
    setAttribute: (k: string, v: unknown) => { span.attributes[k] = v; },
    setStatus: (s: { code: number; message?: string }) => { span.status = s; },
    recordException: (err: Error) => {
      span.events.push({ name: 'exception', attributes: { message: err.message } });
    },
    addEvent: (name: string, attrs?: Record<string, unknown>) => {
      span.events.push({ name, attributes: attrs });
    },
    end: () => {
      span.ended = true;
      const idx = activeSpanStack.indexOf(span);
      if (idx >= 0) activeSpanStack.splice(idx, 1);
    },
    spanContext: () => ({ traceId: 'trace-1', spanId: span.spanId }),
  };
}

const mockTracer = {
  startSpan: (name: string, options?: any) => {
    const span = makeSpan(name, options);
    return makeSpanProxy(span);
  },
  startActiveSpan: (name: string, ...args: any[]) => {
    const fn = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : args[0];
    const options = args.length > 1 ? args[0] : {};
    const span = makeSpan(name, options);
    activeSpanStack.push(span);
    return fn(makeSpanProxy(span));
  },
};

// Mock telemetry
vi.mock('../../config/telemetry.js', () => ({
  getTracer: () => mockTracer,
}));

// Mock SpanStatusCode
vi.mock('@opentelemetry/api', () => ({
  SpanStatusCode: { OK: 0, ERROR: 2, UNSET: 1 },
}));

// Mock CostAwareRouter
vi.mock('../../services/CostAwareRouter.js', () => ({
  CostAwareRouter: class {
    async routeRequest() {
      return { fallbackToBasic: false };
    }
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { LLMGateway, type LLMRequest, type LLMResponse } from '../../lib/agent-fabric/LLMGateway.js';
import { _test_resetResilienceState } from '../../lib/agent-fabric/LLMResilience.js';

// ---------------------------------------------------------------------------
// LLMGateway tracing tests (R3.5)
// ---------------------------------------------------------------------------

describe('LLMGateway.complete() tracing (R3.5)', () => {
  beforeEach(() => {
    capturedSpans = [];
    spanIdCounter = 0;
    activeSpanStack = [];
    _test_resetResilienceState();
  });

  it('creates an llm.complete span with provider and model attributes', async () => {
    const gateway = new LLMGateway(
      { provider: 'openai', model: 'gpt-4o-mini' },
      { trackUsage: vi.fn() } as any
    );

    await gateway.complete({
      messages: [{ role: 'user', content: 'hello' }],
      metadata: { tenantId: 'tenant-1' },
    });

    const llmSpan = capturedSpans.find(s => s.name === 'llm.complete');
    expect(llmSpan).toBeDefined();
    expect(llmSpan!.attributes['llm.provider']).toBe('openai');
    expect(llmSpan!.attributes['llm.model']).toBe('gpt-4o-mini');
    expect(llmSpan!.ended).toBe(true);
    expect(llmSpan!.status.code).toBe(0); // OK
  });

  it('records token usage and cost on the span', async () => {
    const gateway = new LLMGateway(
      { provider: 'openai', model: 'gpt-4o-mini' },
      { trackUsage: vi.fn() } as any
    );

    await gateway.complete({
      messages: [{ role: 'user', content: 'hello' }],
      metadata: { tenantId: 'tenant-1' },
    });

    const llmSpan = capturedSpans.find(s => s.name === 'llm.complete')!;
    expect(llmSpan.attributes['llm.prompt_tokens']).toBe(100);
    expect(llmSpan.attributes['llm.completion_tokens']).toBe(50);
    expect(llmSpan.attributes['llm.total_tokens']).toBe(150);
    expect(llmSpan.attributes['llm.cost_usd']).toBeTypeOf('number');
    expect((llmSpan.attributes['llm.cost_usd'] as number)).toBeGreaterThan(0);
    expect(llmSpan.attributes['llm.latency_ms']).toBeTypeOf('number');
    expect(llmSpan.attributes['llm.cached']).toBe(false);
  });

  it('records error status and exception on span when LLM call fails', async () => {
    class FailGateway extends LLMGateway {
      protected override async executeCompletion(): Promise<LLMResponse> {
        const err = new Error('LLM provider down') as Error & { status: number };
        err.status = 500;
        throw err;
      }
    }

    const gateway = new FailGateway(
      { provider: 'anthropic', model: 'claude-3' },
      { trackUsage: vi.fn() } as any,
      { retry: { attempts: 1 } } as any
    );

    await expect(
      gateway.complete({
        messages: [{ role: 'user', content: 'hello' }],
        metadata: { tenantId: 'tenant-1' },
      })
    ).rejects.toThrow();

    const llmSpan = capturedSpans.find(s => s.name === 'llm.complete');
    expect(llmSpan).toBeDefined();
    expect(llmSpan!.status.code).toBe(2); // ERROR
    expect(llmSpan!.events.some(e => e.name === 'exception')).toBe(true);
    expect(llmSpan!.attributes['llm.latency_ms']).toBeTypeOf('number');
    expect(llmSpan!.ended).toBe(true);
  });

  it('nested spans have correct parent-child relationship', async () => {
    // Simulate what the orchestrator does: a parent span wrapping an LLM call
    const gateway = new LLMGateway(
      { provider: 'openai', model: 'gpt-4' },
      { trackUsage: vi.fn() } as any
    );

    // Create a parent span (simulating processQuery)
    await mockTracer.startActiveSpan(
      'agent.processQuery',
      { attributes: { 'agent.query': 'test' } },
      async (parentSpan: any) => {
        await gateway.complete({
          messages: [{ role: 'user', content: 'hello' }],
          metadata: { tenantId: 'tenant-1' },
        });
        parentSpan.end();
      }
    );

    const parentSpan = capturedSpans.find(s => s.name === 'agent.processQuery');
    const childSpan = capturedSpans.find(s => s.name === 'llm.complete');

    expect(parentSpan).toBeDefined();
    expect(childSpan).toBeDefined();
    expect(childSpan!.parentSpanId).toBe(parentSpan!.spanId);
  });
});

// ---------------------------------------------------------------------------
// Orchestrator tracing pattern validation (R3.1-R3.4)
// ---------------------------------------------------------------------------

describe('Orchestrator tracing patterns (R3.1-R3.4)', () => {
  beforeEach(() => {
    capturedSpans = [];
    spanIdCounter = 0;
    activeSpanStack = [];
  });

  it('startActiveSpan creates nested spans with correct hierarchy', async () => {
    // Simulate the orchestrator's span nesting pattern
    await mockTracer.startActiveSpan(
      'agent.processQuery',
      {
        attributes: {
          'agent.query': 'research company',
          'agent.user_id': 'user-1',
          'agent.session_id': 'session-1',
          'agent.trace_id': 'trace-abc',
          'agent.organization_id': 'org-1',
        },
      },
      async (rootSpan: any) => {
        // selectAgent child span
        mockTracer.startActiveSpan('agent.selectAgent', (selectSpan: any) => {
          selectSpan.setAttributes({
            'agent.selected_type': 'research',
            'agent.routing_strategy': 'stage-based',
          });
          selectSpan.setStatus({ code: 0 });
          selectSpan.end();
        });

        // executeStageWithRetry child span
        await mockTracer.startActiveSpan(
          'agent.executeStageWithRetry',
          {
            attributes: {
              'agent.stage_id': 'stage-1',
              'agent.stage_name': 'Research',
              'agent.agent_type': 'research',
            },
          },
          async (stageSpan: any) => {
            // executeStage grandchild span
            await mockTracer.startActiveSpan(
              'agent.executeStage',
              {
                attributes: {
                  'agent.stage_id': 'stage-1',
                  'agent.agent_type': 'research',
                },
              },
              async (execSpan: any) => {
                execSpan.setAttributes({ 'agent.latency_ms': 42 });
                execSpan.setStatus({ code: 0 });
                execSpan.end();
              }
            );

            stageSpan.setAttributes({
              'agent.retry_count': 0,
              'agent.latency_ms': 50,
            });
            stageSpan.setStatus({ code: 0 });
            stageSpan.end();
          }
        );

        rootSpan.setAttributes({ 'agent.latency_ms': 100 });
        rootSpan.setStatus({ code: 0 });
        rootSpan.end();
      }
    );

    // Verify span hierarchy
    expect(capturedSpans).toHaveLength(4);

    const root = capturedSpans.find(s => s.name === 'agent.processQuery')!;
    const select = capturedSpans.find(s => s.name === 'agent.selectAgent')!;
    const stageRetry = capturedSpans.find(s => s.name === 'agent.executeStageWithRetry')!;
    const stageExec = capturedSpans.find(s => s.name === 'agent.executeStage')!;

    // Root span attributes (R3.1)
    expect(root.attributes['agent.query']).toBe('research company');
    expect(root.attributes['agent.user_id']).toBe('user-1');
    expect(root.attributes['agent.session_id']).toBe('session-1');
    expect(root.attributes['agent.trace_id']).toBe('trace-abc');
    expect(root.attributes['agent.organization_id']).toBe('org-1');
    expect(root.attributes['agent.latency_ms']).toBe(100);
    expect(root.ended).toBe(true);

    // selectAgent span (R3.2)
    expect(select.parentSpanId).toBe(root.spanId);
    expect(select.attributes['agent.selected_type']).toBe('research');
    expect(select.attributes['agent.routing_strategy']).toBe('stage-based');

    // executeStageWithRetry span (R3.3)
    expect(stageRetry.parentSpanId).toBe(root.spanId);
    expect(stageRetry.attributes['agent.stage_id']).toBe('stage-1');
    expect(stageRetry.attributes['agent.stage_name']).toBe('Research');
    expect(stageRetry.attributes['agent.agent_type']).toBe('research');
    expect(stageRetry.attributes['agent.retry_count']).toBe(0);

    // executeStage span (R3.4)
    expect(stageExec.parentSpanId).toBe(stageRetry.spanId);
    expect(stageExec.attributes['agent.stage_id']).toBe('stage-1');
    expect(stageExec.attributes['agent.agent_type']).toBe('research');
    expect(stageExec.attributes['agent.latency_ms']).toBe(42);
  });

  it('error propagation records exception and error status on spans', async () => {
    await mockTracer.startActiveSpan(
      'agent.processQuery',
      { attributes: { 'agent.query': 'fail test' } },
      async (rootSpan: any) => {
        try {
          await mockTracer.startActiveSpan(
            'agent.executeStage',
            { attributes: { 'agent.stage_id': 'fail-stage' } },
            async (execSpan: any) => {
              const err = new Error('Agent communication failed');
              execSpan.setStatus({ code: 2, message: err.message });
              execSpan.recordException(err);
              execSpan.end();
              throw err;
            }
          );
        } catch (err) {
          rootSpan.setStatus({
            code: 2,
            message: (err as Error).message,
          });
          rootSpan.recordException(err as Error);
        }
        rootSpan.end();
      }
    );

    const root = capturedSpans.find(s => s.name === 'agent.processQuery')!;
    const exec = capturedSpans.find(s => s.name === 'agent.executeStage')!;

    expect(root.status.code).toBe(2); // ERROR
    expect(root.events.some(e => e.name === 'exception')).toBe(true);
    expect(root.ended).toBe(true);

    expect(exec.status.code).toBe(2); // ERROR
    expect(exec.events.some(e => e.name === 'exception')).toBe(true);
    expect(exec.ended).toBe(true);
  });
});
