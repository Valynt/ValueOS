import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CapabilityRequestContext, getCapabilityResolver } from '../CapabilityResolver.js';
import { SecretAwareToolExecutor } from '../SecretAwareToolExecutor.js';
import { SecretAccessDeniedError } from '../SecretBrokerService.js';

vi.mock('../CapabilityResolver.js', () => {
  const mockResolver = {
    requestCapability: vi.fn(),
  };
  return {
    getCapabilityResolver: () => mockResolver,
  };
});

describe('SecretAwareToolExecutor', () => {
  let executor: SecretAwareToolExecutor;
  let resolver: ReturnType<typeof getCapabilityResolver>;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new SecretAwareToolExecutor();
    resolver = getCapabilityResolver();
  });

  const ctx: CapabilityRequestContext = {
    tenantId: 'tenant-123',
    agentId: 'agent-456',
    environment: 'production',
  };

  it('resolves capabilities and injects them into the handler', async () => {
    const mockGrant = {
      grantId: 'grant-1',
      tenantId: 'tenant-123',
      capability: 'salesforce.read',
      toolName: 'my_tool',
      decryptedValue: 'secret-value',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };

    vi.mocked(resolver.requestCapability).mockResolvedValue(mockGrant);

    const handler = vi.fn().mockResolvedValue('success');

    const result = await executor.execute(
      'my_tool',
      [{ capability: 'salesforce.read', purpose: 'test' }],
      { someParam: 'value' },
      ctx,
      handler
    );

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(handler).toHaveBeenCalledWith(
      { someParam: 'value' },
      { 'salesforce.read': mockGrant }
    );
  });

  it('returns error if capability is denied', async () => {
    vi.mocked(resolver.requestCapability).mockRejectedValue(
      new SecretAccessDeniedError('AGENT_NOT_ALLOWED', 'Agent not allowed')
    );

    const handler = vi.fn();

    const result = await executor.execute(
      'my_tool',
      [{ capability: 'salesforce.read', purpose: 'test' }],
      {},
      ctx,
      handler
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('AGENT_NOT_ALLOWED');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns error if handler throws', async () => {
    vi.mocked(resolver.requestCapability).mockResolvedValue({} as any);

    const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));

    const result = await executor.execute(
      'my_tool',
      [{ capability: 'salesforce.read', purpose: 'test' }],
      {},
      ctx,
      handler
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TOOL_EXECUTION_ERROR');
    expect(result.error?.message).toBe('Handler failed');
  });

  it('zeroes out decrypted values after execution', async () => {
    const mockGrant = {
      grantId: 'grant-1',
      tenantId: 'tenant-123',
      capability: 'salesforce.read',
      toolName: 'my_tool',
      decryptedValue: 'secret-value',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };

    vi.mocked(resolver.requestCapability).mockResolvedValue(mockGrant);

    let capturedSecrets: any;
    const handler = vi.fn().mockImplementation(async (params, secrets) => {
      capturedSecrets = secrets;
      return 'success';
    });

    await executor.execute(
      'my_tool',
      [{ capability: 'salesforce.read', purpose: 'test' }],
      {},
      ctx,
      handler
    );

    // The grant object was mutated to clear the decrypted value
    expect(mockGrant.decryptedValue).toBe('');
    // The context object was cleared
    expect(Object.keys(capturedSecrets)).toHaveLength(0);
  });
});
