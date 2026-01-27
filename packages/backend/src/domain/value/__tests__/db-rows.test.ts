import { getValueCase, listValueDriversForCase, getFinancialModelForCase, ValueCaseRow, ValueDriverRow, FinancialModelRow } from '../db/rows';

describe('Value Domain DB Row Access', () => {
  const supabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'vc1', tenant_id: 't1', state: 'draft' }, error: null }),
  } as any;

  it('getValueCase returns a value case', async () => {
    const result = await getValueCase(supabase, 't1', 'vc1');
    expect(result).toBeTruthy();
    expect(result?.tenant_id).toBe('t1');
  });

  it('listValueDriversForCase returns drivers', async () => {
    supabase.select = jest.fn().mockReturnThis();
    supabase.eq = jest.fn().mockReturnThis();
    supabase.from = jest.fn().mockReturnThis();
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
    supabase.mockResolvedValue = jest.fn().mockResolvedValue({ data: [{ id: 'd1', tenant_id: 't1', value_case_id: 'vc1', label: 'Driver', driver_type: 'type' }], error: null });
    const result = await listValueDriversForCase(supabase, 't1', 'vc1');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.tenant_id).toBe('t1');
  });

  it('getFinancialModelForCase returns a model', async () => {
    supabase.single = jest.fn().mockResolvedValue({ data: { id: 'fm1', tenant_id: 't1', value_case_id: 'vc1' }, error: null });
    const result = await getFinancialModelForCase(supabase, 't1', 'vc1');
    expect(result).toBeTruthy();
    expect(result?.tenant_id).toBe('t1');
  });
});
