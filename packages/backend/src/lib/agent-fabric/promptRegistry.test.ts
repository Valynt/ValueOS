import { describe, expect, it } from 'vitest';

import { resolvePromptTemplate } from './promptRegistry.js';

describe('promptRegistry value modeling prompts', () => {
  const promptKeys = [
    'value_modeling_baseline_establishment',
    'value_modeling_assumption_registration',
    'value_modeling_scenario_building',
    'value_modeling_sensitivity_analysis',
  ] as const;

  it.each(promptKeys)('resolves active version with approval metadata for %s', (promptKey) => {
    const resolved = resolvePromptTemplate(promptKey);

    expect(resolved.key).toBe(promptKey);
    expect(resolved.version).toBe('1.0.0');
    expect(resolved.template.length).toBeGreaterThan(20);
    expect(resolved.approval.owner).toBeTruthy();
    expect(resolved.approval.ticket).toBeTruthy();
    expect(resolved.approval.risk_class).toBeTruthy();
    expect(resolved.approval.approved_at).toBeTruthy();
  });

  it.each(promptKeys)('resolves explicit active version for %s', (promptKey) => {
    const resolved = resolvePromptTemplate(promptKey, '1.0.0');
    expect(resolved.version).toBe('1.0.0');
  });
});
