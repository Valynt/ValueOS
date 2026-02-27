
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssumptionService } from '../AssumptionService.js'
import { supabase } from '../../lib/supabase.js'

// Mock supabase client
vi.mock('../../lib/supabase', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return {
    supabase: mockSupabase
  };
});

describe('AssumptionService', () => {
  let assumptionService: AssumptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    assumptionService = new AssumptionService();
  });

  it('should update an assumption successfully', async () => {
    const assumptionId = 'test-id';
    const updates = { content: 'updated content' };
    const mockData = { id: assumptionId, ...updates };

    (supabase.from('assumptions').select().single as any).mockResolvedValue({
      data: mockData,
      error: null
    });

    const result = await assumptionService.updateAssumption(assumptionId, updates);

    expect(supabase.from).toHaveBeenCalledWith('assumptions');
    expect(supabase.from('assumptions').update).toHaveBeenCalledWith(updates);
    expect(supabase.from('assumptions').eq).toHaveBeenCalledWith('id', assumptionId);
    expect(result).toEqual({
      assumptionId,
      updated: true,
      data: mockData
    });
  });

  it('should throw an error if update fails', async () => {
    const assumptionId = 'test-id';
    const updates = { content: 'updated content' };
    const mockError = { message: 'Update failed' };

    (supabase.from('assumptions').select().single as any).mockResolvedValue({
      data: null,
      error: mockError
    });

    await expect(assumptionService.updateAssumption(assumptionId, updates))
      .rejects.toThrow('Failed to update assumption: Update failed');
  });

  it('should fetch an assumption successfully', async () => {
    const assumptionId = 'test-id';
    const mockData = { id: assumptionId, content: 'content' };

    (supabase.from('assumptions').select().single as any).mockResolvedValue({
      data: mockData,
      error: null
    });

    const result = await assumptionService.getAssumption(assumptionId);

    expect(supabase.from).toHaveBeenCalledWith('assumptions');
    expect(supabase.from('assumptions').eq).toHaveBeenCalledWith('id', assumptionId);
    expect(result).toEqual(mockData);
  });

  it('should throw an error if fetch fails', async () => {
    const assumptionId = 'test-id';
    const mockError = { message: 'Fetch failed' };

    (supabase.from('assumptions').select().single as any).mockResolvedValue({
      data: null,
      error: mockError
    });

    await expect(assumptionService.getAssumption(assumptionId))
      .rejects.toThrow('Failed to fetch assumption: Fetch failed');
  });
});
