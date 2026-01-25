import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminUserService } from '../AdminUserService';

// Hoist the mock object so it's available in the mock factory
const mocks = vi.hoisted(() => {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        admin: {
          getUserById: vi.fn(),
        },
      },
      schema: vi.fn(),
    },
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: () => mocks.supabase,
}));

vi.mock('../../lib/logger', () => ({
  logger: mocks.logger,
}));

// Mock AuditLogService to avoid its own initialization and side effects
vi.mock('../AuditLogService', () => ({
  AuditLogService: class {
    logAudit = vi.fn().mockResolvedValue({});
  },
}));

describe('AdminUserService Performance', () => {
  let service: AdminUserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminUserService();
    // Force inject the mock client to bypass constructor environment checks
    (service as any).supabase = mocks.supabase;
  });

  it('demonstrates N+1 query inefficiency in listTenantUsers', async () => {
    const userCount = 20;
    const latencyPerCall = 10; // ms

    // Mock tenant users
    const mockTenantUsers = Array.from({ length: userCount }, (_, i) => ({
      user_id: `user-${i}`,
      role: 'member',
      status: 'active',
      created_at: new Date().toISOString(),
    }));

    mocks.supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: mockTenantUsers, error: null }),
      }),
    });

    // Mock Bulk Fetch (Single Query)
    const mockUsersData = Array.from({ length: userCount }, (_, i) => ({
      id: `user-${i}`,
      email: `user-${i}@example.com`,
      raw_user_meta_data: { full_name: `User user-${i}` },
      last_sign_in_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }));

    // Setup chain for schema('auth').from('users').select(...).in(...)
    const mockIn = vi.fn().mockImplementation(async () => {
       await new Promise((resolve) => setTimeout(resolve, latencyPerCall)); // 1 query latency
       return { data: mockUsersData, error: null };
    });

    const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    mocks.supabase.schema.mockReturnValue({ from: mockFrom });

    // Mock N+1 getUserById (should NOT be called)
    mocks.supabase.auth.admin.getUserById.mockImplementation(async () => {
      throw new Error("Should not be called!");
    });

    const start = Date.now();
    const result = await service.listTenantUsers('tenant-1');
    const duration = Date.now() - start;

    console.log(`[Optimized] Duration for ${userCount} users: ${duration}ms`);
    console.log(`[Optimized] getUserById calls: ${mocks.supabase.auth.admin.getUserById.mock.calls.length}`);

    // Verify optimization
    expect(mocks.supabase.auth.admin.getUserById).toHaveBeenCalledTimes(0);
    expect(mocks.supabase.schema).toHaveBeenCalledWith('auth');
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockSelect).toHaveBeenCalled();
    expect(mockIn).toHaveBeenCalled();

    // Verify data integrity
    expect(result).toHaveLength(userCount);
    expect(result[0].fullName).toBe('User user-0');
  });
});
