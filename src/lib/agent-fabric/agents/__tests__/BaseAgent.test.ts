import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { BaseAgent } from '../BaseAgent';
import { logger } from '../../../logger';
import { sanitizeUserInput } from '../../../../utils/security';

vi.mock('../../../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../observability', () => ({
  getTracer: () => ({
    startSpan: vi.fn().mockReturnValue({
      setAttribute: vi.fn(),
      addEvent: vi.fn(),
      end: vi.fn(),
      recordException: vi.fn(),
      setStatus: vi.fn()
    })
  }),
  addSpanAttributes: vi.fn(),
  addSpanEvent: vi.fn(),
  recordSpanException: vi.fn()
}));

vi.mock('../../../../utils/security', async () => {
  const actual = await import('../../../../utils/security');
  return {
    ...actual,
    sanitizeUserInput: vi.fn(actual.sanitizeUserInput)
  };
});

class TestAgent extends BaseAgent {
  lifecycleStage = 'test';
  version = '1.0.0';
  name = 'TestAgent';

  async execute(): Promise<any> {
    return null;
  }

  async runSecure(sessionId: string, input: any, options: any = {}) {
    const schema = z.object({ message: z.string() });
    return this.secureInvoke(sessionId, input, schema, options);
  }
}

function buildLLMResponse(confidence = 0.9) {
  return JSON.stringify({
    result: { message: 'ok' },
    confidence_level: confidence >= 0.7 ? 'high' : 'low',
    confidence_score: confidence,
    hallucination_check: false,
    hallucination_reasons: [],
    assumptions: [{ assumption: 'a', source: 'user', confidence }],
    data_gaps: [],
    evidence: [],
    reasoning: 'because',
    alternative_interpretations: [],
    processing_time_ms: 10,
    data_quality_score: 0.8
  });
}

describe('BaseAgent secureInvoke', () => {
  let llmGateway: any;
  let memorySystem: any;
  let auditLogger: any;
  let supabase: any;

  beforeEach(() => {
    llmGateway = { complete: vi.fn() };
    memorySystem = { storeSemanticMemory: vi.fn(), storeEpisodicMemory: vi.fn() };
    auditLogger = {
      logAction: vi.fn(),
      logMetric: vi.fn(),
      logPerformanceMetric: vi.fn()
    };
    supabase = { from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizes input before sending to LLM', async () => {
    llmGateway.complete.mockResolvedValue({
      content: buildLLMResponse(0.9),
      tokens_used: 5,
      model: 'test-model'
    });

    const agent = new TestAgent('agent-1', llmGateway, memorySystem, auditLogger, null);

    await agent.runSecure('session-1', '<script>alert(1)</script>Hello');

    const messages = llmGateway.complete.mock.calls[0][0];
    const userPrompt = messages[1].content as string;

    expect(userPrompt).not.toContain('<script>');
    expect(vi.mocked(sanitizeUserInput)).toHaveBeenCalled();
  });

  it('throws on low confidence when throwOnLowConfidence is set', async () => {
    llmGateway.complete.mockResolvedValue({
      content: buildLLMResponse(0.4),
      tokens_used: 5,
      model: 'test-model'
    });

    const agent = new TestAgent('agent-1', llmGateway, memorySystem, auditLogger, null);

    await expect(
      agent.runSecure('session-1', 'unsafe', { throwOnLowConfidence: true })
    ).rejects.toThrow(/validation failed/i);

    expect(logger.error).toHaveBeenCalled();
  });

  it('propagates Supabase errors when prediction persistence fails', async () => {
    const insertSpy = vi.fn().mockRejectedValue(new Error('insert failed'));
    supabase.from = vi.fn().mockReturnValue({ insert: insertSpy });

    llmGateway.complete.mockResolvedValue({
      content: buildLLMResponse(0.9),
      tokens_used: 5,
      model: 'test-model'
    });

    const agent = new TestAgent('agent-1', llmGateway, memorySystem, auditLogger, supabase);

    await expect(
      agent.runSecure('session-1', 'persist me', { trackPrediction: true })
    ).rejects.toThrow('insert failed');

    expect(supabase.from).toHaveBeenCalledWith('agent_predictions');
  });
});
