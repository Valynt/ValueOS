/**
 * RunDiscoveryWorkflow — Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunDiscoveryWorkflow } from '../RunDiscoveryWorkflow.js';
import type { DiscoveryAgentPort } from '../RunDiscoveryWorkflow.js';
import type { RequestContext } from '../../types.js';

const mockContext: RequestContext = {
  organizationId: 'org-123e4567-e89b-12d3-a456-426614174000',
  userId: 'user-abc',
  roles: ['member'],
  traceId: 'trace-xyz',
  correlationId: 'corr-xyz',
  planTier: 'pro',
};

function makeMockAgent(overrides?: Partial<DiscoveryAgentPort>): DiscoveryAgentPort {
  return {
    startDiscovery: vi.fn().mockResolvedValue({ runId: 'discovery_1234567890_abc1234' }),
    ...overrides,
  };
}

describe('RunDiscoveryWorkflow', () => {
  let agent: DiscoveryAgentPort;
  let useCase: RunDiscoveryWorkflow;

  beforeEach(() => {
    agent = makeMockAgent();
    useCase = new RunDiscoveryWorkflow(agent);
  });

  it('starts a discovery run and returns runId with status=started', async () => {
    const result = await useCase.execute(
      {
        valueCaseId: '123e4567-e89b-12d3-a456-426614174000',
        companyName: 'Acme Corp',
      },
      mockContext
    );

    expect(result.data.status).toBe('started');
    expect(result.data.runId).toBe('discovery_1234567890_abc1234');
    expect(result.data.valueCaseId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('passes organizationId from context to the agent', async () => {
    await useCase.execute(
      { valueCaseId: '123e4567-e89b-12d3-a456-426614174000', companyName: 'Acme' },
      mockContext
    );

    expect(agent.startDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: mockContext.organizationId })
    );
  });

  it('throws VALIDATION_ERROR for invalid valueCaseId', async () => {
    await expect(
      useCase.execute({ valueCaseId: 'not-a-uuid', companyName: 'Acme' }, mockContext)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws VALIDATION_ERROR for empty companyName', async () => {
    await expect(
      useCase.execute({ valueCaseId: '123e4567-e89b-12d3-a456-426614174000', companyName: '' }, mockContext)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('propagates agent errors', async () => {
    const failingAgent = makeMockAgent({
      startDiscovery: vi.fn().mockRejectedValue(new Error('Agent unavailable')),
    });
    const failingUseCase = new RunDiscoveryWorkflow(failingAgent);

    await expect(
      failingUseCase.execute(
        { valueCaseId: '123e4567-e89b-12d3-a456-426614174000', companyName: 'Acme' },
        mockContext
      )
    ).rejects.toThrow('Agent unavailable');
  });
});
