/**
 * AgentServiceAdapter — tenant isolation guard tests (Fix 4)
 *
 * Verifies that each adapter method throws when context.organizationId is
 * absent, preventing LLM calls from proceeding under the synthetic 'system'
 * tenant that previously bypassed cost attribution, audit trails, and rate
 * limiting.
 */

import { describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

vi.mock('../../../lib/llm/secureLLMWrapper.js', () => ({
  secureLLMComplete: vi.fn().mockResolvedValue({ content: '{}' }),
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import type { LLMGateway } from '../../../lib/agent-fabric/LLMGateway.js';
import { AgentServiceAdapter } from '../AgentAdapters.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAdapter() {
  const gateway = { complete: vi.fn() } as unknown as LLMGateway;
  return new AgentServiceAdapter(gateway);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AgentServiceAdapter — missing organizationId throws (Fix 4)', () => {
  it('analyzeOpportunities throws when context is undefined', async () => {
    const adapter = makeAdapter();
    await expect(adapter.analyzeOpportunities('query', undefined))
      .rejects.toThrow(/requires context\.organizationId/);
  });

  it('analyzeOpportunities throws when organizationId is absent from context', async () => {
    const adapter = makeAdapter();
    await expect(adapter.analyzeOpportunities('query', { userId: 'u1' }))
      .rejects.toThrow(/requires context\.organizationId/);
  });

  it('analyzeFinancialModels throws when organizationId is absent', async () => {
    const adapter = makeAdapter();
    await expect(adapter.analyzeFinancialModels('query', undefined))
      .rejects.toThrow(/requires context\.organizationId/);
  });

  it('analyzeGroundtruth throws when organizationId is absent', async () => {
    const adapter = makeAdapter();
    await expect(adapter.analyzeGroundtruth('query', undefined))
      .rejects.toThrow(/requires context\.organizationId/);
  });

  it('analyzeNarrative throws when organizationId is absent', async () => {
    const adapter = makeAdapter();
    await expect(adapter.analyzeNarrative('query', undefined))
      .rejects.toThrow(/requires context\.organizationId/);
  });

  it('analyzeOpportunities proceeds when organizationId is provided', async () => {
    const { secureLLMComplete } = await import('../../../lib/llm/secureLLMWrapper.js');
    vi.mocked(secureLLMComplete).mockResolvedValueOnce({
      content: JSON.stringify({
        opportunities: [],
        analysis: 'test analysis',
      }),
    });

    const adapter = makeAdapter();
    // Should not throw — organizationId is present
    await expect(
      adapter.analyzeOpportunities('query', { organizationId: 'org-123' }),
    ).resolves.toBeDefined();
  });
});
