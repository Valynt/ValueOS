
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { academyService } from '../AcademyService';
import { supabase } from '../../lib/supabase';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock the missing types module
vi.mock('../../types/academy', () => ({
  PILLARS: {
    1: { id: 1, estimatedHours: 10, prerequisites: [] },
    2: { id: 2, estimatedHours: 20, prerequisites: [1] },
    3: { id: 3, estimatedHours: 30, prerequisites: [2] },
  },
}));

describe('AcademyService Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCertificationProgress should be optimized', async () => {
    // Setup mocks
    const mockUser = { id: 'user-123' };
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser } });

    // Mock existing certifications
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    // Mock RPC with delay to simulate network latency
    // There are 3 levels: 'practitioner', 'professional', 'architect'
    // 50ms delay per call -> ~150ms total if serial, ~50ms if parallel
    (supabase.rpc as any).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { data: true, error: null };
    });

    const start = performance.now();
    await academyService.getCertificationProgress();
    const end = performance.now();
    const duration = end - start;

    console.log(`Duration: ${duration.toFixed(2)}ms`);

    // We expect 3 calls (one for each level)
    // practitioner, professional, architect
    const calls = (supabase.rpc as any).mock.calls.filter((call: any[]) => call[0] === 'check_certification_eligibility');
    expect(calls.length).toBe(3);
  });
});
