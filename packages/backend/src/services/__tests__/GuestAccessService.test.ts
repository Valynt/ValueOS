/**
 * Guest Access Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGuestAccessService } from '../GuestAccessService.js'

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

describe('GuestAccessService', () => {
  let guestService: ReturnType<typeof getGuestAccessService>;

  beforeEach(() => {
    vi.clearAllMocks();
    guestService = getGuestAccessService();

    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'admin@example.com',
        },
      },
    });
  });

  describe('createGuestUser', () => {
    it('should create a new guest user', async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'guest-123',
          email: 'guest@example.com',
          name: 'John Guest',
          company: 'Acme Corp',
          role: 'Prospect',
          organization_id: 'org-123',
          created_by: 'user-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });
      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const result = await guestService.createGuestUser({
        email: 'guest@example.com',
        name: 'John Guest',
        company: 'Acme Corp',
        role: 'Prospect',
        organizationId: 'org-123',
      });

      expect(result.email).toBe('guest@example.com');
      expect(result.name).toBe('John Guest');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'guest@example.com',
          name: 'John Guest',
        })
      );
    });

    it('should handle duplicate guest user', async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: null,
          error: { code: '23505' }, // Unique constraint violation
        })
        .mockResolvedValueOnce({
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

      const mockEq = vi.fn().mockReturnThis();

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });
      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });
      mockEq.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      });

      const result = await guestService.createGuestUser({
        email: 'guest@example.com',
        name: 'John Guest',
        organizationId: 'org-123',
      });

      expect(result.email).toBe('guest@example.com');
    });
  });

  describe('createGuestToken', () => {
    it('should create a guest access token', async () => {
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
      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const result = await guestService.createGuestToken({
        guestUserId: 'guest-123',
        valueCaseId: 'vc-123',
      });

      expect(result.token).toBeDefined();
      expect(result.magicLink).toContain('token=');
      expect(result.token.permissions.can_view).toBe(true);
    });

    it('should create token with custom permissions', async () => {
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
            can_comment: true,
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
      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const result = await guestService.createGuestToken({
        guestUserId: 'guest-123',
        valueCaseId: 'vc-123',
        permissions: {
          can_comment: true,
        },
      });

      expect(result.token.permissions.can_comment).toBe(true);
    });

    it('should create token with custom expiration', async () => {
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
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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
      mockInsert.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const result = await guestService.createGuestToken({
        guestUserId: 'guest-123',
        valueCaseId: 'vc-123',
        expiresInDays: 7,
      });

      expect(result.token).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            is_valid: true,
            guest_user_id: 'guest-123',
            value_case_id: 'vc-123',
            permissions: {
              can_view: true,
              can_comment: false,
              can_edit: false,
            },
            guest_name: 'John Guest',
            guest_email: 'guest@example.com',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            error_message: null,
          },
        ],
        error: null,
      });

      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });
      mockUpdate.mockReturnValue({
        eq: mockEq,
      });

      const result = await guestService.validateToken('valid-token');

      expect(result.isValid).toBe(true);
      expect(result.guestUserId).toBe('guest-123');
      expect(result.valueCaseId).toBe('vc-123');
      expect(result.expiresAt).toBeDefined();
    });

    it('should reject invalid token', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            is_valid: false,
            error_message: 'Token not found',
          },
        ],
        error: null,
      });

      const result = await guestService.validateToken('invalid-token');

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Token not found');
    });

    it('should reject expired token', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            is_valid: false,
            error_message: 'Token has expired',
          },
        ],
        error: null,
      });

      const result = await guestService.validateToken('expired-token');

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Token has expired');
    });

    it('should reject revoked token', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            is_valid: false,
            error_message: 'Token has been revoked',
          },
        ],
        error: null,
      });

      const result = await guestService.validateToken('revoked-token');

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Token has been revoked');
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await guestService.revokeToken('token-123', 'Security concern');

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('revoke_guest_token', {
        token_value: 'token-123',
        revoked_by_user: 'user-123',
        reason: 'Security concern',
      });
    });
  });

  describe('logActivity', () => {
    it('should log guest activity', async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      await guestService.logActivity(
        'guest-123',
        'token-123',
        'vc-123',
        'view_element',
        'org-123',
        { elementId: 'elem-456' }
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          guest_user_id: 'guest-123',
          guest_access_token_id: 'token-123',
          value_case_id: 'vc-123',
          activity_type: 'view_element',
          organization_id: 'org-123',
          activity_data: { elementId: 'elem-456' },
        })
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 5,
        error: null,
      });

      const result = await guestService.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_expired_guest_tokens');
    });
  });
});
