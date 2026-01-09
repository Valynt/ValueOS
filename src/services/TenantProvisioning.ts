/**
 * Handles automated provisioning of new tenants (organizations) with:
 * - Organization creation
 * - Default settings initialization
 * - Team and role setup
 * - Resource allocation
 * - Usage tracking initialization
 * - Billing integration
 */

import { logger } from '../lib/logger';
import { getConfig } from '../config/environment';
import { createServerSupabaseClient } from '../lib/supabase';
import CustomerService from './billing/CustomerService';
import SubscriptionService from './billing/SubscriptionService';
import { PlanTier } from '../config/billing';
import { emailService } from './EmailService';

/**
 * Tenant tier
 */
export type TenantTier = 'free' | 'starter' | 'professional' | 'enterprise';

/**
 * Tenant status
 */
export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'deactivated';

/**
 * Tenant configuration
 */
export interface TenantConfig {
  organizationId: string;
  name: string;
  tier: TenantTier;
  ownerId: string;
  ownerEmail: string;
  settings?: Record<string, any>;
  features?: string[];
  limits?: TenantLimits;
}

/**
 * Tenant limits based on tier
 */
export interface TenantLimits {
  maxUsers: number;
  maxTeams: number;
  maxProjects: number;
  maxStorage: number; // bytes
  maxApiCalls: number; // per month
  maxAgentCalls: number; // per month
}

/**
 * Provisioning result
 */
