/**
 * Admin Configuration API Endpoints
 *
 * Provides REST API for managing organization configurations
 * Requires tenant_admin or vendor_admin access
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConfigurationManager } from '@/lib/configuration/ConfigurationManager';
import { OrganizationSettingsManager } from '@/lib/configuration/managers/OrganizationSettingsManager';
import { IAMConfigurationManager } from '@/lib/configuration/managers/IAMConfigurationManager';
import { AIOrchestrationManager } from '@/lib/configuration/managers/AIOrchestrationManager';
import { OperationalSettingsManager } from '@/lib/configuration/managers/OperationalSettingsManager';
import { SecurityGovernanceManager } from '@/lib/configuration/managers/SecurityGovernanceManager';
import { BillingUsageManager } from '@/lib/configuration/managers/BillingUsageManager';
import { createClient } from '@/lib/supabase/server';
import type { ConfigurationAccessLevel } from '@/lib/configuration/types/settings-matrix';
import { z } from 'zod';

// Simple logger for API routes
const logger = {
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', message, ...meta }));
  }
};

// Initialize managers
const configManager = new ConfigurationManager();
const orgManager = new OrganizationSettingsManager(configManager);
const iamManager = new IAMConfigurationManager(configManager);
const aiManager = new AIOrchestrationManager(configManager);
const opsManager = new OperationalSettingsManager(configManager);
const securityManager = new SecurityGovernanceManager(configManager);
const billingManager = new BillingUsageManager(configManager);

type SupabaseUserRecord = {
  id: string;
  role: string;
  organization_id: string | null;
};

type ConfigurationScope = {
  type: 'tenant';
  tenantId: string;
};

const configurationCategorySchema = z.enum([
  'organization',
  'iam',
  'ai',
  'operational',
  'security',
  'billing'
]);

const updateRequestSchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  category: configurationCategorySchema,
  setting: z.string().min(1, 'setting is required'),
  value: z.unknown()
});

/**
 * Verify user has admin access
 */
async function verifyAdminAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<{ authorized: boolean; accessLevel: ConfigurationAccessLevel; userId: string }> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { authorized: false, accessLevel: 'tenant_admin', userId: '' };
  }

  // Check if user is vendor admin
  const { data: userData, error: roleError } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single<SupabaseUserRecord>();

  if (roleError || !userData) {
    return { authorized: false, accessLevel: 'tenant_admin', userId: user.id };
  }

  if (userData.role === 'vendor_admin') {
    return { authorized: true, accessLevel: 'vendor_admin', userId: user.id };
  }

  // Check if user is tenant admin for this organization
  if (userData.role === 'tenant_admin' && userData.organization_id === organizationId) {
    return { authorized: true, accessLevel: 'tenant_admin', userId: user.id };
  }

  return { authorized: false, accessLevel: 'tenant_admin', userId: user.id };
}

