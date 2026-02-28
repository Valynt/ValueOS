import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Context } from '../../src/data/_core/trpc';
import { appRouter } from '../../src/data/routers/index';

/**
 * Integration tests for authentication flow
 * Tests the complete auth journey from login to logout
 */

// Mock database
vi.mock('../../src/data/db', () => ({
  getUserByOpenId: vi.fn(async (openId: string) => {
    if (openId === 'test-user-123') {
      return {
        id: 'user-uuid-123',
        openId: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        vosRole: 'Sales',
        maturityLevel: 1,
        createdAt: new Date(),
        lastSignedIn: new Date(),
      };
    }
    return null;
  }),
  upsertUser: vi.fn(async () => {}),
  getUserById: vi.fn(async (id: string) => {
    if (id === 'user-uuid-123') {
      return {
        id: 'user-uuid-123',
        openId: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        vosRole: 'Sales',
        maturityLevel: 1,
        createdAt: new Date(),
        lastSignedIn: new Date(),
      };
    }
    return null;
  }),
  updateUserVosRole: vi.fn(async () => {}),
  updateUserMaturityLevel: vi.fn(async () => {}),
}));

describe('Authentication Integration Tests', () => {
  let mockContext: Context;
  let mockRes: any;

  beforeEach(() => {
    mockRes = {
      setHeader: vi.fn(),
      statusCode: 200,
    };

    mockContext = {
      req: {
        headers: {},
      },
      res: mockRes,
      user: null,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Unauthenticated User Flow', () => {
    it('should return null for unauthenticated user', async () => {
      const caller = appRouter.createCaller(mockContext);
      const result = await caller.auth.me();

      expect(result).toBeNull();
    });

    it('should allow access to public procedures', async () => {
      const caller = appRouter.createCaller(mockContext);
      
      // System health should work without auth
      const health = await caller.system.health();
      expect(health.status).toBeDefined();

      // Pillars list should work without auth
      const pillars = await caller.pillars.list();
      expect(Array.isArray(pillars)).toBe(true);
    });

    it('should block access to protected procedures', async () => {
      const caller = appRouter.createCaller(mockContext);

      // Should throw UNAUTHORIZED error
      await expect(caller.user.updateVosRole({ vosRole: 'Sales' }))
        .rejects
        .toThrow('UNAUTHORIZED');
    });
  });

  describe('Authenticated User Flow', () => {
    beforeEach(() => {
      // Set authenticated user in context
      mockContext.user = {
        id: 'user-uuid-123',
        openId: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        vosRole: 'Sales',
        maturityLevel: 1,
        createdAt: new Date(),
        lastSignedIn: new Date(),
      };
    });

    it('should return user data for authenticated user', async () => {
      const caller = appRouter.createCaller(mockContext);
      const result = await caller.auth.me();

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-uuid-123');
      expect(result?.email).toBe('test@example.com');
    });

    it('should allow access to protected procedures', async () => {
      const caller = appRouter.createCaller(mockContext);

      // Should not throw
      const result = await caller.user.updateVosRole({ vosRole: 'CS' });
      expect(result.success).toBe(true);
    });

    it('should allow user to update their profile', async () => {
      const caller = appRouter.createCaller(mockContext);

      // Update VOS role
      const roleResult = await caller.user.updateVosRole({ vosRole: 'Marketing' });
      expect(roleResult.success).toBe(true);

      // Update maturity level
      const maturityResult = await caller.user.updateMaturityLevel({ level: 2 });
      expect(maturityResult.success).toBe(true);
    });
  });

  describe('Logout Flow', () => {
    it('should clear session cookie on logout', async () => {
      mockContext.user = {
        id: 'user-uuid-123',
        openId: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        vosRole: 'Sales',
        maturityLevel: 1,
        createdAt: new Date(),
        lastSignedIn: new Date(),
      };

      const caller = appRouter.createCaller(mockContext);
      const result = await caller.auth.logout();

      expect(result.success).toBe(true);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('Max-Age=0')
      );
    });

    it('should set HttpOnly flag on logout cookie', async () => {
      const caller = appRouter.createCaller(mockContext);
      await caller.auth.logout();

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('HttpOnly')
      );
    });
  });

  describe('Session Management', () => {
    it('should maintain user context across multiple calls', async () => {
      mockContext.user = {
        id: 'user-uuid-123',
        openId: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        vosRole: 'Sales',
        maturityLevel: 1,
        createdAt: new Date(),
        lastSignedIn: new Date(),
      };

      const caller = appRouter.createCaller(mockContext);

      // First call
      const user1 = await caller.auth.me();
      expect(user1?.id).toBe('user-uuid-123');

      // Second call should return same user
      const user2 = await caller.auth.me();
      expect(user2?.id).toBe('user-uuid-123');
      expect(user2?.email).toBe(user1?.email);
    });
  });

  describe('Authorization Checks', () => {
    it('should enforce user ownership for protected resources', async () => {
      mockContext.user = {
        id: 'user-uuid-123',
        openId: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        vosRole: 'Sales',
        maturityLevel: 1,
        createdAt: new Date(),
        lastSignedIn: new Date(),
      };

      const caller = appRouter.createCaller(mockContext);

      // User should be able to access their own progress
      const progress = await caller.progress.getUserProgress();
      expect(Array.isArray(progress)).toBe(true);
    });

    it('should validate user role for role-specific operations', async () => {
      mockContext.user = {
        id: 'user-uuid-123',
        openId: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        vosRole: 'Sales',
        maturityLevel: 1,
        createdAt: new Date(),
        lastSignedIn: new Date(),
      };

      const caller = appRouter.createCaller(mockContext);

      // Should allow valid role update
      const result = await caller.user.updateVosRole({ vosRole: 'CS' });
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user gracefully', async () => {
      const caller = appRouter.createCaller(mockContext);

      // Should not throw, just return null
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it('should provide clear error messages for unauthorized access', async () => {
      const caller = appRouter.createCaller(mockContext);

      try {
        await caller.progress.getUserProgress();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('logged in');
      }
    });
  });
});
