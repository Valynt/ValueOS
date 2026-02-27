/**
 * Billing Feature Rollout Configuration
 *
 * Defines the gradual rollout stages for billing features.
 * Each stage enables a set of features at specified rollout percentages.
 *
 * Rollout order:
 *   1. usage_metering  — collect and aggregate usage data
 *   2. overage_charging — bill for usage beyond plan quotas
 *   3. approval_workflows — require approvals for plan changes
 *   4. invoice_generation — auto-generate invoices from rated ledger
 *
 * Usage:
 *   import { BILLING_ROLLOUT_STAGES, getBillingRolloutStage } from '@/config/billingRollout';
 */

export interface RolloutStage {
  name: string;
  description: string;
  flags: {
    key: string;
    dbKey: string;
    rolloutPercentage: number;
  }[];
  /** Prerequisites that must be at 100% before this stage starts */
  prerequisites: string[];
}

export const BILLING_ROLLOUT_STAGES: RolloutStage[] = [
  {
    name: 'stage-1-metering',
    description: 'Enable usage metering and aggregation pipeline',
    flags: [
      {
        key: 'ENABLE_BILLING_USAGE_METERING',
        dbKey: 'billing.usage_metering',
        rolloutPercentage: 10,
      },
    ],
    prerequisites: [],
  },
  {
    name: 'stage-2-overage',
    description: 'Enable overage detection and charging',
    flags: [
      {
        key: 'ENABLE_BILLING_USAGE_METERING',
        dbKey: 'billing.usage_metering',
        rolloutPercentage: 100,
      },
      {
        key: 'ENABLE_BILLING_OVERAGE_CHARGING',
        dbKey: 'billing.overage_charging',
        rolloutPercentage: 10,
      },
    ],
    prerequisites: ['billing.usage_metering'],
  },
  {
    name: 'stage-3-approvals',
    description: 'Enable approval workflows for plan changes',
    flags: [
      {
        key: 'ENABLE_BILLING_OVERAGE_CHARGING',
        dbKey: 'billing.overage_charging',
        rolloutPercentage: 100,
      },
      {
        key: 'ENABLE_BILLING_APPROVAL_WORKFLOWS',
        dbKey: 'billing.approval_workflows',
        rolloutPercentage: 10,
      },
    ],
    prerequisites: ['billing.usage_metering', 'billing.overage_charging'],
  },
  {
    name: 'stage-4-invoicing',
    description: 'Enable automated invoice generation',
    flags: [
      {
        key: 'ENABLE_BILLING_APPROVAL_WORKFLOWS',
        dbKey: 'billing.approval_workflows',
        rolloutPercentage: 100,
      },
      {
        key: 'ENABLE_BILLING_INVOICE_GENERATION',
        dbKey: 'billing.invoice_generation',
        rolloutPercentage: 10,
      },
    ],
    prerequisites: [
      'billing.usage_metering',
      'billing.overage_charging',
      'billing.approval_workflows',
    ],
  },
];

/**
 * Get the current rollout stage name based on which flags are enabled.
 * Returns the highest stage where all prerequisites are met.
 */
export function getBillingRolloutStage(
  enabledFlags: Record<string, boolean>
): string {
  let currentStage = 'pre-rollout';

  for (const stage of BILLING_ROLLOUT_STAGES) {
    const prerequisitesMet = stage.prerequisites.every(
      (prereq) => enabledFlags[prereq] === true
    );
    if (prerequisitesMet) {
      currentStage = stage.name;
    }
  }

  return currentStage;
}
