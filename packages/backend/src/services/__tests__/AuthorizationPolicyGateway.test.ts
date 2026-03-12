import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resetAgentPolicyServiceForTests } from '../policy/AgentPolicyService.js';
import { assertAuthorized } from '../policy/AuthorizationPolicyGateway.js';
import { PolicyEnforcementError } from '../policy/PolicyEnforcement.js';

function setupPolicies() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'auth-gateway-test-'));
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

afterEach(() => {
  delete process.env.AGENT_POLICY_DIR;
  resetAgentPolicyServiceForTests();
});

describe('AuthorizationPolicyGateway', () => {
  it('creates stable decision IDs for the same invocation input', () => {
    setupPolicies();

    const first = assertAuthorized({
      domain: 'tool_execution',
      action: 'execute',
      resource: 'allowed_tool',
      agentType: 'default',
      actorId: 'user-1',
      tenantId: 'tenant-1',
      traceId: 'trace-1',
      invocationId: 'invoke-1',
    });

    const second = assertAuthorized({
      domain: 'tool_execution',
      action: 'execute',
      resource: 'allowed_tool',
      agentType: 'default',
      actorId: 'user-1',
      tenantId: 'tenant-1',
      traceId: 'trace-1',
      invocationId: 'invoke-1',
    });

    expect(first.decisionId).toBe(second.decisionId);
  });

  it('attaches decision ID when blocking an action', () => {
    setupPolicies();

    expect(() =>
      assertAuthorized({
        domain: 'tool_execution',
        action: 'execute',
        resource: 'blocked_tool',
        agentType: 'default',
        actorId: 'user-2',
        tenantId: 'tenant-1',
        traceId: 'trace-2',
        invocationId: 'invoke-2',
      }),
    ).toThrowError(PolicyEnforcementError);

    try {
      assertAuthorized({
        domain: 'tool_execution',
        action: 'execute',
        resource: 'blocked_tool',
        agentType: 'default',
        actorId: 'user-2',
        tenantId: 'tenant-1',
        traceId: 'trace-2',
        invocationId: 'invoke-2',
      });
    } catch (error) {
      const policyError = error as PolicyEnforcementError;
      expect(policyError.code).toBe('TOOL_DENIED');
      expect(typeof policyError.details.decisionId).toBe('string');
      expect((policyError.details.decisionId as string).length).toBeGreaterThan(0);
    }
  });
});