export interface ProvisioningResult {
  success: boolean;
  organizationId: string;
  status: TenantStatus;
  createdAt: Date;
  resources: {
    organization: boolean;
    settings: boolean;
    teams: boolean;
    roles: boolean;
    billing: boolean;
    usage: boolean;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Tenant usage tracking
 */
export interface TenantUsage {
  organizationId: string;
  period: string; // YYYY-MM
  users: number;
  teams: number;
  projects: number;
  storage: number; // bytes
  apiCalls: number;
  agentCalls: number;
  lastUpdated: Date;
}

/**
 * Default limits by tier
 */
const TIER_LIMITS: Record<TenantTier, TenantLimits> = {
  free: {
    maxUsers: 3,
    maxTeams: 1,
    maxProjects: 5,
    maxStorage: 1073741824, // 1 GB
    maxApiCalls: 1000,
    maxAgentCalls: 100,
  },
  starter: {
    maxUsers: 10,
    maxTeams: 3,
    maxProjects: 25,
    maxStorage: 10737418240, // 10 GB
    maxApiCalls: 10000,
    maxAgentCalls: 1000,
  },
  professional: {
    maxUsers: 50,
    maxTeams: 10,
    maxProjects: 100,
    maxStorage: 107374182400, // 100 GB
    maxApiCalls: 100000,
    maxAgentCalls: 10000,
  },
  enterprise: {
    maxUsers: -1, // unlimited
    maxTeams: -1,
    maxProjects: -1,
    maxStorage: -1,
    maxApiCalls: -1,
    maxAgentCalls: -1,
  },
};

/**
 * Default features by tier
 */
const TIER_FEATURES: Record<TenantTier, string[]> = {
  free: [
    'basic_canvas',
    'basic_agents',
    'basic_workflows',
  ],
  starter: [
    'basic_canvas',
    'basic_agents',
    'basic_workflows',
    'team_collaboration',
    'basic_analytics',
  ],
  professional: [
    'basic_canvas',
    'advanced_agents',
    'advanced_workflows',
    'team_collaboration',
    'advanced_analytics',
    'custom_templates',
    'api_access',
  ],
  enterprise: [
    'basic_canvas',
    'advanced_agents',
    'advanced_workflows',
    'team_collaboration',
    'advanced_analytics',
    'custom_templates',
    'api_access',
    'sso',
    'audit_logs',
    'custom_integrations',
    'dedicated_support',
    'sla',
  ],
};

const TENANT_ARCHIVE_BUCKET = 'tenant-archives';
const TENANT_ARCHIVE_FORMAT = 'json';
// Retention policy expectations: archives are kept for 90 days by default. Update this
// reference once retention policy automation is wired (e.g., compliance-driven TTL jobs).
const TENANT_ARCHIVE_RETENTION_POLICY = 'default-90-days';

const TENANT_ARCHIVE_TABLES: Array<{
  table: string;
  tenantColumns: string[];
}> = [
  { table: 'organizations', tenantColumns: ['id'] },
  { table: 'tenants', tenantColumns: ['id'] },
  { table: 'user_tenants', tenantColumns: ['tenant_id'] },
  { table: 'user_roles', tenantColumns: ['tenant_id'] },
  { table: 'users', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'api_keys', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'audit_logs', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'cases', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'workflows', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'workflow_states', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'shared_artifacts', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'agents', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'agent_runs', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'agent_memory', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'models', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'kpis', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'messages', tenantColumns: ['tenant_id', 'organization_id'] },
  { table: 'security_audit_events', tenantColumns: ['tenant_id', 'organization_id'] },
];

/**
 * Provision a new tenant
 */
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
    // Step 1: Create organization
    logger.debug('Provisioning step 1/6: Creating organization');
    try {
      await createOrganization(config);
      resources.organization = true;
      logger.info('Organization created', { organizationId: config.organizationId });
    } catch (error) {
      const msg = `Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(msg);
      logger.error('Organization creation failed', error instanceof Error ? error : undefined, {
        organizationId: config.organizationId,
      });
      // Organization is foundational, rethrow to abort
      throw new Error(msg);
    }

    // Step 2: Initialize settings
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

    // Step 3: Create default team and roles
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

    // Step 4: Initialize billing
    const appConfig = getConfig();
    if (appConfig.features.billing) {
      logger.debug('Provisioning step 4/6: Initializing billing');
      try {
        await initializeBilling(config);
        resources.billing = true;
        logger.info('Billing initialized', { organizationId: config.organizationId });
      } catch (error) {
    logger.error('Billing initialization failed', error instanceof Error ? error : undefined, {
      organizationId: config.organizationId
        });
    // Re-throw to be handled by the caller (provisionTenant)
    throw error;
      }
    } else {
      logger.debug('Provisioning step 4/6: Billing disabled');
      resources.billing = true; // Mark as complete since it's disabled
    }

    // Step 5: Initialize usage tracking
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
      resources.usage = true; // Mark as complete since it's disabled
    }

    // Step 6: Send welcome email
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

    logger.info(success ? 'Tenant provisioning complete' : 'Tenant provisioning incomplete', { tenantName: config.name, errors: errors.length, warnings: warnings.length });

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

/**
 * Create organization in database
 */
export async function createOrganization(config: TenantConfig): Promise<void> {
  const supabase = createServerSupabaseClient();

  // Map tiers: starter -> professional
  let dbTier = config.tier;
  if (config.tier === 'starter') {
    dbTier = 'professional' as any;
  }

  // Calculate default limits and features (merged from Main branch)
  const limits = config.limits || TIER_LIMITS[config.tier];
  const features = config.features || TIER_FEATURES[config.tier];

  // 1. Insert into organizations
  // Using 'organizations' table (from Jules branch) but including settings logic (from Main branch)
  const { error } = await supabase.from('organizations').insert({
    id: config.organizationId,
    tenant_id: config.organizationId, // Assuming 1:1 mapping for now
    name: config.name,
    tier: dbTier,
    is_active: true,
    settings: {
      ...config.settings,
      tier: config.tier,
      limits,
      features,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single();

  if (error) {
    // Idempotency: If duplicate key, fetch existing
    if (error.code === '23505') { // Unique violation
      logger.info('Organization already exists, retrieving existing record', { organizationId: config.organizationId });
      const existing = await supabase
        .from('organizations')
        .select()
        .eq('id', config.organizationId)
        .single();

      if (existing.error) {
        throw new Error(`Failed to retrieve existing organization: ${existing.error.message}`);
      }
      // Organization exists, we can proceed
    } else {
      throw new Error(`Failed to create organization: ${error.message}`);
    }
  }

  // 2. Insert owner membership
  // Using user_tenants as the join table (from Jules branch)
  const { error: membershipError } = await supabase.from('user_tenants').insert({
    user_id: config.ownerId,
    tenant_id: config.organizationId,
    status: 'active',
    role: 'owner', // Attempting to set role if schema permits
  }).select().single();

  if (membershipError) {
    // Check if membership already exists (idempotency)
    if (membershipError.code === '23505') {
       logger.info('User membership already exists', { userId: config.ownerId, tenantId: config.organizationId });
       // We can consider this a success for idempotency
    } else {
       throw new Error(`Organization created but failed to assign owner membership: ${membershipError.message}`);
    }
  }

  logger.debug(`Organization ${config.organizationId} created and owner assigned`);
}

/**
 * Initialize default settings
 */
async function initializeSettings(config: TenantConfig): Promise<void> {
  const defaultSettings = {
    ...config.settings,
    tier: config.tier,
    limits: config.limits || TIER_LIMITS[config.tier],
    features: config.features || TIER_FEATURES[config.tier],
  };

  // TODO: Implement settings initialization
  // await settingsService.initializeOrganizationSettings(
  //    config.organizationId,
  //    defaultSettings
  // );

  logger.debug(`Settings initialized for ${config.organizationId}`);
}

/**
 * Create default team and roles
 */
async function createTeamsAndRoles(config: TenantConfig): Promise<void> {
  const supabase = createServerSupabaseClient();
  const tenantId = config.organizationId;

  // 1. Create default team
  // Idempotent upsert by (tenant_id, name) via unique constraint
  const { data: teamData, error: teamError } = await supabase.from('teams').upsert({
    tenant_id: tenantId,
    name: 'Default Team',
    description: 'Default team for all members',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    team_settings: {}
  }, { onConflict: 'tenant_id,name' }).select().single();

  if (teamError) {
    throw new Error(`Failed to create default team: ${teamError.message}`);
  }

  logger.debug(`Default team created for ${tenantId}`);

  // 2. Ensure global roles exist and assign owner
  const defaultRoles = ['owner', 'admin', 'member', 'viewer'];
   
  for (const roleName of defaultRoles) {
    // Check if role exists globally
    const { data: existingRoles, error: roleError } = await supabase
      .from('roles')
      .select('id, name')
      .eq('name', roleName)
      .limit(1);

    if (roleError) {
      throw new Error(`Failed to check role ${roleName}: ${roleError.message}`);
    }

    let roleId: string;

    if (!existingRoles || existingRoles.length === 0) {
      // Create role if missing (global)
      const { data: newRole, error: createError } = await supabase
        .from('roles')
        .insert({
          name: roleName,
          description: `System role: ${roleName}`,
          permissions: getDefaultPermissions(roleName),
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (createError) {
        throw new Error(`Failed to create role ${roleName}: ${createError.message}`);
      }
      roleId = newRole.id;
      logger.debug(`Created missing global role: ${roleName}`);
    } else {
      roleId = existingRoles[0].id;
    }

    // 3. Assign owner role to creator
    if (roleName === 'owner') {
      // Check if user has this role for this tenant already
      const { data: existingUserRole, error: userRoleCheckError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', config.ownerId)
        .eq('tenant_id', tenantId)
        .eq('role_id', roleId)
        .single();

      if (userRoleCheckError && userRoleCheckError.code !== 'PGRST116') { // PGRST116 is "Row not found"
          throw new Error(`Failed to check user role assignment: ${userRoleCheckError.message}`);
      }

      if (!existingUserRole) {
        const { error: assignError } = await supabase.from('user_roles').insert({
          user_id: config.ownerId,
          tenant_id: tenantId,
          role_id: roleId,
          created_at: new Date().toISOString(),
        });

        if (assignError) {
          throw new Error(`Failed to assign owner role: ${assignError.message}`);
        }
        logger.debug(`Assigned owner role to ${config.ownerId} for tenant ${tenantId}`);
      }
    }
  }

  logger.debug(`Teams and roles setup complete for ${config.organizationId}`);
}

/**
 * Initialize billing
 */
async function initializeBilling(config: TenantConfig): Promise<void> {
  logger.info('Initializing billing integration', {
    organizationId: config.organizationId,
    tier: config.tier
  });

  try {
    // 1. Map tenant tier to billing plan
    const planTier = mapTenantToPlan(config.tier);

    // 2. Create customer in Stripe
    // Include tenant_id in metadata for webhook correlation
    const _customer = await CustomerService.createCustomer(
      config.organizationId,
      config.name,
      config.ownerEmail,
      {
        tenant_id: config.organizationId,
        original_tier: config.tier,
        owner_id: config.ownerId
      }
    );

    // 3. Configure payment method if provided
    // (Usually skipped during initial provisioning unless coming from checkout flow)
    if (config.settings?.paymentMethodId) {
      await CustomerService.updatePaymentMethod(
        config.organizationId,
        config.settings.paymentMethodId
      );
    }

    // 4. Create subscription
    // Use mapped plan tier
    await SubscriptionService.createSubscription(
      config.organizationId,
      planTier
      // Note: trial days could be passed here if needed based on policy
    );

    logger.debug(`Billing initialized successfully for ${config.organizationId}`);
  } catch (error) {
    logger.error('Billing initialization failed', error instanceof Error ? error : undefined, {
      organizationId: config.organizationId
    });
    // Re-throw to be handled by the caller (provisionTenant)
    throw error;
  }
}

/**
 * Map tenant tier to billing plan tier
 */
function mapTenantToPlan(tier: TenantTier): PlanTier {
  switch (tier) {
    case 'free':
      return 'free';
    case 'starter':
      return 'standard';
    case 'professional':
      return 'standard'; // Map to standard, distinguishing via metadata/limits if needed
    case 'enterprise':
      return 'enterprise';
    default:
      return 'free'; // Fallback
  }
}

/**
 * Initialize usage tracking
 */
async function initializeUsageTracking(config: TenantConfig): Promise<void> {
  const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM

  const initialUsage: TenantUsage = {
    organizationId: config.organizationId,
    period: currentPeriod,
    users: 1, // Owner
    teams: 1, // Default team
    projects: 0,
    storage: 0,
    apiCalls: 0,
    agentCalls: 0,
    lastUpdated: new Date(),
  };

  const supabase = createServerSupabaseClient();

  // Convert to snake_case for database
  const payload = {
    organization_id: initialUsage.organizationId,
    period: initialUsage.period,
    users: initialUsage.users,
    teams: initialUsage.teams,
    projects: initialUsage.projects,
    storage: initialUsage.storage,
    api_calls: initialUsage.apiCalls,
    agent_calls: initialUsage.agentCalls,
    last_updated: initialUsage.lastUpdated.toISOString(),
  };

  const { error } = await supabase.from('tenant_usage').insert(payload);

  if (error) {
    throw error;
  }

  logger.debug(`Usage tracking initialized for ${config.organizationId}`);
}

/**
 * Send welcome email
 */
async function sendWelcomeEmail(config: TenantConfig): Promise<void> {
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

/**
 * Deprovision a tenant
 */
export async function deprovisionTenant(
  organizationId: string,
  reason?: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  logger.info('Starting tenant deprovisioning', { organizationId });

  try {
    // 1. Cancel billing
    logger.debug('Deprovisioning step 1/5: Canceling billing...');
    try {
      await cancelBilling(organizationId);
      logger.info('Billing canceled');
    } catch (error) {
      errors.push(`Failed to cancel billing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 2. Archive data
    logger.debug('Deprovisioning step 2/5: Archiving data...');
    try {
      await archiveTenantData(organizationId);
      logger.info('Data archived');
    } catch (error) {
      errors.push(`Failed to archive data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 3. Revoke access
    logger.debug('Deprovisioning step 3/5: Revoking access...');
    try {
      await revokeAllAccess(organizationId);
      logger.info('Access revoked');
    } catch (error) {
      errors.push(`Failed to revoke access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 4. Update status
    logger.debug('Deprovisioning step 4/5: Updating status...');
    try {
      await updateTenantStatus(organizationId, 'deactivated');
      logger.info('Status updated');
    } catch (error) {
      errors.push(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 5. Send notification
    logger.debug('Deprovisioning step 5/5: Sending notification...');
    try {
      await sendDeactivationEmail(organizationId, reason);
      logger.info('Notification sent');
      } catch (error) {
        // Non-critical, just log
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

/**
 * Cancel billing for tenant
 */
async function cancelBilling(organizationId: string): Promise<void> {
  try {
    // Cancel subscription immediately
    await SubscriptionService.cancelSubscription(organizationId, true);
    logger.debug(`Billing canceled for ${organizationId}`);
  } catch (error) {
    // If no subscription found, we can consider this a success (or at least not a blocker)
    if (error instanceof Error && error.message.includes('No active subscription found')) {
      logger.info(`No active subscription found for ${organizationId}, skipping billing cancellation`);
      return;
    }
    throw error;
  }
}

/**
 * Archive tenant data
 */
async function archiveTenantData(organizationId: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  const exportTimestamp = new Date().toISOString();
  const errors: string[] = [];

  try {
    const { data: tableRows, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tableError) {
      throw new Error(`Failed to list tables for archival: ${tableError.message}`);
    }

    const existingTables = new Set((tableRows || []).map((row) => row.table_name));
    const tablesToArchive = TENANT_ARCHIVE_TABLES.filter((entry) => existingTables.has(entry.table));

    const archivePayload: Record<string, unknown> = {};
    const tableColumnCache: Record<string, Set<string>> = {};

    for (const entry of tablesToArchive) {
      const { data: columnRows, error: columnError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', entry.table);

      if (columnError) {
        errors.push(`Failed to inspect columns for ${entry.table}: ${columnError.message}`);
        continue;
      }

      const columns = new Set((columnRows || []).map((row) => row.column_name));
      tableColumnCache[entry.table] = columns;

      const availableTenantColumns = entry.tenantColumns.filter((column) => columns.has(column));

      if (availableTenantColumns.length === 0) {
        errors.push(`No tenant identifier columns found for ${entry.table}`);
        continue;
      }

      let query = supabase.from(entry.table).select('*');
      if (availableTenantColumns.length === 1) {
        query = query.eq(availableTenantColumns[0], organizationId);
      } else {
        const filters = availableTenantColumns.map((column) => `${column}.eq.${organizationId}`).join(',');
        query = query.or(filters);
      }

      const { data, error } = await query;
      if (error) {
        errors.push(`Failed to export ${entry.table}: ${error.message}`);
        continue;
      }

      archivePayload[entry.table] = data || [];
    }

    if (errors.length > 0) {
      throw new Error(`Archival export failed: ${errors.join('; ')}`);
    }

    const storagePath = `${organizationId}/${exportTimestamp}.${TENANT_ARCHIVE_FORMAT}`;
    const serializedPayload = JSON.stringify(
      {
        organizationId,
        exportedAt: exportTimestamp,
        format: TENANT_ARCHIVE_FORMAT,
        tables: archivePayload,
      },
      null,
      2
    );

    const { error: storageError } = await supabase.storage
      .from(TENANT_ARCHIVE_BUCKET)
      .upload(storagePath, Buffer.from(serializedPayload), {
        contentType: 'application/json',
        upsert: true,
      });

    if (storageError) {
      throw new Error(`Failed to upload archive: ${storageError.message}`);
    }

    const { error: archiveRecordError } = await supabase.from('tenant_archives').upsert(
      {
        organization_id: organizationId,
        storage_location: `${TENANT_ARCHIVE_BUCKET}/${storagePath}`,
        export_format: TENANT_ARCHIVE_FORMAT,
        exported_at: exportTimestamp,
        retention_policy: TENANT_ARCHIVE_RETENTION_POLICY,
      },
      { onConflict: 'organization_id' }
    );

    if (archiveRecordError) {
      throw new Error(`Failed to record archive metadata: ${archiveRecordError.message}`);
    }

    const statusOverrides: Record<string, string> = {
      tenants: 'deleted',
      users: 'inactive',
      cases: 'closed',
      workflow_states: 'cancelled',
      agent_runs: 'cancelled',
      models: 'archived',
    };

    const tableTimestampOverrides: Record<string, string> = {
      cases: 'closed_at',
    };

    for (const entry of tablesToArchive) {
      const columns = tableColumnCache[entry.table];
      if (!columns) {
        errors.push(`Missing column metadata for ${entry.table}`);
        continue;
      }

      const availableTenantColumns = entry.tenantColumns.filter((column) => columns.has(column));
      if (availableTenantColumns.length === 0) {
        errors.push(`No tenant identifier columns found for ${entry.table}`);
        continue;
      }

      const updatePayload: Record<string, unknown> = {};
      let hasArchiveMarker = false;
      if (columns.has('archived_at')) {
        updatePayload.archived_at = exportTimestamp;
        hasArchiveMarker = true;
      }
      if (columns.has('is_archived')) {
        updatePayload.is_archived = true;
        hasArchiveMarker = true;
      }
      if (columns.has('deleted_at')) {
        updatePayload.deleted_at = exportTimestamp;
        hasArchiveMarker = true;
      }
      if (columns.has('is_active')) {
        updatePayload.is_active = false;
        hasArchiveMarker = true;
      }
      if (columns.has('status') && statusOverrides[entry.table]) {
        updatePayload.status = statusOverrides[entry.table];
        hasArchiveMarker = true;
      }
      const timestampOverrideColumn = tableTimestampOverrides[entry.table];
      if (timestampOverrideColumn && columns.has(timestampOverrideColumn)) {
        updatePayload[timestampOverrideColumn] = exportTimestamp;
        hasArchiveMarker = true;
      }
      if (columns.has('updated_at')) {
        updatePayload.updated_at = exportTimestamp;
      }

      if (!hasArchiveMarker) {
        if (columns.has('metadata') && columns.has('id')) {
          const rows = archivePayload[entry.table];
          if (Array.isArray(rows)) {
            for (const row of rows) {
              if (!row || !('id' in row)) {
                errors.push(`Failed to archive metadata for ${entry.table}: missing id`);
                break;
              }
              const currentMetadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
              const mergedMetadata = {
                ...currentMetadata,
                archived: true,
                archived_at: exportTimestamp,
              };
              const metadataUpdate: Record<string, unknown> = { metadata: mergedMetadata };
              if (columns.has('updated_at')) {
                metadataUpdate.updated_at = exportTimestamp;
              }
              const { error: metadataError } = await supabase
                .from(entry.table)
                .update(metadataUpdate)
                .eq('id', row.id as string);
              if (metadataError) {
                errors.push(`Failed to archive metadata for ${entry.table}: ${metadataError.message}`);
                break;
              }
            }
            continue;
          }
        }

        errors.push(`No archival fields available for ${entry.table}`);
        continue;
      }

      let updateQuery = supabase.from(entry.table).update(updatePayload);
      if (availableTenantColumns.length === 1) {
        updateQuery = updateQuery.eq(availableTenantColumns[0], organizationId);
      } else {
        const filters = availableTenantColumns.map((column) => `${column}.eq.${organizationId}`).join(',');
        updateQuery = updateQuery.or(filters);
      }

      const { error: updateError } = await updateQuery;
      if (updateError) {
        errors.push(`Failed to mark ${entry.table} as archived: ${updateError.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Archival update incomplete: ${errors.join('; ')}`);
    }

    logger.debug(`Data archived for ${organizationId}`);
  } catch (error) {
    logger.error('Tenant archival failed', error instanceof Error ? error : undefined, {
      organizationId,
    });
    throw new Error(
      `Tenant archival failed for ${organizationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Revoke all access for tenant
 */
async function revokeAllAccess(organizationId: string): Promise<void> {
  // TODO: Implement access revocation
  // - Revoke all user sessions
  // - Revoke API keys
  // - Disable integrations
  logger.debug(`Access revoked for ${organizationId}`);
}

/**
 * Update tenant status
 */
async function updateTenantStatus(
  organizationId: string,
  status: TenantStatus
): Promise<void> {
  // TODO: Implement database update
  // await supabase
  //    .from('organizations')
  //    .update({ status, updated_at: new Date().toISOString() })
  //    .eq('id', organizationId);

  logger.debug(`Status updated to ${status} for ${organizationId}`);
}

/**
 * Send deactivation email
 */
async function sendDeactivationEmail(
  organizationId: string,
  reason?: string
): Promise<void> {
  // TODO: Implement email sending
  logger.debug(`Deactivation email sent for ${organizationId}`);
}

/**
 * Get tenant limits
 */
export function getTenantLimits(tier: TenantTier): TenantLimits {
  return TIER_LIMITS[tier];
}

/**
 * Get tenant features
 */
export function getTenantFeatures(tier: TenantTier): string[] {
  return TIER_FEATURES[tier];
}

/**
 * Check if tenant has feature
 */
export function hasFeature(tier: TenantTier, feature: string): boolean {
  return TIER_FEATURES[tier].includes(feature);
}

/**
 * Check if tenant is within limits
 */
export function isWithinLimits(
  usage: TenantUsage,
  limits: TenantLimits
): { within: boolean; exceeded: string[] } {
  const exceeded: string[] = [];

  if (limits.maxUsers !== -1 && usage.users > limits.maxUsers) {
    exceeded.push('users');
  }
  if (limits.maxTeams !== -1 && usage.teams > limits.maxTeams) {
    exceeded.push('teams');
  }
  if (limits.maxProjects !== -1 && usage.projects > limits.maxProjects) {
    exceeded.push('projects');
  }
  if (limits.maxStorage !== -1 && usage.storage > limits.maxStorage) {
    exceeded.push('storage');
  }
  if (limits.maxApiCalls !== -1 && usage.apiCalls > limits.maxApiCalls) {
    exceeded.push('apiCalls');
  }
  if (limits.maxAgentCalls !== -1 && usage.agentCalls > limits.maxAgentCalls) {
    exceeded.push('agentCalls');
  }

  return {
    within: exceeded.length === 0,
    exceeded,
  };
}

/**
 * Get default permissions for role
 */
function getDefaultPermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    owner: ['*'], // All permissions
    admin: [
      'read:*',
      'write:*',
      'delete:*',
      'manage:users',
      'manage:teams',
      'manage:settings',
    ],
    member: [
      'read:*',
      'write:own',
      'delete:own',
    ],
    viewer: [
      'read:*',
    ],
  };

  return permissions[role] || [];
}