/**
 * Feature Flags Service
 * 
 * Dynamic feature flags for A/B testing, gradual rollouts, and feature toggles
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  targeting: {
    userIds?: string[];
    tiers?: ('free' | 'basic' | 'pro' | 'enterprise')[];
    countries?: string[];
    customRules?: Record<string, any>;
  };
  variants?: {
    name: string;
    weight: number;
    config: Record<string, any>;
  }[];
  metadata: {
    owner: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface FeatureFlagEvaluation {
  enabled: boolean;
  variant?: string;
  config?: Record<string, any>;
  reason: string;
}

export class FeatureFlagsService {
  private supabase: ReturnType<typeof createClient>;
  private cache: Map<string, FeatureFlag> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
    
    // Start cache refresh interval
    setInterval(() => this.refreshCache(), this.CACHE_TTL);
  }

  /**
   * Create a feature flag
   */
  async createFlag(data: {
    key: string;
    name: string;
    description: string;
    enabled?: boolean;
    rolloutPercentage?: number;
    targeting?: FeatureFlag['targeting'];
    variants?: FeatureFlag['variants'];
    metadata: {
      owner: string;
      tags: string[];
    };
  }): Promise<FeatureFlag> {
    const flag: Omit<FeatureFlag, 'id'> = {
      key: data.key,
      name: data.name,
      description: data.description,
      enabled: data.enabled ?? false,
      rolloutPercentage: data.rolloutPercentage ?? 0,
      targeting: data.targeting || {},
      variants: data.variants,
      metadata: {
        ...data.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const { data: created, error } = await this.supabase
      .from('feature_flags')
      .insert(flag)
      .select()
      .single();

    if (error) throw error;

    logger.info('Feature flag created', {
      key: data.key,
      owner: data.metadata.owner
    });

    // Clear cache
    this.cache.delete(data.key);

    return created;
  }

  /**
   * Get feature flag by key
   */
  async getFlag(key: string): Promise<FeatureFlag | null> {
    // Check cache
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const { data, error } = await this.supabase
      .from('feature_flags')
      .select('*')
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    // Cache
    this.cache.set(key, data);

    return data;
  }

  /**
   * Update feature flag
   */
  async updateFlag(
    key: string,
    updates: Partial<Omit<FeatureFlag, 'id' | 'key' | 'metadata'>>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('feature_flags')
      .update({
        ...updates,
        'metadata.updatedAt': new Date(),
      })
      .eq('key', key);

    if (error) throw error;

    // Clear cache
    this.cache.delete(key);

    logger.info('Feature flag updated', { key, updates });
  }

  /**
   * Delete feature flag
   */
  async deleteFlag(key: string): Promise<void> {
    const { error } = await this.supabase
      .from('feature_flags')
      .delete()
      .eq('key', key);

    if (error) throw error;

    // Clear cache
    this.cache.delete(key);

    logger.info('Feature flag deleted', { key });
  }

  /**
   * List all feature flags
   */
  async listFlags(): Promise<FeatureFlag[]> {
    const { data, error } = await this.supabase
      .from('feature_flags')
      .select('*')
      .order('key');

    if (error) throw error;
    return data || [];
  }

  /**
   * Evaluate feature flag for a user
   */
  async isEnabled(
    key: string,
    context: {
      userId: string;
      userTier?: 'free' | 'basic' | 'pro' | 'enterprise';
      country?: string;
      customAttributes?: Record<string, any>;
    }
  ): Promise<FeatureFlagEvaluation> {
    const flag = await this.getFlag(key);

    if (!flag) {
      return {
        enabled: false,
        reason: 'Flag not found'
      };
    }

    if (!flag.enabled) {
      return {
        enabled: false,
        reason: 'Flag disabled'
      };
    }

    // Check targeting rules
    const targetingResult = this.evaluateTargeting(flag, context);
    if (!targetingResult.enabled) {
      return targetingResult;
    }

    // Check rollout percentage
    const rolloutResult = this.evaluateRollout(flag, context.userId);
    if (!rolloutResult.enabled) {
      return rolloutResult;
    }

    // Select variant if configured
    if (flag.variants && flag.variants.length > 0) {
      const variant = this.selectVariant(flag, context.userId);
      return {
        enabled: true,
        variant: variant.name,
        config: variant.config,
        reason: 'Enabled with variant'
      };
    }

    return {
      enabled: true,
      reason: 'Enabled'
    };
  }

  /**
   * Evaluate targeting rules
   */
  private evaluateTargeting(
    flag: FeatureFlag,
    context: {
      userId: string;
      userTier?: string;
      country?: string;
      customAttributes?: Record<string, any>;
    }
  ): FeatureFlagEvaluation {
    const { targeting } = flag;

    // Check user ID whitelist
    if (targeting.userIds && targeting.userIds.length > 0) {
      if (!targeting.userIds.includes(context.userId)) {
        return {
          enabled: false,
          reason: 'User not in whitelist'
        };
      }
    }

    // Check tier targeting
    if (targeting.tiers && targeting.tiers.length > 0) {
      if (!context.userTier || !targeting.tiers.includes(context.userTier as any)) {
        return {
          enabled: false,
          reason: 'User tier not targeted'
        };
      }
    }

    // Check country targeting
    if (targeting.countries && targeting.countries.length > 0) {
      if (!context.country || !targeting.countries.includes(context.country)) {
        return {
          enabled: false,
          reason: 'Country not targeted'
        };
      }
    }

    // Check custom rules
    if (targeting.customRules) {
      const customResult = this.evaluateCustomRules(
        targeting.customRules,
        context.customAttributes || {}
      );
      if (!customResult) {
        return {
          enabled: false,
          reason: 'Custom rules not met'
        };
      }
    }

    return {
      enabled: true,
      reason: 'Targeting rules passed'
    };
  }

  /**
   * Evaluate custom rules
   */
  private evaluateCustomRules(
    rules: Record<string, any>,
    attributes: Record<string, any>
  ): boolean {
    for (const [key, value] of Object.entries(rules)) {
      if (attributes[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate rollout percentage
   */
  private evaluateRollout(
    flag: FeatureFlag,
    userId: string
  ): FeatureFlagEvaluation {
    if (flag.rolloutPercentage >= 100) {
      return {
        enabled: true,
        reason: 'Full rollout'
      };
    }

    if (flag.rolloutPercentage <= 0) {
      return {
        enabled: false,
        reason: 'Zero rollout'
      };
    }

    // Deterministic hash-based rollout
    const hash = crypto
      .createHash('md5')
      .update(userId + flag.key)
      .digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const bucket = hashValue % 100;

    if (bucket < flag.rolloutPercentage) {
      return {
        enabled: true,
        reason: `Rollout bucket ${bucket} < ${flag.rolloutPercentage}%`
      };
    }

    return {
      enabled: false,
      reason: `Rollout bucket ${bucket} >= ${flag.rolloutPercentage}%`
    };
  }

  /**
   * Select variant for user
   */
  private selectVariant(
    flag: FeatureFlag,
    userId: string
  ): FeatureFlag['variants'][0] {
    if (!flag.variants || flag.variants.length === 0) {
      throw new Error('No variants configured');
    }

    // Deterministic hash-based selection
    const hash = crypto
      .createHash('md5')
      .update(userId + flag.key + 'variant')
      .digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const selection = hashValue % 100;

    let cumulative = 0;
    for (const variant of flag.variants) {
      cumulative += variant.weight;
      if (selection < cumulative) {
        return variant;
      }
    }

    // Fallback to first variant
    return flag.variants[0];
  }

  /**
   * Get variant for user
   */
  async getVariant(
    key: string,
    context: {
      userId: string;
      userTier?: 'free' | 'basic' | 'pro' | 'enterprise';
      country?: string;
      customAttributes?: Record<string, any>;
    }
  ): Promise<{
    variant: string | null;
    config: Record<string, any> | null;
  }> {
    const evaluation = await this.isEnabled(key, context);

    if (!evaluation.enabled) {
      return { variant: null, config: null };
    }

    return {
      variant: evaluation.variant || null,
      config: evaluation.config || null
    };
  }

  /**
   * Track feature flag evaluation
   */
  async trackEvaluation(
    key: string,
    userId: string,
    enabled: boolean,
    variant?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('feature_flag_evaluations')
      .insert({
        flag_key: key,
        user_id: userId,
        enabled,
        variant,
        evaluated_at: new Date(),
      });

    if (error) {
      logger.error('Failed to track feature flag evaluation', error);
    }
  }

  /**
   * Get feature flag analytics
   */
  async getAnalytics(key: string, days: number = 7): Promise<{
    totalEvaluations: number;
    enabledCount: number;
    enabledPercentage: number;
    variantDistribution?: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('feature_flag_evaluations')
      .select('enabled, variant')
      .eq('flag_key', key)
      .gte('evaluated_at', startDate.toISOString());

    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        totalEvaluations: 0,
        enabledCount: 0,
        enabledPercentage: 0
      };
    }

    const totalEvaluations = data.length;
    const enabledCount = data.filter(e => e.enabled).length;
    const enabledPercentage = (enabledCount / totalEvaluations) * 100;

    // Calculate variant distribution
    const variantDistribution: Record<string, number> = {};
    data.forEach(e => {
      if (e.variant) {
        variantDistribution[e.variant] = (variantDistribution[e.variant] || 0) + 1;
      }
    });

    return {
      totalEvaluations,
      enabledCount,
      enabledPercentage,
      variantDistribution: Object.keys(variantDistribution).length > 0
        ? variantDistribution
        : undefined
    };
  }

  /**
   * Refresh cache
   */
  private async refreshCache(): Promise<void> {
    try {
      const flags = await this.listFlags();
      
      // Update cache
      this.cache.clear();
      flags.forEach(flag => {
        this.cache.set(flag.key, flag);
      });

      logger.debug('Feature flags cache refreshed', {
        count: flags.length
      });
    } catch (error) {
      logger.error('Failed to refresh feature flags cache', error as Error);
    }
  }

  /**
   * Gradual rollout helper
   */
  async gradualRollout(
    key: string,
    targetPercentage: number,
    incrementPercentage: number = 10,
    intervalMinutes: number = 60
  ): Promise<void> {
    const flag = await this.getFlag(key);
    if (!flag) throw new Error('Flag not found');

    const currentPercentage = flag.rolloutPercentage;
    const newPercentage = Math.min(
      currentPercentage + incrementPercentage,
      targetPercentage
    );

    await this.updateFlag(key, {
      rolloutPercentage: newPercentage
    });

    logger.info('Gradual rollout updated', {
      key,
      from: currentPercentage,
      to: newPercentage,
      target: targetPercentage
    });

    // Schedule next increment if not at target
    if (newPercentage < targetPercentage) {
      setTimeout(
        () => this.gradualRollout(key, targetPercentage, incrementPercentage, intervalMinutes),
        intervalMinutes * 60 * 1000
      );
    }
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagsService();
