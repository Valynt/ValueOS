import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type MCPTool, ToolRegistry } from '../ToolRegistry.js';
import { LLMGateway } from '../../lib/agent-fabric/LLMGateway.js';
import {
  PolicyEnforcementError,
} from '../policy/PolicyEnforcement.js';
import { resetAgentPolicyServiceForTests } from '../policy/AgentPolicyService.js';

function setupPolicies() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'policy-test-'));
  writeFileSync(
    path.join(dir, 'default.json'),
    JSON.stringify({
      version: 'test-v1',
      agent: 'default',
      allowedModels: ['gpt-4o-mini'],
      allowedTools: ['allowed_tool'],
      maxTokens: 100,
      maxCostUsd: 0.0001,
    })
  );
  process.env.AGENT_POLICY_DIR = dir;
  resetAgentPolicyServiceForTests();
}

afterEach(() => {
  delete process.env.AGENT_POLICY_DIR;
  resetAgentPolicyServiceForTests();
});

describe('policy enforcement fail-closed', () => {
  it('denies tools outside agent policy with TOOL_DENIED', async () => {
    setupPolicies();
    const registry = new ToolRegistry();

    const tool: MCPTool = {
      name: 'denied_tool',
      description: 'denied',
      parameters: { type: 'object' },
      async execute() {
        return { success: true };
      },
    };

    registry.register(tool);

    await expect(
      registry.execute('denied_tool', {}, { agentType: 'default' })
    ).rejects.toMatchObject({ code: 'TOOL_DENIED' } satisfies Partial<PolicyEnforcementError>);
  });

  it('denies models outside policy with MODEL_DENIED', async () => {
    setupPolicies();
    const gateway = new LLMGateway({ provider: 'openai', model: 'gpt-4o' });

    await expect(
      gateway.complete({
        messages: [{ role: 'user', content: 'hi' }],
        metadata: { tenantId: 'tenant-1', agentType: 'default' },
      })
    ).rejects.toMatchObject({ code: 'MODEL_DENIED' } satisfies Partial<PolicyEnforcementError>);
  });

  it('denies budget overflow with BUDGET_EXCEEDED', async () => {
    setupPolicies();
    const gateway = new LLMGateway({
      provider: 'openai',
      model: 'gpt-4o-mini',
      max_tokens: 300,
    });

    await expect(
      gateway.complete({
        messages: [{ role: 'user', content: 'hello world' }],
        metadata: { tenantId: 'tenant-1', agentType: 'default' },
      })
    ).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' } satisfies Partial<PolicyEnforcementError>);
  });
});
