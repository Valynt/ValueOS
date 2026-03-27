import { vi } from "vitest";

import { FinancialModelRow, getFinancialModelForCase, getValueCase, listValueDriversForCase, ValueCaseRow, ValueDriverRow } from '../db/rows';

describe('Value Domain DB Row Access', () => {
  const supabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'vc1', tenant_id: 't1', state: 'draft' }, error: null }),
  } as any;

  it('getValueCase returns a value case', async () => {
    const result = await getValueCase(supabase, 't1', 'vc1');
    expect(result).toBeTruthy();
    expect(result?.tenant_id).toBe('t1');
  });

  it('listValueDriversForCase returns drivers', async () => {
    // Reset the mock chain to return a list result (not a single row).
    // The query calls .from().select().eq().eq() — two chained eq() calls.
    const listResult = { data: [{ id: 'd1', tenant_id: 't1', value_case_id: 'vc1', label: 'Driver', driver_type: 'type' }], error: null };
    const eqChain = { eq: vi.fn().mockResolvedValue(listResult) };
    supabase.from = vi.fn().mockReturnThis();
    supabase.select = vi.fn().mockReturnThis();
    supabase.eq = vi.fn().mockReturnValue(eqChain);
    supabase.single = undefined;

    const result = await listValueDriversForCase(supabase, 't1', 'vc1');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.tenant_id).toBe('t1');
  });

  it('getFinancialModelForCase returns a model', async () => {
    // Rebuild the full chain: .from().select().eq().eq().single()
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'fm1', tenant_id: 't1', value_case_id: 'vc1' }, error: null });
    const innerChain = { single: singleMock };
    const eqChain2 = { eq: vi.fn().mockReturnValue(innerChain) };
    supabase.from = vi.fn().mockReturnThis();
    supabase.select = vi.fn().mockReturnThis();
    supabase.eq = vi.fn().mockReturnValue(eqChain2);
    supabase.single = singleMock;

    const result = await getFinancialModelForCase(supabase, 't1', 'vc1');
    expect(result).toBeTruthy();
    expect(result?.tenant_id).toBe('t1');
  });
});
