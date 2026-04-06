import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import onboardingRouter from '../onboarding.js';

// Mock dependencies
vi.mock('../../lib/supabase.js', () => {
  return {
    assertNotTestEnv: vi.fn(),
    createRequestRlsSupabaseClient: vi.fn(),
    supabase: {},
    supabaseClient: {}
  };
});
vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => next(),
}));
vi.mock('../../middleware/rateLimiter.js', () => ({
  rateLimiters: {
    standard: (req: any, res: any, next: any) => next(),
    loose: (req: any, res: any, next: any) => next(),
  },
}));
vi.mock('../../middleware/securityMiddleware.js', () => ({
  securityHeadersMiddleware: (req: any, res: any, next: any) => next(),
}));
vi.mock('../../middleware/tenantContext.js', () => ({
  tenantContextMiddleware: () => (req: any, res: any, next: any) => {
    req.tenantId = 'test-tenant-id';
    next();
  },
}));

// Mock workers
vi.mock('../../workers/researchWorker.js', () => ({
  getResearchQueue: () => ({ add: vi.fn() })
}));

import { createRequestRlsSupabaseClient } from '../../lib/supabase.js';

const app = express();
app.use(express.json());
app.use('/api/onboarding', onboardingRouter);

describe('Onboarding API Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bulk-accept performance baseline', async () => {
    // Generate 50 mock IDs
    const ids = Array.from({ length: 50 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ error: null }), 10))),
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };

    // Prefetch mock for .in().eq()
    mockSupabase.in.mockImplementation((field, values) => {
      return {
        eq: vi.fn().mockImplementation((eqField, eqValue) => {
          if (field === 'id' && eqField === 'tenant_id' && eqValue === 'test-tenant-id') {
            return Promise.resolve({
              data: values.map((id: string) => ({
                id,
                status: 'suggested',
                entity_type: 'product',
                payload: { name: 'Test Product' },
                context_id: 'test-context',
              })),
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        })
      };
    });

    // Setup single() to return a mock suggestion
    mockSupabase.single.mockImplementation(() => {
      return Promise.resolve({
        data: {
          id: 'test-id',
          status: 'suggested',
          entity_type: 'product',
          payload: { name: 'Test Product' },
          context_id: 'test-context',
        },
        error: null,
      });
    });

    // We need update() to resolve
    mockSupabase.update.mockImplementation(() => {
      const chain = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnValue(Promise.resolve({ data: {}, error: null })),
      };

      const promiseObj = Promise.resolve({ data: {}, error: null });
      Object.assign(chain.eq, promiseObj);

      chain.eq.mockReturnValue(Promise.resolve({ data: {}, error: null }));

      return chain;
    });

    (createRequestRlsSupabaseClient as any).mockReturnValue(mockSupabase);

    const start = performance.now();

    const res = await request(app)
      .post('/api/onboarding/suggestions/bulk-accept')
      .send({ ids });

    const end = performance.now();

    expect(res.status).toBe(200);
    console.log(`Bulk accept 50 items took: ${end - start}ms`);

    // Verify it works correctly
    expect(res.body.data.accepted).toBe(50);
    expect(mockSupabase.update).toHaveBeenCalledTimes(1);
    // mockSupabase.in isn't called directly on mockSupabase in our chain mock, it's chained
  });
});
