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
      in: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockImplementation(async () => {
        // Simulate network latency for inserts
        await new Promise(resolve => setTimeout(resolve, 5));
        return { error: null };
      }),
      update: vi.fn().mockReturnThis(),
    };

    // We need 'in' to resolve data for the prefetch
    mockSupabase.in.mockImplementation((column: string, idsArray: string[]) => {
      if (column === 'id' && Array.isArray(idsArray)) {
        const eqChain = {
          eq: vi.fn().mockReturnValue(Promise.resolve({
            data: idsArray.map(id => ({
              id,
              status: 'suggested',
              entity_type: 'product',
              payload: { name: 'Test Product ' + id },
              context_id: 'test-context',
              tenant_id: 'test-tenant-id'
            })),
            error: null
          }))
        };
        return eqChain as any;
      }
      return Promise.resolve({ data: {}, error: null }) as any;
    });

    // We need update() to resolve
    mockSupabase.update.mockImplementation(() => {
      const chain = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };

      const promiseObj = Promise.resolve({ data: {}, error: null });
      Object.assign(chain.eq, promiseObj);
      Object.assign(chain.in, promiseObj);

      chain.eq.mockReturnValue(Promise.resolve({ data: {}, error: null }));
      chain.in.mockImplementation(() => {
        return Promise.resolve({ data: {}, error: null });
      });

      return chain as any;
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

    // For baseline, it inserts N times. Once optimized, it should insert 1 time (as all are 'product' entity_type)
    console.log(`Number of insert calls: ${mockSupabase.insert.mock.calls.length}`);
  });
});
