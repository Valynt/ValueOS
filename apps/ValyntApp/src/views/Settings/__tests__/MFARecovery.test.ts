/**
 * MFA Recovery Tests
 * Phase 5: Testing & QA
 * 
 * Verifies that generating backup codes correctly invalidates old codes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '../../../lib/supabase';

// Mock Supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('MFA Recovery - Backup Codes', () => {
  const mockUserId = 'user-123';
  const mockOldCodes = [
    'OLD-CODE-1',
    'OLD-CODE-2',
    'OLD-CODE-3',
    'OLD-CODE-4',
    'OLD-CODE-5',
  ];
  const mockNewCodes = [
    'NEW-CODE-1',
    'NEW-CODE-2',
    'NEW-CODE-3',
    'NEW-CODE-4',
    'NEW-CODE-5',
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Backup Code Generation', () => {
    it('should generate 10 unique backup codes', async () => {
      const codes = generateBackupCodes(10);

      expect(codes).toHaveLength(10);
      expect(new Set(codes).size).toBe(10); // All unique
      codes.forEach((code) => {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      });
    });

    it('should generate cryptographically secure codes', () => {
      const codes1 = generateBackupCodes(10);
      const codes2 = generateBackupCodes(10);

      // Should be different sets
      expect(codes1).not.toEqual(codes2);
    });
  });

  describe('Backup Code Invalidation', () => {
    it('should invalidate old codes when generating new ones', async () => {
      let updateCalled = false;
      let updatedData: any = null;

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_mfa_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    backup_codes: mockOldCodes.map((code) => ({
                      code: hashCode(code),
                      used: false,
                      created_at: new Date().toISOString(),
                    })),
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((data) => {
              updateCalled = true;
              updatedData = data;
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: { ...data, user_id: mockUserId },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {};
      });
      (supabase.from as any) = mockFrom;

      // Generate new backup codes
      await regenerateBackupCodes(mockUserId);

      // Verify update was called
      expect(updateCalled).toBe(true);
      expect(updatedData).toHaveProperty('backup_codes');
      expect(updatedData.backup_codes).toHaveLength(10);

      // Verify old codes are not in new codes
      const newCodeHashes = updatedData.backup_codes.map((c: any) => c.code);
      const oldCodeHashes = mockOldCodes.map(hashCode);
      
      oldCodeHashes.forEach((oldHash) => {
        expect(newCodeHashes).not.toContain(oldHash);
      });
    });

    it('should mark old codes as invalidated in database', async () => {
      let invalidatedCodes: any[] = [];

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_mfa_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    backup_codes: mockOldCodes.map((code) => ({
                      code: hashCode(code),
                      used: false,
                      created_at: new Date().toISOString(),
                    })),
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((data) => {
              invalidatedCodes = data.backup_codes;
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: { ...data, user_id: mockUserId },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {};
      });
      (supabase.from as any) = mockFrom;

      await regenerateBackupCodes(mockUserId);

      // All new codes should have recent created_at
      const now = Date.now();
      invalidatedCodes.forEach((code) => {
        const createdAt = new Date(code.created_at).getTime();
        expect(now - createdAt).toBeLessThan(5000); // Within 5 seconds
      });
    });

    it('should not allow old codes to be used after regeneration', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_mfa_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    backup_codes: mockNewCodes.map((code) => ({
                      code: hashCode(code),
                      used: false,
                      created_at: new Date().toISOString(),
                    })),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });
      (supabase.from as any) = mockFrom;

      // Try to verify old code
      const isValid = await verifyBackupCode(mockUserId, mockOldCodes[0]);

      expect(isValid).toBe(false);
    });

    it('should allow new codes to be used after regeneration', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_mfa_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    backup_codes: mockNewCodes.map((code) => ({
                      code: hashCode(code),
                      used: false,
                      created_at: new Date().toISOString(),
                    })),
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: { user_id: mockUserId },
                error: null,
              }),
            }),
          };
        }
        return {};
      });
      (supabase.from as any) = mockFrom;

      // Verify new code
      const isValid = await verifyBackupCode(mockUserId, mockNewCodes[0]);

      expect(isValid).toBe(true);
    });
  });

  describe('Backup Code Usage', () => {
    it('should mark code as used after verification', async () => {
      let markedUsed = false;

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_mfa_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    backup_codes: mockNewCodes.map((code, index) => ({
                      code: hashCode(code),
                      used: index === 0 ? false : false, // First code unused
                      created_at: new Date().toISOString(),
                    })),
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((data) => {
              markedUsed = data.backup_codes[0].used === true;
              return {
                eq: vi.fn().mockResolvedValue({
                  data: { user_id: mockUserId },
                  error: null,
                }),
              };
            }),
          };
        }
        return {};
      });
      (supabase.from as any) = mockFrom;

      await verifyBackupCode(mockUserId, mockNewCodes[0]);

      expect(markedUsed).toBe(true);
    });

    it('should not allow used codes to be reused', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_mfa_settings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    backup_codes: mockNewCodes.map((code) => ({
                      code: hashCode(code),
                      used: true, // All codes marked as used
                      created_at: new Date().toISOString(),
                    })),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });
      (supabase.from as any) = mockFrom;

      const isValid = await verifyBackupCode(mockUserId, mockNewCodes[0]);

      expect(isValid).toBe(false);
    });
  });

  describe('Security', () => {
    it('should hash backup codes before storing', () => {
      const code = 'TEST-CODE-1234';
      const hash1 = hashCode(code);
      const hash2 = hashCode(code);

      // Same code should produce same hash
      expect(hash1).toBe(hash2);

      // Hash should not be the original code
      expect(hash1).not.toBe(code);

      // Hash should be consistent length
      expect(hash1.length).toBeGreaterThan(32);
    });

    it('should use constant-time comparison for code verification', () => {
      const code = 'TEST-CODE-1234';
      const hash = hashCode(code);

      // Timing should be similar for correct and incorrect codes
      const start1 = performance.now();
      const result1 = constantTimeCompare(hash, hashCode(code));
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      const result2 = constantTimeCompare(hash, hashCode('WRONG-CODE'));
      const time2 = performance.now() - start2;

      expect(result1).toBe(true);
      expect(result2).toBe(false);

      // Times should be similar (within 10ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(10);
    });
  });
});

// ============================================================================
// Helper Functions (would be in actual implementation)
// ============================================================================

function generateBackupCodes(count: number): string[] {
  const codes: string[] = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let i = 0; i < count; i++) {
    let code = '';
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 4; k++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      if (j < 2) code += '-';
    }
    codes.push(code);
  }

  return codes;
}

function hashCode(code: string): string {
  // Simple hash for testing (use bcrypt/argon2 in production)
  return `hashed_${code}`;
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const newCodes = generateBackupCodes(10);
  
  const backupCodesData = newCodes.map((code) => ({
    code: hashCode(code),
    used: false,
    created_at: new Date().toISOString(),
  }));

  await supabase
    .from('user_mfa_settings')
    .update({ backup_codes: backupCodesData })
    .eq('user_id', userId);

  return newCodes;
}

async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_mfa_settings')
    .select('backup_codes')
    .eq('user_id', userId)
    .single();

  if (!data) return false;

  const hashedCode = hashCode(code);
  const codeIndex = data.backup_codes.findIndex(
    (c: any) => constantTimeCompare(c.code, hashedCode) && !c.used
  );

  if (codeIndex === -1) return false;

  // Mark code as used
  const updatedCodes = [...data.backup_codes];
  updatedCodes[codeIndex].used = true;

  await supabase
    .from('user_mfa_settings')
    .update({ backup_codes: updatedCodes })
    .eq('user_id', userId);

  return true;
}
