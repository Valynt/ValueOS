// Migrated from apps/ValyntApp/src/services/FeatureFlags.ts
// and packages/backend/src/services/FeatureFlags.ts (identical logic, import paths differed).
// Canonical location: packages/core-services/src/FeatureFlags.ts

import crypto from 'crypto';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targeting: {
    userIds?: string[];
    tiers?: ('free' | 'basic' | 'pro' | 'enterprise')[];
    countries?: string[];
    customRules?: Record<string, unknown>;
  };
  variants?: {
    name: string;
    weight: number;
    config: Record<string, unknown>;
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
  config?: Record<string, unknown>;
  reason: string;
}

export class FeatureFlagsService {
  private supabase: SupabaseClient;
  private cache: Map<string, FeatureFlag> = new Map();
  private readonly CACHE_TTL = 60 * 1000;
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient ?? createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? ''
    );
    // Only start the background refresh when a real client is provided.
    // The module-level singleton skips this to avoid leaking timers in tests.
    if (supabaseClient) {
      this.refreshTimer = setInterval(() => this.refreshCache(), this.CACHE_TTL);
    }
  }

  /** Stop the background cache refresh. Call in tests and on server shutdown. */
  destroy(): void {
    if (this.refreshTimer !== undefined) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  async createFlag(data: {
    key: string;
    name: string;
    description: string;
    enabled?: boolean;
    rolloutPercentage?: number;
    targeting?: FeatureFlag['targeting'];
    variants?: FeatureFlag['variants'];
    metadata: { owner: string; tags: string[] };
  }): Promise<FeatureFlag> {
    const flag: Omit<FeatureFlag, 'id'> = {
      key: data.key,
      name: data.name,
      description: data.description,
      enabled: data.enabled ?? false,
      rolloutPercentage: data.rolloutPercentage ?? 0,
      targeting: data.targeting ?? {},
      variants: data.variants,
      metadata: { ...data.metadata, createdAt: new Date(), updatedAt: new Date() },
    };

    const { data: created, error } = await this.supabase
      .from('feature_flags')
      .insert(flag)
      .select()
      .single();

    if (error) throw error;
    this.cache.delete(data.key);
    return created;
  }

  async getFlag(key: string): Promise<FeatureFlag | null> {
    if (this.cache.has(key)) return this.cache.get(key)!;

    const { data, error } = await this.supabase
      .from('feature_flags')
      .select('*')
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    this.cache.set(key, data);
    return data;
  }

  async updateFlag(
    key: string,
    updates: Partial<Omit<FeatureFlag, 'id' | 'key' | 'metadata'>>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('feature_flags')
      .update({ ...updates, 'metadata.updatedAt': new Date() })
      .eq('key', key);

    if (error) throw error;
    this.cache.delete(key);
  }

  async deleteFlag(key: string): Promise<void> {
    const { error } = await this.supabase.from('feature_flags').delete().eq('key', key);
    if (error) throw error;
    this.cache.delete(key);
  }

  async listFlags(): Promise<FeatureFlag[]> {
    const { data, error } = await this.supabase
      .from('feature_flags')
      .select('*')
      .order('key');
    if (error) throw error;
    return data ?? [];
  }

  async isEnabled(
    key: string,
    context: {
      userId: string;
      userTier?: 'free' | 'basic' | 'pro' | 'enterprise';
      country?: string;
      customAttributes?: Record<string, unknown>;
    }
  ): Promise<FeatureFlagEvaluation> {
    const flag = await this.getFlag(key);
    if (!flag) return { enabled: false, reason: 'Flag not found' };
    if (!flag.enabled) return { enabled: false, reason: 'Flag disabled' };

    const targetingResult = this.evaluateTargeting(flag, context);
    if (!targetingResult.enabled) return targetingResult;

    const rolloutResult = this.evaluateRollout(flag, context.userId);
    if (!rolloutResult.enabled) return rolloutResult;

    if (flag.variants && flag.variants.length > 0) {
      const variant = this.selectVariant(flag, context.userId);
      return { enabled: true, variant: variant.name, config: variant.config, reason: 'Enabled with variant' };
    }

    return { enabled: true, reason: 'Enabled' };
  }

  private evaluateTargeting(
    flag: FeatureFlag,
    context: { userId: string; userTier?: string; country?: string; customAttributes?: Record<string, unknown> }
  ): FeatureFlagEvaluation {
    const { targeting } = flag;

    if (targeting.userIds?.length && !targeting.userIds.includes(context.userId)) {
      return { enabled: false, reason: 'User not in whitelist' };
    }
    if (targeting.tiers?.length && (!context.userTier || !(targeting.tiers as string[]).includes(context.userTier))) {
      return { enabled: false, reason: 'User tier not targeted' };
    }
    if (targeting.countries?.length && (!context.country || !targeting.countries.includes(context.country))) {
      return { enabled: false, reason: 'Country not targeted' };
    }
    if (targeting.customRules) {
      const attrs = context.customAttributes ?? {};
      for (const [k, v] of Object.entries(targeting.customRules)) {
        if (attrs[k] !== v) return { enabled: false, reason: 'Custom rules not met' };
      }
    }

    return { enabled: true, reason: 'Targeting rules passed' };
  }

  private evaluateRollout(flag: FeatureFlag, userId: string): FeatureFlagEvaluation {
    if (flag.rolloutPercentage >= 100) return { enabled: true, reason: 'Full rollout' };
    if (flag.rolloutPercentage <= 0) return { enabled: false, reason: 'Zero rollout' };

    const hash = crypto.createHash('md5').update(userId + flag.key).digest('hex');
    const bucket = parseInt(hash.substring(0, 8), 16) % 100;

    return bucket < flag.rolloutPercentage
      ? { enabled: true, reason: `Rollout bucket ${bucket} < ${flag.rolloutPercentage}%` }
      : { enabled: false, reason: `Rollout bucket ${bucket} >= ${flag.rolloutPercentage}%` };
  }

  private selectVariant(flag: FeatureFlag, userId: string): NonNullable<FeatureFlag['variants']>[0] {
    if (!flag.variants?.length) throw new Error('No variants configured');

    const hash = crypto.createHash('md5').update(userId + flag.key + 'variant').digest('hex');
    const selection = parseInt(hash.substring(0, 8), 16) % 100;

    let cumulative = 0;
    for (const variant of flag.variants) {
      cumulative += variant.weight;
      if (selection < cumulative) return variant;
    }
    return flag.variants[0];
  }

  async getVariant(
    key: string,
    context: { userId: string; userTier?: 'free' | 'basic' | 'pro' | 'enterprise'; country?: string; customAttributes?: Record<string, unknown> }
  ): Promise<{ variant: string | null; config: Record<string, unknown> | null }> {
    const evaluation = await this.isEnabled(key, context);
    if (!evaluation.enabled) return { variant: null, config: null };
    return { variant: evaluation.variant ?? null, config: evaluation.config ?? null };
  }

  async trackEvaluation(key: string, userId: string, enabled: boolean, variant?: string): Promise<void> {
    await this.supabase.from('feature_flag_evaluations').insert({
      flag_key: key,
      user_id: userId,
      enabled,
      variant,
      evaluated_at: new Date(),
    });
  }

  async getAnalytics(key: string, days = 7): Promise<{
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
    if (!data?.length) return { totalEvaluations: 0, enabledCount: 0, enabledPercentage: 0 };

    const totalEvaluations = data.length;
    const enabledCount = data.filter(e => e.enabled).length;
    const enabledPercentage = (enabledCount / totalEvaluations) * 100;

    const variantDistribution: Record<string, number> = {};
    data.forEach(e => {
      if (e.variant) variantDistribution[e.variant] = (variantDistribution[e.variant] ?? 0) + 1;
    });

    return {
      totalEvaluations,
      enabledCount,
      enabledPercentage,
      variantDistribution: Object.keys(variantDistribution).length > 0 ? variantDistribution : undefined,
    };
  }

  private async refreshCache(): Promise<void> {
    try {
      const flags = await this.listFlags();
      this.cache.clear();
      flags.forEach(flag => this.cache.set(flag.key, flag));
    } catch {
      // Cache refresh failure is non-fatal
    }
  }

  async gradualRollout(key: string, targetPercentage: number, incrementPercentage = 10, intervalMinutes = 60): Promise<void> {
    const flag = await this.getFlag(key);
    if (!flag) throw new Error('Flag not found');

    const newPercentage = Math.min(flag.rolloutPercentage + incrementPercentage, targetPercentage);
    await this.updateFlag(key, { rolloutPercentage: newPercentage });

    if (newPercentage < targetPercentage) {
      setTimeout(() => this.gradualRollout(key, targetPercentage, incrementPercentage, intervalMinutes), intervalMinutes * 60 * 1000);
    }
  }
}

export const featureFlags = new FeatureFlagsService();
