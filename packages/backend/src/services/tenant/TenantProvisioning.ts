/**
 * Thin tenant provisioning facade that preserves the public API while
 * delegating cohesive responsibilities to sibling modules.
 */

import { logger } from '../../lib/logger.js';
import { getConfig } from '../config/environment.js';

export { getTenantFeatures, getTenantLimits, hasFeature, isWithinLimits, TIER_FEATURES, TIER_LIMITS } from './TenantLimits.js';
export type {
  ProvisioningResult,
  TenantConfig,
  TenantLimits,
  TenantStatus,
  TenantTier,
  TenantUsage,
} from './TenantProvisioningTypes.js';

import {
  cancelBilling,
  initializeBilling,
  mapTenantToPlan,
} from './TenantBillingProvisioning.js';
import {
  archiveTenantData,
  revokeAllAccess,
  updateTenantStatus,
} from './TenantArchivalService.js';
import {
  createOrganization,
  createTeamsAndRoles,
  initializeSettings,
} from './TenantOrganizationProvisioning.js';
import {
  getTenantOwner,
  sendDeactivationEmail,
  sendWelcomeEmail,
} from './TenantProvisioningEmail.js';
import type {
  ProvisioningResult,
  TenantConfig,
  TenantStatus,
} from './TenantProvisioningTypes.js';
import { initializeUsageTracking } from './TenantUsageProvisioning.js';

export {
  archiveTenantData,
  cancelBilling,
  createOrganization,
  createTeamsAndRoles,
  getTenantOwner,
  initializeBilling,
  initializeSettings,
  initializeUsageTracking,
  mapTenantToPlan,
  revokeAllAccess,
  sendDeactivationEmail,
  sendWelcomeEmail,
  updateTenantStatus,
};

export async function provisionTenant(
  config: TenantConfig
): Promise<ProvisioningResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resources = {
    organization: false,
    settings: false,
    teams: false,
    roles: false,
    billing: false,
    usage: false,
  };

  logger.info('Starting tenant provisioning', {
    tenantName: config.name,
    tier: config.tier,
    organizationId: config.organizationId,
  });

  try {
    logger.debug('Provisioning step 1/6: Creating organization');
    try {
      const provisionedOrganizationId = await createOrganization(config);
      config.organizationId = provisionedOrganizationId;
      resources.organization = true;
      logger.info('Organization created', { organizationId: provisionedOrganizationId });
    } catch (error) {
      const msg = `Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(msg);
      logger.error('Organization creation failed', error instanceof Error ? error : undefined, {
        organizationId: config.organizationId,
      });
      throw new Error(msg);
    }

    logger.debug('Provisioning step 2/6: Initializing settings');
    try {
      await initializeSettings(config);
      resources.settings = true;
      logger.info('Settings initialized', { organizationId: config.organizationId });
    } catch (error) {
      const msg = `Failed to initialize settings: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(msg);
      logger.error('Settings initialization failed', error instanceof Error ? error : undefined, {
        organizationId: config.organizationId,
      });
    }

    logger.debug('Provisioning step 3/6: Creating teams and roles');
    try {
      await createTeamsAndRoles(config);
      resources.teams = true;
      resources.roles = true;
      logger.info('Teams and roles created', { organizationId: config.organizationId });
    } catch (error) {
      const msg = `Failed to create teams/roles: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(msg);
      logger.error('Teams/roles creation failed', error instanceof Error ? error : undefined, {
        organizationId: config.organizationId,
      });
    }

    const appConfig = getConfig();
    if (appConfig.features.billing) {
      logger.debug('Provisioning step 4/6: Initializing billing');
      try {
        await initializeBilling(config);
        resources.billing = true;
        logger.info('Billing initialized', { organizationId: config.organizationId });
      } catch (error) {
        logger.error('Billing initialization failed', error instanceof Error ? error : undefined, {
          organizationId: config.organizationId,
        });
        throw error;
      }
    } else {
      logger.debug('Provisioning step 4/6: Billing disabled');
      resources.billing = true;
    }

    if (appConfig.features.usageTracking) {
      logger.debug('Provisioning step 5/6: Initializing usage tracking');
      try {
        await initializeUsageTracking(config);
        resources.usage = true;
        logger.info('Usage tracking initialized', { organizationId: config.organizationId });
      } catch (error) {
        const msg = `Failed to initialize usage tracking: ${error instanceof Error ? error.message : 'Unknown error'}`;
        warnings.push(msg);
        logger.warn('Usage tracking initialization failed', {
          organizationId: config.organizationId,
        });
      }
    } else {
      logger.debug('Provisioning step 5/6: Usage tracking disabled');
      resources.usage = true;
    }

    logger.debug('Provisioning step 6/6: Sending welcome email');
    try {
      await sendWelcomeEmail(config);
      logger.info('Welcome email sent', { organizationId: config.organizationId });
    } catch (error) {
      const msg = `Failed to send welcome email: ${error instanceof Error ? error.message : 'Unknown error'}`;
      warnings.push(msg);
      logger.warn('Welcome email failed', {
        organizationId: config.organizationId,
      });
    }

    const success = errors.length === 0;
    const status: TenantStatus = success ? 'active' : 'provisioning';

    logger.info(success ? 'Tenant provisioning complete' : 'Tenant provisioning incomplete', {
      tenantName: config.name,
      errors: errors.length,
      warnings: warnings.length,
    });

    return {
      success,
      organizationId: config.organizationId,
      status,
      createdAt: new Date(),
      resources,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Fatal provisioning error: ${error instanceof Error ? error.message : 'Unknown error'}`);

    return {
      success: false,
      organizationId: config.organizationId,
      status: 'provisioning',
      createdAt: new Date(),
      resources,
      errors,
      warnings,
    };
  }
}

export async function deprovisionTenant(
  organizationId: string,
  reason?: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  logger.info('Starting tenant deprovisioning', { organizationId });

  try {
    logger.debug('Deprovisioning step 1/5: Canceling billing...');
    try {
      await cancelBilling(organizationId);
      logger.info('Billing canceled');
    } catch (error) {
      errors.push(`Failed to cancel billing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    logger.debug('Deprovisioning step 2/5: Archiving data...');
    try {
      await archiveTenantData(organizationId);
      logger.info('Data archived');
    } catch (error) {
      errors.push(`Failed to archive data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    logger.debug('Deprovisioning step 3/5: Revoking access...');
    try {
      await revokeAllAccess(organizationId);
      logger.info('Access revoked');
    } catch (error) {
      errors.push(`Failed to revoke access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    logger.debug('Deprovisioning step 4/5: Updating status...');
    try {
      await updateTenantStatus(organizationId, 'deactivated');
      logger.info('Status updated');
    } catch (error) {
      errors.push(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    logger.debug('Deprovisioning step 5/5: Sending notification...');
    try {
      await sendDeactivationEmail(organizationId, reason);
      logger.info('Notification sent');
    } catch (error) {
      logger.warn(`Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Fatal deprovisioning error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      errors,
    };
  }
}
