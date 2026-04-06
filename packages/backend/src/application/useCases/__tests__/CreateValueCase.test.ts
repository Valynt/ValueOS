/**
 * CreateValueCase — Unit Tests
 *
 * Tests the use case in isolation with mocked dependencies.
 * No HTTP, no database, no Express.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateValueCase } from '../CreateValueCase.js';
import type { ValueCaseRepository, CreatedValueCase } from '../CreateValueCase.js';
import type { RequestContext } from '../../types.js';

// ============================================================================
// Fixtures
// ============================================================================

const mockContext: RequestContext = {
  organizationId: 'org-123e4567-e89b-12d3-a456-426614174000',
  userId: 'user-123e4567-e89b-12d3-a456-426614174001',
  roles: ['member'],
  traceId: 'trace-abc123',
  correlationId: 'corr-abc123',
  planTier: 'pro',
};

const mockCreatedCase: CreatedValueCase = {
  id: 'case-123e4567-e89b-12d3-a456-426614174002',
  name: 'Acme Corp Value Case',
  company: 'Acme Corp',
  description: 'Reduce operational costs',
  status: 'draft',
  phase: 'discovery',
  organizationId: mockContext.organizationId,
  createdAt: '2026-04-05T00:00:00Z',
  updatedAt: '2026-04-05T00:00:00Z',
};

// ============================================================================
// Mock repository
// ============================================================================

function makeMockRepo(overrides?: Partial<ValueCaseRepository>): ValueCaseRepository {
  return {
    create: vi.fn().mockResolvedValue(mockCreatedCase),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('CreateValueCase', () => {
  let repo: ValueCaseRepository;
  let useCase: CreateValueCase;

  beforeEach(() => {
    repo = makeMockRepo();
    useCase = new CreateValueCase(repo);
  });

  it('creates a value case and returns it wrapped in UseCaseResult', async () => {
    const result = await useCase.execute(
      { name: 'Acme Corp Value Case', company: 'Acme Corp', description: 'Reduce operational costs' },
      mockContext
    );

    expect(result.data).toMatchObject({
      id: mockCreatedCase.id,
      name: 'Acme Corp Value Case',
      company: 'Acme Corp',
    });
    expect(result.meta?.traceId).toBe(mockContext.traceId);
  });

  it('passes organizationId and userId to the repository', async () => {
    await useCase.execute(
      { name: 'Test Case', company: 'TestCo' },
      mockContext
    );

    expect(repo.create).toHaveBeenCalledWith(
      mockContext.organizationId,
      mockContext.userId,
      expect.objectContaining({ name: 'Test Case', company: 'TestCo' })
    );
  });

  it('throws VALIDATION_ERROR for missing required fields', async () => {
    await expect(
      useCase.execute({ name: '', company: 'TestCo' }, mockContext)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws VALIDATION_ERROR for invalid URL in website field', async () => {
    await expect(
      useCase.execute({ name: 'Test', company: 'TestCo', website: 'not-a-url' }, mockContext)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('propagates repository errors', async () => {
    const failingRepo = makeMockRepo({
      create: vi.fn().mockRejectedValue(new Error('DB connection failed')),
    });
    const failingUseCase = new CreateValueCase(failingRepo);

    await expect(
      failingUseCase.execute({ name: 'Test', company: 'TestCo' }, mockContext)
    ).rejects.toThrow('DB connection failed');
  });

  it('includes durationMs in meta', async () => {
    const result = await useCase.execute(
      { name: 'Test', company: 'TestCo' },
      mockContext
    );
    expect(typeof result.meta?.durationMs).toBe('number');
    expect(result.meta!.durationMs).toBeGreaterThanOrEqual(0);
  });
});
