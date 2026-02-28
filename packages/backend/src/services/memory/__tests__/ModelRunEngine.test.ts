import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultBenchmarkProvider, ModelRunEngine } from '../ModelRunEngine.js'

describe('ModelRunEngine Benchmark Hydration Performance', () => {
  let mockSupabase: any;
  let selectSpy: any;
  let inSpy: any;
  let eqSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    selectSpy = vi.fn().mockReturnThis();
    eqSpy = vi.fn().mockReturnThis();
    const singleSpy = vi.fn().mockResolvedValue({
      data: {
        id: 'bench-1',
        parent_id: null,
        version: 1,
        name: 'Benchmark 1',
        industry: 'tech',
        geo: 'US',
        company_size_range: '100-500',
        tier: 2,
        metrics: { value: 1.5 },
        checksum: 'abc',
        is_active: true,
        created_at: new Date(),
      },
      error: null,
    });

    inSpy = vi.fn().mockResolvedValue({
      data: [
        {
            id: 'bench-1',
            parent_id: null,
            version: 1,
            name: 'Benchmark 1',
            industry: 'tech',
            geo: 'US',
            company_size_range: '100-500',
            tier: 2,
            metrics: { value: 1.5 },
            checksum: 'abc',
            is_active: true,
            created_at: new Date(),
        },
        {
            id: 'bench-2',
            parent_id: null,
            version: 1,
            name: 'Benchmark 2',
            industry: 'finance',
            geo: 'EU',
            company_size_range: '500+',
            tier: 1,
            metrics: { value: 2.0 },
            checksum: 'xyz',
            is_active: true,
            created_at: new Date(),
        }
      ],
      error: null,
    });

    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: selectSpy,
      }),
    };

    // Setup chaining for select -> in -> eq
    // Also support select -> eq -> eq -> single (for the old path if we were testing it)

    // For the new path: .select("*").in("id", ...).eq("is_active", true)
    selectSpy.mockReturnValue({
        in: inSpy,
        eq: eqSpy
    });

    inSpy.mockReturnValue({
        eq: eqSpy // Chaining after in
    });

    eqSpy.mockReturnValue({
        eq: eqSpy,
        single: singleSpy,
        // Since inSpy returns a Promise (awaited), we might need to verify what query builder returns.
        // But in Supabase JS, .in() returns the builder which is then awaited.
        // Actually, if we await the chain, the LAST method called should return the promise.
        // In the code: await this.supabase...select().in().eq()
        // So eq() must return the promise.
        then: (resolve: any) => resolve({
            data: [
                { id: 'bench-1', metrics: { value: 1.5 } },
                { id: 'bench-2', metrics: { value: 2.0 } },
                { id: 'bench-3', metrics: { value: 3.0 } }
            ], error: null
        })
    });
  });

  it('verifies N+1 query issue is fixed in hydrateBenchmarks', async () => {
    const provider = new DefaultBenchmarkProvider(mockSupabase);
    const engine = new ModelRunEngine(mockSupabase, provider);
    const benchmarkIds = ['bench-1', 'bench-2', 'bench-3'];

    // Access private method via casting
    await (engine as any).hydrateBenchmarks(benchmarkIds);

    // Expect select to be called 1 time (batch query)
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(inSpy).toHaveBeenCalledTimes(1);
    expect(inSpy).toHaveBeenCalledWith('id', benchmarkIds);
  });
});
