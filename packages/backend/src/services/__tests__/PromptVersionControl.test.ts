import { describe, expect, it } from 'vitest';
import { PromptVersionControlService } from '../PromptVersionControl';

// These are shallow smoke tests mostly intended to exercise our recent
// type refinements. At compile time the `supabase` field is now
// correctly typed instead of `any`, and `PromptExecution.variables` is
// `Record<string, unknown>`. The runtime assertions below ensure the
// constructors still work and the properties exist.

describe('PromptVersionControlService', () => {
  it('initializes with a supabase client', () => {
    const svc = new PromptVersionControlService();
    expect(svc).toHaveProperty('supabase');
  });

  it('can create a version payload object', () => {
    const svc = new PromptVersionControlService();
    // Type check: interface should allow unknown variable payloads
    const exec: import('../PromptVersionControl').PromptExecution = {
      id: '1',
      promptVersionId: 'pv1',
      userId: 'user1',
      variables: { foo: 'bar' },
      renderedPrompt: '',
      response: '',
      latency: 0,
      cost: 0,
      tokens: { prompt: 0, completion: 0, total: 0 },
      success: true,
      createdAt: new Date(),
    };
    expect(exec.variables).toEqual({ foo: 'bar' });
  });
});
