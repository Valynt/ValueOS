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
    supabase.select = vi.fn().mockReturnThis();
    supabase.eq = vi.fn().mockReturnThis();
    supabase.from = vi.fn().mockReturnThis();
    supabase.single = undefined;
    supabase.then = undefined;
    supabase.mockResolvedValue = undefined;
    supabase.mockReturnValue = undefined;
    supabase.mockImplementation = undefined;
    supabase.mockClear = undefined;
    supabase.mockReset = undefined;
    supabase.mockRestore = undefined;
    supabase.mockRejectedValue = undefined;
    supabase.mock.calls = [];
    supabase.mock.instances = [];
    supabase.mockClear = undefined;
    supabase.mockReset = undefined;
    supabase.mockRestore = undefined;
    supabase.mockRejectedValue = undefined;
    supabase.mock.calls = [];
    supabase.mock.instances = [];
    supabase.mockClear = undefined;
    supabase.mockReset = undefined;
    supabase.mockRestore = undefined;
    supabase.mockRejectedValue = undefined;
    supabase.mock.calls = [];
    supabase.mock.instances = [];
    supabase.mockResolvedValue = vi.fn().mockResolvedValue({ data: [{ id: 'd1', tenant_id: 't1', value_case_id: 'vc1', label: 'Driver', driver_type: 'type' }], error: null });
    const result = await listValueDriversForCase(supabase, 't1', 'vc1');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.tenant_id).toBe('t1');
  });

  it('getFinancialModelForCase returns a model', async () => {
    supabase.single = vi.fn().mockResolvedValue({ data: { id: 'fm1', tenant_id: 't1', value_case_id: 'vc1' }, error: null });
    const result = await getFinancialModelForCase(supabase, 't1', 'vc1');
    expect(result).toBeTruthy();
    expect(result?.tenant_id).toBe('t1');
  });
});
