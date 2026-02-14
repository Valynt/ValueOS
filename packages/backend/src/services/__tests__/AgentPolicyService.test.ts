import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentPolicyService } from '../policy/AgentPolicyService.js';

describe('AgentPolicyService schema validation', () => {
  it('loads valid policies', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'policy-schema-ok-'));
    writeFileSync(
      path.join(dir, 'default.json'),
      JSON.stringify({
        version: 'v1',
        agent: 'default',
        allowedModels: ['gpt-4o-mini'],
        allowedTools: ['web_search'],
        maxTokens: 1000,
        maxCostUsd: 1,
      })
    );

    const service = new AgentPolicyService(dir);
    expect(service.getPolicy('default').version).toBe('v1');
  });

  it('fails closed on invalid schema', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'policy-schema-bad-'));
    writeFileSync(
      path.join(dir, 'default.json'),
      JSON.stringify({
        version: 'v1',
        agent: 'default',
        allowedModels: [],
        allowedTools: ['web_search'],
        maxTokens: -1,
        maxCostUsd: 0,
      })
    );

    expect(() => new AgentPolicyService(dir)).toThrow();
  });
});
