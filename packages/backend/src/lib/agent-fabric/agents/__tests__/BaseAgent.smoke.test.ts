import { describe, expect, it, vi } from 'vitest';

import type { AgentOutput, LifecycleContext } from '../../../../types/agent.js';
import { BaseAgent } from '../BaseAgent.js';

class SmokeAgent extends BaseAgent {
  async _execute(_context: LifecycleContext): Promise<AgentOutput> {
    return this.buildOutput({ ok: true }, 'completed', 'high', Date.now());
  }
}

describe('BaseAgent smoke', () => {
  it('executes through public execute() wrapper', async () => {
    const agent = new SmokeAgent(
      { lifecycle_stage: 'discovery', name: 'smoke-agent', metadata: {} } as never,
      'org-1',
      { retrieve: vi.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
    );

    const out = await agent.execute({ organization_id: 'org-1', user_id: 'u-1', workspace_id: 'w-1' } as never);
    expect(out.status).toBe('completed');
    expect(out.result).toEqual({ ok: true });
  });
});
