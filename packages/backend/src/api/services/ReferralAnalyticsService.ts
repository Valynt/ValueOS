/**
 * Referral Analytics Service
 * Provides analytics and insights for the referral program
 */

import { createLogger } from '@shared/lib/logger';
import { createServiceRoleSupabaseClient } from '../../lib/supabase.js';

const logger = createLogger({ component: 'ReferralAnalytics' });

export interface ReferralAnalytics {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  claimed_referrals: number;
  conversion_rate: number;
  average_time_to_convert: number; // in days
  total_rewards_issued: number;
  referral_velocity: number; // referrals per month
  top_referrers: Array<{
    user_id: string;
    user_email: string;
    referral_count: number;
    completed_count: number;
  }>;
  monthly_stats: Array<{
    month: string;
    referrals: number;
    completions: number;
    conversion_rate: number;
  }>;
  reward_breakdown: {
    referrer_bonuses: number;
    referee_discounts: number;
    total_value: string;
  };
}

interface ReferralRecord {
  status: string;
  created_at: string;
  completed_at?: string | null;
}

interface RewardRecord {
  reward_type: string;
  reward_value: string | number;
  created_at: string;
}

interface TopReferrerRecord {
  user_id: string;
  total_referrals: number;
  completed_referrals: number;
}

interface UserProfile {
  id: string;
  email: string;
}

export class ReferralAnalyticsService {
  private supabase = createServiceRoleSupabaseClient();

