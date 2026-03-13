import { describe, expect, it } from 'vitest';

import { activatePromptVersion, resolvePromptTemplate } from './PromptRegistry.js';

describe('PromptRegistry', () => {
  it('resolves approved active prompt versions with approval metadata', () => {
    const resolved = resolvePromptTemplate({ promptKey: 'opportunity.system.base' });

    expect(resolved.reference.prompt_key).toBe('opportunity.system.base');
    expect(resolved.reference.version).toBe('1.0.0');
    expect(resolved.reference.owner).toBeDefined();
    expect(resolved.reference.ticket).toBeDefined();
    expect(resolved.reference.risk_class).toBeDefined();
  });

  it('requires approval metadata when activating a prompt version', () => {
    expect(() => activatePromptVersion('opportunity.system.base', '1.0.0', {
      owner: '',
      ticket: '',
      risk_class: 'medium',
      approved_at: '2026-03-12T00:00:00.000Z',
    })).toThrow('Prompt activation requires owner, ticket, and risk class approval metadata.');
  });

  it('blocks unknown prompt versions in production', () => {
    expect(() => resolvePromptTemplate({
      promptKey: 'opportunity.system.base',
      version: '9.9.9',
      environment: 'production',
    })).toThrow('No prompt version available for opportunity.system.base');
  });
});
