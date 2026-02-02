import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressiveRollout } from '../progressiveRollout.js';

// Setup hoisted mocks
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProgressiveRollout Optimization', () => {
  let rollout: ProgressiveRollout;
  const featureName = 'test-feature';

  beforeEach(() => {
    vi.clearAllMocks();
    rollout = new ProgressiveRollout(featureName);

    // Setup chainable mocks
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ gte: mocks.gte });

    // Complex mock implementation to handle table context
    mocks.from.mockImplementation((table) => {
      const state = { table, filters: {} };
      return {
        select: vi.fn().mockImplementation((cols, options) => {
          state.cols = cols;
          state.options = options;
          return {
            eq: vi.fn().mockImplementation((field, value) => {
              state.filters[field] = value;
              return {
                 eq: vi.fn().mockImplementation((f, v) => { // Support chained eq
                    state.filters[f] = v;
                    return {
                        gte: vi.fn().mockImplementation((field, value) => {
                            state.gteField = field;
                            state.gteValue = value;
                            return Promise.resolve(getMockData(state));
                        })
                    }
                 }),
                 gte: vi.fn().mockImplementation((field, value) => {
                   state.gteField = field;
                   state.gteValue = value;
                   return Promise.resolve(getMockData(state));
                 })
              }
            })
          }
        })
      };
    });
  });

  function getMockData(state) {
    // Verify optimization usage
    if (state.options?.count !== 'exact' || state.options?.head !== true) {
        throw new Error('Optimization not used: missing count: exact or head: true');
    }

    if (state.table === 'feature_usage') {
      // Check if we are filtering by enabled=true
      if (state.filters.enabled === true) {
           return { count: 6, data: null, error: null }; // 6 enabled users
      }
      return { count: 10, data: null, error: null }; // 10 total users
    }
    if (state.table === 'feature_errors') {
      return { count: 2, data: null, error: null }; // 2 errors
    }
    return { count: 0, data: null, error: null };
  }

  it('calculates metrics correctly using optimized count queries', async () => {
    const metrics = await rollout.getMetrics();

    expect(metrics.totalUsers).toBe(10);
    expect(metrics.enabledUsers).toBe(6);
    expect(metrics.errors).toBe(2);
    // Error rate: (2 errors / 6 enabled users) * 100 = 33.333...
    expect(metrics.errorRate).toBeCloseTo(33.333);
  });
});
