import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TargetAgent } from '../TargetAgent.js'

describe('TargetAgent causal trace verification', () => {
  let agent: any;
  beforeEach(() => {
    // Create instance without running constructor
    agent = Object.create(TargetAgent.prototype);
    // Mock memory system
    agent.memorySystem = {
      retrieve: vi.fn(),
    };
    // Mock causal engine
    agent.causalEngine = {
      inferCausalRelationship: vi.fn().mockResolvedValue({ effect: { direction: 'increase', magnitude: 1 }, confidence: 0.9 }),
    };
  });

  it('rejects target when no linked opportunity found', async () => {
    agent.memorySystem.retrieve.mockResolvedValue([]);

    const context = {
      workspace_id: 'ws',
      organization_id: 'org-1',
      user_id: 'user-1',
      parameters: { title: 'Increase revenue by 10%', description: 'Drive revenue via pricing', category: 'revenue' },
    };

    const result = await TargetAgent.prototype.execute.call(agent, context as any as any);
    expect(result).toBeTruthy();
    expect(result.data).toBeTruthy();
    const payload = result.result || result.data;
    expect(payload.message).toContain('No verified causal link');
  });

  it('accepts target when linked opportunity exists', async () => {
    agent.memorySystem.retrieve.mockResolvedValue([
      {
        id: 'opp-1',
        metadata: { verified: true, relatedActions: ['increase_revenue'], targetKpis: ['revenue'] },
      },
    ]);

    const context = {
      workspace_id: 'ws',
      organization_id: 'org-1',
      user_id: 'user-1',
      parameters: { title: 'Increase revenue by 10%', description: 'Drive revenue via pricing', category: 'revenue' },
    };

    const result = await TargetAgent.prototype.execute.call(agent, context as any as any);
    expect(result).toBeTruthy();
    const payload = result.result || result.data;
    expect(payload.validated).toBe(true);
    expect(payload.causalTrace).toBeTruthy();
    expect(payload.causalTrace.verified).toBe(true);
  });
});
