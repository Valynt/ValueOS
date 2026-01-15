/**
 * Referral Service
 * Handles all referral program operations
 */

import { createServerSupabaseClient } from '@shared/lib/supabase';
import { createLogger } from '@shared/lib/logger';
import {
  ReferralCode,
  Referral,
  ReferralReward,
  ReferralStats,
  GenerateReferralCodeRequest,
  GenerateReferralCodeResponse,
  ClaimReferralRequest,
  ClaimReferralResponse,
  ReferralDashboard
} from '@shared/types/referral';

const logger = createLogger({ component: 'ReferralService' });

export class ReferralService {
  private supabase = createServerSupabaseClient();

  /**
   * Generate or retrieve referral code for a user
   */
  async generateReferralCode(userId: string): Promise<GenerateReferralCodeResponse> {
    try {
      // Call database function to create/retrieve referral code
      const { data, error } = await this.supabase
        .rpc('create_user_referral_code', { p_user_id: userId });

      if (error) {
        logger.error('Failed to generate referral code', error, { userId });
        return { success: false, error: error.message };
      }

      // Fetch the complete referral code details
      const { data: referralCode, error: fetchError } = await this.supabase
        .from('referral_codes')
        .select('*')
        .eq('id', data)
        .single();

      if (fetchError) {
        logger.error('Failed to fetch referral code details', fetchError, { userId });
        return { success: false, error: fetchError.message };
      }

      logger.info('Referral code generated/retrieved', { userId, code: referralCode.code });
      return { success: true, referral_code: referralCode };

    } catch (error) {
      logger.error('Unexpected error generating referral code', error as Error, { userId });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Claim a referral code
   */
  async claimReferral(request: ClaimReferralRequest): Promise<ClaimReferralResponse> {
    try {
      const { referral_code, referee_email, ip_address, user_agent } = request;

      // Call database function to process referral claim
      const { data, error } = await this.supabase
        .rpc('process_referral_claim', {
          p_referral_code: referral_code,
          p_referee_email: referee_email,
          p_ip_address: ip_address,
          p_user_agent: user_agent
        });

      if (error) {
        logger.error('Failed to claim referral', error, { referral_code, referee_email });
        return { success: false, error: error.message };
      }

      const result = data as ClaimReferralResponse;

      if (result.success) {
        logger.info('Referral claimed successfully', {
          referral_id: result.referral_id,
          referrer_id: result.referrer_id,
          referee_email
        });
      }

      return result;

    } catch (error) {
      logger.error('Unexpected error claiming referral', error as Error, { request });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Complete a referral (when referee converts to paying customer)
   */
  async completeReferral(referralId: string, refereeId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('complete_referral', {
          p_referral_id: referralId,
          p_referee_id: refereeId
        });

      if (error) {
        logger.error('Failed to complete referral', error, { referralId, refereeId });
        return false;
      }

      if (data) {
        logger.info('Referral completed successfully', { referralId, refereeId });
      }

      return data || false;

    } catch (error) {
      logger.error('Unexpected error completing referral', error as Error, { referralId, refereeId });
      return false;
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string): Promise<ReferralStats | null> {
    try {
      const { data, error } = await this.supabase
        .from('referral_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error('Failed to fetch referral stats', error, { userId });
        return null;
      }

      return data;

    } catch (error) {
      logger.error('Unexpected error fetching referral stats', error as Error, { userId });
      return null;
    }
  }

  /**
   * Get user's referral code
   */
  async getUserReferralCode(userId: string): Promise<ReferralCode | null> {
    try {
      const { data, error } = await this.supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        logger.error('Failed to fetch user referral code', error, { userId });
        return null;
      }

      return data;

    } catch (error) {
      logger.error('Unexpected error fetching user referral code', error as Error, { userId });
      return null;
    }
  }

  /**
   * Get referrals for a user
   */
  async getUserReferrals(userId: string, limit = 10): Promise<Referral[]> {
    try {
      const { data, error } = await this.supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch user referrals', error, { userId });
        return [];
      }

      return data || [];

    } catch (error) {
      logger.error('Unexpected error fetching user referrals', error as Error, { userId });
      return [];
    }
  }

  /**
   * Get rewards for a user
   */
  async getUserRewards(userId: string, limit = 10): Promise<ReferralReward[]> {
    try {
      const { data, error } = await this.supabase
        .from('referral_rewards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch user rewards', error, { userId });
        return [];
      }

      return data || [];

    } catch (error) {
      logger.error('Unexpected error fetching user rewards', error as Error, { userId });
      return [];
    }
  }

  /**
   * Get complete referral dashboard data
   */
  async getReferralDashboard(userId: string): Promise<ReferralDashboard | null> {
    try {
      // Fetch all data in parallel
      const [referralCode, stats, referrals, rewards] = await Promise.all([
        this.getUserReferralCode(userId),
        this.getReferralStats(userId),
        this.getUserReferrals(userId, 5),
        this.getUserRewards(userId, 5)
      ]);

      if (!referralCode) {
        logger.warn('No referral code found for user', { userId });
        return null;
      }

      return {
        referral_code: referralCode,
        stats: stats || {
          user_id: userId,
          code: referralCode.code,
          total_referrals: 0,
          completed_referrals: 0,
          pending_referrals: 0,
          claimed_referrals: 0,
          earned_rewards: 0
        },
        recent_referrals: referrals,
        rewards
      };

    } catch (error) {
      logger.error('Unexpected error fetching referral dashboard', error as Error, { userId });
      return null;
    }
  }

  /**
   * Validate referral code
   */
  async validateReferralCode(code: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('referral_codes')
        .select('id')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error) {
        return false;
      }

      return !!data;

    } catch (error) {
      logger.error('Unexpected error validating referral code', error as Error, { code });
      return false;
    }
  }

  /**
   * Deactivate referral code
   */
  async deactivateReferralCode(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('referral_codes')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to deactivate referral code', error, { userId });
        return false;
      }

      logger.info('Referral code deactivated', { userId });
      return true;

    } catch (error) {
      logger.error('Unexpected error deactivating referral code', error as Error, { userId });
      return false;
    }
  }
}

// Export singleton instance
export const referralService = new ReferralService();
