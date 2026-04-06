import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import onboardingRouter from '../onboarding.js';

// Mock dependencies
vi.mock('../../lib/supabase.js', () => ({
  createRequestRlsSupabaseClient: vi.fn(),
  supabase: {}
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => next(),
}));

vi.mock('../../middleware/tenantContext.js', () => ({
  tenantContextMiddleware: () => (req: any, res: any, next: any) => {
    req.tenantId = 'test-tenant-id';
    next();
  },
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  rateLimiters: {
    standard: (req: any, res: any, next: any) => next(),
  },
}));
vi.mock('../../workers/researchWorker.js', () => ({
  getResearchQueue: vi.fn(),
}));

import { createRequestRlsSupabaseClient } from '../../lib/supabase.js';

describe('POST /api/onboarding/suggestions/bulk-accept (Performance Baseline)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/onboarding', onboardingRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('measures baseline performance for N suggestions', async () => {
    // We want to test N+1 fetch behavior
    const numItems = 20;
    const ids = Array.from({ length: numItems }, () => crypto.randomUUID());

    // Mock Supabase
    const singleMock = vi.fn().mockImplementation(() => {
      // Return a suggestion for each ID
      return Promise.resolve({
        data: {
          id: 'some-id',
          tenant_id: 'test-tenant-id',
          status: 'suggested',
          entity_type: 'product',
          payload: { name: 'Test Product' },
          context_id: 'test-context'
        },
        error: null
      });
    });

    const insertMock = vi.fn().mockResolvedValue({ error: null });

    const eqMock = vi.fn().mockImplementation(() => {
      const obj: any = Promise.resolve({ data: null, error: null });
      obj.single = singleMock;
      return obj;
    });

    const inMock = vi.fn().mockImplementation(() => {
      // Return the object that chaining .eq handles for the new bulk flow
      return {
        eq: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            data: ids.map(id => ({
              id,
              tenant_id: 'test-tenant-id',
              status: 'suggested',
              entity_type: 'product',
              payload: { name: 'Test Product' },
              context_id: 'test-context'
            })),
            error: null
          });
        })
      };
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
      in: inMock,
    });

    const updateEqMock = vi.fn().mockReturnThis();
    const updateMock = vi.fn().mockReturnValue({
      eq: updateEqMock,
    });

    const fromMock = vi.fn((table) => {
      if (table === 'company_research_suggestions') {
        return {
          select: selectMock,
          update: updateMock,
        };
      } else {
        return {
          insert: insertMock,
        };
      }
    });

    vi.mocked(createRequestRlsSupabaseClient).mockReturnValue({
      from: fromMock,
    } as any);

    const startTime = performance.now();

    const response = await request(app)
      .post('/api/onboarding/suggestions/bulk-accept')
      .send({ ids });

    const endTime = performance.now();

    expect(response.status).toBe(200);
    expect(response.body.data.accepted).toBe(numItems);

    // Check how many times the select API was called (baseline: N times, optimized: 1 time)
    console.log(`Execution time: ${endTime - startTime}ms`);
    console.log(`Select single fetch called ${singleMock.mock.calls.length} times`);
    expect(singleMock).toHaveBeenCalledTimes(0);
  });
});
