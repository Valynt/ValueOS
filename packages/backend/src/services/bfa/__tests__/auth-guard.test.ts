import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { resetAgentPolicyServiceForTests } from '../../policy/AgentPolicyService.js';
import { AuthorizationError, type AgentContext, type SemanticTool } from '../types.js';
import { toolRegistry } from '../registry.js';
import { AuthGuard } from '../auth-guard.js';

function setupPolicies() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bfa-auth-guard-test-'));
  writeFileSync(
    path.join(dir, 'default.json'),
    JSON.stringify({
      version: 'test-v1',
      agent: 'default',
      allowedModels: ['gpt-4o-mini'],
      allowedTools: ['allowed_tool'],
      maxTokens: 100,
      maxCostUsd: 1,
    }),
  );
  process.env.AGENT_POLICY_DIR = dir;
  resetAgentPolicyServiceForTests();
}

describe('AuthGuard', () => {
  beforeEach(() => {
    setupPolicies();
  });

  afterEach(() => {
    delete process.env.AGENT_POLICY_DIR;
    resetAgentPolicyServiceForTests();
    vi.restoreAllMocks();
  });

  it('blocks unauthorized tool execution before business logic runs', async () => {
    const executeBusinessLogic = vi.fn().mockResolvedValue({ ok: true });
    const tool: SemanticTool<{ input: string }, { ok: boolean }> = {
      id: `activate_customer_${Date.now()}`,
      description: 'activates customer',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      policy: {
        resource: 'customer',
        action: 'activate',
        requiredPermissions: ['customer:activate'],
      },
      execute: executeBusinessLogic,
    };

    toolRegistry.register(tool);
    const toolId = tool.id;

    const context: AgentContext = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      permissions: [],
      requestTime: new Date(),
    };

    await expect(AuthGuard.executeWithAuth(toolId, { input: 'x' }, context)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(executeBusinessLogic).not.toHaveBeenCalled();
  });
});