/**
 * GET /api/admin/configurations
 * Get all configurations for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const { authorized } = await verifyAdminAccess(supabase, organizationId);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all configurations
    const [
      organizationSettings,
      iamSettings,
      aiSettings,
      operationalSettings,
      securitySettings,
      billingSettings
    ] = await Promise.all([
      orgManager.getAllOrganizationSettings(organizationId),
      iamManager.getAllIAMSettings(organizationId),
      aiManager.getAllAISettings(organizationId),
      opsManager.getAllOperationalSettings(organizationId),
      securityManager.getAllSecuritySettings(organizationId),
      billingManager.getAllBillingSettings(organizationId)
    ]);

    return NextResponse.json({
      organizationId,
      configurations: {
        organization: organizationSettings,
        iam: iamSettings,
        ai: aiSettings,
        operational: operationalSettings,
        security: securitySettings,
        billing: billingSettings
      }
    });
  } catch (error) {
    logger.error('Error fetching configurations', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/configurations
 * Update a specific configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const parseResult = updateRequestSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message ?? 'Invalid request payload' },
        { status: 400 }
      );
    }
    const { organizationId, category, setting, value } = parseResult.data;

    const { authorized, accessLevel } = await verifyAdminAccess(supabase, organizationId);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const scope: ConfigurationScope = { type: 'tenant', tenantId: organizationId };
    let result;

    // Route to appropriate manager based on category
    switch (category) {
      case 'organization':
        result = await handleOrganizationUpdate(setting, value, scope, accessLevel);
        break;
      case 'iam':
        result = await handleIAMUpdate(setting, value, scope, accessLevel);
        break;
      case 'ai':
        result = await handleAIUpdate(setting, value, scope, accessLevel);
        break;
      case 'operational':
        result = await handleOperationalUpdate(setting, value, scope, accessLevel);
        break;
      case 'security':
        result = await handleSecurityUpdate(setting, value, scope, accessLevel);
        break;
      case 'billing':
        result = await handleBillingUpdate(setting, value, scope, accessLevel);
        break;
      default:
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error updating configuration', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/configurations/cache
 * Clear configuration cache for an organization
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const { authorized } = await verifyAdminAccess(supabase, organizationId);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Clear all caches
    await Promise.all([
      orgManager.clearCache(organizationId),
      iamManager.clearCache(organizationId),
      aiManager.clearCache(organizationId),
      opsManager.clearCache(organizationId),
      securityManager.clearCache(organizationId),
      billingManager.clearCache(organizationId)
    ]);

    return NextResponse.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    logger.error('Error clearing cache', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

// Helper functions for updating specific categories

async function handleOrganizationUpdate(
  setting: string,
  value: unknown,
  scope: ConfigurationScope,
  accessLevel: ConfigurationAccessLevel
) {
  switch (setting) {
    case 'tenant_provisioning':
      return orgManager.updateTenantProvisioning(scope, value, accessLevel);
    case 'custom_branding':
      return orgManager.updateCustomBranding(scope, value, accessLevel);
    case 'data_residency':
      return orgManager.updateDataResidency(scope, value, accessLevel);
    case 'domain_management':
      return orgManager.updateDomainManagement(scope, value, accessLevel);
    case 'namespace_isolation':
      return orgManager.updateNamespaceIsolation(scope, value, accessLevel);
    default:
      throw new Error(`Unknown organization setting: ${setting}`);
  }
}

async function handleIAMUpdate(
  setting: string,
  value: unknown,
  scope: ConfigurationScope,
  accessLevel: ConfigurationAccessLevel
) {
  switch (setting) {
    case 'auth_policy':
      return iamManager.updateAuthPolicy(scope, value, accessLevel);
    case 'sso_config':
      return iamManager.updateSSOConfig(scope, value, accessLevel);
    case 'session_control':
      return iamManager.updateSessionControl(scope, value, accessLevel);
    case 'ip_whitelist':
      return iamManager.updateIPWhitelist(scope, value, accessLevel);
    default:
      throw new Error(`Unknown IAM setting: ${setting}`);
  }
}

async function handleAIUpdate(
  setting: string,
  value: unknown,
  scope: ConfigurationScope,
  accessLevel: ConfigurationAccessLevel
) {
  switch (setting) {
    case 'llm_spending_limits':
      return aiManager.updateLLMSpendingLimits(scope, value, accessLevel);
    case 'model_routing':
      return aiManager.updateModelRouting(scope, value, accessLevel);
    case 'agent_toggles':
      return aiManager.updateAgentToggles(scope, value, accessLevel);
    case 'hitl_thresholds':
      return aiManager.updateHITLThresholds(scope, value, accessLevel);
    case 'ground_truth_sync':
      return aiManager.updateGroundTruthSync(scope, value, accessLevel);
    case 'formula_versioning':
      return aiManager.updateFormulaVersioning(scope, value, accessLevel);
    default:
      throw new Error(`Unknown AI setting: ${setting}`);
  }
}

async function handleOperationalUpdate(
  setting: string,
  value: unknown,
  scope: ConfigurationScope,
  accessLevel: ConfigurationAccessLevel
) {
  switch (setting) {
    case 'feature_flags':
      return opsManager.updateFeatureFlags(scope, value, accessLevel);
    case 'rate_limiting':
      return opsManager.updateRateLimiting(scope, value, accessLevel);
    case 'observability':
      return opsManager.updateObservability(scope, value, accessLevel);
    case 'cache_management':
      return opsManager.updateCacheManagement(scope, value, accessLevel);
    case 'webhooks':
      return opsManager.updateWebhooks(scope, value, accessLevel);
    default:
      throw new Error(`Unknown operational setting: ${setting}`);
  }
}

async function handleSecurityUpdate(
  setting: string,
  value: unknown,
  scope: ConfigurationScope,
  accessLevel: ConfigurationAccessLevel
) {
  switch (setting) {
    case 'audit_integrity':
      return securityManager.updateAuditIntegrity(scope, value, accessLevel);
    case 'retention_policies':
      return securityManager.updateRetentionPolicies(scope, value, accessLevel);
    case 'manifesto_strictness':
      return securityManager.updateManifestoStrictness(scope, value, accessLevel);
    case 'secret_rotation':
      return securityManager.updateSecretRotation(scope, value, accessLevel);
    case 'rls_monitoring':
      return securityManager.updateRLSMonitoring(scope, value, accessLevel);
    default:
      throw new Error(`Unknown security setting: ${setting}`);
  }
}

async function handleBillingUpdate(
  setting: string,
  value: unknown,
  scope: ConfigurationScope,
  accessLevel: ConfigurationAccessLevel
) {
  switch (setting) {
    case 'token_dashboard':
      return billingManager.updateTokenDashboard(scope, value, accessLevel);
    case 'value_metering':
      return billingManager.updateValueMetering(scope, value, accessLevel);
    case 'subscription_plan':
      return billingManager.updateSubscriptionPlan(scope, value, accessLevel);
    case 'invoicing':
      return billingManager.updateInvoicing(scope, value, accessLevel);
    default:
      throw new Error(`Unknown billing setting: ${setting}`);
  }
}
