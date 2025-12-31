/**
 * Billing Configuration
 * 
 * Defines plans, quotas, pricing, and Stripe product/price mappings
 */

const env = typeof import.meta !== 'undefined' ? (import.meta as any).env ?? {} : process.env ?? {};

const getEnv = (key: string, defaultValue: string = '') => (env[key] ?? defaultValue) as string;

export type BillingMetric = 'llm_tokens' | 'agent_executions' | 'api_calls' | 'storage_gb' | 'user_seats';
export type PlanTier = 'free' | 'standard' | 'enterprise';

/**
 * Plan configuration
 */
export interface PlanConfig {
  tier: PlanTier;
  name: string;
  description: string;
  price: number;  // Monthly price in USD
  billingPeriod: 'monthly' | 'yearly';
  
  // Quotas per metric (included in plan)
  quotas: Record<BillingMetric, number>;
  
  // Hard caps (enforce strictly)
  hardCaps: Record<BillingMetric, boolean>;
  
  // Overage rates (per unit after quota)
  overageRates: Record<BillingMetric, number>;
  
  // Features
  features: string[];
  
  // Stripe price IDs (update after running stripe-products-setup.sh)
  stripePriceIds?: Partial<Record<BillingMetric, string>>;
}

/**
 * Plan definitions
 */
export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    name: 'Free',
    description: 'Perfect for trying out ValueCanvas',
    price: 0,
    billingPeriod: 'monthly',
    
    quotas: {
      llm_tokens: 10_000,              // 10K tokens
      agent_executions: 100,           // 100 executions
      api_calls: 1_000,                // 1K API calls
      storage_gb: 1,                   // 1 GB storage
      user_seats: 3,                   // 3 users
    },
    
    hardCaps: {
      llm_tokens: false,               // Soft cap (warn then block)
      agent_executions: false,
      api_calls: false,
      storage_gb: true,                // Hard cap
      user_seats: true,                // Hard cap
    },
    
    overageRates: {
      llm_tokens: 0,                   // No overage allowed
      agent_executions: 0,
      api_calls: 0,
      storage_gb: 0,
      user_seats: 0,
    },
    
    features: [
      'Up to 3 users',
      '10K LLM tokens/month',
      '100 agent executions/month',
      '1,000 API calls/month',
      '1 GB storage',
      'Email support',
      'Community access',
    ],
    
    // Update these IDs after running stripe-products-setup.sh
    stripePriceIds: {
      llm_tokens: getEnv('STRIPE_PRICE_LLM_TOKENS_FREE'),
      agent_executions: getEnv('STRIPE_PRICE_AGENT_EXECUTIONS_FREE'),
      api_calls: getEnv('STRIPE_PRICE_API_CALLS_FREE'),
      storage_gb: getEnv('STRIPE_PRICE_STORAGE_FREE'),
      user_seats: getEnv('STRIPE_PRICE_USER_SEATS_FREE'),
    },
  },
  
  standard: {
    tier: 'standard',
    name: 'Standard',
    description: 'For growing teams and projects',
    price: 99,
    billingPeriod: 'monthly',
    
    quotas: {
      llm_tokens: 1_000_000,           // 1M tokens
      agent_executions: 5_000,         // 5K executions
      api_calls: 100_000,              // 100K API calls
      storage_gb: 100,                 // 100 GB storage
      user_seats: 25,                  // 25 users
    },
    
    hardCaps: {
      llm_tokens: false,               // Allow overage
      agent_executions: false,
      api_calls: false,
      storage_gb: false,
      user_seats: false,
    },
    
    overageRates: {
      llm_tokens: 0.00001,             // $0.01 per 1K tokens
      agent_executions: 0.10,          // $0.10 per execution
      api_calls: 0.001,                // $0.001 per call
      storage_gb: 0.50,                // $0.50 per GB
      user_seats: 5.00,                // $5 per user
    },
    
    features: [
      'Up to 25 users',
      '1M LLM tokens/month + overage',
      '5K agent executions/month + overage',
      '100K API calls/month + overage',
      '100 GB storage + overage',
      'Priority support',
      'SSO integration',
      'Advanced analytics',
      'Custom workflows',
    ],
    
    stripePriceIds: {
      llm_tokens: getEnv('STRIPE_PRICE_LLM_TOKENS_STANDARD'),
      agent_executions: getEnv('STRIPE_PRICE_AGENT_EXECUTIONS_STANDARD'),
      api_calls: getEnv('STRIPE_PRICE_API_CALLS_STANDARD'),
      storage_gb: getEnv('STRIPE_PRICE_STORAGE_STANDARD'),
      user_seats: getEnv('STRIPE_PRICE_USER_SEATS_STANDARD'),
    },
  },
  
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    price: 499,
    billingPeriod: 'monthly',
    
    quotas: {
      llm_tokens: 10_000_000,          // 10M tokens
      agent_executions: 50_000,        // 50K executions
      api_calls: 1_000_000,            // 1M API calls
      storage_gb: 1_000,               // 1 TB storage
      user_seats: -1,                  // Unlimited
    },
    
    hardCaps: {
      llm_tokens: false,
      agent_executions: false,
      api_calls: false,
      storage_gb: false,
      user_seats: false,
    },
    
    overageRates: {
      llm_tokens: 0.000005,            // $0.005 per 1K tokens (50% discount)
      agent_executions: 0.05,          // $0.05 per execution
      api_calls: 0.0005,               // $0.0005 per call
      storage_gb: 0.25,                // $0.25 per GB
      user_seats: 0,                   // Unlimited, no charge
    },
    
    features: [
      'Unlimited users',
      '10M LLM tokens/month + discounted overage',
      '50K agent executions/month + discounted overage',
      '1M API calls/month + discounted overage',
      '1 TB storage + discounted overage',
      '24/7 dedicated support',
      'SSO & SCIM provisioning',
      'Advanced security features',
      'Custom SLA',
      'On-premise deployment option',
      'White-label capabilities',
      'Dedicated account manager',
    ],
    
    stripePriceIds: {
      llm_tokens: getEnv('STRIPE_PRICE_LLM_TOKENS_ENTERPRISE'),
      agent_executions: getEnv('STRIPE_PRICE_AGENT_EXECUTIONS_ENTERPRISE'),
      api_calls: getEnv('STRIPE_PRICE_API_CALLS_ENTERPRISE'),
      storage_gb: getEnv('STRIPE_PRICE_STORAGE_ENTERPRISE'),
      user_seats: getEnv('STRIPE_PRICE_USER_SEATS_ENTERPRISE'),
    },
  },
};

