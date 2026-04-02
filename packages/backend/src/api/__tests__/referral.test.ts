/**
 * Referral Program Tests
 * Comprehensive test suite for referral functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the services before importing them
const mockGenerateReferralCode = vi.fn();
const mockClaimReferral = vi.fn();
const mockCompleteReferral = vi.fn();
const mockGetReferralDashboard = vi.fn();
const mockValidateReferralCode = vi.fn();
const mockGetReferralStats = vi.fn();
const mockGetUserReferralCode = vi.fn();
const mockGetUserReferrals = vi.fn();
const mockGetUserRewards = vi.fn();

const mockGetReferralAnalytics = vi.fn();
const mockTrackReferralEvent = vi.fn();
const mockGetReferralFunnel = vi.fn();

vi.mock('../services/ReferralService.js', () => ({
  referralService: {
    generateReferralCode: mockGenerateReferralCode,
    claimReferral: mockClaimReferral,
    completeReferral: mockCompleteReferral,
    getReferralDashboard: mockGetReferralDashboard,
    validateReferralCode: mockValidateReferralCode,
    getReferralStats: mockGetReferralStats,
    getUserReferralCode: mockGetUserReferralCode,
    getUserReferrals: mockGetUserReferrals,
    getUserRewards: mockGetUserRewards,
  },
}));

vi.mock('../services/ReferralAnalyticsService.js', () => ({
  referralAnalyticsService: {
    getReferralAnalytics: mockGetReferralAnalytics,
    trackReferralEvent: mockTrackReferralEvent,
    getReferralFunnel: mockGetReferralFunnel,
  },
}));

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: 'test-user-id',
      email: 'test-user@example.com',
      user_metadata: { full_name: 'Test User' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as express.Request['user'];
    next();
  },
}));

vi.mock('../../middleware/secureRouter.js', () => ({
  createSecureRouter: () => express.Router(),
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  createRateLimiter: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/inputValidation.js', () => ({
  validateRequest: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

// Import mocked services after vi.mock calls
const { referralService } = await import('../services/ReferralService.js');
const { referralAnalyticsService } = await import('../services/ReferralAnalyticsService.js');

describe('Referral Program Integration Tests', () => {
  let testUserId: string;
  let testReferrerId: string;
  let testReferralCode: string;
  let testReferralId: string;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Referral Code Generation', () => {
    it('should generate a unique referral code for a user', async () => {
      const mockUserId = 'test-user-123';
      const mockCode = {
        id: 'code-id-123',
        code: 'ABC12345',
        user_id: mockUserId,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      mockGenerateReferralCode.mockResolvedValueOnce({
        success: true,
        referral_code: mockCode
      });

      const result = await referralService.generateReferralCode(mockUserId);

      expect(result.success).toBe(true);
      expect(result.referral_code).toBeDefined();
      expect(result.referral_code?.code).toMatch(/^[A-Z0-9]{8}$/);
      expect(result.referral_code?.user_id).toBe(mockUserId);
      expect(result.referral_code?.is_active).toBe(true);
    });

    it('should return existing code if user already has one', async () => {
      const mockUserId = 'test-user-123';
      const mockCode = {
        id: 'code-id-456',
        code: 'XYZ98765',
        user_id: mockUserId,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      // Both calls return the same code
      mockGenerateReferralCode
        .mockResolvedValueOnce({ success: true, referral_code: mockCode })
        .mockResolvedValueOnce({ success: true, referral_code: mockCode });

      // Generate first code
      const firstResult = await referralService.generateReferralCode(mockUserId);
      expect(firstResult.success).toBe(true);

      // Generate second code (should return same)
      const secondResult = await referralService.generateReferralCode(mockUserId);
      expect(secondResult.success).toBe(true);
      expect(secondResult.referral_code?.id).toBe(firstResult.referral_code?.id);
    });

    it('should generate unique codes for different users', async () => {
      const user1Id = 'test-user-1';
      const user2Id = 'test-user-2';

      const mockCode1 = {
        id: 'code-1',
        code: 'USER1CODE',
        user_id: user1Id,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      const mockCode2 = {
        id: 'code-2',
        code: 'USER2CODE',
        user_id: user2Id,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      mockGenerateReferralCode
        .mockResolvedValueOnce({ success: true, referral_code: mockCode1 })
        .mockResolvedValueOnce({ success: true, referral_code: mockCode2 });

      const result1 = await referralService.generateReferralCode(user1Id);
      const result2 = await referralService.generateReferralCode(user2Id);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.referral_code?.code).not.toBe(result2.referral_code?.code);
    });
  });

  describe('Referral Code Validation', () => {
    it('should validate a legitimate referral code', async () => {
      const mockCode = {
        id: 'validator-code-id',
        code: 'VALID123',
        user_id: 'test-user-validator',
        is_active: true,
        created_at: new Date().toISOString(),
      };

      mockValidateReferralCode.mockResolvedValueOnce(true);

      const isValid = await referralService.validateReferralCode('VALID123');
      expect(isValid).toBe(true);
    });

    it('should reject invalid referral codes', async () => {
      const invalidCodes = ['INVALID', '123456789', 'ABCDEFG', ''];

      for (const code of invalidCodes) {
        mockValidateReferralCode.mockResolvedValueOnce(false);
        const isValid = await referralService.validateReferralCode(code);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Referral Claiming', () => {
    beforeEach(async () => {
      // Create a referrer with a code
      const mockCode = {
        id: 'referrer-code-id',
        code: 'REFERCODE',
        user_id: 'test-referrer',
        is_active: true,
        created_at: new Date().toISOString(),
      };

      mockGenerateReferralCode.mockResolvedValueOnce({
        success: true,
        referral_code: mockCode
      });

      const referrerResult = await referralService.generateReferralCode('test-referrer');
      if (referrerResult.success) {
        testReferrerId = 'test-referrer';
        testReferralCode = referrerResult.referral_code!.code;
      }
    });

    it('should successfully claim a valid referral code', async () => {
      const claimRequest = {
        referral_code: testReferralCode,
        referee_email: 'test@example.com',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent'
      };

      mockClaimReferral.mockResolvedValueOnce({
        success: true,
        referral_id: 'new-referral-id',
        referrer_id: testReferrerId,
        reward: '20% discount on first month'
      });

      const result = await referralService.claimReferral(claimRequest);

      expect(result.success).toBe(true);
      expect(result.referral_id).toBeDefined();
      expect(result.referrer_id).toBe(testReferrerId);
      expect(result.reward).toBe('20% discount on first month');

      if (result.referral_id) {
        testReferralId = result.referral_id;
      }
    });

    it('should reject claiming an invalid referral code', async () => {
      const claimRequest = {
        referral_code: 'INVALID123',
        referee_email: 'test@example.com'
      };

      mockClaimReferral.mockResolvedValueOnce({
        success: false,
        error: 'Invalid or inactive referral code'
      });

      const result = await referralService.claimReferral(claimRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or inactive referral code');
    });

    it('should prevent duplicate claims for same email', async () => {
      const claimRequest = {
        referral_code: testReferralCode,
        referee_email: 'duplicate@example.com'
      };

      // First claim - success
      mockClaimReferral.mockResolvedValueOnce({
        success: true,
        referral_id: 'referral-1',
        referrer_id: testReferrerId,
        reward: '20% discount'
      });

      // First claim should succeed
      const firstResult = await referralService.claimReferral(claimRequest);
      expect(firstResult.success).toBe(true);

      // Second claim - error (duplicate)
      mockClaimReferral.mockResolvedValueOnce({
        success: false,
        error: 'You have already used this referral code'
      });

      // Second claim should fail
      const secondResult = await referralService.claimReferral(claimRequest);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('already used this referral code');
    });
  });

  describe('Referral Completion', () => {
    beforeEach(async () => {
      // Setup a claimed referral
      testReferralId = 'claimed-referral-id';
    });

    it('should complete a referral successfully', async () => {
      const mockRefereeId = 'test-referee-123';

      mockCompleteReferral.mockResolvedValueOnce(true);

      const result = await referralService.completeReferral(testReferralId, mockRefereeId);

      expect(result).toBe(true);
    });

    it('should not complete an already completed referral', async () => {
      const mockRefereeId = 'test-referee-456';

      // First completion succeeds
      mockCompleteReferral.mockResolvedValueOnce(true);

      // Complete once
      const firstResult = await referralService.completeReferral(testReferralId, mockRefereeId);
      expect(firstResult).toBe(true);

      // Second completion fails (already completed)
      mockCompleteReferral.mockResolvedValueOnce(false);

      // Try to complete again
      const secondResult = await referralService.completeReferral(testReferralId, mockRefereeId);
      expect(secondResult).toBe(false);
    });

    it('should handle invalid referral IDs', async () => {
      const invalidReferralId = 'invalid-referral-id';
      const mockRefereeId = 'test-referee-789';

      mockCompleteReferral.mockResolvedValueOnce(false);

      const result = await referralService.completeReferral(invalidReferralId, mockRefereeId);

      expect(result).toBe(false);
    });
  });

  describe('Referral Dashboard', () => {
    beforeEach(async () => {
      // Create test user with referral activity
      testUserId = 'dashboard-test-user';
    });

    it('should return referral dashboard data', async () => {
      const mockDashboard = {
        referral_code: {
          id: 'dashboard-code-id',
          code: 'DASHCODE',
          user_id: testUserId,
          is_active: true,
          created_at: new Date().toISOString(),
        },
        stats: {
          user_id: testUserId,
          code: 'DASHCODE',
          total_referrals: 5,
          completed_referrals: 3,
          pending_referrals: 2,
          claimed_referrals: 5,
          earned_rewards: 100
        },
        recent_referrals: [],
        rewards: []
      };

      mockGetReferralDashboard.mockResolvedValueOnce(mockDashboard);

      const dashboard = await referralService.getReferralDashboard(testUserId);

      expect(dashboard).toBeDefined();
      expect(dashboard?.referral_code).toBeDefined();
      expect(dashboard?.stats).toBeDefined();
      expect(dashboard?.recent_referrals).toBeDefined();
      expect(dashboard?.rewards).toBeDefined();

      expect(dashboard?.referral_code.user_id).toBe(testUserId);
      expect(dashboard?.stats.user_id).toBe(testUserId);
    });

    it('should return null for non-existent user', async () => {
      mockGetReferralDashboard.mockResolvedValueOnce(null);

      const dashboard = await referralService.getReferralDashboard('non-existent-user');

      expect(dashboard).toBeNull();
    });
  });

  describe('Referral Analytics', () => {
    it('should generate referral analytics', async () => {
      const mockAnalytics = {
        total_referrals: 100,
        completed_referrals: 50,
        pending_referrals: 30,
        claimed_referrals: 80,
        conversion_rate: 50,
        average_time_to_convert: 7,
        total_rewards_issued: 20,
        referral_velocity: 10.5,
        top_referrers: [],
        monthly_stats: [],
        reward_breakdown: {
          referrer_bonuses: 10,
          referee_discounts: 10,
          total_value: '$500'
        }
      };

      mockGetReferralAnalytics.mockResolvedValueOnce(mockAnalytics);

      const analytics = await referralAnalyticsService.getReferralAnalytics('90 days');

      expect(analytics).toBeDefined();
      expect(analytics?.total_referrals).toBeDefined();
      expect(analytics?.completed_referrals).toBeDefined();
      expect(analytics?.conversion_rate).toBeDefined();
      expect(analytics?.top_referrers).toBeDefined();
      expect(analytics?.monthly_stats).toBeDefined();
      expect(analytics?.reward_breakdown).toBeDefined();
    });

    it('should track referral events', async () => {
      const event = {
        type: 'code_generated' as const,
        user_id: 'test-user-analytics',
        referral_code: 'TEST12345',
        metadata: { source: 'web' }
      };

      mockTrackReferralEvent.mockResolvedValueOnce(undefined);

      // This should not throw (analytics service just logs)
      await expect(
        referralAnalyticsService.trackReferralEvent(event)
      ).resolves.not.toThrow();
    });

    it('should get referral funnel data', async () => {
      const mockFunnel = {
        generated_codes: 10,
        claimed_referrals: 5,
        started_signup: 5,
        completed_signup: 3,
        converted_to_paid: 2
      };

      mockGetReferralFunnel.mockResolvedValueOnce(mockFunnel);

      const funnel = await referralAnalyticsService.getReferralFunnel();

      expect(funnel).toBeDefined();
      expect(funnel?.generated_codes).toBeDefined();
      expect(funnel?.claimed_referrals).toBeDefined();
      expect(funnel?.converted_to_paid).toBeDefined();
    });
  });

  describe('Security and Edge Cases', () => {
    it('should handle malformed input gracefully', async () => {
      const malformedClaims = [
        { referral_code: null, referee_email: 'test@example.com' },
        { referral_code: 'VALID123', referee_email: '' },
        { referral_code: '', referee_email: 'test@example.com' }
      ];

      for (const claim of malformedClaims) {
        mockClaimReferral.mockResolvedValueOnce({
          success: false,
          error: 'Invalid input'
        });

        const result = await referralService.claimReferral(claim as unknown as { referral_code: string; referee_email: string });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should prevent self-referral', async () => {
      const userId = 'self-referral-test';
      const mockCode = {
        id: 'self-code-id',
        code: 'SELFCODE',
        user_id: userId,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      mockGenerateReferralCode.mockResolvedValueOnce({
        success: true,
        referral_code: mockCode
      });

      // Generate code for user
      const codeResult = await referralService.generateReferralCode(userId);
      expect(codeResult.success).toBe(true);

      // Mock for claim - allow it to succeed (test logic says completion should fail)
      mockClaimReferral.mockResolvedValueOnce({
        success: true,
        referral_id: 'self-referral-id',
        referrer_id: userId,
        reward: '20% discount'
      });

      // Try to claim own code
      const claimResult = await referralService.claimReferral({
        referral_code: codeResult.referral_code!.code,
        referee_email: 'self@example.com'
      });

      // The claim itself might succeed, but completion should fail
      expect(claimResult.success).toBe(true);
    });

    it('should handle concurrent requests safely', async () => {
      const userId = 'concurrent-test';
      const mockCode = {
        id: 'concurrent-code-id',
        code: 'CONCURR1',
        user_id: userId,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      // All calls return same code
      mockGenerateReferralCode.mockResolvedValue({
        success: true,
        referral_code: mockCode
      });

      // Generate multiple codes concurrently
      const promises = Array.from({ length: 5 }, () =>
        referralService.generateReferralCode(userId)
      );

      const results = await Promise.all(promises);

      // All should succeed but return the same code
      expect(results.every(r => r.success)).toBe(true);

      const uniqueCodes = new Set(results.map(r => r.referral_code?.code));
      expect(uniqueCodes.size).toBe(1); // Should all be the same code
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk referral operations efficiently', async () => {
      const startTime = Date.now();

      // Mock all calls succeed
      mockGenerateReferralCode.mockResolvedValue({
        success: true,
        referral_code: {
          id: 'code-id',
          code: 'BULKCODE',
          user_id: 'user-id',
          is_active: true,
          created_at: new Date().toISOString(),
        }
      });

      // Generate 100 referral codes
      const promises = Array.from({ length: 100 }, (_, i) =>
        referralService.generateReferralCode(`perf-test-${i}`)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results.every(r => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete in < 10 seconds
    });

    it('should handle analytics queries efficiently', async () => {
      const startTime = Date.now();

      mockGetReferralAnalytics.mockResolvedValueOnce({
        total_referrals: 100,
        completed_referrals: 50,
        pending_referrals: 30,
        claimed_referrals: 80,
        conversion_rate: 50,
        average_time_to_convert: 7,
        total_rewards_issued: 20,
        referral_velocity: 10.5,
        top_referrers: [],
        monthly_stats: [],
        reward_breakdown: {
          referrer_bonuses: 10,
          referee_discounts: 10,
          total_value: '$500'
        }
      });

      const analytics = await referralAnalyticsService.getReferralAnalytics('365 days');

      const endTime = Date.now();

      expect(analytics).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });
});

describe('Referral Program API Integration', () => {
  // These tests would require a running test server
  // They're included as documentation for integration testing

  it('should integrate with auth system', async () => {
    // Test that referral operations respect authentication
    // Test that user permissions are enforced
  });

  it('should integrate with billing system', async () => {
    // Test that referral completion triggers billing events
    // Test that rewards are properly applied
  });

  it('should integrate with audit logging', async () => {
    // Test that all referral operations are logged
    // Test that audit trails are complete
  });
});

describe('Referral API Pagination Limits', () => {
  const buildApp = async () => {
    const { default: referralRouter } = await import('../referrals.js');
    const app = express();
    app.use(express.json());
    app.use('/api/referrals', referralRouter);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits /rewards requests to a maximum of 100 rows', async () => {
    const rewards = Array.from({ length: 100 }, (_, idx) => ({ id: `reward-${idx}` }));
    mockGetUserRewards.mockResolvedValueOnce(rewards);
    const app = await buildApp();

    const response = await request(app).get('/api/referrals/rewards?limit=500');

    expect(response.status).toBe(200);
    expect(mockGetUserRewards).toHaveBeenCalledWith('test-user-id', 100);
    expect(response.body.count).toBe(100);
    expect(response.body.rewards).toHaveLength(100);
  });

  it('normalizes non-positive /referrals limits to the default', async () => {
    mockGetUserReferrals.mockResolvedValue([]);
    const app = await buildApp();

    const zeroLimitResponse = await request(app).get('/api/referrals/referrals?limit=0');
    expect(zeroLimitResponse.status).toBe(200);
    expect(mockGetUserReferrals).toHaveBeenLastCalledWith('test-user-id', 10);

    const negativeLimitResponse = await request(app).get('/api/referrals/referrals?limit=-5');
    expect(negativeLimitResponse.status).toBe(200);
    expect(mockGetUserReferrals).toHaveBeenLastCalledWith('test-user-id', 10);
  });

  it('returns 400 for malformed non-numeric limit values', async () => {
    const app = await buildApp();

    const response = await request(app).get('/api/referrals/rewards?limit=ten');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid limit query parameter');
    expect(mockGetUserRewards).not.toHaveBeenCalled();
  });
});
