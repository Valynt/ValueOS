import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface UsageMetrics {
  seats: { used: number; total: number };
  cases: { used: number; total: number };
  aiCredits: { used: number; total: number; resetsInDays: number };
}

export interface PlanLimits {
  seats: number;
  cases: number;
  aiCredits: number;
}

export class BillingUsageManager {
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  async getUsageMetrics(): Promise<UsageMetrics> {
    try {
      // Fetch current usage from Supabase
      const { data: usageData, error } = await supabase
        .from('organization_usage')
        .select('*')
        .eq('organization_id', this.organizationId)
        .single();

      if (error) {
        logger.error('Failed to fetch usage metrics', { error, organizationId: this.organizationId });
        throw error;
      }

      // Fetch plan limits
      const { data: planData, error: planError } = await supabase
        .from('organization_plans')
        .select('seats_limit, cases_limit, ai_credits_limit')
        .eq('organization_id', this.organizationId)
        .single();

      if (planError) {
        logger.error('Failed to fetch plan limits', { error: planError, organizationId: this.organizationId });
        throw planError;
      }

      const now = new Date();
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1); // Next month
      const resetsInDays = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        seats: { used: usageData.seats_used, total: planData.seats_limit },
        cases: { used: usageData.cases_used, total: planData.cases_limit },
        aiCredits: { used: usageData.ai_credits_used, total: planData.ai_credits_limit, resetsInDays },
      };
    } catch (error) {
      logger.error('Error in getUsageMetrics', { error, organizationId: this.organizationId });
      // Return mock data as fallback
      return {
        seats: { used: 8, total: 10 },
        cases: { used: 450, total: 500 },
        aiCredits: { used: 847, total: 1000, resetsInDays: 21 },
      };
    }
  }

  async checkUsageLimit(resource: keyof UsageMetrics): Promise<boolean> {
    const metrics = await this.getUsageMetrics();
    const usage = metrics[resource];
    return usage.used >= usage.total;
  }

  async getPlanLimits(): Promise<PlanLimits> {
    try {
      const { data, error } = await supabase
        .from('organization_plans')
        .select('seats_limit, cases_limit, ai_credits_limit')
        .eq('organization_id', this.organizationId)
        .single();

      if (error) throw error;

      return {
        seats: data.seats_limit,
        cases: data.cases_limit,
        aiCredits: data.ai_credits_limit,
      };
    } catch (error) {
      logger.error('Error fetching plan limits', { error, organizationId: this.organizationId });
      return { seats: 10, cases: 500, aiCredits: 1000 };
    }
  }
}

export const createBillingUsageManager = (organizationId: string) => new BillingUsageManager(organizationId);
