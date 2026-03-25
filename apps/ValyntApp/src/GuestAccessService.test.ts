import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSupabase, mockLogger } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./lib/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('./lib/logger', () => ({
  logger: mockLogger,
}));

import { getGuestAccessService } from './GuestAccessService';
import { logger } from './lib/logger';

describe('GuestAccessService (frontend)', () => {
  let guestService: ReturnType<typeof getGuestAccessService>;

  beforeEach(() => {
    vi.clearAllMocks();
    guestService = getGuestAccessService();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'admin@example.com',
        },
      },
    });
  });

  it('generates fragment-based magic links instead of query tokens', async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'token-123',
        guest_user_id: 'guest-123',
        value_case_id: 'vc-123',
        token: 'secure-token-123',
        permissions: {
          can_view: true,
          can_comment: false,
          can_edit: false,
        },
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        access_count: 0,
        revoked: false,
        created_by: 'user-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      insert: mockInsert,
    });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });

    const result = await guestService.createGuestToken({
      guestUserId: 'guest-123',
      valueCaseId: 'vc-123',
    });

    expect(result.magicLink).toContain('#token=');
    expect(result.magicLink).not.toContain('?token=');
  });

  it('redacts token substrings in structured warning logs', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{
        is_valid: false,
        error_message: 'Token not found',
      }],
      error: null,
    });

    const token = 'invalid-token-123456';
    const result = await guestService.validateToken(token);

    expect(result.isValid).toBe(false);

    const warnPayload = JSON.stringify(vi.mocked(logger.warn).mock.calls[0]?.[1]);
    expect(warnPayload).toContain('token:');
    expect(warnPayload).not.toContain(token);
    expect(warnPayload).not.toContain(token.substring(0, 10));
  });

  it('redacts recipient identifiers in structured info logs', async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'guest-123',
        email: 'guest@example.com',
        name: 'John Guest',
        organization_id: 'org-123',
        created_by: 'user-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });

    await guestService.createGuestUser({
      email: 'guest@example.com',
      name: 'John Guest',
      organizationId: 'org-123',
    });

    const infoPayload = JSON.stringify(vi.mocked(logger.info).mock.calls[0]?.[1]);
    expect(infoPayload).toContain('recipient:');
    expect(infoPayload).not.toContain('guest@example.com');
  });
});
