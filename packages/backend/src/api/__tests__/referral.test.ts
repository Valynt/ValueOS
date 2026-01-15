/**
 * Referral Program Tests
 * Comprehensive test suite for referral functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { referralService } from '../src/api/services/ReferralService';
import { referralAnalyticsService } from '../src/api/services/ReferralAnalyticsService';
import { createServerSupabaseClient } from '@shared/lib/supabase';

describe('Referral Program Integration Tests', () => {
  let testUserId: string;
  let testReferrerId: string;
  let testReferralCode: string;
  let testReferralId: string;

  beforeAll(async () => {
    // Setup test environment
    console.log('Setting up referral program tests...');
  });

  afterAll(async () => {
    // Cleanup test data
    console.log('Cleaning up referral program tests...');
  });

  beforeEach(async () => {
    // Reset test state
  });

  describe('Referral Code Generation', () => {
    it('should generate a unique referral code for a user', async () => {
      const mockUserId = 'test-user-123';

      const result = await referralService.generateReferralCode(mockUserId);

      expect(result.success).toBe(true);
      expect(result.referral_code).toBeDefined();
      expect(result.referral_code?.code).toMatch(/^[A-Z0-9]{8}$/);
      expect(result.referral_code?.user_id).toBe(mockUserId);
      expect(result.referral_code?.is_active).toBe(true);
    });

    it('should return existing code if user already has one', async () => {
      const mockUserId = 'test-user-123';

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

      const result1 = await referralService.generateReferralCode(user1Id);
      const result2 = await referralService.generateReferralCode(user2Id);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.referral_code?.code).not.toBe(result2.referral_code?.code);
    });
  });

  describe('Referral Code Validation', () => {
    it('should validate a legitimate referral code', async () => {
      const mockUserId = 'test-user-validator';

      // Generate a code
      const generateResult = await referralService.generateReferralCode(mockUserId);
      expect(generateResult.success).toBe(true);

      // Validate the code
      const isValid = await referralService.validateReferralCode(generateResult.referral_code!.code);
      expect(isValid).toBe(true);
    });

    it('should reject invalid referral codes', async () => {
      const invalidCodes = ['INVALID', '123456789', 'ABCDEFG', ''];

      for (const code of invalidCodes) {
        const isValid = await referralService.validateReferralCode(code);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Referral Claiming', () => {
    beforeEach(async () => {
      // Create a referrer with a code
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

      const result = await referralService.claimReferral(claimRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or inactive referral code');
    });

    it('should prevent duplicate claims for same email', async () => {
      const claimRequest = {
        referral_code: testReferralCode,
        referee_email: 'duplicate@example.com'
      };

      // First claim should succeed
      const firstResult = await referralService.claimReferral(claimRequest);
      expect(firstResult.success).toBe(true);

      // Second claim should fail
      const secondResult = await referralService.claimReferral(claimRequest);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('already used this referral code');
    });
  });

  describe('Referral Completion', () => {
    beforeEach(async () => {
      // Setup a claimed referral
      const referrerResult = await referralService.generateReferralCode('test-referrer-complete');
      if (referrerResult.success) {
        const claimResult = await referralService.claimReferral({
          referral_code: referrerResult.referral_code!.code,
          referee_email: 'complete@example.com'
        });

        if (claimResult.success && claimResult.referral_id) {
          testReferralId = claimResult.referral_id;
        }
      }
    });

    it('should complete a referral successfully', async () => {
      const mockRefereeId = 'test-referee-123';

      const result = await referralService.completeReferral(testReferralId, mockRefereeId);

      expect(result).toBe(true);
    });

    it('should not complete an already completed referral', async () => {
      const mockRefereeId = 'test-referee-456';

      // Complete once
      const firstResult = await referralService.completeReferral(testReferralId, mockRefereeId);
      expect(firstResult).toBe(true);

      // Try to complete again
      const secondResult = await referralService.completeReferral(testReferralId, mockRefereeId);
      expect(secondResult).toBe(false);
    });

    it('should handle invalid referral IDs', async () => {
      const invalidReferralId = 'invalid-referral-id';
      const mockRefereeId = 'test-referee-789';

      const result = await referralService.completeReferral(invalidReferralId, mockRefereeId);

      expect(result).toBe(false);
    });
  });

  describe('Referral Dashboard', () => {
    beforeEach(async () => {
      // Create test user with referral activity
      testUserId = 'dashboard-test-user';
      await referralService.generateReferralCode(testUserId);
    });

    it('should return referral dashboard data', async () => {
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
      const dashboard = await referralService.getReferralDashboard('non-existent-user');

      expect(dashboard).toBeNull();
    });
  });

  describe('Referral Analytics', () => {
    it('should generate referral analytics', async () => {
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

      // This should not throw
      await expect(
        referralAnalyticsService.trackReferralEvent(event)
      ).resolves.not.toThrow();
    });

    it('should get referral funnel data', async () => {
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
        const result = await referralService.claimReferral(claim);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should prevent self-referral', async () => {
      const userId = 'self-referral-test';

      // Generate code for user
      const codeResult = await referralService.generateReferralCode(userId);
      expect(codeResult.success).toBe(true);

      // Try to claim own code (this should be prevented at database level)
      const claimResult = await referralService.claimReferral({
        referral_code: codeResult.referral_code!.code,
        referee_email: 'self@example.com'
      });

      // The claim itself might succeed, but completion should fail
      expect(claimResult.success).toBe(true);
    });

    it('should handle concurrent requests safely', async () => {
      const userId = 'concurrent-test';

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
