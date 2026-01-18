
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emailService } from '../EmailService';

// Mock dependencies
vi.mock('../EmailService', () => ({
  emailService: {
    send: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config
vi.mock('../config/environment', () => ({
  getConfig: vi.fn().mockReturnValue({
    email: { enabled: true },
    features: { billing: true, usageTracking: true },
  }),
}));

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

// Chain setup
mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ single: mockSingle, eq: mockEq }); // Allow chaining eq
mockSingle.mockReturnValue(Promise.resolve({ data: {}, error: null }));

const mockSupabase = {
  from: vi.fn().mockReturnValue({ select: mockSelect }),
  storage: { from: vi.fn().mockReturnValue({ upload: vi.fn() }) },
};

vi.mock('../lib/supabase', () => ({
  createServerSupabaseClient: vi.fn().mockReturnValue(mockSupabase),
}));

import { deprovisionTenant } from '../TenantProvisioning';

describe('TenantProvisioning - sendDeactivationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send deactivation email when deprovisioning', async () => {
    const orgId = 'org-123';
    const userId = 'user-123';
    const email = 'owner@example.com';
    const orgName = 'Test Org';

    // Mock sequence of Supabase calls
    mockSupabase.from.mockImplementation((table) => {
         if (table === 'information_schema.tables') {
             return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
         }
        if (table === 'organizations') {
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { name: orgName }, error: null })
                    })
                }),
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null })
                })
            }
        }
        if (table === 'user_tenants') {
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                             single: vi.fn().mockResolvedValue({ data: { user_id: userId }, error: null })
                        })
                    })
                })
            }
        }
        if (table === 'users') {
             return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { email }, error: null })
                    })
                })
            }
        }
        // Fallback for other tables used in deprovisioning (archives, etc)
        return {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ data: [], error: null }) })
            }),
            update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ error: null }) })
            }),
            upsert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({data:{}, error: null}) }) })
        }
    });

    // Simplification: mocking SubscriptionService
    vi.mock('../billing/SubscriptionService', () => ({
        default: {
            cancelSubscription: vi.fn().mockResolvedValue(undefined)
        }
    }));

    await deprovisionTenant(orgId, 'Violation of terms');

    // Debug output if fails
    // console.log(emailService.send.mock.calls);

    expect(emailService.send).toHaveBeenCalledWith({
      to: email,
      subject: `Account Deactivation - ${orgName}`,
      template: 'deactivation',
      data: {
        organizationName: orgName,
        reason: 'Violation of terms',
      },
    });
  });
});