  /**
   * Get comprehensive referral analytics
   */
  async getReferralAnalytics(timeframe = '90 days'): Promise<ReferralAnalytics | null> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeframe.split(' ')[0]));

      // Get overall stats
      const { data: overallStats, error: overallError } = await this.supabase
        .from('referrals')
        .select('status, created_at, completed_at')
        .gte('created_at', cutoffDate.toISOString())
        .returns<ReferralRecord[]>();

      if (overallError) {
        logger.error('Failed to fetch overall referral stats', overallError);
        return null;
      }

      // Get reward stats
      const { data: rewardStats, error: rewardError } = await this.supabase
        .from('referral_rewards')
        .select('reward_type, reward_value, created_at')
        .gte('created_at', cutoffDate.toISOString())
        .returns<RewardRecord[]>();

      if (rewardError) {
        logger.error('Failed to fetch reward stats', rewardError);
        return null;
      }

      // Get top referrers
      const { data: topReferrers, error: referrersError } = await this.supabase
        .from('referral_stats')
        .select('user_id, total_referrals, completed_referrals')
        .gte('total_referrals', 1)
        .order('completed_referrals', { ascending: false })
        .limit(10)
        .returns<TopReferrerRecord[]>();

      if (referrersError) {
        logger.error('Failed to fetch top referrers', referrersError);
        return null;
      }

      // Get user emails for top referrers
      const userIds = topReferrers?.map(r => r.user_id) || [];
      const { data: userProfiles, error: profilesError } = await this.supabase.auth.admin.listUsers();

      const userEmailMap = new Map<string, string>();
      if (!profilesError && userProfiles?.users) {
        (userProfiles.users as UserProfile[]).forEach(user => {
          if (userIds.includes(user.id)) {
            userEmailMap.set(user.id, user.email);
          }
        });
      }

      // Get monthly stats
      const monthlyStats = await this.getMonthlyStats(cutoffDate);

      // Calculate analytics
      const totalReferrals = overallStats?.length || 0;
      const completedReferrals = overallStats?.filter(r => r.status === 'completed').length || 0;
      const pendingReferrals = overallStats?.filter(r => r.status === 'pending').length || 0;
      const claimedReferrals = overallStats?.filter(r => r.status === 'claimed').length || 0;

      const conversionRate = totalReferrals > 0 ? (completedReferrals / totalReferrals) * 100 : 0;
      const avgTimeToConvert = await this.calculateAverageTimeToConvert(overallStats || []);

      const referralVelocity = this.calculateReferralVelocity(overallStats || [], timeframe);

      const rewardBreakdown = this.calculateRewardBreakdown(rewardStats || []);

      const analytics: ReferralAnalytics = {
        total_referrals: totalReferrals,
        completed_referrals: completedReferrals,
        pending_referrals: pendingReferrals,
        claimed_referrals: claimedReferrals,
        conversion_rate: conversionRate,
        average_time_to_convert: avgTimeToConvert,
        total_rewards_issued: rewardStats?.length || 0,
        referral_velocity: referralVelocity,
        top_referrers: (topReferrers || []).map(referrer => ({
          user_id: referrer.user_id,
          user_email: userEmailMap.get(referrer.user_id) || 'Unknown',
          referral_count: referrer.total_referrals,
          completed_count: referrer.completed_referrals
        })),
        monthly_stats: monthlyStats,
        reward_breakdown: rewardBreakdown
      };

      logger.info('Referral analytics generated', {
        timeframe,
        total_referrals: analytics.total_referrals,
        conversion_rate: analytics.conversion_rate
      });

      return analytics;

    } catch (error: unknown) {
      logger.error('Failed to generate referral analytics', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Get monthly referral statistics
   */
  private async getMonthlyStats(cutoffDate: Date): Promise<ReferralAnalytics['monthly_stats']> {
    try {
      const { data: monthlyData, error } = await this.supabase
        .from('referrals')
        .select('status, created_at, completed_at')
        .gte('created_at', cutoffDate.toISOString())
        .returns<ReferralRecord[]>();

      if (error || !monthlyData) {
        return [];
      }

      // Group by month
      const monthlyMap = new Map<string, { referrals: number; completions: number }>();

      monthlyData.forEach(referral => {
        const month = new Date(referral.created_at).toISOString().slice(0, 7); // YYYY-MM

        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { referrals: 0, completions: 0 });
        }

        const stats = monthlyMap.get(month)!;
        stats.referrals++;

        if (referral.status === 'completed') {
          stats.completions++;
        }
      });

      // Convert to array and calculate conversion rates
      return Array.from(monthlyMap.entries())
        .map(([month, stats]) => ({
          month,
          referrals: stats.referrals,
          completions: stats.completions,
          conversion_rate: stats.referrals > 0 ? (stats.completions / stats.referrals) * 100 : 0
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

    } catch (error: unknown) {
      logger.error('Failed to get monthly stats', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Calculate average time to convert (in days)
   */
  private async calculateAverageTimeToConvert(referrals: ReferralRecord[]): Promise<number> {
    const completedReferrals = referrals.filter(r => r.status === 'completed' && r.completed_at);

    if (completedReferrals.length === 0) {
      return 0;
    }

    const totalDays = completedReferrals.reduce((sum, referral) => {
      const created = new Date(referral.created_at);
      const completed = new Date(referral.completed_at!);
      const daysDiff = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return sum + daysDiff;
    }, 0);

    return Math.round(totalDays / completedReferrals.length);
  }

  /**
   * Calculate referral velocity (referrals per month)
   */
  private calculateReferralVelocity(referrals: ReferralRecord[], timeframe: string): number {
    const days = parseInt(timeframe.split(' ')[0]);
    const months = days / 30.44; // Average month length
    return Math.round((referrals.length / months) * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate reward breakdown
   */
  private calculateRewardBreakdown(rewards: RewardRecord[]): ReferralAnalytics['reward_breakdown'] {
    const referrerBonuses = rewards.filter(r => r.reward_type === 'referrer_bonus').length;
    const refereeDiscounts = rewards.filter(r => r.reward_type === 'referee_discount').length;

    // Calculate total value (this would need to be based on actual pricing)
    const totalValue = `${referrerBonuses * 29 + refereeDiscounts * 6}`; // Example values

    return {
      referrer_bonuses: referrerBonuses,
      referee_discounts: refereeDiscounts,
      total_value: `$${totalValue}`
    };
  }

  /**
   * Track referral event for analytics
   */
  async trackReferralEvent(event: {
    type: 'code_generated' | 'referral_claimed' | 'referral_completed' | 'reward_earned';
    user_id?: string;
    referral_id?: string;
    referral_code?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // This would integrate with your analytics system
      // For now, we'll just log the event
      logger.info('Referral event tracked', {
        event_type: event.type,
        user_id: event.user_id,
        referral_id: event.referral_id,
        referral_code: event.referral_code,
        metadata: event.metadata
      });

      // In a real implementation, you might send this to:
      // - Segment, Mixpanel, or other analytics service
      // - Internal events table
      // - Redis for real-time metrics

    } catch (error: unknown) {
      logger.error('Failed to track referral event', error instanceof Error ? error : undefined, { event });
    }
  }

  /**
   * Get referral funnel analytics
   */
  async getReferralFunnel(): Promise<{
    generated_codes: number;
    claimed_referrals: number;
    started_signup: number;
    completed_signup: number;
    converted_to_paid: number;
  } | null> {
    try {
      // This would require additional tracking tables or events
      // For now, return basic funnel data
      const { data: codes, error: codesError } = await this.supabase
        .from('referral_codes')
        .select('id');

      const { data: claimed, error: claimedError } = await this.supabase
        .from('referrals')
        .select('id')
        .eq('status', 'claimed');

      const { data: completed, error: completedError } = await this.supabase
        .from('referrals')
        .select('id')
        .eq('status', 'completed');

      if (codesError || claimedError || completedError) {
        throw new Error('Failed to fetch funnel data');
      }

      return {
        generated_codes: codes?.length || 0,
        claimed_referrals: claimed?.length || 0,
        started_signup: claimed?.length || 0, // Assuming claim = signup start
        completed_signup: claimed?.length || 0, // Would need separate tracking
        converted_to_paid: completed?.length || 0
      };

    } catch (error: unknown) {
      logger.error('Failed to get referral funnel', error instanceof Error ? error : undefined);
      return null;
    }
  }
}

export const referralAnalyticsService = new ReferralAnalyticsService();
