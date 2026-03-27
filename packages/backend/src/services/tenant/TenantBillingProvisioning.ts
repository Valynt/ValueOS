import { logger } from '../../lib/logger.js';
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from '../../lib/supabase.js';
import { PLANS, PlanTier } from '../config/billing.js';

import * as customerServiceModule from '../billing/CustomerService.js';
import * as subscriptionServiceModule from '../billing/SubscriptionService.js';
import type { TenantConfig, TenantTier } from './TenantProvisioningTypes.js';


const resolveCustomerService = () =>
  ('customerService' in customerServiceModule
    ? (customerServiceModule as unknown as { customerService: { createCustomer: Function; updatePaymentMethod: Function } }).customerService
    : (customerServiceModule as unknown as { default: { createCustomer: Function; updatePaymentMethod: Function } }).default);

const resolveSubscriptionService = () =>
  ('subscriptionService' in subscriptionServiceModule
    ? (subscriptionServiceModule as unknown as { subscriptionService: { createSubscription: Function; cancelSubscription: Function } }).subscriptionService
    : (subscriptionServiceModule as unknown as { default: { createSubscription: Function; cancelSubscription: Function } }).default);


export async function initializeBilling(config: TenantConfig): Promise<void> {
  const supabase = createServerSupabaseClient();

  logger.info('Initializing billing integration', {
    organizationId: config.organizationId,
    tier: config.tier,
  });

  try {
    const planTier = mapTenantToPlan(config.tier);

    const CustomerService = resolveCustomerService();
    const SubscriptionService = resolveSubscriptionService();

    await CustomerService.createCustomer(
      config.organizationId,
      config.name,
      config.ownerEmail,
      {
        tenant_id: config.organizationId,
        original_tier: config.tier,
        owner_id: config.ownerId,
      }
    );

    if (config.settings?.paymentMethodId) {
      await CustomerService.updatePaymentMethod(
        config.organizationId,
        config.settings.paymentMethodId
      );
    }

    const subscription = await SubscriptionService.createSubscription(
      config.organizationId,
      planTier
    );

    const subscriptionRecord = subscription as unknown as {
      stripe_customer_id: string;
      stripe_subscription_id: string;
      status: string;
    };
    const requestKey = config.provisioningRequestKey || `tenant-provision-${config.organizationId}-${Date.now()}`;

    const { data: provisioningData, error: provisioningError } = await supabase.rpc(
      'tenant_provisioning_workflow',
      {
        p_tenant_id: config.organizationId,
        p_organization_name: config.name,
        p_owner_user_id: config.ownerId,
        p_selected_tier: planTier,
        p_stripe_customer_id: subscriptionRecord.stripe_customer_id,
        p_stripe_subscription_id: subscriptionRecord.stripe_subscription_id,
        p_subscription_status: subscriptionRecord.status,
        p_subscription_billing_period: PLANS[planTier].billingPeriod,
        p_subscription_amount: PLANS[planTier].price,
        p_subscription_currency: 'usd',
        p_request_key: requestKey,
      }
    );

    if (provisioningError) {
      throw new Error(`Failed tenant provisioning billing workflow: ${provisioningError.message}`);
    }

    logger.info('Tenant provisioning workflow pinned billing price version', {
      organizationId: config.organizationId,
      subscriptionId: provisioningData?.subscription_id,
      priceVersionId: provisioningData?.price_version_id,
      entitlementSnapshotId: provisioningData?.entitlement_snapshot_id,
      requestKey,
    });

    logger.debug(`Billing initialized successfully for ${config.organizationId}`);
  } catch (error) {
    logger.error('Billing initialization failed', error instanceof Error ? error : undefined, {
      organizationId: config.organizationId,
    });
    throw error;
  }
}

export function mapTenantToPlan(tier: TenantTier): PlanTier {
  switch (tier) {
    case 'free':
      return 'free';
    case 'starter':
      return 'standard';
    case 'professional':
      return 'standard';
    case 'enterprise':
      return 'enterprise';
    default:
      return 'free';
  }
}

export async function cancelBilling(organizationId: string): Promise<void> {
  try {
    const SubscriptionService = resolveSubscriptionService();
    await SubscriptionService.cancelSubscription(organizationId, true);
    logger.debug(`Billing canceled for ${organizationId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('No active subscription found')) {
      logger.info(`No active subscription found for ${organizationId}, skipping billing cancellation`);
      return;
    }
    throw error;
  }
}
