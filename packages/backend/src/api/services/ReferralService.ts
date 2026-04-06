/**
 * Referral Service
 * Handles all referral program operations
 *
 * SECURITY (B-5): This service now accepts a per-request RLS-scoped Supabase
 * client instead of using a singleton service-role client. The service-role
 * client bypasses all Row Level Security policies, meaning any user could
 * previously read or modify referral records belonging to other tenants.
 *
 * All write operations that span tenants (e.g., claimReferral, which is
 * intentionally cross-user) still use the service-role client via a dedicated
 * database function that enforces its own business-logic constraints.
 * Read operations use the RLS-scoped client so that Postgres RLS policies
 * enforce tenant isolation at the database layer.
 */

import { createLogger } from '@shared/lib/logger';
import { sanitizeForLogging } from '@shared/lib/piiFilter';
import {
  createRequestRlsSupabaseClient,
  createServiceRoleSupabaseClient,
  type RequestScopedRlsSupabaseClient,
} from '../../lib/supabase.js';
import {
  ClaimReferralRequest,
  ClaimReferralResponse,
  GenerateReferralCodeResponse,
  Referral,
  ReferralCode,
  ReferralDashboard,
  ReferralReward,
  ReferralStats
} from '@shared/types/referral';

const logger = createLogger({ component: 'ReferralService' });

/**
 * Per-request context required by all authenticated ReferralService methods.
 * Pass `req` (the Express request) so the service can build an RLS-scoped
 * Supabase client that inherits the caller's JWT and tenant context.
 */
export interface ReferralRequestContext {
  headers: { authorization?: string };
}

export class ReferralService {
  /**
   * Build an RLS-scoped Supabase client from the incoming request.
   * This client will only see rows that Postgres RLS policies permit for
   * the authenticated user's tenant.
   */
  private rlsClient(ctx: ReferralRequestContext): RequestScopedRlsSupabaseClient {
    return createRequestRlsSupabaseClient({ headers: ctx.headers });
  }

  /**
   * Service-role client — used ONLY for cross-tenant database functions
   * (e.g., process_referral_claim) that must operate across user boundaries
   * under controlled, audited conditions.
   */
  private get serviceRoleClient() {
    return createServiceRoleSupabaseClient();
  }

  /**
   * Generate or retrieve referral code for a user
   */
  async generateReferralCode(
    userId: string,
    ctx: ReferralRequestContext
  ): Promise<GenerateReferralCodeResponse> {
    try {
      const supabase = this.rlsClient(ctx);

      // Call database function to create/retrieve referral code
      const { data, error } = await supabase
        .rpc('create_user_referral_code', { p_user_id: userId });

      if (error) {
        logger.error('Failed to generate referral code', error, { userId });
        return { success: false, error: error.message };
      }

      // Fetch the complete referral code details (RLS-scoped: only own codes)
      const { data: referralCode, error: fetchError } = await supabase
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
   * Claim a referral code.
   *
   * This operation is intentionally cross-user (a new user claims a code
   * belonging to an existing user) and therefore uses the service-role client
   * via a database function that enforces its own business-logic constraints.
   */
  async claimReferral(request: ClaimReferralRequest): Promise<ClaimReferralResponse> {
    try {
      const { referral_code, referee_email, ip_address, user_agent } = request;
      const sanitizedReferralCode = sanitizeForLogging(referral_code) as string;
      const sanitizedRefereeEmail = sanitizeForLogging(referee_email) as string;

      // Use service-role client for this cross-user operation.
      // The database function process_referral_claim enforces its own
      // business-logic constraints and is the only permitted path.
      const { data, error } = await this.serviceRoleClient
        .rpc('process_referral_claim', {
          p_referral_code: referral_code,
          p_referee_email: referee_email,
          p_ip_address: ip_address,
          p_user_agent: user_agent
        });

      if (error) {
        logger.error('Failed to claim referral', error, {
          referral_code: sanitizedReferralCode,
          referee_email: sanitizedRefereeEmail
        });
        return { success: false, error: error.message };
      }

      const result = data as ClaimReferralResponse;

      if (result.success) {
        logger.info('Referral claimed successfully', {
          referral_id: result.referral_id,
          referrer_id: result.referrer_id,
          referee_email: sanitizedRefereeEmail
        });
      }

      return result;

    } catch (error) {
      logger.error('Unexpected error claiming referral', error as Error, {
        referral_code: sanitizeForLogging(request.referral_code) as string,
        referee_email: sanitizeForLogging(request.referee_email) as string
      });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Complete a referral (when referee converts to paying customer).
   * Uses service-role client via audited database function.
   */
  async completeReferral(referralId: string, refereeId: string): Promise<boolean> {
    try {
      const { data, error } = await this.serviceRoleClient
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
   * Get referral statistics for a user (RLS-scoped: own stats only)
   */
  async getReferralStats(
    userId: string,
    ctx: ReferralRequestContext
  ): Promise<ReferralStats | null> {
    try {
      const { data, error } = await this.rlsClient(ctx)
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
   * Get user's referral code (RLS-scoped: own codes only)
   */
  async getUserReferralCode(
    userId: string,
    ctx: ReferralRequestContext
  ): Promise<ReferralCode | null> {
    try {
      const { data, error } = await this.rlsClient(ctx)
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
   * Get referrals for a user (RLS-scoped: own referrals only)
   */
  async getUserReferrals(
    userId: string,
    ctx: ReferralRequestContext,
    limit = 10
  ): Promise<Referral[]> {
    try {
      const { data, error } = await this.rlsClient(ctx)
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
   * Get rewards for a user (RLS-scoped: own rewards only)
   */
  async getUserRewards(
    userId: string,
    ctx: ReferralRequestContext,
    limit = 10
  ): Promise<ReferralReward[]> {
    try {
      const { data, error } = await this.rlsClient(ctx)
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
   * Get complete referral dashboard data (RLS-scoped)
   */
  async getReferralDashboard(
    userId: string,
    ctx: ReferralRequestContext
  ): Promise<ReferralDashboard | null> {
    try {
      // Fetch all data in parallel using the same RLS-scoped client context
      const [referralCode, stats, referrals, rewards] = await Promise.all([
        this.getUserReferralCode(userId, ctx),
        this.getReferralStats(userId, ctx),
        this.getUserReferrals(userId, ctx, 5),
        this.getUserRewards(userId, ctx, 5)
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
   * Validate referral code.
   *
   * This is a public endpoint (no auth required) so it uses the service-role
   * client, but only reads a single boolean existence check — no PII is exposed.
   */
  async validateReferralCode(code: string): Promise<boolean> {
    try {
      const { data, error } = await this.serviceRoleClient
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
   * Deactivate referral code (RLS-scoped: own codes only)
   */
  async deactivateReferralCode(
    userId: string,
    ctx: ReferralRequestContext
  ): Promise<boolean> {
    try {
      const { error } = await this.rlsClient(ctx)
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

// Export singleton instance (stateless — all state is per-request via ctx)
export const referralService = new ReferralService();
