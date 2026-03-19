import { logger } from '../../lib/logger.js';
import { createServerSupabaseClient } from '../../lib/supabase.js';
import { getConfig } from '../config/environment.js';

import { emailService } from './EmailService.js';
import { TIER_FEATURES, TIER_LIMITS } from './TenantLimits.js';
import type { TenantConfig } from './TenantProvisioningTypes.js';

export async function sendWelcomeEmail(config: TenantConfig): Promise<void> {
  const appConfig = getConfig();

  if (!appConfig.email.enabled) {
    logger.debug('    Email disabled, skipping welcome email');
    return;
  }

  await emailService.send({
    to: config.ownerEmail,
    subject: `Welcome to ValueCanvas - ${config.name}`,
    template: 'welcome',
    data: {
      organizationName: config.name,
      tier: config.tier,
      features: TIER_FEATURES[config.tier],
      limits: TIER_LIMITS[config.tier],
    },
  });

  logger.debug(`Welcome email sent to ${config.ownerEmail}`);
}

export async function sendDeactivationEmail(
  organizationId: string,
  reason?: string
): Promise<void> {
  const appConfig = getConfig();
  if (!appConfig.email.enabled) {
    logger.debug('    Email disabled, skipping deactivation email');
    return;
  }

  const supabase = createServerSupabaseClient();
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single();

  if (orgError || !organization) {
    logger.warn(`Failed to fetch organization details for email: ${orgError?.message || 'Not found'}`);
    return;
  }

  const owner = await getTenantOwner(organizationId);
  if (!owner) {
    logger.warn(`Failed to fetch owner email for deactivation notification. Organization: ${organizationId}`);
    return;
  }

  await emailService.send({
    to: owner.email,
    subject: `Account Deactivation - ${organization.name}`,
    template: 'deactivation',
    data: {
      organizationName: organization.name,
      reason,
    },
  });

  logger.debug(`Deactivation email sent for ${organizationId} to ${owner.email}`);
}

export async function getTenantOwner(
  tenantId: string
): Promise<{ userId: string; email: string } | null> {
  const supabase = createServerSupabaseClient();
  const { data: ownerMemberships, error: memberError } = await supabase
    .from('user_tenants')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .limit(1);

  if (memberError) {
    logger.warn(`Error querying tenant owner: ${memberError.message}`, { tenantId });
    return null;
  }

  if (!ownerMemberships || ownerMemberships.length === 0) {
    return null;
  }

  const userId = ownerMemberships[0].user_id;
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (userError) {
    logger.warn(`Error querying owner user details: ${userError.message}`, { userId });
    return null;
  }

  if (!user || !user.email) {
    return null;
  }

  return {
    userId,
    email: user.email,
  };
}
