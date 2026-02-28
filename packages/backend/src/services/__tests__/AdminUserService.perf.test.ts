import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminUserService } from '../AdminUserService.js'

// Hoist the mock object so it's available in the mock factory
const mocks = vi.hoisted(() => {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        admin: {
          getUserById: vi.fn(),
          listUsers: vi.fn(),
        },
      },
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

  it('uses auth admin listUsers batch fetch in listTenantUsers', async () => {
    const userCount = 20;
    const latencyPerCall = 10; // ms

    // Mock tenant users
    const mockTenantUsers = Array.from({ length: userCount }, (_, i) => ({
      user_id: `user-${i}`,
      role: 'member',
      status: 'active',
      created_at: new Date().toISOString(),
    }));

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === 'user_tenants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockTenantUsers, error: null }),
          }),
        };
      }

      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const mockUsersData = Array.from({ length: userCount }, (_, i) => ({
      id: `user-${i}`,
      email: `user-${i}@example.com`,
      user_metadata: { full_name: `User user-${i}` },
      last_sign_in_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }));

    mocks.supabase.auth.admin.listUsers.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, latencyPerCall));
      return { data: { users: mockUsersData }, error: null };
    });

    // Mock N+1 getUserById (should NOT be called)
    mocks.supabase.auth.admin.getUserById.mockImplementation(async () => {
      throw new Error('Should not be called!');
    });

    const start = Date.now();
    const result = await service.listTenantUsers('tenant-1');
    const duration = Date.now() - start;

    console.log(`[Optimized] Duration for ${userCount} users: ${duration}ms`);
    console.log(`[Optimized] getUserById calls: ${mocks.supabase.auth.admin.getUserById.mock.calls.length}`);

    // Verify optimization
    expect(mocks.supabase.auth.admin.getUserById).toHaveBeenCalledTimes(0);
    expect(mocks.supabase.auth.admin.listUsers).toHaveBeenCalledTimes(1);

    // Verify data integrity
    expect(result).toHaveLength(userCount);
    expect(result[0].fullName).toBe('User user-0');
  });
});