/**
 * Stripe configuration
 */
export const STRIPE_CONFIG = {
  secretKey: getEnv('STRIPE_SECRET_KEY'),
  publishableKey: getEnv('VITE_STRIPE_PUBLISHABLE_KEY'),
  webhookSecret: getEnv('STRIPE_WEBHOOK_SECRET'),
  apiVersion: '2023-10-16' as const,
};

/**
 * Usage alert thresholds (percentage of quota)
 */
export const USAGE_ALERT_THRESHOLDS = {
  warning: 80,      // Warn at 80% usage
  critical: 100,    // Critical at 100% usage
  exceeded: 120,    // Exceeded threshold
};

/**
 * Grace period after hitting quota (milliseconds)
 */
export const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;  // 24 hours

/**
 * Usage cache TTL (seconds)
 */
export const USAGE_CACHE_TTL = 60;  // 1 minute

/**
 * Aggregation interval (milliseconds)
 */
export const AGGREGATION_INTERVAL_MS = 60 * 1000;  // 1 minute

/**
 * Stripe submission interval (milliseconds)
 */
export const STRIPE_SUBMISSION_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes

/**
 * Get plan by tier
 */
export function getPlan(tier: PlanTier): PlanConfig {
  return PLANS[tier];
}

/**
 * Get quota for metric in plan
 */
export function getQuota(tier: PlanTier, metric: BillingMetric): number {
  return PLANS[tier].quotas[metric];
}

/**
 * Check if metric has hard cap
 */
export function isHardCap(tier: PlanTier, metric: BillingMetric): boolean {
  return PLANS[tier].hardCaps[metric];
}

/**
 * Get overage rate
 */
export function getOverageRate(tier: PlanTier, metric: BillingMetric): number {
  return PLANS[tier].overageRates[metric];
}

/**
 * Calculate overage cost
 */
export function calculateOverageCost(
  tier: PlanTier,
  metric: BillingMetric,
  usage: number
): number {
  const quota = getQuota(tier, metric);
  const overageAmount = Math.max(0, usage - quota);
  const rate = getOverageRate(tier, metric);
  
  return overageAmount * rate;
}

/**
 * Calculate total monthly cost
 */
export function calculateMonthlyCost(
  tier: PlanTier,
  usage: Record<BillingMetric, number>
): {
  baseCost: number;
  overageCosts: Record<BillingMetric, number>;
  totalOverage: number;
  totalCost: number;
} {
  const plan = getPlan(tier);
  const baseCost = plan.price;
  
  const overageCosts: Record<BillingMetric, number> = {
    llm_tokens: calculateOverageCost(tier, 'llm_tokens', usage.llm_tokens),
    agent_executions: calculateOverageCost(tier, 'agent_executions', usage.agent_executions),
    api_calls: calculateOverageCost(tier, 'api_calls', usage.api_calls),
    storage_gb: calculateOverageCost(tier, 'storage_gb', usage.storage_gb),
    user_seats: calculateOverageCost(tier, 'user_seats', usage.user_seats),
  };
  
  const totalOverage = Object.values(overageCosts).reduce((sum, cost) => sum + cost, 0);
  const totalCost = baseCost + totalOverage;
  
  return {
    baseCost,
    overageCosts,
    totalOverage,
    totalCost,
  };
}

/**
 * Format metric name for display
 */
export function formatMetricName(metric: BillingMetric): string {
  const names: Record<BillingMetric, string> = {
    llm_tokens: 'LLM Tokens',
    agent_executions: 'Agent Executions',
    api_calls: 'API Calls',
    storage_gb: 'Storage',
    user_seats: 'User Seats',
  };
  
  return names[metric];
}

/**
 * Format usage amount with units
 */
export function formatUsageAmount(metric: BillingMetric, amount: number): string {
  const formats: Record<BillingMetric, (n: number) => string> = {
    llm_tokens: (n) => `${n.toLocaleString()} tokens`,
    agent_executions: (n) => `${n.toLocaleString()} executions`,
    api_calls: (n) => `${n.toLocaleString()} calls`,
    storage_gb: (n) => `${n.toFixed(2)} GB`,
    user_seats: (n) => `${n} seats`,
  };
  
  return formats[metric](amount);
}

export default {
  PLANS,
  STRIPE_CONFIG,
  USAGE_ALERT_THRESHOLDS,
  GRACE_PERIOD_MS,
  USAGE_CACHE_TTL,
  AGGREGATION_INTERVAL_MS,
  STRIPE_SUBMISSION_INTERVAL_MS,
  getPlan,
  getQuota,
  isHardCap,
  getOverageRate,
  calculateOverageCost,
  calculateMonthlyCost,
  formatMetricName,
  formatUsageAmount,
};
