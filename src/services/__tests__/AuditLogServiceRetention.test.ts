import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogService } from '../AuditLogService';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
      lt: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('AuditLogService retention and immutability', () => {
  let service: AuditLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditLogService();
  });

  it('archives old logs instead of deleting', async () => {
    mockUpdate.mockReturnValue({
      lt: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({ data: [{ id: '1' }, { id: '2' }], error: null }),
    });

    const count = await service.archiveOldLogs('2024-01-01T00:00:00Z');
    expect(count).toBe(2);
    expect(mockUpdate).toHaveBeenCalledWith({ archived: true });
  });

  it('verifies append-only behavior by not exposing delete/update APIs', () => {
    expect(typeof (service as any).deleteEntry).toBe('undefined');
    expect(typeof (service as any).updateEntry).toBe('undefined');
  });
});
